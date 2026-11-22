/* Supabase (PostgreSQL + Storage) repository. Server-only: uses the service-role key.
 * Every state change that must be atomic goes through a SQL function defined
 * in supabase/migrations/0001_init.sql. */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config";
import { TileState, TOTAL_TILES, pieceNumber } from "../grid";
import { foundingColor, foundingExtra, hexToInt, toPublicFounding } from "./shared";
import type {
  AdminStats, ConfirmResult, FoundingRow, ModerationEvent, OverviewRecord, PublicStats, Report, Repo, Submission,
} from "./types";

type Row = Record<string, unknown>;

const toSub = (r: Row): Submission => ({
  id: r.id as string,
  tile: r.tile as number,
  status: r.status as Submission["status"],
  displayName: (r.display_name as string) ?? null,
  country: (r.country as string) ?? null,
  title: (r.title as string) ?? null,
  description: (r.description as string) ?? null,
  email: (r.email as string) ?? null,
  contactInstagram: (r.contact_instagram as string) ?? null,
  contactEmail: (r.contact_email as string) ?? null,
  contactPhone: (r.contact_phone as string) ?? null,
  imagePath: r.image_path as string,
  thumbPath: r.thumb_path as string,
  avgColor: r.avg_color as string,
  accessTokenHash: r.access_token_hash as string,
  rightsConfirmed: !!r.rights_confirmed,
  ipHash: (r.ip_hash as string) ?? null,
  holdUntil: (r.hold_until as string) ?? null,
  moderationDecision: (r.moderation_decision as Submission["moderationDecision"]) ?? null,
  moderationCategories: (r.moderation_categories as string[]) ?? [],
  moderationScores: (r.moderation_scores as Record<string, number>) ?? {},
  moderationDetail: (r.moderation_detail as Record<string, unknown>) ?? {},
  moderationProvider: (r.moderation_provider as string) ?? null,
  extractedText: (r.extracted_text as string) ?? null,
  moderatedAt: (r.moderated_at as string) ?? null,
  publicReason: (r.public_reason as string) ?? null,
  appealMessage: (r.appeal_message as string) ?? null,
  appealedAt: (r.appealed_at as string) ?? null,
  reviewedAt: (r.reviewed_at as string) ?? null,
  reviewedBy: (r.reviewed_by as string) ?? null,
  paymentProvider: (r.payment_provider as string) ?? null,
  paymentOrderId: (r.payment_order_id as string) ?? null,
  paymentCaptureId: (r.payment_capture_id as string) ?? null,
  amountCents: (r.amount_cents as number) ?? null,
  currency: (r.currency as string) ?? null,
  paidAt: (r.paid_at as string) ?? null,
  publishedAt: (r.published_at as string) ?? null,
  refundId: (r.refund_id as string) ?? null,
  refundedAt: (r.refunded_at as string) ?? null,
  notifiedAt: (r.notified_at as string) ?? null,
  createdAt: r.created_at as string,
});

const toEvent = (r: Row): ModerationEvent => ({
  id: r.id as number, submissionId: (r.submission_id as string) ?? null, reportId: (r.report_id as number) ?? null,
  tile: (r.tile as number) ?? null, actor: r.actor as string, action: r.action as string,
  fromStatus: (r.from_status as string) ?? null, toStatus: (r.to_status as string) ?? null,
  note: (r.note as string) ?? null, data: (r.data as Record<string, unknown>) ?? {}, createdAt: r.created_at as string,
});

const toReport = (r: Row): Report => ({
  id: r.id as number, tile: r.tile as number, submissionId: (r.submission_id as string) ?? null, founding: !!r.founding,
  reason: r.reason as Report["reason"], details: (r.details as string) ?? null, status: r.status as Report["status"],
  resolvedBy: (r.resolved_by as string) ?? null, resolvedAt: (r.resolved_at as string) ?? null, createdAt: r.created_at as string,
});

function must<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(`supabase: ${res.error.message}`);
  return res.data;
}

let client: SupabaseClient | null = null;
const db = () =>
  (client ??= createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }));

export function createSupabaseRepo(): Repo {
  const repo: Repo = {
    async overview() {
      const rows = must(await db().rpc("mosaic_overview")) as [number, number, string | null, number | null, number | null, number | null][];
      return rows.map(([tile, st, col, k, sd, p]): OverviewRecord => {
        if (st === TileState.Founding && k !== null) {
          const f = { kind: k, seed: sd!, palette: p! };
          return { tile, state: st, color: foundingColor(f), extra: foundingExtra(f) };
        }
        return { tile, state: st as TileState, color: col ? hexToInt(col) : 0, extra: st === TileState.Published ? 1 : 0 };
      });
    },

    async stats() {
      let founding = 0, contributions = 0, held = 0;
      for (const r of await repo.overview()) {
        if (r.state === TileState.Founding) founding++;
        else if (r.state === TileState.Published) contributions++;
        else held++;
      }
      return { founding, contributions, held, available: TOTAL_TILES - founding - contributions - held, updatedAt: new Date().toISOString() } satisfies PublicStats;
    },

    async adminStats() {
      const base = await repo.stats();
      const m = must(await db().rpc("admin_money")) as Record<string, number>;
      return {
        ...base,
        revenueCents: m.revenue_cents, refundedCents: m.refunded_cents, paid: m.paid, published: m.published,
        awaitingPayment: m.awaiting, inReview: m.in_review, rejected: m.rejected, openReports: m.open_reports,
      } satisfies AdminStats;
    },

    async publicPiece(tile) {
      const f = must(await db().from("founding_pieces").select("*").eq("tile", tile).eq("hidden", false).maybeSingle());
      if (f) return toPublicFounding(f as FoundingRow);
      const s = must(await db().from("submissions").select("*").eq("tile", tile).eq("status", "published").maybeSingle());
      if (!s) return null;
      const sub = toSub(s);
      const n = pieceNumber(tile);
      return {
        tile, founding: false, title: sub.title, displayName: sub.displayName, country: sub.country,
        description: sub.description, publishedAt: sub.publishedAt, avgColor: sub.avgColor,
        contact: { instagram: sub.contactInstagram, email: sub.contactEmail, phone: sub.contactPhone },
        imageUrl: repo.publicUrl(`${n}/full.webp`), thumbUrl: repo.publicUrl(`${n}/thumb.webp`),
      };
    },

    async reserveTile(tile, tokenHash, minutes) {
      const exp = must(await db().rpc("reserve_tile", { p_tile: tile, p_token_hash: tokenHash, p_minutes: minutes })) as string | null;
      return exp ? { ok: true, expiresAt: exp } : { ok: false };
    },

    async releaseReservation(tile, tokenHash) {
      must(await db().rpc("release_tile", { p_tile: tile, p_token_hash: tokenHash }));
    },

    async createSubmission(i) {
      const m = i.moderation;
      const row = must(
        await db().rpc("create_submission", {
          p_id: i.id, p_tile: i.tile, p_token_hash: i.reservationTokenHash, p_access_hash: i.accessTokenHash,
          p_display_name: i.meta.displayName, p_country: i.meta.country, p_title: i.meta.title,
          p_description: i.meta.description, p_email: i.meta.email,
          p_contact_instagram: i.meta.contactInstagram, p_contact_email: i.meta.contactEmail, p_contact_phone: i.meta.contactPhone,
          p_image_path: i.imagePath, p_thumb_path: i.thumbPath, p_avg_color: i.avgColor, p_ip_hash: i.ipHash,
          p_decision: m.decision, p_categories: m.categories, p_scores: m.scores, p_detail: m.detail,
          p_provider: m.provider, p_extracted_text: m.extractedText, p_public_reason: m.publicReason,
          p_hold_minutes: i.holdMinutes,
        }),
      ) as Row | null;
      return row && row.id ? toSub(row) : null;
    },

    async getSubmission(id) {
      if (!/^[0-9a-f-]{36}$/.test(id)) return null;
      const r = must(await db().from("submissions").select("*").eq("id", id).maybeSingle());
      return r ? toSub(r) : null;
    },

    async attachCheckout(id, provider, orderId) {
      must(await db().from("submissions").update({ payment_provider: provider, payment_order_id: orderId }).eq("id", id));
    },

    async confirmPayment({ provider, orderId, captureId, amountCents, currency }): Promise<ConfirmResult> {
      const rows = must(await db().rpc("confirm_payment", {
        p_provider: provider, p_order_id: orderId, p_capture_id: captureId, p_amount: amountCents, p_currency: currency,
      })) as { result: string; submission_id: string | null }[];
      const r = rows[0];
      if (!r || r.result === "unknown" || !r.submission_id) return { result: "unknown" };
      const sub = await repo.getSubmission(r.submission_id);
      return { result: r.result as Exclude<ConfirmResult["result"], "unknown">, submission: sub! };
    },

    async markRefunded(id, refundId, actor) {
      const sub = await repo.getSubmission(id);
      if (!sub) return;
      const status = sub.status === "removed" || sub.status === "rejected" ? sub.status : "refunded";
      must(await db().from("submissions").update({ refund_id: refundId, refunded_at: new Date().toISOString(), status }).eq("id", id));
      await repo.logEvent({ submissionId: id, reportId: null, tile: sub.tile, actor, action: "refund", fromStatus: sub.status, toStatus: status, note: null, data: { refundId } });
    },

    async markNotified(id) {
      must(await db().from("submissions").update({ notified_at: new Date().toISOString() }).eq("id", id));
    },

    async moderate(id, action, actor, { reason = null, note = null, holdMinutes = 0 }) {
      const res = await db().rpc("moderate_submission", {
        p_id: id, p_action: action, p_actor: actor, p_reason: reason, p_note: note, p_hold_minutes: holdMinutes,
      });
      if (res.error) throw new Error(res.error.message.includes("square_taken") ? "square_taken" : res.error.message);
      return res.data && (res.data as Row).id ? toSub(res.data as Row) : null;
    },

    async appeal(id, message, holdMinutes) {
      return must(await db().rpc("appeal_submission", { p_id: id, p_message: message, p_hold_minutes: holdMinutes })) as "ok";
    },

    async expireHolds() {
      return must(await db().rpc("expire_holds")) as number;
    },

    async listSubmissions({ status, category, search, from, to, limit, offset }) {
      let q = db().from("submissions").select("*", { count: "exact" }).order("created_at", { ascending: false });
      if (status === "needs_review") q = q.in("status", ["in_review", "appealed"]);
      else if (status && status !== "all") q = q.eq("status", status);
      if (category) q = q.contains("moderation_categories", [category]);
      if (from) q = q.gte("created_at", from);
      if (to) q = q.lte("created_at", `${to}T23:59:59.999Z`);
      if (search) {
        const n = search.replace(/[#,\s]/g, "");
        const safe = search.replace(/[%,()]/g, " ").trim();
        if (/^\d+$/.test(n)) q = q.eq("tile", Number(n) - 1);
        else if (/^[0-9a-f-]{36}$/i.test(safe)) q = q.eq("id", safe);
        else q = q.or(["display_name", "title", "description", "country", "payment_order_id", "extracted_text"].map((c) => `${c}.ilike.%${safe}%`).join(","));
      }
      const res = await q.range(offset, offset + limit - 1);
      if (res.error) throw new Error(res.error.message);
      return { rows: (res.data ?? []).map(toSub), total: res.count ?? 0 };
    },

    async events(submissionId, limit = 100) {
      let q = db().from("moderation_events").select("*").order("created_at", { ascending: false }).limit(limit);
      if (submissionId) q = q.eq("submission_id", submissionId);
      return (must(await q) ?? []).map(toEvent);
    },

    async logEvent(e) {
      must(await db().from("moderation_events").insert({
        submission_id: e.submissionId, report_id: e.reportId, tile: e.tile, actor: e.actor, action: e.action,
        from_status: e.fromStatus, to_status: e.toStatus, note: e.note, data: e.data,
      }));
    },

    async createReport(r) {
      const res = await db().from("reports").insert({
        tile: r.tile, submission_id: r.submissionId, founding: r.founding, reason: r.reason, details: r.details, reporter_hash: r.reporterHash,
      });
      if (res.error) {
        if (res.error.code === "23505") return "duplicate";
        throw new Error(res.error.message);
      }
      return "ok";
    },

    async listReports({ status, limit, offset }) {
      let q = db().from("reports").select("id,tile,submission_id,founding,reason,details,status,resolved_by,resolved_at,created_at", { count: "exact" }).order("created_at", { ascending: false });
      if (status && status !== "all") q = q.eq("status", status);
      const res = await q.range(offset, offset + limit - 1);
      if (res.error) throw new Error(res.error.message);
      return { rows: (res.data ?? []).map(toReport), total: res.count ?? 0 };
    },

    async resolveReport(id, status, actor, note) {
      const r = must(await db().from("reports").update({ status, resolved_by: actor, resolved_at: new Date().toISOString() }).eq("id", id).select().maybeSingle());
      if (!r) return null;
      const rep = toReport(r);
      await repo.logEvent({ submissionId: rep.submissionId, reportId: id, tile: rep.tile, actor, action: status === "dismissed" ? "report_dismiss" : "report_action", fromStatus: "open", toStatus: status, note, data: { reason: rep.reason } });
      return rep;
    },

    async listFounding({ limit, offset, hidden }) {
      let q = db().from("founding_pieces").select("tile,kind,seed,palette,hidden", { count: "exact" }).order("tile");
      if (hidden !== undefined) q = q.eq("hidden", hidden);
      const res = await q.range(offset, offset + limit - 1);
      if (res.error) throw new Error(res.error.message);
      return { rows: (res.data ?? []) as FoundingRow[], total: res.count ?? 0 };
    },

    async setFoundingHidden(tile, hidden) {
      const r = must(await db().rpc("set_founding_hidden", { p_tile: tile, p_hidden: hidden })) as string;
      return r === "ok" ? { ok: true } : { ok: false, reason: r };
    },

    async rateLimit(key, windowSec, max) {
      const res = await db().rpc("hit_rate_limit", { p_key: key, p_window_seconds: windowSec, p_max: max });
      if (res.error) return true; // never lock everyone out because the limiter failed
      return res.data as boolean;
    },

    async recordPaymentEvent(provider, eventId, type, payload) {
      const res = await db().from("payment_events").insert({ provider, event_id: eventId, event_type: type, payload });
      if (res.error) {
        if (res.error.code === "23505") return false;
        throw new Error(res.error.message);
      }
      return true;
    },

    async retention() {
      return (must(await db().rpc("apply_retention")) as string[]) ?? [];
    },

    async putObject(bucket, path, data, contentType) {
      must(await db().storage.from(bucket).upload(path, data, { contentType, upsert: false, cacheControl: bucket === "pieces" ? "31536000" : "0" }));
    },
    async getObject(bucket, path) {
      const res = await db().storage.from(bucket).download(path);
      if (res.error || !res.data) return null;
      return Buffer.from(await res.data.arrayBuffer());
    },
    async copyObject(fromPath, toPath) {
      const buf = await repo.getObject("submissions", fromPath);
      if (!buf) throw new Error("source object missing");
      const res = await db().storage.from("pieces").upload(toPath, buf, { contentType: "image/webp", upsert: true, cacheControl: "31536000" });
      if (res.error) throw new Error(res.error.message);
    },
    async removeObject(bucket, path) {
      await db().storage.from(bucket).remove([path]);
    },
    async privateUrl(path) {
      const r = must(await db().storage.from("submissions").createSignedUrl(path, 600));
      return r?.signedUrl ?? "";
    },
    publicUrl(path) {
      return `${config.supabaseUrl}/storage/v1/object/public/pieces/${path}`;
    },
  };
  return repo;
}
