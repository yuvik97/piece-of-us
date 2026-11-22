import { json } from "@/lib/http";
import { getRepo } from "@/lib/repo";

export const dynamic = "force-dynamic";
export async function GET() {
  return json(await getRepo().stats(), { headers: { "cache-control": "public, max-age=5" } });
}
