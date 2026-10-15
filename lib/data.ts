import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Shift = {
  id: string;
  title: string;
  description: string;
  starts_at: string;
  duration_hours: number;
  commitment: string;
  spots_total: number;
  spots_left: number;
  city: string;
  address: string;
  cause: string;
  logistics: string;
  charity_id: string;
  charities: { id: string; name: string; image_key: string } | null;
};

const SHIFT_COLS =
  "id, title, description, starts_at, duration_hours, commitment, spots_total, spots_left, city, address, cause, logistics, charity_id, charities(id, name, image_key)";

async function must<R extends { data: unknown; error: { message: string } | null }>(p: PromiseLike<R>): Promise<R["data"]> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data;
}

export const shiftsQuery = () =>
  queryOptions({
    queryKey: ["shifts"],
    queryFn: () =>
      (async () => (await must(
        supabase.from("shifts").select(SHIFT_COLS).gt("starts_at", new Date().toISOString()).order("starts_at")) as unknown as Shift[]))(),
  });

export const shiftQuery = (id: string) =>
  queryOptions({
    queryKey: ["shift", id],
    queryFn: async () => (await must(supabase.from("shifts").select(SHIFT_COLS).eq("id", id).maybeSingle())) as unknown as Shift | null,
  });

export const coursesQuery = () =>
  queryOptions({
    queryKey: ["courses"],
    queryFn: () =>
      must(
        supabase
          .from("courses")
          .select("id, title, kind, summary, minutes, charity_id, created_by, charities(name), lessons(id)")
          .order("created_at"),
      ),
  });

export const requirementsQuery = () =>
  queryOptions({
    queryKey: ["requirements"],
    queryFn: () => must(supabase.from("shift_requirements").select("shift_id, course_id, courses(title, minutes)")),
  });

export const myCertsQuery = (userId?: string) =>
  queryOptions({
    queryKey: ["certs", userId],
    enabled: !!userId,
    queryFn: () =>
      must(supabase.from("certificates").select("*").eq("user_id", userId!).order("issued_at", { ascending: false })),
  });

export const charitiesQuery = () =>
  queryOptions({
    queryKey: ["charities"],
    queryFn: () => must(supabase.from("charities").select("*").order("name")),
  });

export const flagsQuery = () =>
  queryOptions({
    queryKey: ["flags"],
    queryFn: async () => {
      const rows = await must(supabase.from("feature_flags").select("key, label, enabled").order("key"));
      return rows;
    },
  });

export const profileQuery = (id?: string) =>
  queryOptions({
    queryKey: ["profile", id],
    enabled: !!id,
    queryFn: () => must(supabase.from("profiles").select("*").eq("id", id!).maybeSingle()),
  });

export const myCharityQuery = (userId?: string) =>
  queryOptions({
    queryKey: ["my-charity", userId],
    enabled: !!userId,
    queryFn: () => must(supabase.from("charities").select("*").eq("created_by", userId!).maybeSingle()),
  });
