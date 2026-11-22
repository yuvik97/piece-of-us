/* Deterministic server-side checks that run on every submission, alongside the
 * AI providers. They catch things models are inconsistent about (QR codes,
 * links, contact details, obfuscation) and a short list of unambiguous hate
 * codes. They are a floor, not the moderation system: on their own they never
 * auto-approve in production (see policy.ts). */

import jsQR from "jsqr";
import type { ModerationInput, ProviderOutput, Signal } from "./types";

const ZERO_WIDTH = /[​-‏‪-‮⁠-⁤﻿]/g;
const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i" };

export function normalise(s: string) {
  return s
    .normalize("NFKC")
    .replace(ZERO_WIDTH, "")
    .toLowerCase()
    .replace(/[013457@$!]/g, (c) => LEET[c] ?? c)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
/** Also collapse spacing: "k i l l" → "kill" */
const squash = (s: string) => normalise(s).replace(/\s/g, "");

const URL_RE = /\b((https?:\/\/|www\.)\S+|[a-z0-9-]{2,}\s*(\.|\(dot\)|\[dot\]|\sdot\s)\s*(com|net|org|io|co|me|ly|shop|store|xyz|app|link|gg|tv|il)\b)/i;
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/;
const HANDLE_RE = /(^|\s)@[a-z0-9_.]{3,}/i;
const CRYPTO_RE = /\b(0x[a-f0-9]{40}|[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{25,60})\b/;

const PROMO = [
  "buy now", "discount", "promo code", "coupon", "free shipping", "percent off", "order now", "follow me", "subscribe",
  "dm me", "link in bio", "casino", "betting", "airdrop", "giveaway", "visit our", "shop now", "for sale",
  "מבצע", "הנחה", "קוד קופון", "خصم", "تخفيض", "descuento", "promoción", "réduction",
];

// Unambiguous hate codes / slogans (normalised, spaces removed). Deliberately
// short: context-dependent words are left to the AI + human review.
const HATE_CODES = ["1488", "heilhitler", "siegheil", "whitepower", "gasthejews", "sixmillionwasntenough", "hhitler"];
const INCITEMENT = [
  "killall", "deathtoall", "gasthe", "exterminate", "ethniccleansing",
  "מוותל", "מוות ל", "الموتل", "الموت ل", "смертьвсем",
];

function textSignals(label: string, raw: string | null): Signal[] {
  if (!raw) return [];
  const out: Signal[] = [];
  const n = normalise(raw);
  const sq = squash(raw);
  const sqRaw = raw.normalize("NFKC").replace(ZERO_WIDTH, "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const padded = ` ${n} `;
  const ev = (e: string) => `${label}: “${raw.slice(0, 80)}” (${e})`;

  if (ZERO_WIDTH.test(raw)) out.push({ source: "local", category: "evasion", confidence: 0.5, evidence: ev("hidden characters") });
  ZERO_WIDTH.lastIndex = 0;
  const noEmail = raw.replace(/[^\s@]+@[^\s@]+\.[a-z]{2,}/gi, " ");
  if (URL_RE.test(noEmail) || URL_RE.test(normalise(noEmail).replace(/ dot /g, "."))) out.push({ source: "local", category: "commercial_spam", confidence: 0.9, evidence: ev("link") });
  if (EMAIL_RE.test(raw)) out.push({ source: "local", category: "privacy", confidence: 0.6, evidence: ev("e-mail address") });
  if (PHONE_RE.test(raw) && raw.replace(/\D/g, "").length >= 8) out.push({ source: "local", category: "privacy", confidence: 0.6, evidence: ev("phone number") });
  if (HANDLE_RE.test(raw)) out.push({ source: "local", category: "commercial_spam", confidence: 0.55, evidence: ev("social handle") });
  if (CRYPTO_RE.test(raw)) out.push({ source: "local", category: "impersonation_fraud", confidence: 0.7, evidence: ev("wallet address") });
  if (PROMO.some((p) => padded.includes(` ${p} `))) out.push({ source: "local", category: "commercial_spam", confidence: 0.6, evidence: ev("promotional wording") });
  const code = HATE_CODES.find((h) => sq.includes(h) || sqRaw.includes(h));
  // numeric codes can be innocent (a year, a house number) → human review, not rejection
  if (code) out.push({ source: "local", category: "hate", confidence: /^\d+$/.test(code) ? 0.6 : 0.95, evidence: ev("known hate code") });
  if (INCITEMENT.some((h) => sq.includes(h.replace(/\s/g, "")) || n.includes(h)))
    out.push({ source: "local", category: "violence_incitement", confidence: 0.7, evidence: ev("call for violence") });
  return out;
}

export function detectQr(rgba: ModerationInput["rgba512"]): string | null {
  try {
    const r = jsQR(rgba.data, rgba.width, rgba.height, { inversionAttempts: "attemptBoth" });
    return r ? r.data || "(empty)" : null;
  } catch {
    return null;
  }
}

export function localModeration(input: ModerationInput): ProviderOutput {
  const signals: Signal[] = [
    ...textSignals("display name", input.displayName),
    ...textSignals("title", input.title),
    ...textSignals("description", input.description),
    ...textSignals("country", input.country),
  ];
  const qr = detectQr(input.rgba512);
  if (qr) {
    const isLink = /^(https?:|www\.)|\.[a-z]{2,}(\/|$)/i.test(qr);
    signals.push({
      source: "qr",
      category: "commercial_spam",
      confidence: isLink ? 0.95 : 0.6,
      evidence: `QR code in image${isLink ? ` linking to ${qr.slice(0, 80)}` : ""}`,
    });
  }
  return { provider: "local", signals };
}
