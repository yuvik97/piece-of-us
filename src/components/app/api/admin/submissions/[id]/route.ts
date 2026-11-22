import { adminApi } from "@/lib/admin-auth";
import { fail, json, sameOrigin } from "@/lib/http";
import { moderatorAction } from "@/lib/service";

const ACTIONS = ["approve", "reject", "remove", "note", "republish"] as const;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return fail(403, "forbidden");
  const { session, status } = await adminApi("moderate");
  if (!session) return fail(status, "unauthorized");
  const body = await req.json().catch(() => ({}));
  if (!ACTIONS.includes(body.action)) return fail(400, "invalid_action");
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 2000) || null : null;
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) || null : null;
  if (body.action === "note" && !note) return fail(400, "note_required");
  const r = await moderatorAction((await params).id, body.action, `admin:${session.u}`, { reason, note });
  if (!r.ok) return fail(409, r.error!, r.error === "square_taken" ? "Another piece now holds this square, so this one can’t be approved for it." : r.error);
  return json({ ok: true, status: r.submission!.status });
}
