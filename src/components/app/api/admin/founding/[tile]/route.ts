import { adminApi } from "@/lib/admin-auth";
import { isValidTile } from "@/lib/grid";
import { fail, json, sameOrigin } from "@/lib/http";
import { getRepo } from "@/lib/repo";

export async function POST(req: Request, { params }: { params: Promise<{ tile: string }> }) {
  if (!sameOrigin(req)) return fail(403, "forbidden");
  const { session, status } = await adminApi("founding");
  if (!session) return fail(status, "unauthorized");
  const tile = Number((await params).tile);
  if (!isValidTile(tile)) return fail(400, "invalid_tile");
  const { hidden } = await req.json().catch(() => ({}));
  const repo = getRepo();
  const r = await repo.setFoundingHidden(tile, !!hidden);
  if (!r.ok) return fail(409, r.reason || "error");
  await repo.logEvent({ submissionId: null, reportId: null, tile, actor: `admin:${session.u}`, action: hidden ? "founding_hide" : "founding_restore", fromStatus: null, toStatus: null, note: null, data: {} });
  return json({ ok: true });
}
