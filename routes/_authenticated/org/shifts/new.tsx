import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DetailPage, Section } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { coursesQuery, myCharityQuery } from "@/lib/data";
import { draftShift } from "@/lib/ai.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/org/shifts/new")({
  head: () => ({ meta: [{ title: "Post a shift · Kindred" }, { name: "description", content: "Post a volunteer shift." }] }),
  component: NewShift,
});

const A = (n: number) => `00000000-0000-0000-0000-00000000a00${n}`;

const Form = z.object({
  title: z.string().trim().min(2, "Add a title").max(120),
  description: z.string().trim().max(600),
  date: z.string().min(1, "Pick a date"),
  time: z.string().min(1, "Pick a time"),
  duration: z.number().min(1).max(8),
  spots: z.number().int().min(1).max(500),
  commitment: z.enum(["2 hrs", "one-off", "weekly"]),
  address: z.string().trim().max(200),
});

function NewShift() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const charity = useQuery(myCharityQuery(user?.id));
  const courses = useQuery(coursesQuery());
  const draft = useServerFn(draftShift);
  const [sentence, setSentence] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const tomorrow = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);
  const [f, setF] = useState({ title: "", description: "", date: tomorrow, time: "10:00", duration: 2, spots: 6, commitment: "one-off" as "2 hrs" | "one-off" | "weekly", address: "" });
  const [reqs, setReqs] = useState<string[]>([]);

  async function runDraft() {
    if (sentence.trim().length < 5) return void toast.error("Describe the shift in a sentence");
    setDrafting(true);
    try {
      const r = await draft({ data: { sentence: sentence.slice(0, 400) } });
      const d = r.data;
      const date = new Date(Date.now() + d.day_offset * 86400_000).toISOString().slice(0, 10);
      setF({ ...f, title: d.title, description: d.description, date, time: `${String(d.start_hour).padStart(2, "0")}:00`, duration: d.duration_hours, spots: d.spots, commitment: d.commitment as typeof f.commitment });
      setReqs([d.needs_food_safety && A(2), d.needs_safeguarding && A(1), d.needs_manual_handling && A(4)].filter(Boolean) as string[]);
      setNotice(r.fallback ? r.notice ?? "AI is resting for today" : null);
      toast.success("Draft ready. Check and edit before posting.");
    } catch {
      toast.error("Couldn't draft that. Fill the form instead.");
    }
    setDrafting(false);
  }

  async function publish() {
    const p = Form.safeParse(f);
    if (!p.success) return void toast.error(p.error.issues[0]?.message ?? "Check the form");
    if (!charity.data) return;
    setSaving(true);
    const starts = new Date(`${p.data.date}T${p.data.time}`);
    const { data, error } = await supabase
      .from("shifts")
      .insert({
        charity_id: charity.data.id,
        title: p.data.title,
        description: p.data.description,
        starts_at: starts.toISOString(),
        duration_hours: p.data.duration,
        spots_total: p.data.spots,
        spots_left: p.data.spots,
        commitment: p.data.commitment,
        city: charity.data.area,
        address: p.data.address || charity.data.area,
        cause: charity.data.cause,
      })
      .select("id")
      .single();
    if (error || !data) {
      setSaving(false);
      return void toast.error("Couldn't post the shift.");
    }
    if (reqs.length) await supabase.from("shift_requirements").insert(reqs.map((course_id) => ({ shift_id: data.id, course_id })));
    await qc.invalidateQueries();
    toast.success("Shift posted");
    navigate({ to: "/org/shifts/$id", params: { id: data.id } });
  }

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF({ ...f, [k]: k === "duration" || k === "spots" ? Number(e.target.value) : e.target.value });

  return (
    <DetailPage backTo="/dashboard" backLabel="Dashboard" eyebrow="New shift" title="Post a shift" lead="Describe it in a sentence, or fill it in.">
      <div className="flex flex-col gap-3 rounded-xl bg-gradient-forest p-5 text-on-brand shadow-md">
        <Label className="text-on-brand">Describe the shift in a sentence</Label>
        <Textarea value={sentence} onChange={(e) => setSentence(e.target.value)} maxLength={400} rows={2} className="bg-surface text-text" placeholder="Need 8 people Saturday morning to sort food donations for 3 hours" />
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={runDraft} disabled={drafting}>{drafting ? <Loader2 className="animate-spin" /> : <Sparkles />} Draft it</Button>
          {notice && <span className="text-sm opacity-90">{notice}</span>}
        </div>
      </div>

      <Section title="Basics">
        <div className="grid gap-4 sm:grid-cols-2">
          <F label="Title"><Input value={f.title} onChange={set("title")} maxLength={120} /></F>
          <F label="Address"><Input value={f.address} onChange={set("address")} maxLength={200} /></F>
          <div className="sm:col-span-2"><F label="Description"><Textarea value={f.description} onChange={set("description")} maxLength={600} rows={3} /></F></div>
        </div>
      </Section>

      <Section title="Time and spots">
        <div className="grid gap-4 sm:grid-cols-4">
          <F label="Date"><Input type="date" value={f.date} onChange={set("date")} /></F>
          <F label="Start"><Input type="time" value={f.time} onChange={set("time")} /></F>
          <F label="Hours"><Input type="number" min={1} max={8} value={f.duration} onChange={set("duration")} /></F>
          <F label="Spots"><Input type="number" min={1} max={500} value={f.spots} onChange={set("spots")} /></F>
        </div>
        <div className="flex gap-2">
          {(["2 hrs", "one-off", "weekly"] as const).map((c) => (
            <button key={c} onClick={() => setF({ ...f, commitment: c })} className={cn("rounded-full border px-4 py-1.5 text-sm", f.commitment === c ? "border-brand bg-brand text-on-brand" : "border-border text-text-2")}>{c}</button>
          ))}
        </div>
      </Section>

      <Section title="Required training">
        <div className="flex flex-wrap gap-2">
          {(courses.data ?? []).map((c) => {
            const on = reqs.includes(c.id);
            return (
              <button key={c.id} onClick={() => setReqs(on ? reqs.filter((r) => r !== c.id) : [...reqs, c.id])} className={cn("rounded-full border px-4 py-1.5 text-sm font-medium", on ? "border-forest bg-sage-soft text-forest" : "border-border text-text-2")}>
                {c.title}
              </button>
            );
          })}
        </div>
      </Section>

      <div><Button size="lg" onClick={publish} disabled={saving}>{saving && <Loader2 className="animate-spin" />} Publish shift</Button></div>
    </DetailPage>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-2"><Label>{label}</Label>{children}</div>;
}
