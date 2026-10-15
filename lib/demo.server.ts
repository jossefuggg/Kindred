// Idempotent demo-data setup for the three demo accounts (service role, server only).
const C = (n: number) => `00000000-0000-0000-0000-00000000c00${n}`;
const A = (n: number) => `00000000-0000-0000-0000-00000000a00${n}`;

const TITLES: Record<string, string> = {
  [A(1)]: "Safeguarding Basics",
  [A(2)]: "Food Safety L1",
  [A(3)]: "First Aid Awareness",
  [A(4)]: "Manual Handling",
  [A(5)]: "Data Privacy for Volunteers",
};
const ISSUER: Record<string, string> = {
  [A(1)]: "Northside Hospice",
  [A(2)]: "City Food Bank",
  [A(3)]: "Harbor Red Relief",
  [A(4)]: "Shelter Together",
  [A(5)]: "Youth Code Mentors",
};

export type DemoWho = "maya" | "alex" | "foodbank";

export async function ensureDemoData(who: DemoWho, userId: string, name: string) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

  const role = who === "foodbank" ? "charity_admin" : "volunteer";
  await db.from("user_roles").upsert({ user_id: userId, role }, { onConflict: "user_id,role" });

  if (who === "foodbank") {
    await db.from("profiles").update({ display_name: name, city: "City Centre", onboarded: true, headline: "Volunteer coordinator" }).eq("id", userId);
    await db.from("charities").update({ created_by: userId }).eq("id", C(2));
    return;
  }

  const profile =
    who === "maya"
      ? {
          headline: "Weekend helper · loves feeding people",
          city: "City Centre",
          bio: "Product designer by day. I want my Saturdays to count.",
          causes: ["Food", "Housing"],
          skills: ["Cooking", "Organising", "Spanish"],
          availability: { Saturday: { morning: true, afternoon: true }, Sunday: { morning: true }, Wednesday: { evening: true } },
        }
      : {
          headline: "Paramedic in training · 120+ volunteer hours",
          city: "Riverside",
          bio: "Happiest outdoors or where things get busy.",
          causes: ["Disaster response", "Health", "Environment"],
          skills: ["First aid", "Driving", "Team lead"],
          availability: { Saturday: { morning: true, afternoon: true, evening: true }, Tuesday: { evening: true }, Thursday: { evening: true }, Friday: { afternoon: true, evening: true } },
        };
  await db.from("profiles").update({ ...profile, display_name: name, onboarded: true }).eq("id", userId);

  const courses = who === "maya" ? [A(1)] : [A(1), A(2), A(3), A(4)];
  for (const c of courses) {
    await db.from("certificates").upsert(
      {
        user_id: userId,
        course_id: c,
        holder_name: name,
        course_title: TITLES[c]!,
        issuer_name: ISSUER[c]!,
        issued_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * (20 + courses.indexOf(c) * 9)).toISOString(),
      },
      { onConflict: "user_id,course_id", ignoreDuplicates: true },
    );
  }

  await db
    .from("applications")
    .upsert(
      who === "maya"
        ? [{ charity_id: C(6), volunteer_id: userId, status: "accepted", message: "Happy to help on weekends." }]
        : [
            { charity_id: C(1), volunteer_id: userId, status: "accepted", message: "First-aid trained." },
            { charity_id: C(3), volunteer_id: userId, status: "pending", message: "Available Tuesdays." },
            { charity_id: C(2), volunteer_id: userId, status: "pending", message: "Food Safety certified, free most Saturdays." },
          ],
      { onConflict: "charity_id,volunteer_id", ignoreDuplicates: true },
    );

  const { count } = await db.from("endorsements").select("id", { count: "exact", head: true }).eq("volunteer_id", userId);
  if (!count) {
    await db.from("endorsements").insert(
      who === "alex"
        ? [
            { charity_id: C(1), volunteer_id: userId, author_name: "Sam Whitlock", shift_title: "Emergency kit packing", body: "Calm under pressure. Alex led our storm-response team brilliantly." },
            { charity_id: C(4), volunteer_id: userId, author_name: "Rosa Lindqvist", shift_title: "Spring planting day", body: "Always first to arrive and last to leave. A natural organiser." },
          ]
        : [
            { charity_id: C(6), volunteer_id: userId, author_name: "Dev Patel", shift_title: "Soup kitchen", body: "Warm, reliable and wonderful with our guests." },
          ],
    );
  }

  // Past attended shifts → hours on the profile
  const { data: past } = await db.from("shifts").select("id").lt("starts_at", new Date().toISOString()).order("starts_at").range(who === "alex" ? 0 : 3, who === "alex" ? 2 : 5);
  const rows = (past ?? []).map((p) => ({ shift_id: p.id, user_id: userId, attended: true, hours: 3 }));
  if (rows.length) await db.from("bookings").upsert(rows, { onConflict: "shift_id,user_id", ignoreDuplicates: true });
}

export async function resetDemo(onlyUserId?: string) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data: users } = await db.auth.admin.listUsers({ perPage: 200 });
  const demo = (users?.users ?? []).filter((u) => u.email?.endsWith("@demo.kindred.app") && (!onlyUserId || u.id === onlyUserId));
  for (const u of demo) {
    const { data: bookings } = await db.from("bookings").select("id, shift_id").eq("user_id", u.id);
    for (const b of bookings ?? []) {
      const { data: s } = await db.from("shifts").select("spots_left, spots_total").eq("id", b.shift_id).single();
      if (s) await db.from("shifts").update({ spots_left: Math.min(s.spots_total, s.spots_left + 1) }).eq("id", b.shift_id);
    }
    await db.from("bookings").delete().eq("user_id", u.id);
    await db.from("chat_messages").delete().eq("user_id", u.id);
    await db.from("lesson_progress").delete().eq("user_id", u.id);
    await db.from("certificates").delete().eq("user_id", u.id);
    await db.from("applications").delete().eq("volunteer_id", u.id);
    await db.from("endorsements").delete().eq("volunteer_id", u.id);
    const who = u.email!.split("@")[0] as DemoWho;
    await ensureDemoData(who, u.id, (u.user_metadata?.["display_name"] as string) ?? who);
  }
  // Remove welcome messages left without a booking
  await db.from("chat_messages").delete().is("user_id", null).eq("pinned", false);
  return demo.length;
}
