import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { myCertsQuery, requirementsQuery, shiftsQuery } from "@/lib/data";
import { useAuth } from "./use-auth";

/** Which shifts the user can book, and which course unlocks the most shifts. */
export function useEligibility() {
  const { user } = useAuth();
  const shifts = useQuery(shiftsQuery());
  const reqs = useQuery(requirementsQuery());
  const certs = useQuery(myCertsQuery(user?.id));

  return useMemo(() => {
    const valid = new Set(
      (certs.data ?? []).filter((c) => new Date(c.expires_at) > new Date()).map((c) => c.course_id),
    );
    const missingFor = (shiftId: string) =>
      (reqs.data ?? []).filter((r) => r.shift_id === shiftId && !valid.has(r.course_id));
    const missingTitles = (shiftId: string) => missingFor(shiftId).map((r) => r.courses?.title ?? "Training");

    // Course that unlocks the most currently-locked shifts
    const unlock = new Map<string, { courseId: string; title: string; minutes: number; shifts: number; charities: Set<string> }>();
    for (const s of shifts.data ?? []) {
      const m = missingFor(s.id);
      if (m.length !== 1) continue;
      const r = m[0]!;
      const e = unlock.get(r.course_id) ?? {
        courseId: r.course_id,
        title: r.courses?.title ?? "",
        minutes: r.courses?.minutes ?? 10,
        shifts: 0,
        charities: new Set<string>(),
      };
      e.shifts += 1;
      e.charities.add(s.charity_id);
      unlock.set(r.course_id, e);
    }
    const best = [...unlock.values()].sort((a, b) => b.shifts - a.shifts)[0];

    return {
      loading: shifts.isLoading || reqs.isLoading || certs.isLoading,
      error: shifts.error || reqs.error,
      shifts: shifts.data ?? [],
      certs: certs.data ?? [],
      missingTitles,
      best,
      unlockCount: (courseId: string) => unlock.get(courseId),
    };
  }, [shifts.data, reqs.data, certs.data, shifts.isLoading, reqs.isLoading, certs.isLoading, shifts.error, reqs.error]);
}
