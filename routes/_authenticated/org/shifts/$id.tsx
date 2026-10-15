import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, Check, MessagesSquare, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DetailPage, Section } from "@/components/layout/page";
import { Empty } from "@/components/layout/blocks";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { shiftWhen } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/org/shifts/$id")({
  head: () => ({ meta: [{ title: "Manage shift · Kindred" }, { name: "description", content: "Volunteers booked on this shift." }] }),
  component: Manage,
});

function Manage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null);
  const [hours, setHours] = useState(2);
  const [note, setNote] = useState("");

  const data = useQuery({
    queryKey: ["manage", id],
    queryFn: async () => {
      const { data: shift } = await supabase.from("shifts").select("*").eq("id", id).maybeSingle();
      const { data: bookings } = await supabase.from("bookings").select("id, user_id, attended, hours").eq("shift_id", id);
      const ids = (bookings ?? []).map((b) => b.user_id);
      const [{ data: people }, { data: certs }] = ids.length
        ? await Promise.all([
            supabase.from("profiles").select("id, display_name, city").in("id", ids),
            supabase.from("certificates").select("user_id, course_title").in("user_id", ids),
          ])
        : [{ data: [] }, { data: [] }];
      return {
        shift,
        people: (bookings ?? []).map((b) => ({
          ...b,
          profile: (people ?? []).find((p) => p.id === b.user_id),
          certs: (certs ?? []).filter((c) => c.user_id === b.user_id).map((c) => c.course_title),
        })),
      };
    },
  });

  async function mark() {
    if (!target) return;
    const { error } = await supabase.rpc("mark_attendance", { _booking: target.id, _hours: Math.max(0, Math.min(24, hours)), _endorsement: note.slice(0, 280) });
    if (error) return void toast.error("Couldn't mark attendance.");
    toast.success("Attendance logged");
    setTarget(null);
    setNote("");
    qc.invalidateQueries({ queryKey: ["manage", id] });
  }

  if (data.isLoading) return <div className="mx-auto max-w-3xl p-6"><Skeleton className="h-64 rounded-xl" /></div>;
  const s = data.data?.shift;
  if (!s) return <div className="mx-auto max-w-3xl p-6"><Empty icon={Users} title="Shift not found" body="It may have been removed." /></div>;

  return (
    <DetailPage
      backTo="/dashboard"
      backLabel="Dashboard"
      eyebrow={shiftWhen(s.starts_at, Number(s.duration_hours))}
      title={s.title}
      lead={`${s.spots_total - s.spots_left} of ${s.spots_total} spots filled`}
      actions={<Button asChild variant="secondary"><Link to="/shift/$id/chat" params={{ id }}><MessagesSquare /> Chat</Link></Button>}
    >
      <Section title="Volunteers">
        {(data.data?.people ?? []).length === 0 ? (
          <Empty icon={Users} title="No one booked yet" body="Qualified volunteers can book in one tap." />
        ) : (
          (data.data?.people ?? []).map((p) => (
            <div key={p.id} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center">
              <div className="flex-1">
                <Link to="/v/$id" params={{ id: p.user_id }} className="font-semibold text-text hover:text-brand">{p.profile?.display_name ?? "Volunteer"}</Link>
                <div className="mt-1 flex flex-wrap gap-1">
                  {p.certs.map((c) => <span key={c} className="inline-flex items-center gap-1 rounded-full bg-sage-soft px-2 py-0.5 text-xs font-semibold text-forest"><BadgeCheck className="size-3" /> {c}</span>)}
                </div>
              </div>
              {p.attended ? (
                <span className="flex items-center gap-1 text-sm font-semibold text-forest"><Check className="size-4" /> {Number(p.hours)} hrs logged</span>
              ) : (
                <Button size="sm" onClick={() => { setHours(Number(s.duration_hours)); setTarget({ id: p.id, name: p.profile?.display_name ?? "Volunteer" }); }}>Mark attended</Button>
              )}
            </div>
          ))
        )}
      </Section>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark {target?.name} attended</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <Input type="number" min={0} max={24} value={hours} onChange={(e) => setHours(Number(e.target.value))} aria-label="Hours" />
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} rows={3} placeholder="Optional endorsement (shows on their profile)" />
            <Button onClick={mark}>Log hours</Button>
          </div>
        </DialogContent>
      </Dialog>
    </DetailPage>
  );
}
