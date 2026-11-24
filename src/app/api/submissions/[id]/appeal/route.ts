import { config } from "@/lib/config";
import { fail, json, limit, sameOrigin } from "@/lib/http";
import { getRepo } from "@/lib/repo";
import { checkAccess, publicStatus } from "@/lib/service";

/** Ask for a human review of an automated rejection (once per submission). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return fail(403, "forbidden");
  const limited = await limit(req, "appeal", 3600, 5);
  if (limited) return limited;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const repo = getRepo();
  const s = await repo.getSubmission(id);
  if (!checkAccess(s, body.t ?? null)) return fail(404, "not_found");
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 500) : "";
  const r = await repo.appeal(id, message, config.reviewHoldMinutes);
  if (r !== "ok") return fail(409, r, "This piece can’t be sent for review.");
  return json(publicStatus((await repo.getSubmission(id))!));
}
