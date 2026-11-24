import { isDemoMode } from "@/lib/config";
import { getRepo } from "@/lib/repo";

/** Demo mode only: serves PUBLISHED media from the in-memory "pieces" bucket. */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (!isDemoMode()) return new Response("Not found", { status: 404 });
  const path = (await params).path.join("/");
  if (!/^\d{1,7}\/(full|thumb)\.webp$/.test(path)) return new Response("Not found", { status: 404 });
  const buf = await getRepo().getObject("pieces", path);
  if (!buf) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(buf), { headers: { "content-type": "image/webp", "cache-control": "public, max-age=300" } });
}
