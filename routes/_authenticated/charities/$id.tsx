import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { BookOpen, Building2, Globe, Loader2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DetailPage, Section } from "@/components/layout/page";
import { Empty } from "@/components/layout/blocks";
import { ShiftCard } from "@/components/shift-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useEligibility } from "@/hooks/use-eligibility";
import { charityImage } from "@/lib/images";

export const Route = createFileRoute("/_authenticated/charities/$id")({
  head: () => ({ meta: [{ title: "Charity · Kindred" }, { name: "description", content: "Charity profile and volunteer applications." }] }),
  component: CharityPage,
});

const STATUS: Record<string, string> = {
  pending: "bg-warning-soft text-text",
  accepted: "bg-sage-soft text-forest",
  declined: "bg-danger-soft text-danger",
};

function CharityPage() {
  const { id } = Route.useParams();
  const { user, hasRole } = useAuth();
  const qc = useQueryClient();
  const el = useEligibility();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const charity = useQuery({
    queryKey: ["charity", id],
    queryFn: async () => {
      const { data } = await supabase.from("charities").select("*, charity_programs(course_id, courses(id, title, minutes))").eq("id", id).maybeSingle();
      return data;
    },
  });
  const app = useQuery({
    queryKey: ["application", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("applications").select("status").eq("charity_id", id).eq("volunteer_id", user!.id).maybeSingle();
      return data;
    },
  });

  async function apply() {
    setBusy(true);
    const { error } = await supabase.from("applications").insert({ charity_id: id, volunteer_id: user!.id, message: msg.trim().slice(0, 1000) });
    setBusy(false);
    if (error) return void toast.error("We couldn't send that application. Try again.");
    toast.success("Application sent");
    qc.invalidateQueries({ queryKey: ["application", id] });
  }

  if (charity.isLoading) return <div className="mx-auto max-w-3xl p-6"><Skeleton className="h-80 rounded-xl" /></div>;
  const c = charity.data;
  if (!c) return <div className="mx-auto max-w-3xl p-6"><Empty icon={Building2} title="Charity not found" body="It may have moved." action={<Button asChild><Link to="/charities">All charities</Link></Button>} /></div>;
  const shifts = el.shifts.filter((s) => s.charity_id === id);

  return (
    <DetailPage backTo="/charities" backLabel="All charities" eyebrow={c.cause || "Charity"} title={c.name} lead={c.description}>
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-md">
        <img src={charityImage(c.image_key)} alt="" width={976} height={688} className="aspect-[16/7] w-full object-cover" />
        <div className="flex flex-wrap gap-4 p-5 text-sm text-text-2">
          <span className="flex items-center gap-1"><MapPin className="size-4" /> {c.area}</span>
          {c.website && <span className="flex items-center gap-1"><Globe className="size-4" /> {c.website}</span>}
        </div>
      </div>

      {hasRole("volunteer") && (
        <Section title="Volunteer here">
          {app.data ? (
            <p className="text-sm text-text-2">
              Your application is <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS[app.data.status]}`}>{app.data.status}</span>
            </p>
          ) : (
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
              <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={1000} rows={3} placeholder="Optional: a short note for the team" />
              <div><Button onClick={apply} disabled={busy}>{busy && <Loader2 className="animate-spin" />} Apply to volunteer</Button></div>
            </div>
          )}
        </Section>
      )}

      <Section title="Onboarding program">
        {c.charity_programs.length === 0 ? (
          <p className="text-sm text-text-2">No courses required. You can start right away.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {c.charity_programs.map((p) => p.courses && (
              <Link key={p.course_id} to="/courses/$id" params={{ id: p.courses.id }} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-brand/50">
                <span className="flex size-9 items-center justify-center rounded-full bg-sage-soft text-forest"><BookOpen className="size-4" /></span>
                <span><span className="block text-sm font-semibold text-text">{p.courses.title}</span><span className="text-xs text-text-3">{p.courses.minutes} min</span></span>
              </Link>
            ))}
          </div>
        )}
      </Section>

      <Section title="Upcoming shifts">
        {shifts.length === 0 ? (
          <p className="text-sm text-text-2">No shifts posted right now.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">{shifts.slice(0, 6).map((s) => <ShiftCard key={s.id} shift={s} missing={el.missingTitles(s.id)} />)}</div>
        )}
      </Section>
    </DetailPage>
  );
}
