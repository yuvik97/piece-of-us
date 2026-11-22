import type { Category, Decision, ModerationResult, ProviderOutput, Signal } from "./types";

/**
 * Thresholds per category. Anything at or above `reject` with high confidence
 * is blocked; anything at or above `review` goes to a human. Categories where
 * context decides (politics, copyright, extremism vs. history) are tuned so
 * that ambiguity lands in the review queue instead of an automatic rejection.
 */
export const THRESHOLDS: Record<Category, { review: number; reject: number }> = {
  minors:              { review: 0.1,  reject: 0.3 },
  sexual:              { review: 0.4,  reject: 0.85 },
  graphic_violence:    { review: 0.4,  reject: 0.85 },
  self_harm:           { review: 0.4,  reject: 0.85 },
  hate:                { review: 0.35, reject: 0.9 },
  extremism:           { review: 0.35, reject: 0.9 },
  violence_incitement: { review: 0.35, reject: 0.9 },
  harassment:          { review: 0.4,  reject: 0.9 },
  illegal:             { review: 0.4,  reject: 0.9 },
  commercial_spam:     { review: 0.5,  reject: 0.85 },
  privacy:             { review: 0.5,  reject: 0.92 },
  impersonation_fraud: { review: 0.5,  reject: 0.92 },
  political:           { review: 0.5,  reject: 0.95 },
  evasion:             { review: 0.4,  reject: 0.95 },
  copyright:           { review: 0.5,  reject: 1.01 }, // never automatic: needs identification
};

const REASON_GROUPS: [Category[], string][] = [
  [["minors", "sexual"], "It appears to include sexual or explicit content."],
  [["hate", "extremism", "violence_incitement", "harassment"], "It appears to include content that targets or excludes people, or promotes violence."],
  [["graphic_violence", "self_harm"], "It appears to include graphic or distressing content."],
  [["political"], "It appears to include political campaigning or propaganda."],
  [["commercial_spam"], "It appears to include advertising, links, QR codes or other promotion."],
  [["privacy", "impersonation_fraud"], "It appears to include someone’s private information, or content that could mislead people."],
  [["copyright"], "It appears to include artwork or imagery that may belong to someone else."],
  [["illegal", "evasion"], "It appears to include content that our guidelines don’t allow."],
];

export function publicReasonFor(categories: Category[]): string | null {
  for (const [group, text] of REASON_GROUPS) if (categories.some((c) => group.includes(c))) return text;
  return null;
}

export function decide(outputs: ProviderOutput[], errors: string[], opts: { allowLocalOnly: boolean }): ModerationResult {
  const signals: Signal[] = outputs.flatMap((o) => o.signals);
  const aiOutputs = outputs.filter((o) => o.provider !== "local");
  const aiAvailable = aiOutputs.length > 0;
  const reasons: string[] = [];

  // Highest confidence per category across providers.
  const scores: Partial<Record<Category, number>> = {};
  for (const s of signals) scores[s.category] = Math.max(scores[s.category] ?? 0, Math.min(1, Math.max(0, s.confidence)));

  let decision: Decision = "approved";
  const flagged: Category[] = [];
  for (const [cat, score] of Object.entries(scores) as [Category, number][]) {
    const t = THRESHOLDS[cat];
    if (score >= t.reject) {
      decision = "rejected";
      flagged.push(cat);
      reasons.push(`${cat} ≥ reject threshold (${score.toFixed(2)})`);
    } else if (score >= t.review) {
      if (decision === "approved") decision = "pending_review";
      flagged.push(cat);
      reasons.push(`${cat} ≥ review threshold (${score.toFixed(2)})`);
    }
  }

  // A provider's own verdict can raise caution, never lower it below thresholds.
  for (const o of aiOutputs) {
    if (o.suggested === "pending_review" && decision === "approved") {
      decision = "pending_review";
      reasons.push(`${o.provider} asked for human review`);
    }
    if (o.suggested === "rejected" && decision === "approved") {
      // Model says reject but no category crossed a threshold: a human decides.
      decision = "pending_review";
      reasons.push(`${o.provider} suggested rejection without a confident category`);
    }
  }

  // Fail closed: no AI verdict → never auto-approve (unless explicitly allowed in local/demo mode).
  if (!aiAvailable && decision === "approved" && !opts.allowLocalOnly) {
    decision = "pending_review";
    reasons.push("moderation service unavailable — sent to manual review");
  }

  const categories = [...new Set(flagged)];
  const summaries: Record<string, string> = {};
  for (const o of outputs) if (o.summary) summaries[o.provider] = o.summary;

  return {
    decision,
    categories,
    scores,
    provider: outputs.map((o) => o.provider).join("+") || "none",
    extractedText: aiOutputs.find((o) => o.extractedText)?.extractedText ?? null,
    publicReason: decision === "approved" ? null : publicReasonFor(categories),
    detail: {
      signals,
      summaries,
      protectedExpression: [...new Set(outputs.flatMap((o) => o.protectedExpression ?? []))],
      errors,
      aiAvailable,
      reasons,
    },
  };
}
