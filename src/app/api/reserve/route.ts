import { config } from "@/lib/config";
import { randomToken, sha256 } from "@/lib/crypto";
import { isValidTile } from "@/lib/grid";
import { fail, json, limit, sameOrigin } from "@/lib/http";
import { getRepo } from "@/lib/repo";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "forbidden");
  const limited = await limit(req, "reserve", 600, 30);
  if (limited) return limited;
  const body = await req.json().catch(() => ({}));
  const tile = Number(body.tile);
  if (!isValidTile(tile)) return fail(400, "invalid_tile");
  // Re-use an existing token so refreshing the page extends the same hold.
  const token = typeof body.token === "string" && /^[\w-]{20,64}$/.test(body.token) ? body.token : randomToken();
  const r = await getRepo().reserveTile(tile, sha256(token), config.reservationMinutes);
  if (!r.ok) return fail(409, "taken", "Someone else is making this square theirs right now. Try another one.");
  return json({ tile, token, expiresAt: r.expiresAt });
}

export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return fail(403, "forbidden");
  const body = await req.json().catch(() => ({}));
  const tile = Number(body.tile);
  if (!isValidTile(tile) || typeof body.token !== "string") return fail(400, "invalid");
  await getRepo().releaseReservation(tile, sha256(body.token));
  return json({ ok: true });
}
