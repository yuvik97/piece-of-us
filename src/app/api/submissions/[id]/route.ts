import { fail, json, limit } from "@/lib/http";
import { getRepo } from "@/lib/repo";
import { checkAccess, publicStatus } from "@/lib/service";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = await limit(req, "status", 60, 60);
  if (limited) return limited;
  const { id } = await params;
  const s = await getRepo().getSubmission(id);
  if (!checkAccess(s, new URL(req.url).searchParams.get("t"))) return fail(404, "not_found");
  return json(publicStatus(s), { headers: { "cache-control": "no-store" } });
}
