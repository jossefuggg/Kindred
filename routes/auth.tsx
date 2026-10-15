import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Building2, Loader2, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { demoSignIn } from "@/lib/demo.functions";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/app-shell";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · Kindred" },
      { name: "description", content: "Sign in to Kindred, or try the demo as Maya or City Food Bank." },
      { property: "og:title", content: "Sign in · Kindred" },
      { property: "og:description", content: "Volunteer once. Qualify everywhere." },
    ],
  }),
  component: AuthPage,
});

const Creds = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8, "Use at least 8 characters").max(128),
});

function AuthPage() {
  const navigate = useNavigate();
  const demo = useServerFn(demoSignIn);
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/explore", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Creds.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check your details.");
      return;
    }
    setBusy("form");
    if (mode === "in") {
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
      const { error } = await supabase.auth.signInWithPassword(parsed.data);
      setBusy(null);
      if (error) {
        toast.error("Email or password is incorrect.");
        return;
      }
      navigate({ to: "/explore" });
    } else {
      const { error } = await supabase.auth.signUp({
        ...parsed.data,
        options: { emailRedirectTo: window.location.origin + "/explore" },
      });
      setBusy(null);
      if (error) {
        toast.error("We couldn't create that account. Try a different password.");
        return;
      }
      toast.success("Check your email to confirm your account.");
    }
  }

  async function google() {
    setBusy("google");
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) {
      setBusy(null);
      toast.error("Google sign-in didn't work. Try again.");
      return;
    }
    if (r.redirected) return;
    navigate({ to: "/explore" });
  }

  async function tryAs(who: "maya" | "alex" | "foodbank") {
    setBusy(who);
    try {
      // Clear any stale/revoked session left on this device first.
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
      const res = await demo({ data: { who } });
      if ("error" in res && res.error) throw new Error(res.error);
      if (!("access_token" in res) || !res.access_token || !res.refresh_token)
        throw new Error("Demo sign-in is unavailable right now.");
      const { error } = await supabase.auth.setSession({
        access_token: res.access_token,
        refresh_token: res.refresh_token,
      });
      if (error) throw error;
      navigate({ to: "/explore" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Demo sign-in is unavailable right now.");
      setBusy(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <div className="flex items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <ThemeToggle />
      </div>
      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md animate-fade-rise">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-text">
            {mode === "in" ? "Welcome back" : "Join Kindred"}
          </h1>
          <p className="mt-2 text-text-2">Volunteer once. Qualify everywhere.</p>

          <div className="mt-8 rounded-xl border border-border bg-surface p-6 shadow-md">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-3">Try the demo</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <Button variant="soft" onClick={() => tryAs("maya")} disabled={!!busy}>
                {busy === "maya" ? <Loader2 className="animate-spin" /> : <User />} Maya
              </Button>
              <Button variant="soft" onClick={() => tryAs("alex")} disabled={!!busy}>
                {busy === "alex" ? <Loader2 className="animate-spin" /> : <User />} Alex
              </Button>
              <Button variant="soft" onClick={() => tryAs("foodbank")} disabled={!!busy}>
                {busy === "foodbank" ? <Loader2 className="animate-spin" /> : <Building2 />} Food Bank
              </Button>
            </div>

            <div className="my-6 flex items-center gap-3 text-xs text-text-3">
              <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
            </div>

            <Button variant="secondary" className="w-full" onClick={google} disabled={!!busy}>
              {busy === "google" && <Loader2 className="animate-spin" />} Continue with Google
            </Button>

            <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "in" ? "current-password" : "new-password"}
                  minLength={8}
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={!!busy}>
                {busy === "form" && <Loader2 className="animate-spin" />}
                {mode === "in" ? "Sign in" : "Create account"}
              </Button>
            </form>
          </div>

          <p className="mt-6 text-center text-sm text-text-2">
            {mode === "in" ? "New here?" : "Already have an account?"}{" "}
            <button className="font-semibold text-brand hover:underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>
              {mode === "in" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
