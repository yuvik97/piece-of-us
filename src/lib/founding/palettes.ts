/**
 * Hand-picked palettes drawn from dyes, pigments, glazes and places.
 * Index 0 is the ground colour; the rest are figure colours.
 */
export const PALETTES: string[][] = [
  ["#1f2a5a", "#e9b949", "#c2452d", "#f4ead5", "#2f7a5d"], // indigo, saffron, madder
  ["#b8432f", "#f2c14e", "#1d1b1a", "#f3e9d2", "#2b5c8a"], // kente-ish red
  ["#f1e4c8", "#a2361f", "#24334f", "#d9a441", "#3d6b4f"], // cream & madder
  ["#0f4c5c", "#e36414", "#fb8b24", "#f6efe2", "#9a031e"], // teal & persimmon
  ["#e8d5b5", "#7a2e1f", "#c97b2e", "#2c2a26", "#6d8b74"], // adobe
  ["#2d1e2f", "#c9a227", "#e8dcc4", "#8e3b46", "#4c6e5b"], // aubergine & gold
  ["#f6f1e7", "#1b3a6b", "#3e7cb1", "#d8a31a", "#b33f2a"], // delft & sun
  ["#0b3d2e", "#f2d0a4", "#d1495b", "#edae49", "#f7f3ea"], // malachite
  ["#d65a31", "#2e2b29", "#f2e8cf", "#3b8ea5", "#f5b700"], // terracotta
  ["#efe6d2", "#2f4858", "#86bbd8", "#f26419", "#33658a"], // harbour
  ["#3b1f2b", "#e6a57e", "#f4e3c1", "#9b2915", "#5a7d7c"], // plum & clay
  ["#f7dba7", "#8c2f39", "#461220", "#b23a48", "#fcb9b2"], // rose madder
  ["#1d3557", "#f1faee", "#e63946", "#a8dadc", "#457b9d"], // navy & coral
  ["#264653", "#e9c46a", "#f4a261", "#e76f51", "#2a9d8f"], // desert dusk
  ["#ece2d0", "#5b3a29", "#a47148", "#2e4a3f", "#c8553d"], // walnut
  ["#6a040f", "#f48c06", "#ffba08", "#faf3e3", "#370617"], // pomegranate
  ["#f4efe6", "#0a2463", "#d8315b", "#3e92cc", "#1e1b18"], // cobalt print
  ["#344e41", "#dad7cd", "#a3b18a", "#bc6c25", "#283618"], // olive grove
  ["#f2e9e4", "#22223b", "#4a4e69", "#9a8c98", "#c9ada7"], // dusk stone
  ["#fefae0", "#606c38", "#283618", "#dda15e", "#bc6c25"], // field
  ["#03045e", "#90e0ef", "#caf0f8", "#ffb703", "#0077b6"], // sea glass
  ["#5f0f40", "#fb8b24", "#e36414", "#f7ede2", "#0f4c5c"], // fuchsia dye
  ["#e9edc9", "#344e41", "#bc4749", "#f2e8cf", "#386641"], // garden
  ["#2b2d42", "#edf2f4", "#ef233c", "#8d99ae", "#d90429"], // ink & vermilion
  ["#f8f1e5", "#c1121f", "#003049", "#fdf0d5", "#669bbc"], // tile blue-red
  ["#432818", "#ffe6a7", "#bb9457", "#99582a", "#6f1d1b"], // coffee
  ["#d4a373", "#fefae0", "#3a2e39", "#1e5245", "#b5651d"], // henna
  ["#0d1b2a", "#e0e1dd", "#778da9", "#f2a541", "#415a77"], // night
  ["#f3dfc1", "#160f29", "#246a73", "#368f8b", "#ddbea8"], // lagoon
  ["#9d0208", "#fff3b0", "#e09f3e", "#335c67", "#540b0e"], // chilli
  ["#ffffff", "#1a1a1a", "#d62828", "#f77f00", "#003049"], // print
  ["#e5d4c0", "#4f000b", "#720026", "#ce4257", "#ff9b54"], // berry
  ["#283d3b", "#edddd4", "#c44536", "#772e25", "#197278"], // pine & brick
  ["#f0ead2", "#6c584c", "#a98467", "#adc178", "#dde5b6"], // linen
  ["#1b263b", "#fca311", "#e5e5e5", "#14213d", "#d62828"], // lantern
  ["#ffcdb2", "#6d6875", "#b5838d", "#e5989b", "#3d2c2e"], // apricot
];

function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Approximate average colour of a founding piece (ground-dominant). */
export function paletteAverage(p: number): [number, number, number] {
  const pal = PALETTES[p % PALETTES.length];
  const ground = hexToRgb(pal[0]);
  const rest = pal.slice(1).map(hexToRgb);
  const acc = [0, 0, 0];
  for (const c of rest) for (let k = 0; k < 3; k++) acc[k] += c[k] / rest.length;
  return [0, 1, 2].map((k) => Math.round(ground[k] * 0.62 + acc[k] * 0.38)) as [number, number, number];
}
