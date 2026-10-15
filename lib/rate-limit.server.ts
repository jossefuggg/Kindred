// Fixed-window rate limiter backed by the rate_limits table (service role only).
export class RateLimitError extends Error {
  constructor(public retryAfter: number) {
    super(`Slow down a little. Try again in ${retryAfter}s`);
  }
}

export async function rateLimit(bucket: string, subject: string, limit: number, windowSec: number) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = Date.now();
  const start = new Date(Math.floor(now / (windowSec * 1000)) * windowSec * 1000).toISOString();

  const { data: row } = await supabaseAdmin
    .from("rate_limits")
    .select("count")
    .eq("bucket", bucket)
    .eq("subject", subject)
    .eq("window_start", start)
    .maybeSingle();

  const count = (row?.count ?? 0) + 1;
  await supabaseAdmin
    .from("rate_limits")
    .upsert({ bucket, subject, window_start: start, count }, { onConflict: "bucket,subject,window_start" });

  if (count > limit) {
    const retry = Math.ceil((new Date(start).getTime() + windowSec * 1000 - now) / 1000);
    throw new RateLimitError(retry);
  }
}
