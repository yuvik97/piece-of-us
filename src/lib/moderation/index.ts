import sharp from "sharp";
import { config, isDemoMode } from "../config";
import { claudeModeration } from "./claude";
import { localModeration } from "./local";
import { openaiModeration } from "./openai";
import { decide } from "./policy";
import type { ModerationInput, ModerationResult, ProviderOutput } from "./types";

export function moderationProviders() {
  const p: string[] = [];
  if (config.moderation.anthropicKey) p.push("claude");
  if (config.moderation.openaiKey) p.push("openai");
  return p;
}

/** Local-only approval is allowed ONLY in demo mode with no AI provider configured. */
export const allowLocalOnly = () => isDemoMode() && moderationProviders().length === 0 && config.moderation.allowLocalOnlyInDemo;

export async function moderate(
  base: Omit<ModerationInput, "rgba512">,
  overrides?: { providers?: ((i: ModerationInput) => Promise<ProviderOutput>)[] },
): Promise<ModerationResult> {
  const { data, info } = await sharp(base.image).resize(512, 512, { fit: "fill" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const input: ModerationInput = { ...base, rgba512: { data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), width: info.width, height: info.height } };

  const runners: ((i: ModerationInput) => Promise<ProviderOutput>)[] = overrides?.providers ?? [];
  if (!overrides?.providers) {
    if (config.moderation.anthropicKey)
      runners.push((i) => claudeModeration(i, { apiKey: config.moderation.anthropicKey, model: config.moderation.anthropicModel, timeoutMs: config.moderation.timeoutMs }));
    if (config.moderation.openaiKey)
      runners.push((i) => openaiModeration(i, { apiKey: config.moderation.openaiKey, timeoutMs: config.moderation.timeoutMs }));
  }

  const outputs: ProviderOutput[] = [localModeration(input)];
  const errors: string[] = [];
  const settled = await Promise.allSettled(runners.map((r) => r(input)));
  for (const s of settled) {
    if (s.status === "fulfilled") outputs.push(s.value);
    else errors.push(String((s.reason as Error)?.message ?? s.reason).slice(0, 300));
  }
  if (errors.length) console.error("[moderation] provider errors:", errors);
  return decide(outputs, errors, { allowLocalOnly: overrides?.providers ? false : allowLocalOnly() });
}
