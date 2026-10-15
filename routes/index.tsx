import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, CalendarCheck, GraduationCap, HandHeart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { demoSignIn } from "@/lib/demo.functions";
import { heroImage } from "@/lib/images";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kindred · Volunteer once. Qualify everywhere." },
      { name: "description", content: "One verified profile. Portable training. One-tap shifts at local charities." },
      { property: "og:title", content: "Kindred · Volunteer once. Qualify everywhere." },
      { property: "og:description", content: "One verified profile. Portable training. One-tap shifts at local charities." },
    ],
  }),
  component: Landing,
});

const STEPS = [
  { icon: GraduationCap, title: "Learn once", body: "Short courses from a library every charity shares." },
  { icon: BadgeCheck, title: "Qualify everywhere", body: "Certificates land in your wallet and unlock shifts." },
  { icon: CalendarCheck, title: "Show up", body: "Book in one tap. Your team chat is waiting." },
];

const STATS = [
  { value: "6", label: "local charities" },
  { value: "30", label: "shifts this fortnight" },
  { value: "5", label: "shared courses" },
  { value: "12 min", label: "to your first credential" },
];

function Landing() {
  const demo = useServerFn(demoSignIn);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function tryMaya() {
    setBusy(true);
    try {
      const r = await demo({ data: { who: "maya" } });
      if (!("access_token" in r) || !r.access_token || !r.refresh_token) throw new Error("error" in r ? r.error : undefined);
      await supabase.auth.setSession({ access_token: r.access_token, refresh_token: r.refresh_token });
      navigate({ to: "/explore" });
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Demo sign-in is unavailable right now.");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost"><Link to="/auth">Sign in</Link></Button>
        </div>
      </div>

      <section className="mx-auto grid max-w-6xl animate-fade-rise items-center gap-10 px-4 pb-16 pt-8 sm:px-6 lg:grid-cols-2 lg:pt-16">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-sage-soft px-3 py-1 text-sm font-semibold text-forest">
            <HandHeart className="size-4" /> Volunteer once. Qualify everywhere.
          </p>
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-text sm:text-5xl">
            Joining a charity shouldn't feel like a job application.
          </h1>
          <p className="mt-5 max-w-lg text-lg text-text-2">One verified profile. Portable training. One-tap shifts.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" onClick={tryMaya} disabled={busy}>{busy && <Loader2 className="animate-spin" />} Try as Maya</Button>
            <Button asChild size="lg" variant="secondary"><Link to="/auth">I'm a charity</Link></Button>
          </div>
        </div>
        <div className="relative">
          <div className="absolute -right-6 -top-6 size-40 rounded-full bg-gradient-forest opacity-30 blur-2xl" />
          <img src={heroImage} alt="Volunteers packing donation boxes together" width={1600} height={1008} className="relative aspect-[4/3] w-full rounded-xl object-cover shadow-lg" />
        </div>
      </section>

      <section className="border-y border-border bg-surface">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-8 sm:px-6 lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label}>
              <p className="font-display text-3xl font-bold tabular-nums text-brand">{s.value}</p>
              <p className="text-sm text-text-2">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="font-display text-3xl font-semibold tracking-tight text-text">How it works</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {STEPS.map((p, i) => (
            <div key={p.title} className="rounded-xl border border-border bg-surface p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-brand-soft text-brand"><p.icon className="size-5" /></span>
                <span className="text-sm font-bold text-text-3">Step {i + 1}</span>
              </div>
              <p className="font-display text-lg font-semibold text-text">{p.title}</p>
              <p className="mt-1 text-sm text-text-2">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-text-3 sm:flex-row sm:justify-between sm:px-6">
          <Logo />
          <p>Made for local charities and the people who help them.</p>
        </div>
      </footer>
    </div>
  );
}
