import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Award, Building2, CalendarCheck, Clock, Globe, GraduationCap, MapPin, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Section } from "@/components/layout/page";
import { Empty, KpiRow, StatTile } from "@/components/layout/blocks";
import { ShiftCard } from "@/components/shift-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useEligibility } from "@/hooks/use-eligibility";
import { coursesQuery } from "@/lib/data";
import { charityImage } from "@/lib/images";
import { hrs, initials } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/org/$id")({
  head: () => ({ meta: [{ title: "Organisation · Kindred" }, { name: "description", content: "Charity profile, open shifts and impact." }] }),
  component: OrgProfile,
});

type Stats = { volunteers: number; hours: number; shifts_month: number; shifts_run: number; trained: number; people: { id: string; display_name: string; hours: number }[] };

function OrgProfile() {
  const { id } = Route.useParams();
  const { hasRole, user } = useAuth();
  const el = useEligibility();
  const courses = useQuery(coursesQuery());
  const org = useQuery({
    queryKey: ["org", id],
    queryFn: async () => (await supabase.from("charities").select("*").eq("id", id).maybeSingle()).data,
  });
  const stats = useQuery({
    queryKey: ["org-stats", id],
    queryFn: async () => (await supabase.rpc("charity_public_stats", { _cid: id })).data as Stats | null,
  });

  if (org.isLoading) return <div className="mx-auto max-w-5xl p-6"><Skeleton className="h-80 rounded-xl" /></div>;
  const o = org.data;
  if (!o) return <div className="mx-auto max-w-3xl p-6"><Empty icon={Building2} title="Organisation not found" body="It may have moved." action={<Button asChild><Link to="/charities">All charities</Link></Button>} /></div>;
  const shifts = el.shifts.filter((s) => s.charity_id === id);
  const isAdminHere = hasRole("charity_admin") && o.created_by === user?.id;
  const s = stats.data;

  return (
    <div className="mx-auto w-full max-w-5xl animate-fade-rise px-4 py-8 sm:px-6">
      <div className="relative">
        <img src={charityImage(o.image_key)} alt="" width={976} height={688} className="aspect-[16/6] w-full rounded-xl object-cover" />
        <span className="absolute -bottom-8 left-6 flex size-20 items-center justify-center rounded-full border-4 border-bg bg-brand font-display text-2xl font-bold text-on-brand shadow-md">
          {initials(o.name)}
        </span>
      </div>
      <div className="mt-12 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-text sm:text-4xl">{o.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-text-2">
            <span className="rounded-full bg-sage-soft px-3 py-1 text-xs font-semibold text-forest">{o.cause || "Community"}</span>
            <span className="flex items-center gap-1"><MapPin className="size-4" /> {o.area}</span>
            <span className="flex items-center gap-1"><Users className="size-4" /> {s?.volunteers ?? 0} volunteers</span>
          </div>
        </div>
        {hasRole("volunteer") && <Button asChild><Link to="/charities/$id" params={{ id }}>Apply to volunteer</Link></Button>}
      </div>

      <div className="mt-8">
        <KpiRow>
          <StatTile label="Volunteers engaged" value={String(s?.volunteers ?? 0)} icon={Users} />
          <StatTile label="Hours delivered" value={hrs(Number(s?.hours ?? 0))} icon={Clock} />
          <StatTile label="Shifts filled this month" value={String(s?.shifts_month ?? 0)} icon={CalendarCheck} />
          <StatTile label="Open shifts" value={String(shifts.length)} icon={Award} />
        </KpiRow>
      </div>

      <Tabs defaultValue="about" className="mt-10">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="about">About</TabsTrigger>
          <TabsTrigger value="shifts">Open shifts</TabsTrigger>
          <TabsTrigger value="volunteers">Volunteers</TabsTrigger>
          <TabsTrigger value="impact">Impact</TabsTrigger>
        </TabsList>

        <TabsContent value="about" className="mt-6 flex flex-col gap-8">
          <Section title="About">
            <p className="text-text-2">{o.description}</p>
            <div className="flex flex-wrap gap-4 text-sm text-text-2">
              {o.founded_year && <span>Founded {o.founded_year}</span>}
              {o.website && <span className="flex items-center gap-1"><Globe className="size-4" /> {o.website}</span>}
            </div>
          </Section>
          <Section title="Accepted credentials">
            <div className="flex flex-wrap gap-2">
              {(courses.data ?? []).map((c) => (
                <Link key={c.id} to="/courses/$id" params={{ id: c.id }} className="inline-flex items-center gap-1 rounded-full bg-sage-soft px-3 py-1 text-sm font-semibold text-forest hover:brightness-95">
                  <Award className="size-4" /> {c.title}
                </Link>
              ))}
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="shifts" className="mt-6">
          {shifts.length === 0 ? (
            <Empty icon={CalendarCheck} title="No open shifts" body="Check back soon." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{shifts.map((sh) => <ShiftCard key={sh.id} shift={sh} missing={el.missingTitles(sh.id)} />)}</div>
          )}
        </TabsContent>

        <TabsContent value="volunteers" className="mt-6">
          {(s?.people ?? []).length === 0 ? (
            <Empty icon={Users} title="No completed shifts yet" body="Volunteers appear here after their first shift." />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
              {(s?.people ?? []).map((p) => (
                <Link key={p.id} to="/v/$id" params={{ id: p.id }} className="flex flex-col items-center gap-2 rounded-xl p-3 text-center transition-colors hover:bg-surface">
                  <span className="flex size-14 items-center justify-center rounded-full bg-forest font-bold text-on-brand">{initials(p.display_name)}</span>
                  <span className="text-sm font-semibold text-text">{p.display_name}</span>
                  {isAdminHere && <span className="text-xs tabular-nums text-text-3">{hrs(Number(p.hours))}</span>}
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="impact" className="mt-6">
          <KpiRow>
            <StatTile label="Total hours delivered" value={hrs(Number(s?.hours ?? 0))} icon={Clock} />
            <StatTile label="Shifts run" value={String(s?.shifts_run ?? 0)} icon={CalendarCheck} />
            <StatTile label="Volunteers trained" value={String(s?.trained ?? 0)} icon={GraduationCap} />
            <StatTile label="Volunteers engaged" value={String(s?.volunteers ?? 0)} icon={Users} />
          </KpiRow>
        </TabsContent>
      </Tabs>
    </div>
  );
}
