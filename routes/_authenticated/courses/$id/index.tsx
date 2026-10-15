import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Award, BadgeCheck, BookOpen, Check, Loader2, Pencil, RotateCcw, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DetailPage, Section } from "@/components/layout/page";
import { Empty } from "@/components/layout/blocks";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { demoQuizAnswers } from "@/lib/demo.functions";
import { useEligibility } from "@/hooks/use-eligibility";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/courses/$id/")({
  validateSearch: (s: Record<string, unknown>): { from?: string } => (typeof s["from"] === "string" ? { from: s["from"] } : {}),
  head: () => ({ meta: [{ title: "Course · Kindred" }, { name: "description", content: "Take a short course and earn a certificate." }] }),
  component: CoursePage,
});

function CoursePage() {
  const { id } = Route.useParams();
  const { user, hasRole } = useAuth();
  const qc = useQueryClient();
  const el = useEligibility();
  const [open, setOpen] = useState(0);
  const [busy, setBusy] = useState(false);
  const [unlocked, setUnlocked] = useState<{ shifts: number; charities: number } | null>(null);
  const { from } = Route.useSearch();
  const getAnswers = useServerFn(demoQuizAnswers);
  const [answers, setAnswers] = useState<number[]>([]);
  const isDemo = !!user?.email?.endsWith("@demo.kindred.app");
  const quiz = useQuery({
    queryKey: ["quiz", id],
    queryFn: async () => (await supabase.from("quiz_questions").select("id, q, options, position").eq("course_id", id).order("position")).data ?? [],
  });

  const course = useQuery({
    queryKey: ["course", id],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("*, charities!courses_charity_id_fkey(name), lessons(id, title, content, position)").eq("id", id).maybeSingle();
      if (data) data.lessons.sort((a, b) => a.position - b.position);
      return data;
    },
  });
  const accepted = useQuery({
    queryKey: ["accepted-by", id],
    queryFn: async () => {
      const { data } = await supabase.from("charities").select("name").order("name");
      return (data ?? []).map((c) => c.name);
    },
  });
  const progress = useQuery({
    queryKey: ["progress", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("lesson_progress").select("lesson_id").eq("user_id", user!.id);
      return new Set((data ?? []).map((p) => p.lesson_id));
    },
  });
  const cert = useQuery({
    queryKey: ["cert", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("certificates").select("id").eq("course_id", id).eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  if (course.isLoading) return <div className="mx-auto max-w-3xl p-6"><Skeleton className="h-96 rounded-xl" /></div>;
  const c = course.data;
  if (!c) return <div className="mx-auto max-w-3xl p-6"><Empty icon={BookOpen} title="Course not found" body="It may have been removed." action={<Button asChild><Link to="/courses">Library</Link></Button>} /></div>;

  const done = progress.data ?? new Set<string>();
  const doneCount = c.lessons.filter((l) => done.has(l.id)).length;
  const total = c.lessons.length;
  const allDone = total > 0 && doneCount === total;
  const resumeAt = c.lessons.findIndex((l) => !done.has(l.id));

  async function complete(lessonIds: string[]) {
    const rows = lessonIds.filter((l) => !done.has(l)).map((lesson_id) => ({ lesson_id, user_id: user!.id }));
    if (rows.length) {
      const { error } = await supabase.from("lesson_progress").insert(rows);
      if (error) return void toast.error("Couldn't save your progress.");
    }
    await qc.invalidateQueries({ queryKey: ["progress", id] });
  }

  async function claim() {
    setBusy(true);
    const { data, error } = await supabase.rpc("claim_certificate", { _course: id, _answers: answers });
    setBusy(false);
    const r = data as { ok: boolean; reason?: string; correct?: number; total?: number; unlocked_shift_count?: number; unlocked_org_count?: number } | null;
    if (error || !r) return void toast.error("Couldn't issue the certificate.");
    if (!r.ok) {
      if (r.reason === "quiz") return void toast.error(`${r.correct}/${r.total} correct. You need 4 out of 5. Try again.`);
      return void toast.error("Finish every lesson first.");
    }
    await qc.invalidateQueries();
    setUnlocked({ shifts: r.unlocked_shift_count ?? 0, charities: r.unlocked_org_count ?? 0 });
  }

  async function demoMode() {
    await complete(c!.lessons.map((l) => l.id));
    const r = await getAnswers({ data: { courseId: id } });
    setAnswers(r.answers);
    setOpen(-1);
  }

  async function startOver() {
    await supabase.from("lesson_progress").delete().in("lesson_id", c!.lessons.map((l) => l.id)).eq("user_id", user!.id);
    setOpen(0);
    qc.invalidateQueries({ queryKey: ["progress", id] });
  }

  return (
    <DetailPage
      backTo="/courses"
      backLabel="Library"
      eyebrow={`${c.kind} · ${c.minutes} min`}
      title={c.title}
      lead={c.summary || undefined}
      actions={hasRole("charity_admin") ? <Button asChild variant="secondary"><Link to="/courses/$id/edit" params={{ id }}><Pencil /> Edit</Link></Button> : undefined}
    >
      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div className="mb-2 flex justify-between text-sm"><span className="font-semibold text-text">Your progress</span><span className="tabular-nums text-text-2">{doneCount}/{total} lessons</span></div>
        <Progress value={total ? (doneCount / total) * 100 : 0} />
        {doneCount > 0 && !allDone && <p className="mt-3 text-sm text-text-2">Welcome back, picking up at lesson {resumeAt + 1}.</p>}
        <p className="mt-3 text-xs text-text-3">Accepted by: {(accepted.data ?? []).join(", ")}</p>
      </div>

      {unlocked ? (
        <div className="flex flex-col items-center gap-4 rounded-xl bg-gradient-forest p-8 text-center text-on-brand shadow-lg">
          <span className="flex size-20 animate-in zoom-in-50 items-center justify-center rounded-full bg-surface text-forest shadow-md duration-500">
            <Award className="size-10" />
          </span>
          <p className="font-display text-3xl font-semibold tracking-tight">{c.title} earned</p>
          <p className="text-lg opacity-95">
            {unlocked.shifts > 0 ? `Unlocked ${unlocked.shifts} shifts at ${unlocked.charities} ${unlocked.charities === 1 ? "charity" : "charities"}` : "Added to your wallet. Accepted everywhere."}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild variant="secondary"><Link to="/explore" search={{ qualified: 1 }}>See unlocked shifts</Link></Button>
            {from && <Button asChild variant="ghost" className="text-on-brand"><Link to="/shift/$id" params={{ id: from }}>Back to shift</Link></Button>}
          </div>
        </div>
      ) : cert.data ? (
        <div className="flex flex-col gap-4 rounded-xl bg-gradient-forest p-6 text-on-brand shadow-md sm:flex-row sm:items-center">
          <Award className="size-10 shrink-0" />
          <div className="flex-1">
            <p className="font-display text-xl font-semibold">Certificate earned</p>
            <p className="text-sm opacity-90">It's in your wallet and accepted everywhere.</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="secondary"><Link to="/certificates/$id" params={{ id: cert.data.id }}>View</Link></Button>
            <Button asChild variant="secondary"><Link to="/explore">Find shifts</Link></Button>
          </div>
        </div>
      ) : allDone ? (
        <div className="flex flex-col gap-4 rounded-xl border border-brand/30 bg-brand-soft p-5">
          <p className="font-semibold text-text">{(quiz.data ?? []).length ? "Final quiz · 4 of 5 to pass" : "All lessons complete"}</p>
          {(quiz.data ?? []).map((q, qi) => (
            <div key={q.id} className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-text">{qi + 1}. {q.q}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {q.options.map((o, oi) => (
                  <button
                    key={oi}
                    onClick={() => { const next = [...answers]; next[qi] = oi; setAnswers(next); }}
                    className={cn("rounded-lg border px-3 py-2 text-left text-sm transition-colors duration-150", answers[qi] === oi ? "border-brand bg-surface font-semibold text-brand" : "border-border bg-surface text-text-2 hover:border-brand/50")}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div><Button onClick={claim} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Award />} {(quiz.data ?? []).length ? "Submit and claim certificate" : "Claim certificate"}</Button></div>
        </div>
      ) : null}

      <Section
        title="Lessons"
        action={
          <div className="flex gap-1">
            {isDemo && !cert.data && total > 0 && (
              <Button variant="ghost" size="sm" onClick={demoMode}><Zap /> Demo mode</Button>
            )}
            {doneCount > 0 && !cert.data && <Button variant="ghost" size="sm" onClick={startOver}><RotateCcw /> Start over</Button>}
          </div>
        }
      >
        {total === 0 ? (
          <Empty icon={BookOpen} title="No lessons yet" body="A charity needs to add lessons first." />
        ) : (
          <div className="flex flex-col gap-3">
            {c.lessons.map((l, i) => {
              const isDone = done.has(l.id);
              const isOpen = open === i;
              return (
                <div key={l.id} className={cn("rounded-xl border bg-surface transition-colors", isOpen ? "border-brand/40 shadow-md" : "border-border")}>
                  <button onClick={() => setOpen(isOpen ? -1 : i)} className="flex w-full items-center gap-3 p-4 text-left">
                    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold", isDone ? "bg-forest text-on-brand" : "bg-surface-2 text-text-2")}>
                      {isDone ? <Check className="size-4" /> : i + 1}
                    </span>
                    <span className="font-semibold text-text">{l.title}</span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-border p-4 pl-16">
                      <p className="whitespace-pre-line text-text-2">{l.content}</p>
                      <Button
                        className="mt-4"
                        variant={isDone ? "soft" : "default"}
                        size="sm"
                        disabled={isDone}
                        onClick={async () => {
                          await complete([l.id]);
                          setOpen(i + 1 < total ? i + 1 : -1);
                        }}
                      >
                        {isDone ? <><BadgeCheck /> Completed</> : "Mark complete"}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </DetailPage>
  );
}
