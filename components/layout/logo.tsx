import { Sprout } from "lucide-react";

export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <span className="flex size-8 items-center justify-center rounded-full bg-brand text-on-brand">
        <Sprout className="size-4.5" />
      </span>
      <span className="font-display text-xl font-bold tracking-tight text-text">Kindred</span>
    </span>
  );
}
