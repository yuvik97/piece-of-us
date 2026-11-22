import "server-only";
import { config } from "./config";
import { hmac, safeEqual, sha256 } from "./crypto";
import { CURRENCY, PRICE_CENTS, formatPieceNumber, pieceNumber } from "./grid";
import { notify } from "./notify";
import { paymentProvider, providerByName, type VerifiedPayment } from "./payments";
import { getRepo, type Submission } from "./repo";

/* ───────── Status links ─────────
 * Each submission has a private status link. The token is derived from the id
 * with a server secret, so it can be regenerated for e-mails without storing it. */
const statusSecret = () => process.env.STATUS_TOKEN_SECRET || config.adminSessionSecret;
export const accessTokenFor = (id: string) => hmac(statusSecret(), `status:${id}`).slice(0, 40);
export const statusUrl = (s: Pick<Submission, "id">) => `${config.siteUrl}/status/${s.id}?t=${accessTokenFor(s.id)}`;
export function checkAccess(s: Submission | null, token: string | null): s is Submission {
  if (!s || !token) return false;
  return safeEqual(sha256(token), s.accessTokenHash) && safeEqual(token, accessTokenFor(s.id));
}

/** What the contributor's status page may see. No moderation internals. */
export function publicStatus(s: Submission) {
  const appealable = s.status === "rejected" && !s.reviewedBy && !s.appealedAt;
  return {
    id: s.id,
    tile: s.tile,
    pieceNumber: pieceNumber(s.tile),
    status: s.status,
    title: s.title,
    displayName: s.displayName,
    country: s.country,
    description: s.description,
    avgColor: s.avgColor,
    holdUntil: s.holdUntil,
    publicReason: s.status === "rejected" || s.status === "removed" ? s.publicReason : null,
    appealable,
    appealed: !!s.appealedAt,
    paid: !!s.paidAt,
    refunded: !!s.refundedAt,
    publishedAt: s.publishedAt,
    createdAt: s.createdAt,
  };
}

/* ───────── Checkout ───────── */
export async function startCheckout(s: Submission) {
  if (s.status !== "awaiting_payment") throw new Error("not_payable");
  if (s.holdUntil && Date.parse(s.holdUntil) < Date.now()) throw new Error("hold_expired");
  const provider = paymentProvider();
  const token = accessTokenFor(s.id);
  const session = await provider.createCheckout({
    submissionId: s.id,
    idempotencyKey: `checkout-${s.id}-${s.paymentOrderId ?? "1"}`,
    amountCents: PRICE_CENTS,
    currency: CURRENCY,
    description: `PIECE OF US — square No. ${formatPieceNumber(pieceNumber(s.tile))}`,
    returnUrl: `${config.siteUrl}/api/payments/return/${provider.name}?sid=${s.id}&t=${token}`,
    cancelUrl: `${config.siteUrl}/status/${s.id}?t=${token}&cancelled=1`,
  });
  await getRepo().attachCheckout(s.id, provider.name, session.orderId);
  return session;
}

/* ───────── Payment confirmation (webhook + return URL share this) ───────── */
export async function confirmPayment(providerName: string, p: VerifiedPayment) {
  const repo = getRepo();
  const r = await repo.confirmPayment({ provider: providerName, ...p });
  if (r.result === "unknown") return r;
  const s = r.submission;
  if (r.result === "confirmed") {
    await publishMedia(s);
    await notifyOnce("published", s);
  } else if (r.result === "conflict" || r.result === "amount_mismatch" || r.result === "not_payable") {
    // Paid, but it can't be published (square lost, wrong amount, or no longer approved) → full refund.
    await refundSubmission(s, "system");
  }
  return r;
}

async function publishMedia(s: Submission) {
  const repo = getRepo();
  const n = pieceNumber(s.tile);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await repo.copyObject(s.imagePath, `${n}/full.webp`);
      await repo.copyObject(s.thumbPath, `${n}/thumb.webp`);
      return;
    } catch (e) {
      if (attempt === 2) {
        console.error("[publish] media copy failed", s.id, e);
        await repo.logEvent({ submissionId: s.id, reportId: null, tile: s.tile, actor: "system", action: "note", fromStatus: s.status, toStatus: s.status, note: "Media copy to public bucket failed — use 'Republish media' in admin.", data: {} });
      }
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
}
export const republishMedia = publishMedia;

export async function refundSubmission(s: Submission, actor: string) {
  if (!s.paidAt || s.refundedAt || !s.paymentCaptureId || !s.paymentProvider) return { ok: false, reason: "not_refundable" };
  const provider = providerByName(s.paymentProvider);
  if (!provider) return { ok: false, reason: "unknown_provider" };
  try {
    const { refundId } = await provider.refund(s.paymentCaptureId, `refund-${s.id}`);
    await getRepo().markRefunded(s.id, refundId, actor);
    const fresh = await getRepo().getSubmission(s.id);
    if (fresh && fresh.status !== "removed") await notifyOnce("refunded", fresh);
    return { ok: true, refundId };
  } catch (e) {
    console.error("[refund] failed", s.id, e);
    await getRepo().logEvent({ submissionId: s.id, reportId: null, tile: s.tile, actor, action: "note", fromStatus: s.status, toStatus: s.status, note: `Refund failed: ${String((e as Error).message).slice(0, 200)}`, data: {} });
    return { ok: false, reason: "provider_error" };
  }
}

/* ───────── Moderator actions ───────── */
export async function moderatorAction(
  id: string,
  action: "approve" | "reject" | "remove" | "note" | "republish",
  actor: string,
  opts: { reason?: string | null; note?: string | null },
) {
  const repo = getRepo();
  const before = await repo.getSubmission(id);
  if (!before) return { ok: false, error: "not_found" };

  if (action === "republish") {
    if (before.status !== "published") return { ok: false, error: "not_published" };
    await publishMedia(before);
    return { ok: true, submission: before };
  }

  let after: Submission | null;
  try {
    after = await repo.moderate(id, action, actor, { reason: opts.reason, note: opts.note, holdMinutes: config.approvedHoldMinutes });
  } catch (e) {
    if ((e as Error).message === "square_taken") return { ok: false, error: "square_taken" };
    throw e;
  }
  if (!after) return { ok: false, error: "not_found" };

  if (action === "approve" && before.status !== after.status) await notifyOnce("approved", after);
  if (action === "reject" && before.status !== "rejected") {
    if (after.paidAt && !after.refundedAt) await refundSubmission(after, actor);
    await notifyOnce("rejected", after);
  }
  if (action === "remove") {
    const n = pieceNumber(after.tile);
    await repo.removeObject("pieces", `${n}/full.webp`);
    await repo.removeObject("pieces", `${n}/thumb.webp`);
    if (after.paidAt && !after.refundedAt) await refundSubmission(after, actor);
    await notifyOnce("removed", after);
  }
  return { ok: true, submission: (await repo.getSubmission(id))! };
}

async function notifyOnce(kind: Parameters<typeof notify>[0], s: Submission) {
  const sent = await notify(kind, s, statusUrl(s));
  if (sent) await getRepo().markNotified(s.id);
}
export { notifyOnce };
