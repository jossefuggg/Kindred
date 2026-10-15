import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Award, BadgeCheck, Clock, Building2, Pencil, Quote, Share2, Check, X, CalendarPlus, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Section } from "@/components/layout/page";
import { Empty, StatTile } from "@/components/layout/blocks";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { charitiesQuery, profileQuery, requirementsQuery } from "@/lib/data";
import { useAuth } from "@/hooks/use-auth";
import { hrs, initials } from "@/lib/format";
import { cn } from "@/lib/utils";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SLOTS = ["morning", "afternoon", "evening"] as const;
const CAUSES = ["Food", "Housing", "Health", "Environment", "Education", "Disaster response"];
type Avail = Record<string, Partial<Record<(typeof SLOTS)[number], boolean>>>;

export function VolunteerProfile({ userId, editable }: { userId: string; editable: boolean }) {
  const { user, hasRole } = useAuth();
  const qc = useQueryClient();
  const profile = useQuery(profileQuery(userId));
  const charities = useQuery(charitiesQuery());
  const reqs = useQuery(requirementsQuery());
  const certs = useQuery({
    queryKey: ["certs", userId],
    queryFn: async () => (await supabase.from("certificates").select("*").eq("user_id", userId).order("issued_at", { ascending: false })).data ?? [],
  });
  const stats = useQuery({
    queryKey: ["vstats", userId],
    queryFn: async () => (await supabase.rpc("volunteer_stats", { _uid: userId })).data as { hours: number; shifts: number; charities: number } | null,
  });
  const history = useQuery({
    queryKey: ["vhistory", userId],
    queryFn: async () =>
      ((await supabase.rpc("volunteer_history", { _uid: userId })).data ?? []) as { id: string; title: string; starts_at: string; hours: number; charity_id: string; charity_name: string }[],
  });
  const endorsements = useQuery({
    queryKey: ["endorsements", userId],
    queryFn: async () => (await supabase.from("endorsements").select("*, charities(id, name)").eq("volunteer_id", userId).order("created_at", { ascending: false })).data ?? [],
  });
  const [openCert, setOpenCert] = useState<string | null>(null);
  const [editing, setEditing] = useState<null | "headline" | "bio" | "causes">(null);
  const [draft, setDraft] = useState("");

  if (profile.isLoading) return <Skeleton className="h-72 rounded-xl" />;
  const p = profile.data;
  if (!p) return <Empty icon={Heart} title="Profile not found" body="This volunteer may have left Kindred." />;

  const avail = (p.availability ?? {}) as Avail;
  const orgCount = charities.data?.length ?? 6;

  async function save(patch: Partial<{ headline: string; bio: string; causes: string[]; availability: Avail }>) {
    const { error } = await supabase.from("profiles").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", userId);
    if (error) return void toast.error("Couldn't save that.");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["profile", userId] });
  }

  function toggleSlot(day: string, slot: (typeof SLOTS)[number]) {
    if (!editable) return;
    const next: Avail = { ...avail, [day]: { ...(avail[day] ?? {}), [slot]: !avail[day]?.[slot] } };
    save({ availability: next });
  }

  const cert = certs.data?.find((c) => c.id === openCert);
  const unlocks = cert ? (reqs.data ?? []).filter((r) => r.course_id === cert.course_id).length : 0;
  const viewerIsCharity = !editable && hasRole("charity_admin") && user?.id !== userId;

  return (
    <div className="flex flex-col gap-10">
      {/* Header card */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-md">
        <div className="h-24 bg-gradient-brand" />
        <div className="flex flex-col gap-4 px-5 pb-5 sm:px-8">
          <div className="-mt-10 flex items-end justify-between gap-4">
            <span className="flex size-20 items-center justify-center rounded-full border-4 border-surface bg-forest font-display text-2xl font-bold text-on-brand">
              {initials(p.display_name || "?")}
            </span>
            {!editable && (
              <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link copied"); }}>
                <Share2 /> Share
              </Button>
            )}
          </div>
          <div>
            <p className="flex items-center gap-2 font-display text-2xl font-semibold tracking-tight text-text">
              {p.display_name} <BadgeCheck className="size-5 text-forest" aria-label="Verified volunteer" />
            </p>
            <Editable
              editable={editable}
              active={editing === "headline"}
              onEdit={() => { setDraft(p.headline); setEditing("headline"); }}
              onCancel={() => setEditing(null)}
              onSave={() => save({ headline: draft.trim().slice(0, 120) })}
              view={<p className="text-text-2">{p.headline || (editable ? "Add a headline" : "")}{p.city && <span className="text-text-3"> · {p.city}</span>}</p>}
              input={<Input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={120} />}
            />
          </div>
          <Editable
            editable={editable}
            active={editing === "causes"}
            onEdit={() => { setDraft((p.causes ?? []).join(",")); setEditing("causes"); }}
            onCancel={() => setEditing(null)}
            onSave={() => save({ causes: draft.split(",").filter(Boolean).slice(0, 8) })}
            view={
              <div className="flex flex-wrap gap-2">
                {(p.causes ?? []).length ? (p.causes ?? []).map((c: string) => <span key={c} className="rounded-full bg-sage-soft px-3 py-1 text-xs font-semibold text-forest">{c}</span>) : editable && <span className="text-sm text-text-3">Add causes you care about</span>}
              </div>
            }
            input={
              <div className="flex flex-wrap gap-2">
                {CAUSES.map((c) => {
                  const on = draft.split(",").includes(c);
                  return (
                    <button key={c} onClick={() => setDraft((on ? draft.split(",").filter((x) => x !== c) : [...draft.split(",").filter(Boolean), c]).join(","))} className={cn("rounded-full border px-3 py-1 text-xs font-semibold", on ? "border-forest bg-sage-soft text-forest" : "border-border text-text-2")}>
                      {c}
                    </button>
                  );
                })}
              </div>
            }
          />
          <div className="grid grid-cols-3 gap-3">
            <StatTile label="Hours logged" value={hrs(Number(stats.data?.hours ?? 0))} icon={Clock} />
            <StatTile label="Orgs helped" value={String(stats.data?.charities ?? 0)} icon={Building2} />
            <StatTile label="Credentials" value={String(certs.data?.length ?? 0)} icon={Award} />
          </div>
        </div>
      </div>

      {viewerIsCharity && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-brand/30 bg-brand-soft p-4">
          <p className="flex-1 text-sm font-semibold text-text">You're viewing as a charity</p>
          <Button size="sm" variant="secondary" asChild><Link to="/dashboard">Endorse</Link></Button>
          <Button size="sm" asChild><Link to="/org/shifts/new"><CalendarPlus /> Invite to a shift</Link></Button>
        </div>
      )}

      <Section title="Credential Wallet">
        {certs.isLoading ? <Skeleton className="h-32 rounded-xl" /> : (certs.data ?? []).length === 0 ? (
          <Empty icon={Award} title="Earn your first credential in 12 minutes" body="Short courses, accepted by every charity." action={<Button asChild><Link to="/courses">Start learning</Link></Button>} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(certs.data ?? []).map((c) => (
              <button key={c.id} onClick={() => setOpenCert(c.id)} className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-full bg-gradient-forest text-on-brand"><Award className="size-5" /></span>
                  <span className="flex items-center gap-1 text-xs font-semibold text-forest"><BadgeCheck className="size-4" /> Verified</span>
                </div>
                <p className="font-semibold text-text">{c.course_title}</p>
                <p className="text-xs text-text-2">Issued by {c.issuer_name}</p>
                <p className="text-xs tabular-nums text-text-3">
                  {new Date(c.issued_at).toLocaleDateString()} · expires {new Date(c.expires_at).toLocaleDateString()}
                </p>
                <p className="text-xs text-text-3">Accepted by {orgCount} organisations</p>
              </button>
            ))}
          </div>
        )}
      </Section>

      <Section title="About">
        <Editable
          editable={editable}
          active={editing === "bio"}
          onEdit={() => { setDraft(p.bio); setEditing("bio"); }}
          onCancel={() => setEditing(null)}
          onSave={() => save({ bio: draft.trim().slice(0, 500) })}
          view={<p className="text-text-2">{p.bio || (editable ? "Add a short bio" : "No bio yet.")}</p>}
          input={<Textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={500} rows={3} />}
        />
        {(p.skills ?? []).length > 0 && (
          <div className="flex flex-wrap gap-2">{(p.skills ?? []).map((s: string) => <span key={s} className="rounded-full border border-border px-3 py-1 text-xs text-text-2">{s}</span>)}</div>
        )}
      </Section>

      <Section title="Endorsements">
        {(endorsements.data ?? []).length === 0 ? (
          <p className="text-sm text-text-2">No endorsements yet. They appear after completed shifts.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {(endorsements.data ?? []).map((e) => (
              <figure key={e.id} className="rounded-xl border border-border bg-surface p-5">
                <Quote className="size-5 text-brand" />
                <blockquote className="mt-2 text-text">{e.body}</blockquote>
                <figcaption className="mt-4 flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand">{initials(e.charities?.name ?? "K")}</span>
                  <span className="text-xs text-text-2">
                    <span className="block font-semibold text-text">{e.author_name || "Coordinator"}</span>
                    {e.charities && <Link to="/org/$id" params={{ id: e.charities.id }} className="hover:text-brand">{e.charities.name}</Link>}
                    {e.shift_title && ` · ${e.shift_title}`}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </Section>

      <Section title="Availability">
        <div className="overflow-x-auto">
          <div className="grid min-w-[480px] grid-cols-8 gap-1 text-xs">
            <span />
            {DAYS.map((d) => <span key={d} className="text-center font-semibold text-text-2">{d.slice(0, 3)}</span>)}
            {SLOTS.map((slot) => (
              <div key={slot} className="contents">
                <span className="capitalize text-text-3">{slot}</span>
                {DAYS.map((d) => {
                  const on = !!avail[d]?.[slot];
                  return (
                    <button
                      key={d + slot}
                      disabled={!editable}
                      onClick={() => toggleSlot(d, slot)}
                      aria-label={`${d} ${slot}`}
                      className={cn("h-8 rounded-md transition-colors duration-150", on ? "bg-sage" : "bg-surface-2", editable && "hover:ring-2 hover:ring-sage")}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        {editable && <p className="text-xs text-text-3">Tap a slot to toggle it.</p>}
      </Section>

      <Section title="Shift history">
        {(history.data ?? []).length === 0 ? (
          <p className="text-sm text-text-2">No completed shifts yet.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
            {(history.data ?? []).map((h) => (
              <div key={h.id} className="flex items-center justify-between p-4 text-sm">
                <div>
                  <p className="font-semibold text-text">{h.title}</p>
                  <Link to="/org/$id" params={{ id: h.charity_id }} className="text-text-2 hover:text-brand">{h.charity_name}</Link>
                </div>
                <div className="text-right tabular-nums text-text-2">
                  <p>{new Date(h.starts_at).toLocaleDateString()}</p>
                  <p className="text-xs text-text-3">{hrs(Number(h.hours))}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Sheet open={!!cert} onOpenChange={(o) => !o && setOpenCert(null)}>
        <SheetContent>
          <SheetHeader><SheetTitle>{cert?.course_title}</SheetTitle></SheetHeader>
          <div className="flex flex-col gap-4 p-4">
            <p className="text-sm text-text-2">Unlocks {unlocks} open shifts.</p>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-3">Accepted by</p>
            {(charities.data ?? []).map((c) => (
              <Link key={c.id} to="/org/$id" params={{ id: c.id }} className="flex items-center gap-3 text-sm font-semibold text-text hover:text-brand">
                <span className="flex size-8 items-center justify-center rounded-full bg-brand-soft text-xs text-brand">{initials(c.name)}</span> {c.name}
              </Link>
            ))}
            {cert && <Button asChild variant="secondary"><Link to="/courses/$id" params={{ id: cert.course_id }}>View course</Link></Button>}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Editable({ editable, active, onEdit, onCancel, onSave, view, input }: {
  editable: boolean; active: boolean; onEdit: () => void; onCancel: () => void; onSave: () => void; view: ReactNode; input: ReactNode;
}) {
  if (active)
    return (
      <div className="flex flex-col gap-2">
        {input}
        <div className="flex gap-2">
          <Button size="sm" onClick={onSave}><Check /> Save</Button>
          <Button size="sm" variant="ghost" onClick={onCancel}><X /> Cancel</Button>
        </div>
      </div>
    );
  return (
    <div className="group flex items-start gap-2">
      <div className="flex-1">{view}</div>
      {editable && <Button size="icon" variant="ghost" className="size-8" onClick={onEdit} aria-label="Edit"><Pencil /></Button>}
    </div>
  );
}
