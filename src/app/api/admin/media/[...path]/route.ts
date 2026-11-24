import { adminApi } from "@/lib/admin-auth";
import { getRepo } from "@/lib/repo";

/** Private submission images — moderators only. */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { session } = await adminApi("moderate");
  if (!session) return new Response("Unauthorized", { status: 401 });
  const path = (await params).path.join("/");
  if (!/^[0-9a-f-]{36}\/(full|thumb)\.webp$/.test(path)) return new Response("Not found", { status: 404 });
  const buf = await getRepo().getObject("submissions", path);
  if (!buf) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(buf), { headers: { "content-type": "image/webp", "cache-control": "private, no-store" } });
}
