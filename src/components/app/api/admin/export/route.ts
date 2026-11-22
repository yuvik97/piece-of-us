import { adminApi } from "@/lib/admin-auth";
import { fail } from "@/lib/http";
import { getRepo, type Submission } from "@/lib/repo";

const COLS: [string, (s: Submission) => unknown][] = [
  ["piece_number", (s) => s.tile + 1], ["id", (s) => s.id], ["status", (s) => s.status], ["created_at", (s) => s.createdAt],
  ["display_name", (s) => s.displayName], ["country", (s) => s.country], ["title", (s) => s.title], ["description", (s) => s.description],
  ["moderation_decision", (s) => s.moderationDecision], ["moderation_categories", (s) => s.moderationCategories.join("|")],
  ["reviewed_by", (s) => s.reviewedBy], ["reviewed_at", (s) => s.reviewedAt],
  ["payment_provider", (s) => s.paymentProvider], ["payment_order_id", (s) => s.paymentOrderId], ["payment_capture_id", (s) => s.paymentCaptureId],
  ["amount_cents", (s) => s.amountCents], ["currency", (s) => s.currency], ["paid_at", (s) => s.paidAt],
  ["published_at", (s) => s.publishedAt], ["refund_id", (s) => s.refundId], ["refunded_at", (s) => s.refundedAt],
];

const cell = (v: unknown) => {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // CSV/formula injection guard
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(req: Request) {
  const { session, status } = await adminApi("export");
  if (!session) return fail(status, "unauthorized");
  const url = new URL(req.url);
  const st = (url.searchParams.get("status") || "all") as "all";
  const repo = getRepo();
  const all: Submission[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { rows } = await repo.listSubmissions({ status: st, limit: 1000, offset });
    all.push(...rows);
    if (rows.length < 1000) break;
  }
  const csv = [COLS.map((c) => c[0]).join(","), ...all.map((s) => COLS.map(([, f]) => cell(f(s))).join(","))].join("\n");
  await repo.logEvent({ submissionId: null, reportId: null, tile: null, actor: `admin:${session.u}`, action: "export", fromStatus: null, toStatus: null, note: null, data: { rows: all.length, status: st } });
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="piece-of-us-contributions-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
