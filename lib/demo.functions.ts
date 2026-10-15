import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DEMO_USERS = {
  maya: { email: "maya@demo.kindred.app", name: "Maya Okafor" },
  alex: { email: "alex@demo.kindred.app", name: "Alex Rivera" },
  foodbank: { email: "foodbank@demo.kindred.app", name: "Priya Shah" },
} as const;

const Input = z.object({ who: z.enum(["maya", "alex", "foodbank"]) }).strict();
const UNAVAILABLE = "Demo sign-in is unavailable right now.";

/** One-click demo sign-in. Creates the demo account + its sample data on first use. */
export const demoSignIn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const { rateLimit, RateLimitError } = await import("./rate-limit.server");
    const ip = getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for") ?? "unknown";
    try {
      await rateLimit("demo_signin", ip, 60, 300);
    } catch (e) {
      if (e instanceof RateLimitError) return { error: e.message };
      throw e;
    }

    const password = process.env["DEMO_PASSWORD"];
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!password || !url || !key) return { error: UNAVAILABLE };

    const demo = DEMO_USERS[data.who];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const pub = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    let res = await pub.auth.signInWithPassword({ email: demo.email, password });
    if (res.error) {
      const created = await supabaseAdmin.auth.admin.createUser({
        email: demo.email,
        password,
        email_confirm: true,
        user_metadata: { display_name: demo.name },
      });
      if (created.error) {
        console.error("demo create failed", created.error.message);
        return { error: UNAVAILABLE };
      }
      res = await pub.auth.signInWithPassword({ email: demo.email, password });
    }
    if (res.error || !res.data.session) return { error: UNAVAILABLE };

    const { ensureDemoData } = await import("./demo.server");
    await ensureDemoData(data.who, res.data.session.user.id, demo.name);

    return { access_token: res.data.session.access_token, refresh_token: res.data.session.refresh_token };
  });

/** Admins reset every demo account; a demo account can reset itself. */
export const resetDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    const email = (context.claims as { email?: string }).email ?? "";
    const isDemo = email.endsWith("@demo.kindred.app");
    if (!isAdmin && !isDemo) throw new Error("Not found");
    const { resetDemo } = await import("./demo.server");
    const n = await resetDemo(isAdmin ? undefined : context.userId);
    return { reset: n };
  });

/** Admin only: summary for the console (user count). */
export const adminSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Not found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin.from("profiles").select("id", { count: "exact", head: true });
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const { data: people } = await supabaseAdmin.from("profiles").select("id, display_name, city, created_at").order("created_at", { ascending: false }).limit(50);
    return {
      userCount: count ?? 0,
      users: (people ?? []).map((p) => ({ ...p, roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role) })),
    };
  });

/** Demo accounts only: correct quiz answers so the live demo takes seconds. */
export const demoQuizAnswers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ courseId: z.string().uuid() }).strict().parse(d))
  .handler(async ({ data, context }) => {
    const email = (context.claims as { email?: string }).email ?? "";
    if (!email.endsWith("@demo.kindred.app")) return { answers: [] as number[] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: qs } = await supabaseAdmin.from("quiz_questions").select("answer_index").eq("course_id", data.courseId).order("position");
    return { answers: (qs ?? []).map((q) => q.answer_index) };
  });
