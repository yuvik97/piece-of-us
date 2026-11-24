import { isValidTile, tileFromPieceNumber } from "@/lib/grid";
import { fail, ipHash, json, limit, sameOrigin } from "@/lib/http";
import { getRepo, type ReportReason } from "@/lib/repo";

const REASONS: ReportReason[] = ["hate", "violence", "sexual", "political", "copyright", "privacy", "spam", "other"];

/** Visitor reports. Reports never remove anything automatically — they go to moderators. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "forbidden");
  // Per-person limits blunt coordinated mass-reporting.
  const limited = (await limit(req, "report-h", 3600, 5)) || (await limit(req, "report-d", 86400, 15));
  if (limited) return limited;
  const body = await req.json().catch(() => ({}));
  const tile = tileFromPieceNumber(Number(body.pieceNumber));
  if (!isValidTile(tile)) return fail(400, "invalid_piece");
  if (!REASONS.includes(body.reason)) return fail(400, "invalid_reason");
  const details = typeof body.details === "string" ? body.details.trim().slice(0, 500) || null : null;
  const repo = getRepo();
  const piece = await repo.publicPiece(tile);
  if (!piece) return fail(404, "not_found");
  let submissionId: string | null = null;
  if (!piece.founding) {
    const { rows } = await repo.listSubmissions({ status: "published", search: String(tile + 1), limit: 1, offset: 0 });
    submissionId = rows[0]?.id ?? null;
  }
  const r = await repo.createReport({ tile, submissionId, founding: piece.founding, reason: body.reason, details, reporterHash: ipHash(req) });
  return json({ ok: true, duplicate: r === "duplicate" });
}
