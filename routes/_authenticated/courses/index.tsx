import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, BookOpen, Clock, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { WidePage } from "@/components/layout/page";
import { CardSkeletonGrid, Empty } from "@/components/layout/blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { coursesQuery, myCertsQuery, myCharityQuery } from "@/lib/data";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/courses/")({
  head: () => ({
    meta: [
      { title: "Shared training library · Kindred" },
      { name: "description", content: "Short courses every charity on Kindred accepts." },
      { property: "og:title", content: "Shared training library · Kindred" },
      { property: "og:description", content: "Short courses every charity on Kindred accepts." },
    ],
  }),
  component: Courses,
});

const KINDS = ["training", "induction", "safeguarding", "coaching"];

function Courses() {
  const { user, hasRole } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const courses = useQuery(coursesQuery());
  const certs = useQuery(myCertsQuery(user?.id));
  const charity = useQuery(myCharityQuery(user?.id));
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("training");

  const have = new Set((certs.data ?? []).map((c) => c.course_id));

  async function create() {
    const t = title.trim();
    if (t.length < 2 || t.length > 120) return void toast.error("Give the course a title");
    const { data, error } = await supabase
      .from("courses")
      .insert({ title: t, kind, created_by: user!.id, charity_id: charity.data?.id ?? null })
      .select("id")
      .single();
    if (error) return void toast.error("Couldn't create the course.");
    qc.invalidateQueries({ queryKey: ["courses"] });
    setOpen(false);
    navigate({ to: "/courses/$id/edit", params: { id: data.id } });
  }

  return (
    <WidePage
      eyebrow="Learn"
      title="Shared training library"
      lead="Train once. Every charity accepts it."
      actions={hasRole("charity_admin") ? <Button onClick={() => setOpen(true)}><Plus /> New course</Button> : undefined}
    >
      {courses.isLoading ? (
        <CardSkeletonGrid />
      ) : !courses.data?.length ? (
        <Empty icon={BookOpen} title="No courses yet" body="Charities can add the first one." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.data.map((c) => (
            <Link
              key={c.id}
              to="/courses/$id"
              params={{ id: c.id }}
              className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-sage-soft px-3 py-1 text-xs font-semibold capitalize text-forest">{c.kind}</span>
                {have.has(c.id) && <span className="flex items-center gap-1 text-xs font-semibold text-forest"><BadgeCheck className="size-4" /> Earned</span>}
              </div>
              <p className="font-display text-lg font-semibold tracking-tight text-text">{c.title}</p>
              <p className="text-sm text-text-2">{c.summary || "A short course from the shared library."}</p>
              <p className="mt-auto flex items-center gap-3 text-xs text-text-3">
                <span className="flex items-center gap-1"><Clock className="size-3.5" /> {c.minutes} min</span>
                <span>{c.lessons.length} lessons</span>
                {c.charities?.name && <span>by {c.charities.name}</span>}
              </p>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New course</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></div>
            <div className="flex flex-wrap gap-2">
              {KINDS.map((k) => (
                <button key={k} onClick={() => setKind(k)} className={k === kind ? "rounded-full bg-brand px-3 py-1 text-sm capitalize text-on-brand" : "rounded-full border border-border px-3 py-1 text-sm capitalize text-text-2"}>{k}</button>
              ))}
            </div>
            <Button onClick={create}>Create and add lessons</Button>
          </div>
        </DialogContent>
      </Dialog>
    </WidePage>
  );
}
