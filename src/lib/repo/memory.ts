/* In-memory repository for DEMO MODE (no Supabase credentials).
 * Mirrors the SQL functions in supabase/migrations/0001_init.sql one-to-one,
 * including atomic claims, idempotent payment confirmation and the audit log.
 * Data lives for the life of the server process. */

import { CURRENCY, PRICE_CENTS, TileState, TOTAL_TILES, pieceNumber } from "../grid";
import { generateFounding } from "../founding/layout";
import { foundingColor, foundingExtra, hexToInt, matchesSearch, toPublicFounding } from "./shared";
import type {
  AdminStats, ConfirmResult, FoundingRow, ModerationEvent, OverviewRecord, PublicStats, Report, Repo, Submission,
} from "./types";

interface Claim {
  kind: "reservation" | "submission" | "founding";
  tokenHash?: string;
  submissionId?: string;
  expiresAt?: number;
}

interface Store {
  claims: Map<number, Claim>;
  founding: Map<number, FoundingRow>;
  submissions: Map<string, Submission>;
  orders: Map<string, string>;
  objects: Map<string, Buffer>;
  rate: Map<string, { count: number; reset: number }>;
  events: ModerationEvent[];
  reports: Report[];
}

const g = globalThis as unknown as { __pouStore?: Store };

function store(): Store {
  if (g.__pouStore) return g.__pouStore;
  const s: Store = {
    claims: new Map(), founding: new Map(), submissions: new Map(), orders: new Map(),
    objects: new Map(), rate: new Map(), events: [], reports: [],
  };
  for (const f of generateFounding()) {
    s.founding.set(f.tile, { ...f, hidden: false });
    s.claims.set(f.tile, { kind: "founding" });
  }
  g.__pouStore = s;
  return s;
}

const now = () => Date.now();
const iso = (t = now()) => new Date(t).toISOString();

function liveClaim(s: Store, tile: number): Claim | undefined {
  const c = s.claims.get(tile);
  if (!c) return undefined;
  if (c.expiresAt !== undefined && c.expiresAt < now()) {
    s.claims.delete(tile);
    return undefined;
  }
  return c;
}

export function createMemoryRepo(): Repo {
  const s = store();
  const log = (e: Omit<ModerationEvent, "id" | "createdAt">) =>
    s.events.push({ ...e, id: s.events.length + 1, createdAt: iso() });

  const repo: Repo = {
    async overview() {
      const out: OverviewRecord[] = [];
      for (const tile of [...s.claims.keys()]) {
        const c = liveClaim(s, tile);
        if (!c) continue;
        if (c.kind === "founding") {
          const f = s.founding.get(tile)!;
          out.push({ tile, state: TileState.Founding, color: foundingColor(f), extra: foundingExtra(f) });
        } else if (c.kind === "reservation") {
          out.push({ tile, state: TileState.Reserved, color: 0, extra: 0 });
        } else {
          const sub = s.submissions.get(c.submissionId!)!;
          if (sub.status === "published") out.push({ tile, state: TileState.Published, color: hexToInt(sub.avgColor), extra: 1 });
          else out.push({ tile, state: sub.status === "in_review" || sub.status === "appealed" ? TileState.Pending : TileState.Reserved, color: 0, extra: 0 });
        }
      }
      return out.sort((a, b) => a.tile - b.tile);
    },

    async stats() {
      let founding = 0, contributions = 0, held = 0;
      for (const r of await repo.overview()) {
        if (r.state === TileState.Founding) founding++;
        else if (r.state === TileState.Published) contributions++;
        else held++;
      }
      return { founding, contributions, held, available: TOTAL_TILES - founding - contributions - held, updatedAt: iso() } satisfies PublicStats;
    },

    async adminStats() {
      const base = await repo.stats();
      const a = { revenueCents: 0, refundedCents: 0, paid: 0, published: 0, awaitingPayment: 0, inReview: 0, rejected: 0 };
      for (const sub of s.submissions.values()) {
        if (sub.paidAt) { a.revenueCents += sub.amountCents || 0; a.paid++; }
        if (sub.refundedAt) a.refundedCents += sub.amountCents || 0;
        if (sub.status === "published") a.published++;
        if (sub.status === "awaiting_payment") a.awaitingPayment++;
        if (sub.status === "in_review" || sub.status === "appealed") a.inReview++;
        if (sub.status === "rejected") a.rejected++;
      }
      return { ...base, ...a, openReports: s.reports.filter((r) => r.status === "open").length } satisfies AdminStats;
    },

    async publicPiece(tile) {
      const c = liveClaim(s, tile);
      if (!c) return null;
      if (c.kind === "founding") return toPublicFounding(s.founding.get(tile)!);
      if (c.kind !== "submission") return null;
      const sub = s.submissions.get(c.submissionId!)!;
      if (sub.status !== "published") return null;
      const n = pieceNumber(tile);
      return {
        tile, founding: false,
        title: sub.title, displayName: sub.displayName, country: sub.country, description: sub.description,
        publishedAt: sub.publishedAt, avgColor: sub.avgColor,
        contact: { instagram: sub.contactInstagram, email: sub.contactEmail, phone: sub.contactPhone },
        imageUrl: repo.publicUrl(`${n}/full.webp`), thumbUrl: repo.publicUrl(`${n}/thumb.webp`),
      };
    },

    async reserveTile(tile, tokenHash, minutes) {
      const c = liveClaim(s, tile);
      if (c && !(c.kind === "reservation" && c.tokenHash === tokenHash)) return { ok: false };
      const expiresAt = now() + minutes * 60_000;
      s.claims.set(tile, { kind: "reservation", tokenHash, expiresAt });
      return { ok: true, expiresAt: iso(expiresAt) };
    },

    async releaseReservation(tile, tokenHash) {
      const c = s.claims.get(tile);
      if (c?.kind === "reservation" && c.tokenHash === tokenHash) s.claims.delete(tile);
    },

    async createSubmission(input) {
      const c = liveClaim(s, input.tile);
      if (!c || c.kind !== "reservation" || c.tokenHash !== input.reservationTokenHash) return null;
      const m = input.moderation;
      const status = m.decision === "approved" ? "awaiting_payment" : m.decision === "rejected" ? "rejected" : "in_review";
      const hold = status === "rejected" ? null : now() + input.holdMinutes * 60_000;
      const sub: Submission = {
        id: input.id, tile: input.tile, status, ...input.meta,
        imagePath: input.imagePath, thumbPath: input.thumbPath, avgColor: input.avgColor,
        accessTokenHash: input.accessTokenHash, rightsConfirmed: true, ipHash: input.ipHash,
        holdUntil: hold ? iso(hold) : null,
        moderationDecision: m.decision, moderationCategories: m.categories, moderationScores: m.scores as Record<string, number>,
        moderationDetail: m.detail as unknown as Record<string, unknown>, moderationProvider: m.provider,
        extractedText: m.extractedText, moderatedAt: iso(), publicReason: m.publicReason,
        appealMessage: null, appealedAt: null, reviewedAt: null, reviewedBy: null,
        paymentProvider: null, paymentOrderId: null, paymentCaptureId: null, amountCents: null, currency: null,
        paidAt: null, publishedAt: null, refundId: null, refundedAt: null, notifiedAt: null, createdAt: iso(),
      };
      s.submissions.set(sub.id, sub);
      if (status === "rejected") s.claims.delete(input.tile);
      else s.claims.set(input.tile, { kind: "submission", submissionId: sub.id, expiresAt: hold! });
      log({ submissionId: sub.id, reportId: null, tile: sub.tile, actor: "system", action: "auto_decision", fromStatus: null, toStatus: status, note: null,
        data: { decision: m.decision, categories: m.categories, provider: m.provider } });
      return sub;
    },

    async getSubmission(id) {
      return s.submissions.get(id) ?? null;
    },

    async attachCheckout(id, provider, orderId) {
      const sub = s.submissions.get(id);
      if (!sub) return;
      sub.paymentProvider = provider;
      sub.paymentOrderId = orderId;
      s.orders.set(`${provider}:${orderId}`, id);
    },

    async confirmPayment({ provider, orderId, captureId, amountCents, currency }): Promise<ConfirmResult> {
      const id = s.orders.get(`${provider}:${orderId}`);
      const sub = id ? s.submissions.get(id) : undefined;
      if (!sub) return { result: "unknown" };
      if (sub.paidAt) return { result: "already", submission: sub };
      Object.assign(sub, { paidAt: iso(), paymentCaptureId: captureId, amountCents, currency });
      if (amountCents !== PRICE_CENTS || currency !== CURRENCY) return { result: "amount_mismatch", submission: sub };
      if (sub.status !== "awaiting_payment") return { result: "not_payable", submission: sub };
      const c = liveClaim(s, sub.tile);
      if (c && !(c.kind === "submission" && c.submissionId === sub.id)) return { result: "conflict", submission: sub };
      s.claims.set(sub.tile, { kind: "submission", submissionId: sub.id });
      sub.status = "published";
      sub.publishedAt = iso();
      sub.holdUntil = null;
      log({ submissionId: sub.id, reportId: null, tile: sub.tile, actor: "system", action: "publish", fromStatus: "awaiting_payment", toStatus: "published", note: null, data: {} });
      return { result: "confirmed", submission: sub };
    },

    async markRefunded(id, refundId, actor) {
      const sub = s.submissions.get(id);
      if (!sub) return;
      const from = sub.status;
      sub.refundId = refundId;
      sub.refundedAt = iso();
      if (sub.status !== "removed" && sub.status !== "rejected") sub.status = "refunded";
      log({ submissionId: id, reportId: null, tile: sub.tile, actor, action: "refund", fromStatus: from, toStatus: sub.status, note: null, data: { refundId } });
    },

    async markNotified(id) {
      const sub = s.submissions.get(id);
      if (sub) sub.notifiedAt = iso();
    },

    async moderate(id, action, actor, { reason = null, note = null, holdMinutes = 0 }) {
      const sub = s.submissions.get(id);
      if (!sub) return null;
      const from = sub.status;
      if (action === "approve") {
        if (!["in_review", "appealed", "rejected"].includes(sub.status)) return sub;
        const c = liveClaim(s, sub.tile);
        if (c && !(c.kind === "submission" && c.submissionId === sub.id)) throw new Error("square_taken");
        const hold = now() + holdMinutes * 60_000;
        s.claims.set(sub.tile, { kind: "submission", submissionId: sub.id, expiresAt: hold });
        Object.assign(sub, { status: "awaiting_payment", holdUntil: iso(hold), reviewedAt: iso(), reviewedBy: actor, publicReason: null });
      } else if (action === "reject" || action === "remove") {
        Object.assign(sub, {
          status: action === "remove" ? "removed" : "rejected", reviewedAt: iso(), reviewedBy: actor,
          publicReason: reason ?? sub.publicReason, holdUntil: null,
        });
        const c = s.claims.get(sub.tile);
        if (c?.kind === "submission" && c.submissionId === sub.id) s.claims.delete(sub.tile);
      }
      log({ submissionId: id, reportId: null, tile: sub.tile, actor, action, fromStatus: from, toStatus: sub.status, note, data: {} });
      return sub;
    },

    async appeal(id, message, holdMinutes) {
      const sub = s.submissions.get(id);
      if (!sub) return "not_found";
      if (sub.status !== "rejected" || sub.reviewedBy || sub.appealedAt) return "not_appealable";
      if (!liveClaim(s, sub.tile)) s.claims.set(sub.tile, { kind: "submission", submissionId: sub.id, expiresAt: now() + holdMinutes * 60_000 });
      Object.assign(sub, { status: "appealed", appealMessage: message, appealedAt: iso(), holdUntil: iso(now() + holdMinutes * 60_000) });
      log({ submissionId: id, reportId: null, tile: sub.tile, actor: "contributor", action: "appeal", fromStatus: "rejected", toStatus: "appealed", note: message, data: {} });
      return "ok";
    },

    async expireHolds() {
      let n = 0;
      for (const sub of s.submissions.values()) {
        if (sub.status === "awaiting_payment" && sub.holdUntil && Date.parse(sub.holdUntil) < now() && !sub.paidAt) {
          sub.status = "expired";
          n++;
        }
      }
      for (const t of [...s.claims.keys()]) liveClaim(s, t);
      return n;
    },

    async listSubmissions({ status, category, search, from, to, limit, offset }) {
      let rows = [...s.submissions.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      if (status === "needs_review") rows = rows.filter((r) => r.status === "in_review" || r.status === "appealed");
      else if (status && status !== "all") rows = rows.filter((r) => r.status === status);
      if (category) rows = rows.filter((r) => r.moderationCategories.includes(category));
      if (from) rows = rows.filter((r) => r.createdAt >= from);
      if (to) rows = rows.filter((r) => r.createdAt <= to + "T23:59:59.999Z");
      if (search) rows = rows.filter((r) => matchesSearch(r, search));
      return { rows: rows.slice(offset, offset + limit), total: rows.length };
    },

    async events(submissionId, limit = 100) {
      const rows = submissionId ? s.events.filter((e) => e.submissionId === submissionId) : s.events;
      return rows.slice(-limit).reverse();
    },

    async logEvent(e) {
      log(e);
    },

    async createReport(r) {
      if (s.reports.some((x) => x.tile === r.tile && x.status === "open" && (x as Report & { _h?: string })._h === r.reporterHash)) return "duplicate";
      const rep = {
        id: s.reports.length + 1, tile: r.tile, submissionId: r.submissionId, founding: r.founding, reason: r.reason,
        details: r.details, status: "open" as const, resolvedBy: null, resolvedAt: null, createdAt: iso(), _h: r.reporterHash,
      };
      s.reports.push(rep);
      return "ok";
    },

    async listReports({ status, limit, offset }) {
      let rows = [...s.reports].reverse();
      if (status && status !== "all") rows = rows.filter((r) => r.status === status);
      return { rows: rows.slice(offset, offset + limit).map(({ _h, ...r }: Report & { _h?: string }) => (void _h, r)), total: rows.length };
    },

    async resolveReport(id, status, actor, note) {
      const r = s.reports.find((x) => x.id === id);
      if (!r) return null;
      Object.assign(r, { status, resolvedBy: actor, resolvedAt: iso() });
      log({ submissionId: r.submissionId, reportId: id, tile: r.tile, actor, action: status === "dismissed" ? "report_dismiss" : "report_action", fromStatus: "open", toStatus: status, note, data: { reason: r.reason } });
      return r;
    },

    async listFounding({ limit, offset, hidden }) {
      let rows = [...s.founding.values()];
      if (hidden !== undefined) rows = rows.filter((r) => r.hidden === hidden);
      return { rows: rows.slice(offset, offset + limit), total: rows.length };
    },

    async setFoundingHidden(tile, hidden) {
      const f = s.founding.get(tile);
      if (!f) return { ok: false, reason: "not_found" };
      if (hidden) {
        f.hidden = true;
        if (s.claims.get(tile)?.kind === "founding") s.claims.delete(tile);
        return { ok: true };
      }
      if (liveClaim(s, tile)) return { ok: false, reason: "square_in_use" };
      f.hidden = false;
      s.claims.set(tile, { kind: "founding" });
      return { ok: true };
    },

    async rateLimit(key, windowSec, max) {
      const t = now();
      const e = s.rate.get(key);
      if (!e || e.reset < t) {
        s.rate.set(key, { count: 1, reset: t + windowSec * 1000 });
        return true;
      }
      e.count++;
      return e.count <= max;
    },

    async recordPaymentEvent(provider, eventId) {
      const k = `evt:${provider}:${eventId}`;
      if (s.rate.has(k)) return false;
      s.rate.set(k, { count: 1, reset: Number.MAX_SAFE_INTEGER });
      return true;
    },

    async retention() {
      const paths: string[] = [];
      const cutoff = now() - 30 * 86400_000;
      for (const sub of s.submissions.values()) {
        if (["rejected", "expired", "removed", "refunded"].includes(sub.status) && sub.imagePath !== "deleted") {
          const at = Date.parse(sub.reviewedAt || sub.holdUntil || sub.createdAt);
          if (at < cutoff) {
            paths.push(sub.imagePath, sub.thumbPath);
            sub.imagePath = sub.thumbPath = "deleted";
          }
        }
      }
      return paths;
    },

    async putObject(bucket, path, data) {
      s.objects.set(`${bucket}/${path}`, data);
    },
    async getObject(bucket, path) {
      return s.objects.get(`${bucket}/${path}`) ?? null;
    },
    async copyObject(fromPath, toPath) {
      const o = s.objects.get(`submissions/${fromPath}`);
      if (!o) throw new Error("source object missing");
      s.objects.set(`pieces/${toPath}`, o);
    },
    async removeObject(bucket, path) {
      s.objects.delete(`${bucket}/${path}`);
    },
    async privateUrl(path) {
      return `/api/admin/media/${path}`;
    },
    publicUrl(path) {
      return `/api/media/${path}`;
    },
  };
  return repo;
}
