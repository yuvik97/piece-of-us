import { GRID, tileIndex } from "../grid";
import { PALETTES } from "./palettes";
import { GLYPHS, POSTER_WORDS } from "./studio";

/**
 * The Founding Collection is generated deterministically, so the same
 * pieces exist on the server (seed SQL / demo store) and in every browser.
 */

export const KINDS = [
  "stripweave",
  "ikat",
  "zellige",
  "plaid",
  "quilt",
  "symbol",
  "word",
  "architecture",
  "food",
  "landscape",
  "folk",
  "abstract",
  "vessel",
  "celestial",
  "embroidery",
  "painting",
  "typography",
  "render3d",
  "handmosaic",
  "poster",
] as const;
export type FoundingKind = (typeof KINDS)[number];

const KIND_WEIGHTS: Record<FoundingKind, number> = {
  stripweave: 6, ikat: 6, zellige: 7, plaid: 3, quilt: 5, symbol: 4, word: 5,
  architecture: 5, food: 4, landscape: 5, folk: 6, abstract: 6, vessel: 3, celestial: 3, embroidery: 5,
  painting: 14, typography: 10, render3d: 8, handmosaic: 11, poster: 9,
};
export const FOUNDING_COUNT = 7430;

export interface FoundingPiece {
  tile: number;
  kind: number; // index into KINDS
  seed: number; // 0..65535
  palette: number;
}

export function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x: number, y: number, s: number) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(x: number, y: number, s: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s);
  const c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

interface Cluster { cx: number; cy: number; r: number; holes: number; }

const CLUSTERS: Cluster[] = [
  { cx: 500, cy: 500, r: 50, holes: 0.07 },
  { cx: 438, cy: 452, r: 14, holes: 0.12 },
  { cx: 566, cy: 548, r: 16, holes: 0.12 },
  { cx: 560, cy: 438, r: 10, holes: 0.15 },
  { cx: 428, cy: 560, r: 11, holes: 0.15 },
  { cx: 212, cy: 284, r: 13, holes: 0.14 },
  { cx: 781, cy: 236, r: 12, holes: 0.14 },
  { cx: 812, cy: 742, r: 15, holes: 0.14 },
  { cx: 246, cy: 768, r: 12, holes: 0.14 },
  { cx: 640, cy: 112, r: 7, holes: 0.2 },
  { cx: 94, cy: 520, r: 8, holes: 0.2 },
  { cx: 912, cy: 488, r: 8, holes: 0.2 },
  { cx: 368, cy: 902, r: 7, holes: 0.2 },
  { cx: 336, cy: 140, r: 6, holes: 0.2 },
  { cx: 690, cy: 880, r: 6, holes: 0.2 },
];

function pickKind(r: number) {
  const total = Object.values(KIND_WEIGHTS).reduce((a, b) => a + b, 0);
  let acc = 0;
  for (let k = 0; k < KINDS.length; k++) {
    acc += KIND_WEIGHTS[KINDS[k]] / total;
    if (r <= acc) return k;
  }
  return KINDS.length - 1;
}

let cache: FoundingPiece[] | null = null;

export function generateFounding(): FoundingPiece[] {
  if (cache) return cache;
  const rand = mulberry32(19480514);
  const taken = new Set<number>();
  const out: FoundingPiece[] = [];
  const add = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) return;
    const t = tileIndex(x, y);
    if (taken.has(t)) return;
    taken.add(t);
    out.push({
      tile: t,
      kind: pickKind(rand()),
      seed: Math.floor(rand() * 65536),
      palette: Math.floor(rand() * PALETTES.length),
    });
  };

  CLUSTERS.forEach((c, ci) => {
    const cr = c.r * 0.76;
    const R = Math.ceil(cr * 1.6);
    for (let y = c.cy - R; y <= c.cy + R; y++) {
      for (let x = c.cx - R; x <= c.cx + R; x++) {
        const dx = x - c.cx, dy = y - c.cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        const edge =
          cr * (0.78 + 0.5 * valueNoise(x / 9, y / 9, ci + 3) + 0.18 * valueNoise(x / 3, y / 3, ci + 99));
        if (d < edge && rand() > c.holes) add(x, y);
      }
    }
  });

  // A scattering of lone pieces across the whole canvas.
  for (let i = 0; i < 420; i++) add(Math.floor(rand() * GRID), Math.floor(rand() * GRID));

  // Keep exactly FOUNDING_COUNT pieces: thin evenly, so clusters keep their shape.
  const keep = mulberry32(7430);
  const shuffledIdx = out.map((_, i) => i).sort(() => keep() - 0.5);
  const chosen = new Set(shuffledIdx.slice(0, FOUNDING_COUNT));
  const final = out.filter((_, i) => chosen.has(i));
  final.sort((a, b) => a.tile - b.tile);
  cache = final;
  return final;
}

/* ───────────────────────── Titles & descriptions ───────────────────────── */

export const HOME_WORDS: [string, string][] = [
  ["בית", "Hebrew"], ["بيت", "Arabic"], ["家", "Chinese"], ["घर", "Hindi"], ["maison", "French"],
  ["hogar", "Spanish"], ["casa", "Portuguese"], ["дом", "Russian"], ["σπίτι", "Greek"], ["nyumba", "Swahili"],
  ["ev", "Turkish"], ["집", "Korean"], ["bahay", "Filipino"], ["rumah", "Malay"], ["koti", "Finnish"],
  ["Zuhause", "German"], ["thuis", "Dutch"], ["hem", "Swedish"], ["dom", "Polish"], ["otthon", "Hungarian"],
  ["nhà", "Vietnamese"], ["خانه", "Persian"], ["ঘর", "Bengali"], ["ilé", "Yoruba"], ["kāinga", "Māori"],
  ["hjem", "Norwegian"], ["baile", "Irish"], ["cartref", "Welsh"], ["บ้าน", "Thai"], ["ቤት", "Amharic"],
  ["casa", "Italian"], ["kodu", "Estonian"], ["heima", "Icelandic"], ["ghar", "Urdu (romanised)"],
];

export const SYMBOLS = [
  "Star of David", "Crescent and star", "Cross", "Dharma wheel", "Yin and yang",
  "Om", "Nine-pointed star", "Lotus",
];
const ARCH = ["Arcade", "Domes", "Pagoda", "Gabled houses", "Whitewashed village", "Adobe walls", "Stilt houses", "Bell tower"];
const FOOD = ["A bowl of rice", "Round bread", "Citrus, halved", "Pomegranate", "Dumplings", "Watermelon", "Olives", "Flatbread"];
const LAND = ["Sea at dusk", "Dunes", "Mountains", "Terraced fields", "Lake at dawn", "Snowfield", "River bend", "Night sky"];
const FOLK = ["Flower motif", "Two birds", "Tree of life", "Rosette", "Vine", "Paper-cut"];
const ABSTRACT = ["Composition", "Colour field", "Circles", "Interval", "Weight and balance", "Horizon", "Rhythm"];
const VESSEL = ["Vessel", "Water jar", "Lantern", "Teapot", "Bowl"];
const CELESTIAL = ["Sun", "Crescent moon", "Full moon", "Morning star", "Eclipse"];

const DESC: Record<FoundingKind, string> = {
  stripweave: "A study in strip-woven cloth, where narrow bands are sewn edge to edge into something larger.",
  ikat: "Threads dyed before weaving, so every edge blurs a little. A study in resist-dyed textile.",
  zellige: "Interlocking stars and polygons, the kind of geometry that can repeat forever.",
  plaid: "Crossing bands of colour, warp over weft.",
  quilt: "Triangles pieced together from what was at hand.",
  symbol: "A sign of faith or meaning, held by many. Shared here without hierarchy.",
  word: "A word for home, written by hand.",
  architecture: "The shapes of the places people live in.",
  food: "Something shared at a table, somewhere.",
  landscape: "A place someone might call home, remembered in colour.",
  folk: "A motif passed from hand to hand, generation to generation.",
  abstract: "Colour and form, with nothing else to explain.",
  vessel: "An everyday object, carried and filled and carried again.",
  celestial: "The same sky, seen from everywhere.",
  embroidery: "Stitch by stitch, a pattern made slowly.",
  painting: "Oil and gouache, laid on in visible strokes.",
  typography: "A single letterform, drawn with care — one script among the world’s many.",
  render3d: "Modelled and lit in three dimensions; light, weight and shadow.",
  handmosaic: "Hand-cut tesserae set one by one in grout, the oldest way to make a mosaic.",
  poster: "Graphic design on a grid: type, colour and interval.",
};

export const DISCIPLINE: Record<FoundingKind, string> = {
  stripweave: "Textile", ikat: "Textile", plaid: "Textile", quilt: "Textile", embroidery: "Textile",
  zellige: "Pattern", folk: "Folk art", symbol: "Symbol", word: "Calligraphy", architecture: "Illustration",
  food: "Illustration", landscape: "Painting", abstract: "Graphic design", vessel: "Illustration", celestial: "Illustration",
  painting: "Painting", typography: "Typography", render3d: "3D", handmosaic: "Mosaic", poster: "Graphic design",
};

export function variantOf(kind: FoundingKind, seed: number): number {
  const n: Partial<Record<FoundingKind, number>> = {
    word: HOME_WORDS.length, symbol: SYMBOLS.length, architecture: ARCH.length, food: FOOD.length,
    landscape: LAND.length, folk: FOLK.length, abstract: ABSTRACT.length, vessel: VESSEL.length, celestial: CELESTIAL.length,
    painting: 3, typography: GLYPHS.length, render3d: 4, handmosaic: 4, poster: POSTER_WORDS.length,
  };
  return seed % (n[kind] ?? 1);
}

export function foundingMeta(p: { kind: number; seed: number }) {
  const kind = KINDS[p.kind];
  const v = variantOf(kind, p.seed);
  let title: string;
  switch (kind) {
    case "stripweave": title = "Strip-weave study"; break;
    case "ikat": title = "Ikat study"; break;
    case "zellige": title = "Tessellation"; break;
    case "plaid": title = "Crossed bands"; break;
    case "quilt": title = "Pieced quilt"; break;
    case "symbol": title = SYMBOLS[v]; break;
    case "word": title = `“${HOME_WORDS[v][0]}” — ${HOME_WORDS[v][1]}`; break;
    case "architecture": title = ARCH[v]; break;
    case "food": title = FOOD[v]; break;
    case "landscape": title = LAND[v]; break;
    case "folk": title = FOLK[v]; break;
    case "abstract": title = ABSTRACT[v]; break;
    case "vessel": title = VESSEL[v]; break;
    case "celestial": title = CELESTIAL[v]; break;
    case "embroidery": title = "Cross-stitch"; break;
    case "painting": title = ["Harbour, evening", "Still life with jug", "Gesture"][p.seed % 3]; break;
    case "typography": { const g = GLYPHS[p.seed % GLYPHS.length]; title = `${g[0]} — ${g[1]} (${g[2]})`; break; }
    case "render3d": title = ["Sphere study", "Three spheres", "Cubes", "Isometric village"][p.seed % 4]; break;
    case "handmosaic": title = ["Mosaic — sun", "Mosaic — fish", "Mosaic — flower", "Mosaic — rings"][p.seed % 4]; break;
    case "poster": title = `Poster — ${POSTER_WORDS[p.seed % POSTER_WORDS.length]}`; break;
  }
  return { kind, title, description: DESC[kind], discipline: DISCIPLINE[kind] };
}
