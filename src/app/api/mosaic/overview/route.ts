import { getRepo } from "@/lib/repo";

export const dynamic = "force-dynamic";

let cache: { at: number; buf: Buffer } | null = null;

/** Binary snapshot of every non-empty square: 12 bytes per record
 *  [u32 tile][u8 state][u8 r][u8 g][u8 b][u32 extra], little-endian. */
export async function GET() {
  if (!cache || Date.now() - cache.at > 3000) {
    const rows = await getRepo().overview();
    const buf = Buffer.alloc(rows.length * 12);
    rows.forEach((r, i) => {
      const o = i * 12;
      buf.writeUInt32LE(r.tile, o);
      buf.writeUInt8(r.state, o + 4);
      buf.writeUInt8((r.color >> 16) & 255, o + 5);
      buf.writeUInt8((r.color >> 8) & 255, o + 6);
      buf.writeUInt8(r.color & 255, o + 7);
      buf.writeUInt32LE(r.extra >>> 0, o + 8);
    });
    cache = { at: Date.now(), buf };
  }
  return new Response(new Uint8Array(cache.buf), {
    headers: {
      "content-type": "application/octet-stream",
      "cache-control": "public, max-age=3, stale-while-revalidate=30",
      "x-media-base": getRepo().publicUrl(""),
    },
  });
}
