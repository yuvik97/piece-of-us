import { fail, json } from "@/lib/http";
import { isValidTile, tileFromPieceNumber } from "@/lib/grid";
import { getRepo } from "@/lib/repo";

export async function GET(_req: Request, { params }: { params: Promise<{ number: string }> }) {
  const tile = tileFromPieceNumber(Number((await params).number));
  if (!isValidTile(tile)) return fail(400, "invalid_piece");
  const piece = await getRepo().publicPiece(tile);
  if (!piece) return fail(404, "not_found");
  return json(piece, { headers: { "cache-control": "public, max-age=30" } });
}
