import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { Award, BookOpen, CalendarCheck, Check, Clock, Inbox, MessagesSquare, Plus, RotateCcw, Users, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StandardPage, WidePage, Section } from "@/components/layout/page";
import { ChartCard, Empty, KpiRow, StatTile } from "@/components/layout/blocks";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { coursesQuery, myCertsQuery, myCharityQuery } from "@/lib/data";
import { shiftWhen, hrs, pct } from "@/lib/format";
import { resetDemoData } from "@/lib/demo.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · Kindred" }, { name: "description", content: "Your applications, training and shifts." }] }),
  component: Dashboard,
});

const STATUS: Record<string, string> = {
  pending: "bg-warning-soft text-text",
  accepted: "bg-sage-soft text-forest",
  declined: "bg-danger-soft text-danger",
};

function Dashboard() {
  const { hasRole, ready, roles } = useAuth();
  if (!ready || roles.length === 0) return <div className="mx-auto max-w-5xl p-6"><Skeleton className="h-64 rounded-xl" /></div>;
  return hasRole("charity_admin") ? <CharityDashboard /> : <VolunteerDashboard />;
}

function DemoReset() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const reset = useServerFn(resetDemoData);
  if (!user?.email?.endsWith("@demo.kindred.app")) return null;
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        await reset();
        await qc.invalidateQueries();
        toast.success("Demo data restored");
      }}
    >
      <RotateCcw /> Reset demo
    </Button>
  );
}

function VolunteerDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const certs = useQuery(myCertsQuery(user?.id));
  const apps = useQuery({
    queryKey: ["my-apps", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("applications").select("id, status, created_at, charities(id, name)").eq("volunteer_id", user!.id).order("created_at", { ascending: false })).data ?? [],
  });
  const training = useQuery({
    queryKey: ["my-training", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: acc } = await supabase.from("applications").select("charity_id").eq("volunteer_id", user!.id).eq("status", "accepted");
      const ids = (acc ?? []).map((a) => a.charity_id);
      if (!ids.length) return [];
      const { data } = await supabase.from("charity_programs").select("charity_id, charities(name), courses(id, title, minutes)").in("charity_id", ids);
      return data ?? [];
    },
  });
  const bookings = useQuery({
    queryKey: ["my-bookings", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("bookings").select("id, attended, hours, shift_id, shifts(id, title, starts_at, duration_hours, charities(name))").eq("user_id", user!.id)).data ?? [],
  });

  const have = new Set((certs.data ?? []).map((c) => c.course_id));
  const upcoming = (bookings.data ?? []).filter((b) => b.shifts && new Date(b.shifts.starts_at) > new Date()).sort((a, b) => a.shifts!.starts_at.localeCompare(b.shifts!.starts_at));
  const hours = (bookings.data ?? []).filter((b) => b.attended).reduce((n, b) => n + Number(b.hours), 0);

  async function cancel(shiftId: string) {
    const { data } = await supabase.rpc("cancel_booking", { _shift: shiftId });
    if (!data) return void toast.error("Couldn't cancel that booking.");
    toast.success("Booking cancelled. Your spot went back to the pool.");
    qc.invalidateQueries();
  }

  return (
    <StandardPage eyebrow="Dashboard" title="Your volunteering" lead="Shifts, training and applications in one place." actions={<DemoReset />}>
      <KpiRow>
        <StatTile label="Hours given" value={hrs(hours)} icon={Clock} />
        <StatTile label="Upcoming shifts" value={String(upcoming.length)} icon={CalendarCheck} />
        <StatTile label="Certificates" value={String(certs.data?.length ?? 0)} icon={Award} />
        <StatTile label="Applications" value={String(apps.data?.length ?? 0)} icon={Inbox} />
      </KpiRow>

      <Section title="Upcoming shifts">
        {bookings.isLoading ? <Skeleton className="h-24 rounded-xl" /> : upcoming.length === 0 ? (
          <Empty icon={CalendarCheck} title="No shifts booked" body="Find one you're qualified for." action={<Button asChild><Link to="/explore">Explore shifts</Link></Button>} />
        ) : (
          <div className="flex flex-col gap-3">
            {upcoming.map((b) => (
              <div key={b.id} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <p className="font-semibold text-text">{b.shifts!.title}</p>
                  <p className="text-sm text-text-2">{b.shifts!.charities?.name} · {shiftWhen(b.shifts!.starts_at, Number(b.shifts!.duration_hours))}</p>
                </div>
                <div className="flex gap-2">
                  <Button asChild size="sm" variant="soft"><Link to="/shift/$id/chat" params={{ id: b.shift_id }}><MessagesSquare /> Chat</Link></Button>
                  <Button size="sm" variant="ghost" onClick={() => cancel(b.shift_id)}>Cancel</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="My training">
        {training.isLoading ? <Skeleton className="h-24 rounded-xl" /> : (training.data ?? []).length === 0 ? (
          <Empty icon={BookOpen} title="No onboarding programs yet" body="Once a charity accepts you, its courses show here." action={<Button asChild variant="secondary"><Link to="/courses">Browse library</Link></Button>} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {(training.data ?? []).map((t) => t.courses && (
              <Link key={`${t.charity_id}-${t.courses.id}`} to="/courses/$id" params={{ id: t.courses.id }} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-brand/50">
                <span><span className="block font-semibold text-text">{t.courses.title}</span><span className="text-xs text-text-3">{t.charities?.name} · {t.courses.minutes} min</span></span>
                {have.has(t.courses.id) ? <span className="rounded-full bg-sage-soft px-3 py-1 text-xs font-semibold text-forest">Earned</span> : <span className="text-xs font-semibold text-brand">Start</span>}
              </Link>
            ))}
          </div>
        )}
      </Section>

      <Section title="Certificates">
        {(certs.data ?? []).length === 0 ? (
          <Empty icon={Award} title="No certificates yet" body="Finish a course to earn your first." action={<Button asChild><Link to="/courses">Start a course</Link></Button>} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(certs.data ?? []).map((c) => (
              <Link key={c.id} to="/certificates/$id" params={{ id: c.id }} className="rounded-xl border border-border bg-surface p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <Award className="size-6 text-forest" />
                <p className="mt-2 font-semibold text-text">{c.course_title}</p>
                <p className="text-xs text-text-3">Issued by {c.issuer_name}</p>
              </Link>
            ))}
          </div>
        )}
      </Section>

      <Section title="Applications">
        {(apps.data ?? []).length === 0 ? (
          <Empty icon={Inbox} title="No applications yet" body="Find a charity near you." action={<Button asChild variant="secondary"><Link to="/charities">Browse charities</Link></Button>} />
        ) : (
          <div className="flex flex-col gap-2">
            {(apps.data ?? []).map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-xl border border-border bg-surface p-4">
                <Link to="/org/$id" params={{ id: a.charities!.id }} className="font-semibold text-text hover:text-brand">{a.charities?.name}</Link>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${STATUS[a.status]}`}>{a.status}</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </StandardPage>
  );
}

function CharityDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const charity = useQuery(myCharityQuery(user?.id));
  const cid = charity.data?.id;
  const kpis = useQuery({
    queryKey: ["kpis", cid],
    enabled: !!cid,
    queryFn: async () => (await supabase.rpc("charity_kpis")).data as { fill_rate: number; open_spots: number; volunteers_month: number; hours: number } | null,
  });
  const shifts = useQuery({
    queryKey: ["org-shifts", cid],
    enabled: !!cid,
    queryFn: async () => (await supabase.from("shifts").select("id, title, starts_at, duration_hours, spots_total, spots_left, shift_requirements(courses(title))").eq("charity_id", cid!).gt("starts_at", new Date().toISOString()).order("starts_at")).data ?? [],
  });
  const apps = useQuery({
    queryKey: ["org-apps", cid],
    enabled: !!cid,
    queryFn: async () => {
      const { data } = await supabase.from("applications").select("id, status, message, volunteer_id, created_at").eq("charity_id", cid!).order("created_at", { ascending: false });
      const ids = (data ?? []).map((a) => a.volunteer_id);
      const { data: people } = ids.length ? await supabase.from("profiles").select("id, display_name, city").in("id", ids) : { data: [] };
      return (data ?? []).map((a) => ({ ...a, profile: (people ?? []).find((p) => p.id === a.volunteer_id) }));
    },
  });
  const courses = useQuery(coursesQuery());
  const program = useQuery({
    queryKey: ["program", cid],
    enabled: !!cid,
    queryFn: async () => new Set(((await supabase.from("charity_programs").select("course_id").eq("charity_id", cid!)).data ?? []).map((p) => p.course_id)),
  });

  async function decide(id: string, status: "accepted" | "declined") {
    const { error } = await supabase.from("applications").update({ status }).eq("id", id);
    if (error) return void toast.error("Couldn't update that application.");
    toast.success(status === "accepted" ? "Volunteer accepted" : "Application declined");
    qc.invalidateQueries({ queryKey: ["org-apps"] });
  }
  async function toggleProgram(courseId: string, on: boolean) {
    const { error } = on
      ? await supabase.from("charity_programs").insert({ charity_id: cid!, course_id: courseId })
      : await supabase.from("charity_programs").delete().eq("charity_id", cid!).eq("course_id", courseId);
    if (error) return void toast.error("Couldn't update your program.");
    qc.invalidateQueries({ queryKey: ["program"] });
  }

  if (charity.isLoading) return <div className="mx-auto max-w-7xl p-6"><Skeleton className="h-64 rounded-xl" /></div>;
  if (!charity.data) return <div className="mx-auto max-w-3xl p-6"><Empty icon={Users} title="No charity linked" body="Finish onboarding to set up your charity." /></div>;

  const perDay = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() + i * 86400_000);
    const filled = (shifts.data ?? []).filter((s) => new Date(s.starts_at).toDateString() === d.toDateString()).reduce((n, s) => n + (s.spots_total - s.spots_left), 0);
    return { day: d.toLocaleDateString(undefined, { day: "numeric", month: "short" }), filled };
  });
  const mine = (courses.data ?? []).filter((c) => c.created_by === user?.id);

  return (
    <WidePage
      eyebrow="Charity dashboard"
      title={charity.data.name}
      lead="Fill shifts, onboard volunteers, track impact."
      actions={<><DemoReset /><Button asChild><Link to="/org/shifts/new"><Plus /> Post a shift</Link></Button></>}
    >
      <KpiRow>
        <StatTile label="Fill rate this week" value={pct(kpis.data?.fill_rate ?? 0)} icon={CalendarCheck} />
        <StatTile label="Volunteers this month" value={String(kpis.data?.volunteers_month ?? 0)} icon={Users} />
        <StatTile label="Hours delivered" value={hrs(Number(kpis.data?.hours ?? 0))} icon={Clock} />
        <StatTile label="Open spots" value={String(kpis.data?.open_spots ?? 0)} icon={Inbox} />
      </KpiRow>

      <ChartCard title="Volunteers booked · next 14 days">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={perDay}>
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--text-3)" }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--text-3)" }} axisLine={false} tickLine={false} width={24} />
              <Tooltip cursor={{ fill: "var(--surface-2)" }} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }} />
              <Bar dataKey="filled" fill="var(--brand)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <Section title="Applications">
        {(apps.data ?? []).length === 0 ? (
          <Empty icon={Inbox} title="No applications yet" body="Volunteers who apply will appear here." />
        ) : (
          <div className="flex flex-col gap-2">
            {(apps.data ?? []).map((a) => (
              <div key={a.id} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <Link to="/v/$id" params={{ id: a.volunteer_id }} className="font-semibold text-text hover:text-brand">{a.profile?.display_name ?? "Volunteer"}</Link>
                  <p className="text-sm text-text-2">{a.message || "No message"}</p>
                </div>
                {a.status === "pending" ? (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => decide(a.id, "accepted")}><Check /> Accept</Button>
                    <Button size="sm" variant="secondary" onClick={() => decide(a.id, "declined")}><X /> Decline</Button>
                  </div>
                ) : (
                  <span className={`self-start rounded-full px-3 py-1 text-xs font-semibold capitalize ${STATUS[a.status]}`}>{a.status}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Upcoming shifts">
        {(shifts.data ?? []).length === 0 ? (
          <Empty icon={CalendarCheck} title="No shifts posted" body="Post your first shift in a minute." action={<Button asChild><Link to="/org/shifts/new">Post a shift</Link></Button>} />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-text-3"><tr><th className="p-3">Shift</th><th className="p-3">When</th><th className="p-3">Filled</th><th className="p-3">Needs</th><th className="p-3" /></tr></thead>
              <tbody>
                {(shifts.data ?? []).map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="p-3 font-semibold text-text">{s.title}</td>
                    <td className="p-3 text-text-2">{shiftWhen(s.starts_at, Number(s.duration_hours))}</td>
                    <td className="p-3 tabular-nums text-text">{s.spots_total - s.spots_left}/{s.spots_total}</td>
                    <td className="p-3 text-text-2">{s.shift_requirements.map((r) => r.courses?.title).join(", ") || "None"}</td>
                    <td className="p-3 text-right"><Link to="/org/shifts/$id" params={{ id: s.id }} className="font-semibold text-brand hover:underline">Manage</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Onboarding program" action={<Button asChild variant="ghost" size="sm"><Link to="/courses">Library</Link></Button>}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(courses.data ?? []).map((c) => {
            const on = program.data?.has(c.id) ?? false;
            return (
              <button key={c.id} onClick={() => toggleProgram(c.id, !on)} className={on ? "flex items-center justify-between rounded-xl border-2 border-forest bg-sage-soft p-4 text-left" : "flex items-center justify-between rounded-xl border-2 border-border bg-surface p-4 text-left hover:border-sage"}>
                <span><span className="block font-semibold text-text">{c.title}</span><span className="text-xs text-text-3">{c.minutes} min</span></span>
                <span className="text-xs font-semibold text-forest">{on ? "In program" : "Add"}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Courses you created">
        {mine.length === 0 ? (
          <Empty icon={BookOpen} title="You haven't created a course" body="Share your know-how with every charity." action={<Button asChild variant="secondary"><Link to="/courses">Create a course</Link></Button>} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {mine.map((c) => (
              <Link key={c.id} to="/courses/$id/edit" params={{ id: c.id }} className="rounded-xl border border-border bg-surface p-4 font-semibold text-text hover:border-brand/50">{c.title}</Link>
            ))}
          </div>
        )}
      </Section>
    </WidePage>
  );
}
