/* OpenAI omni-moderation (text + image). A fast, inexpensive second opinion on
 * the core harm categories. Optional: enabled when OPENAI_API_KEY is set. */

import type { Category, ModerationInput, ProviderOutput, Signal } from "./types";

// [our category, multiplier]. "violence" alone is capped to review level:
// it fires on historical, religious and cultural imagery (swords, battles).
const MAP: Record<string, [Category, number]> = {
  hate: ["hate", 1],
  "hate/threatening": ["violence_incitement", 1],
  harassment: ["harassment", 1],
  "harassment/threatening": ["violence_incitement", 1],
  sexual: ["sexual", 1],
  "sexual/minors": ["minors", 1],
  violence: ["graphic_violence", 0.6],
  "violence/graphic": ["graphic_violence", 1],
  "self-harm": ["self_harm", 0.8],
  "self-harm/intent": ["self_harm", 1],
  "self-harm/instructions": ["self_harm", 1],
  illicit: ["illegal", 0.8],
  "illicit/violent": ["illegal", 1],
};

export async function openaiModeration(input: ModerationInput, opts: { apiKey: string; timeoutMs: number }): Promise<ProviderOutput> {
  const text = [input.displayName, input.title, input.description, input.country].filter(Boolean).join("\n");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs);
  try {
    const res = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${opts.apiKey}` },
      body: JSON.stringify({
        model: "omni-moderation-latest",
        input: [
          { type: "image_url", image_url: { url: `data:image/webp;base64,${input.image.toString("base64")}` } },
          ...(text ? [{ type: "text", text }] : []),
        ],
      }),
    });
    if (!res.ok) throw new Error(`openai ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as { results: { category_scores: Record<string, number> }[] };
    return parseOpenAI(json.results[0]?.category_scores ?? {});
  } finally {
    clearTimeout(timer);
  }
}

export function parseOpenAI(scores: Record<string, number>): ProviderOutput {
  const signals: Signal[] = [];
  for (const [k, v] of Object.entries(scores)) {
    const m = MAP[k];
    if (!m || !(v > 0.01)) continue;
    signals.push({ source: "openai", category: m[0], confidence: Math.min(1, v * m[1]), evidence: `${k} ${v.toFixed(3)}` });
  }
  return { provider: "openai", signals };
}
