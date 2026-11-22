import { paletteAverage } from "../founding/palettes";
import { foundingMeta } from "../founding/layout";
import type { FoundingRow, PublicPiece, Submission } from "./types";

export const hexToInt = (h: string) => parseInt(h.replace("#", ""), 16) || 0;
export const intToHex = (n: number) => "#" + n.toString(16).padStart(6, "0");

export function foundingColor(f: Pick<FoundingRow, "palette">) {
  const [r, g, b] = paletteAverage(f.palette);
  return (r << 16) | (g << 8) | b;
}
export const foundingExtra = (f: Pick<FoundingRow, "kind" | "seed" | "palette">) =>
  ((f.kind & 0xff) << 24) | ((f.seed & 0xffff) << 8) | (f.palette & 0xff);

export function toPublicFounding(f: FoundingRow): PublicPiece {
  const meta = foundingMeta(f);
  return {
    tile: f.tile,
    founding: true,
    title: meta.title,
    displayName: null,
    country: null,
    description: meta.description,
    publishedAt: "2026-11-19T00:00:00.000Z",
    imageUrl: null,
    thumbUrl: null,
    avgColor: intToHex(foundingColor(f)),
    discipline: meta.discipline,
    kind: f.kind,
    seed: f.seed,
    palette: f.palette,
  };
}

export function matchesSearch(s: Submission, q: string) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const num = needle.replace(/[#,\s]/g, "");
  if (/^\d+$/.test(num) && String(s.tile + 1) === num) return true;
  return [s.id, s.displayName, s.country, s.title, s.description, s.paymentOrderId, s.paymentCaptureId]
    .filter(Boolean)
    .some((v) => String(v).toLowerCase().includes(needle));
}
