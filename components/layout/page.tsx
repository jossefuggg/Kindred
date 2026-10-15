import type { ReactNode } from "react";
import { Link, type LinkProps } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shared page header: the only place page titles (h1) are rendered. */
export function PageHeader({
  eyebrow,
  title,
  lead,
  actions,
}: {
  eyebrow?: string | undefined;
  title: string;
  lead?: string | undefined;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 pb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-3xl font-semibold tracking-tight text-text sm:text-4xl">
          {title}
        </h1>
        {lead && <p className="mt-2 text-lg text-text-2">{lead}</p>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </header>
  );
}

type PageProps = {
  eyebrow?: string | undefined;
  title: string;
  lead?: string | undefined;
  actions?: ReactNode;
  children: ReactNode;
};

export function StandardPage({ children, ...h }: PageProps) {
  return (
    <div className="mx-auto w-full max-w-5xl animate-fade-rise px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader {...h} />
      <div className="flex flex-col gap-10">{children}</div>
    </div>
  );
}

export function WidePage({ children, ...h }: PageProps) {
  return (
    <div className="mx-auto w-full max-w-7xl animate-fade-rise px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader {...h} />
      <div className="flex flex-col gap-10">{children}</div>
    </div>
  );
}

export function DetailPage({
  backTo,
  backLabel,
  children,
  ...h
}: PageProps & { backTo: NonNullable<LinkProps["to"]>; backLabel: string }) {
  return (
    <div className="mx-auto w-full max-w-3xl animate-fade-rise px-4 py-8 sm:px-6 sm:py-10">
      <Link
        to={backTo}
        className="mb-6 inline-flex items-center gap-2 text-sm text-text-2 transition-colors hover:text-text"
      >
        <ArrowLeft className="size-4" /> {backLabel}
      </Link>
      <PageHeader {...h} />
      <div className="flex flex-col gap-10">{children}</div>
    </div>
  );
}

/** Left 300px · main · right 360px. Collapses to a single column on mobile. */
export function WorkspacePage({
  left,
  right,
  children,
}: {
  left?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto grid w-full max-w-7xl animate-fade-rise gap-4 px-4 py-6 sm:px-6 lg:grid-cols-[300px_1fr_360px]">
      <aside className="hidden lg:block">{left}</aside>
      <main className="min-w-0">{children}</main>
      <aside className="hidden lg:block">{right}</aside>
    </div>
  );
}

/** The only heading allowed inside a page. */
export function Section({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold tracking-tight text-text">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
