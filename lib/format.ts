export function shiftWhen(startsAt: string, hours: number) {
  const d = new Date(startsAt);
  const end = new Date(d.getTime() + hours * 3600_000);
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86400_000);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const day = same(d, today)
    ? "Today"
    : same(d, tomorrow)
      ? "Tomorrow"
      : d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  const t = (x: Date) => x.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${day} · ${t(d)}–${t(end)}`;
}

export const hrs = (n: number) => `${Number(n.toFixed(1))} hrs`;
export const pct = (n: number) => `${Math.round(n)}%`;
export const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
