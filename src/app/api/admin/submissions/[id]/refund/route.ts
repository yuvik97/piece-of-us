import { adminApi } from "@/lib/admin-auth";
import { fail, json, sameOrigin } from "@/lib/http";
import { getRepo } from "@/lib/repo";
import { refundSubmission } from "@/lib/service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return fail(403, "forbidden");
  const { session, status } = await adminApi("refund");
  if (!session) return fail(status, "unauthorized");
  const s = await getRepo().getSubmission((await params).id);
  if (!s) return fail(404, "not_found");
  const r = await refundSubmission(s, `admin:${session.u}`);
  if (!r.ok) return fail(409, r.reason!);
  return json(r);
}
