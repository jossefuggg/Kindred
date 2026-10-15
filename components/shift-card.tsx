import { Link } from "@tanstack/react-router";
import { BadgeCheck, Clock, Lock, MapPin, Sparkles } from "lucide-react";
import type { Shift } from "@/lib/data";
import { charityImage } from "@/lib/images";
import { shiftWhen } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Too Good To Go-style listing card: photo, "N left" pill, time window, qualification state. */
export function ShiftCard({
  shift,
  missing,
  reason,
  compact,
}: {
  shift: Shift;
  missing: string[];
  reason?: string;
  compact?: boolean;
}) {
  const full = shift.spots_left <= 0;
  const qualified = missing.length === 0;
  return (
    <Link
      to="/shift/$id"
      params={{ id: shift.id }}
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg",
        compact && "w-72 shrink-0",
      )}
    >
      <div className="relative aspect-[16/9] overflow-hidden">
        <img
          src={charityImage(shift.charities?.image_key)}
          alt=""
          loading="lazy"
          width={976}
          height={688}
          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <span
          className={cn(
            "absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-bold shadow-sm",
            full ? "bg-surface text-text-3" : shift.spots_left <= 2 ? "bg-brand text-on-brand" : "bg-surface text-text",
          )}
        >
          {full ? "Full" : `${shift.spots_left} left`}
        </span>
        <span className="absolute right-3 top-3 rounded-full bg-surface/90 px-3 py-1 text-xs font-medium text-text-2">
          {shift.commitment}
        </span>
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-text/70 to-transparent px-3 pb-2 pt-8">
          <span className="truncate text-sm font-semibold text-on-brand">{shift.charities?.name}</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="font-display text-lg font-semibold leading-snug tracking-tight text-text">{shift.title}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-2">
          <span className="flex items-center gap-1">
            <Clock className="size-3.5" /> {shiftWhen(shift.starts_at, Number(shift.duration_hours))}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="size-3.5" /> {shift.city}
          </span>
        </div>
        {reason && (
          <p className="flex items-start gap-1.5 text-sm text-forest">
            <Sparkles className="mt-0.5 size-3.5 shrink-0" /> {reason}
          </p>
        )}
        <div className="mt-auto pt-2">
          {qualified ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-sage-soft px-3 py-1 text-xs font-semibold text-forest">
              <BadgeCheck className="size-3.5" /> You're qualified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-3 py-1 text-xs font-semibold text-text">
              <Lock className="size-3.5" /> Needs: {missing.join(", ")}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
