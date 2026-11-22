import { adminApi } from "@/lib/admin-auth";
import { fail, json, sameOrigin } from "@/lib/http";
import { getRepo } from "@/lib/repo";
import { moderatorAction } from "@/lib/service";

/** Resolve a visitor report. "action" + removePiece takes the artwork down (and refunds). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return fail(403, "forbidden");
  const { session, status } = await adminApi("moderate");
  if (!session) return fail(status, "unauthorized");
  const body = await req.json().catch(() => ({}));
  if (!["dismissed", "actioned"].includes(body.status)) return fail(400, "invalid_status");
  const note = typeof body.note === "string" ? body.note.slice(0, 2000) : null;
  const repo = getRepo();
  const id = Number((await params).id);
  const actor = `admin:${session.u}`;
  const { rows } = await repo.listReports({ status: "all", limit: 1000, offset: 0 });
  const report = rows.find((r) => r.id === id);
  if (!report) return fail(404, "not_found");
  if (body.status === "actioned" && body.removePiece) {
    if (report.founding) {
      const r = await repo.setFoundingHidden(report.tile, true);
      if (!r.ok) return fail(409, r.reason || "error");
    } else if (report.submissionId) {
      const r = await moderatorAction(report.submissionId, "remove", actor, { reason: typeof body.reason === "string" ? body.reason : null, note });
      if (!r.ok) return fail(409, r.error!);
    }
  }
  await repo.resolveReport(id, body.status, actor, note);
  return json({ ok: true });
}
