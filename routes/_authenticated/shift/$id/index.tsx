import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, Clock, Loader2, Lock, MapPin, MessagesSquare, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DetailPage, Section } from "@/components/layout/page";
import { Empty } from "@/components/layout/blocks";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { shiftQuery, requirementsQuery } from "@/lib/data";
import { useEligibility } from "@/hooks/use-eligibility";
import { useAuth } from "@/hooks/use-auth";
import { charityImage } from "@/lib/images";
import { shiftWhen } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/shift/$id/")({
  head: () => ({ meta: [{ title: "Shift · Kindred" }, { name: "description", content: "Shift details and one-tap booking." }] }),
  component: ShiftPage,
});

function ShiftPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const shift = useQuery(shiftQuery(id));
  const reqs = useQuery(requirementsQuery());
  const el = useEligibility();
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState<string[] | null>(null);

  const booked = useQuery({
    queryKey: ["booked", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("bookings").select("id").eq("shift_id", id).eq("user_id", user!.id).maybeSingle();
      return !!data;
    },
  });

  // Live spots left
  useEffect(() => {
    const ch = supabase
      .channel(`shift-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "shifts", filter: `id=eq.${id}` }, () =>
        qc.invalidateQueries({ queryKey: ["shift", id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, qc]);

  async function book() {
    setBusy(true);
    const { data, error } = await supabase.rpc("book_shift", { _shift: id });
    setBusy(false);
    const res = data as { ok: boolean; reason?: string; missing?: string[] } | null;
    if (error || !res) return void toast.error("Booking didn't go through. Try again.");
    if (res.ok) {
      await qc.invalidateQueries();
      toast.success("You're booked! Say hi to the team.");
      navigate({ to: "/shift/$id/chat", params: { id } });
      return;
    }
    if (res.reason === "missing") setMissing(res.missing ?? []);
    else if (res.reason === "full") toast.error("Sorry, this shift just filled up.");
    else if (res.reason === "off") toast.error("Booking is switched off right now.");
    else toast.error("Shift not found.");
  }

  if (shift.isLoading) return <div className="mx-auto max-w-3xl p-6"><Skeleton className="h-96 rounded-xl" /></div>;
  const s = shift.data;
  if (!s) return <div className="mx-auto max-w-3xl p-6"><Empty icon={MapPin} title="Shift not found" body="It may have been removed." action={<Button asChild><Link to="/explore">Back to explore</Link></Button>} /></div>;

  const required = (reqs.data ?? []).filter((r) => r.shift_id === id);
  const missingTitles = el.missingTitles(id);
  const missingCourses = required.filter((r) => missingTitles.includes(r.courses?.title ?? ""));
  const showMissing = missing !== null || missingTitles.length > 0;

  return (
    <DetailPage backTo="/explore" backLabel="All shifts" eyebrow={s.charities?.name} title={s.title} lead={s.description}>
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-md">
        <img src={charityImage(s.charities?.image_key)} alt="" width={976} height={688} className="aspect-[16/8] w-full object-cover" />
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <Info icon={Clock} label="When" value={shiftWhen(s.starts_at, Number(s.duration_hours))} />
          <Info icon={MapPin} label="Where" value={`${s.address}, ${s.city}`} />
          <Info icon={Users} label="Spots" value={s.spots_left > 0 ? `${s.spots_left} of ${s.spots_total} left` : "Full"} />
        </div>
        <div className="border-t border-border p-5">
          {booked.data ? (
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link to="/shift/$id/chat" params={{ id }}><MessagesSquare /> Open shift chat</Link>
            </Button>
          ) : (
            <Button size="lg" className="w-full sm:w-auto" onClick={book} disabled={busy || s.spots_left <= 0}>
              {busy && <Loader2 className="animate-spin" />} {s.spots_left <= 0 ? "Shift is full" : "Book shift"}
            </Button>
          )}
        </div>
      </div>

      {showMissing && missingCourses.length > 0 && !booked.data && (
        <div className="rounded-xl border border-warning/40 bg-warning-soft p-5">
          <p className="flex items-center gap-2 font-semibold text-text"><Lock className="size-4" /> One step to go</p>
          {missingCourses.map((m) => {
            const u = el.unlockCount(m.course_id);
            return (
              <div key={m.course_id} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-text-2">
                  Complete {m.courses?.title} ({m.courses?.minutes} min) to unlock {u?.shifts ?? 1} shifts
                  {u && u.charities.size > 1 ? ` at ${u.charities.size} charities` : ""}.
                </p>
                <Button asChild size="sm"><Link to="/courses/$id" params={{ id: m.course_id }} search={{ from: id }}>Unlock · {m.courses?.minutes} min</Link></Button>
              </div>
            );
          })}
        </div>
      )}

      <Section title="Required training">
        {required.length === 0 ? (
          <p className="text-sm text-text-2">No training needed. Just turn up.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {required.map((r) => {
              const have = !missingTitles.includes(r.courses?.title ?? "");
              return (
                <span key={r.course_id} className={have ? "inline-flex items-center gap-1 rounded-full bg-sage-soft px-3 py-1 text-sm font-semibold text-forest" : "inline-flex items-center gap-1 rounded-full bg-warning-soft px-3 py-1 text-sm font-semibold text-text"}>
                  {have ? <BadgeCheck className="size-4" /> : <Lock className="size-4" />} {r.courses?.title}
                </span>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Location">
        <div className="flex aspect-[16/7] items-center justify-center rounded-xl border border-border bg-gradient-forest text-on-brand">
          <span className="flex items-center gap-2 rounded-full bg-surface/20 px-4 py-2 text-sm font-semibold"><MapPin className="size-4" /> {s.address}, {s.city}</span>
        </div>
      </Section>

      <Section title="About the charity">
        <Link to="/org/$id" params={{ id: s.charity_id }} className="text-sm font-semibold text-brand hover:underline">
          View {s.charities?.name}
        </Link>
      </Section>
    </DetailPage>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"><Icon className="size-4" /></span>
      <div>
        <p className="text-xs text-text-3">{label}</p>
        <p className="text-sm font-semibold tabular-nums text-text">{value}</p>
      </div>
    </div>
  );
}
