import { createOpenAI } from "@ai-sdk/openai";
import { streamText, Output, NoObjectGeneratedError } from "ai";
import type { z } from "zod";
import { rateLimit, RateLimitError } from "./rate-limit.server";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const RESERVE_USD = 0.02;

export type AiResult<T> = { data: T; fallback: boolean; notice?: string };

/**
 * Shared AI pattern: kill switch → rate limit → budget reserve → structured call
 * → zod re-validation → usage log. Any failure returns the scripted fallback.
 */
export async function runAi<T>(opts: {
  feature: string;
  userId: string;
  isAdmin: boolean;
  model: string;
  instructions: string;
  userData: string;
  schema: z.ZodType<T>;
  normalize: (raw: unknown) => T | null;
  fallback: () => T;
}): Promise<AiResult<T>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const log = (fallback: boolean, reason: string, tokens = 0, cost = 0) =>
    supabaseAdmin.from("ai_usage").insert({
      user_id: opts.userId,
      feature: opts.feature,
      tokens,
      cost_usd: cost,
      fallback,
      reason,
    });
  const fall = async (reason: string, notice = "AI is resting for today") => {
    await log(true, reason);
    return { data: opts.fallback(), fallback: true, notice };
  };

  const { data: flag } = await supabaseAdmin.from("feature_flags").select("enabled").eq("key", "ai").maybeSingle();
  if (!flag?.enabled) return fall("kill_switch");

  try {
    await rateLimit("ai_min", opts.userId, 40, 60);
    await rateLimit("ai_day", opts.userId, 800, 86400);
  } catch (e) {
    if (e instanceof RateLimitError) return fall("rate_limited", e.message);
    throw e;
  }

  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return fall("no_key");

  const { data: ok } = await supabaseAdmin.rpc("reserve_ai_budget", {
    _amount: RESERVE_USD,
    _share: opts.isAdmin ? 1 : 0.8,
  });
  if (!ok) return fall("budget");

  let actual = 0;
  try {
    const provider = createOpenAI({
      baseURL: GATEWAY,
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    const result = streamText({
      model: provider.responses(opts.model),
      system: opts.instructions,
      prompt: `<user_data>\n${opts.userData}\n</user_data>`,
      output: Output.object({ schema: opts.schema }),
      providerOptions: {
        openai: {
          store: false,
          forceReasoning: true,
          reasoningEffort: "low",
          include: ["reasoning.encrypted_content"],
        },
      },
    });
    const raw = await result.output;
    const usage = await result.usage;
    const tokens = usage.totalTokens ?? 0;
    actual = Math.min(RESERVE_USD, tokens * 0.000004);
    const data = opts.normalize(raw);
    if (!data) {
      await log(true, "validation", tokens, actual);
      return { data: opts.fallback(), fallback: true, notice: "AI is resting for today" };
    }
    await log(false, "ok", tokens, actual);
    return { data, fallback: false };
  } catch (e) {
    console.error("ai call failed", e instanceof NoObjectGeneratedError ? "no object" : e);
    return fall("error");
  } finally {
    await supabaseAdmin.rpc("settle_ai_budget", { _reserved: RESERVE_USD, _actual: actual });
  }
}

/** Redact personal details before text goes to AI or chat. */
export function redact(t: string) {
  return t
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[EMAIL]")
    .replace(/\b(?:\d[ -]?){13,16}\b/g, "[CARD]")
    .replace(/\+?\d[\d ()-]{7,}\d/g, "[PHONE]")
    .replace(/\b\d{1,4}\s+[A-Z][a-z]+\s+(Street|St|Road|Rd|Avenue|Ave|Lane|Ln)\b/g, "[ADDRESS]");
}
