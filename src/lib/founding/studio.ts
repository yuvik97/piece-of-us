/* Founding Collection, studio disciplines: painting, typography, 3D,
 * hand-laid mosaic and graphic design. Drawn in a unit square (0..1). */

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type R = () => number;
export interface StudioEnv { c: Ctx; r: R; p: string[]; s: number; v: number }

const TAU = Math.PI * 2;
const pick = <T,>(r: R, a: T[]) => a[Math.floor(r() * a.length)];
const lum = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};
const rgb = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
/** Colour with jitter in lightness — the life in paint and tesserae. */
function vary(h: string, r: R, amt = 22, a = 1) {
  const [R0, G, B] = rgb(h);
  const d = (r() - 0.5) * amt;
  const k = (x: number) => Math.max(0, Math.min(255, Math.round(x + d + (r() - 0.5) * amt * 0.4)));
  return `rgba(${k(R0)},${k(G)},${k(B)},${a})`;
}
const byLum = (p: string[]) => p.slice().sort((a, b) => lum(a) - lum(b));

/* ───────────── Painting (oil / gouache, visible brushwork) ───────────── */
export function painting({ c, r, p, s, v }: StudioEnv) {
  const [dark, , mid, , light] = byLum(p);
  const strokes = s < 40 ? 40 : s < 200 ? 160 : 420;
  const brush = (x: number, y: number, len: number, w: number, ang: number, col: string) => {
    c.save();
    c.translate(x, y);
    c.rotate(ang);
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(-len / 2, 0);
    c.bezierCurveTo(-len / 4, -w, len / 4, -w * (0.6 + r() * 0.8), len / 2, 0);
    c.bezierCurveTo(len / 4, w * (0.5 + r()), -len / 4, w, -len / 2, 0);
    c.fill();
    c.restore();
  };
  c.fillStyle = mid;
  c.fillRect(0, 0, 1, 1);
  if (v % 3 === 0) {
    // landscape: sky, distant hills, water
    for (let i = 0; i < strokes; i++) {
      const y = r();
      const col = y < 0.45 ? vary(light, r, 30, 0.55) : y < 0.62 ? vary(dark, r, 30, 0.6) : vary(p[1], r, 40, 0.5);
      brush(r(), y, 0.12 + r() * 0.25, 0.012 + r() * 0.02, (r() - 0.5) * 0.25, col);
    }
    c.fillStyle = vary(p[2], r, 10, 0.9);
    c.beginPath();
    c.arc(0.68, 0.3, 0.07, 0, TAU);
    c.fill();
  } else if (v % 3 === 1) {
    // still life: table, vessel, fruit
    for (let i = 0; i < strokes; i++) {
      const y = r();
      brush(r(), y, 0.1 + r() * 0.2, 0.015 + r() * 0.025, (r() - 0.5) * 0.9, y > 0.66 ? vary(dark, r, 30, 0.55) : vary(light, r, 30, 0.45));
    }
    for (let i = 0; i < strokes / 4; i++) {
      const t = r() * TAU, d = Math.sqrt(r()) * 0.13;
      brush(0.42 + Math.cos(t) * d * 0.8, 0.5 + Math.sin(t) * d * 1.3, 0.06, 0.02, t, vary(p[1], r, 40, 0.7));
    }
    for (const [x, col] of [[0.62, p[3]], [0.72, p[4]]] as [number, string][])
      for (let i = 0; i < strokes / 8; i++) {
        const t = r() * TAU, d = Math.sqrt(r()) * 0.05;
        brush(x + Math.cos(t) * d, 0.66 + Math.sin(t) * d, 0.04, 0.015, t, vary(col, r, 40, 0.8));
      }
  } else {
    // gestural abstract
    for (let i = 0; i < strokes; i++) {
      const col = vary(pick(r, p), r, 50, 0.35 + r() * 0.4);
      brush(r(), r(), 0.1 + r() * 0.45, 0.01 + r() * 0.05, r() * TAU, col);
    }
  }
  if (s >= 120) {
    // canvas weave
    c.globalAlpha = 0.05;
    c.fillStyle = "#000";
    for (let i = 0; i < 1; i += 0.006) c.fillRect(i, 0, 0.0015, 1);
    for (let i = 0; i < 1; i += 0.006) c.fillRect(0, i, 1, 0.0015);
    c.globalAlpha = 1;
  }
}

/* ───────────── Typography (letterforms, specimen sheets) ───────────── */
export const GLYPHS: [string, string, string][] = [
  ["א", "Alef", "Hebrew"], ["ש", "Shin", "Hebrew"], ["ع", "Ayn", "Arabic"], ["ك", "Kaf", "Arabic"],
  ["अ", "A", "Devanagari"], ["永", "Eternity", "Chinese"], ["愛", "Love", "Japanese / Chinese"], ["ㅎ", "Hieut", "Korean"],
  ["Ж", "Zhe", "Cyrillic"], ["Ω", "Omega", "Greek"], ["&", "Ampersand", "Latin"], ["g", "Double-storey g", "Latin"],
  ["Ա", "Ayb", "Armenian"], ["ა", "Ani", "Georgian"], ["ሀ", "Hä", "Ge'ez"], ["ก", "Ko kai", "Thai"],
];
export function typography({ c, r, p, s, v }: StudioEnv) {
  const [g] = GLYPHS[v % GLYPHS.length];
  const sorted = byLum(p);
  const bg = r() > 0.4 ? sorted[4] : sorted[0];
  const ink = bg === sorted[4] ? sorted[0] : sorted[4];
  const accent = pick(r, p.filter((x) => x !== bg && x !== ink)) || ink;
  c.fillStyle = bg;
  c.fillRect(0, 0, 1, 1);
  const serif = r() > 0.5;
  const fam = serif ? `"Instrument Serif","Noto Serif","Noto Serif Hebrew","Noto Naskh Arabic",Georgia,serif` : `"Figtree","Noto Sans","Noto Sans Hebrew","Noto Sans Arabic",system-ui,sans-serif`;
  if (s >= 40) {
    // metric guides, as on a specimen sheet
    c.strokeStyle = accent;
    c.lineWidth = 0.004;
    for (const y of [0.24, 0.7, 0.78]) {
      c.beginPath();
      c.moveTo(0.06, y);
      c.lineTo(0.94, y);
      c.stroke();
    }
  }
  c.fillStyle = ink;
  c.textAlign = "center";
  c.textBaseline = "alphabetic";
  c.font = `${serif ? "" : "700 "}0.62px ${fam}`;
  c.fillText(g, 0.5, 0.72);
  if (s >= 60) {
    c.font = `0.035px "IBM Plex Mono",monospace`;
    c.textAlign = "left";
    c.fillStyle = accent;
    const [, name, script] = GLYPHS[v % GLYPHS.length];
    c.fillText(`${script.toUpperCase()} — ${name.toUpperCase()}`, 0.06, 0.9);
    c.textAlign = "right";
    c.fillText(serif ? "SERIF" : "SANS 700", 0.94, 0.9);
  }
}

/* ───────────── 3D (rendered objects, light and shadow) ───────────── */
export function render3d({ c, r, p, v }: StudioEnv) {
  const [d0, , m, , l0] = byLum(p);
  const floor = c.createLinearGradient(0, 0, 0, 1);
  floor.addColorStop(0, l0);
  floor.addColorStop(1, m);
  c.fillStyle = floor;
  c.fillRect(0, 0, 1, 1);
  const shadow = (x: number, y: number, rx: number) => {
    const g = c.createRadialGradient(x, y, 0, x, y, rx);
    g.addColorStop(0, "rgba(0,0,0,0.35)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(x, y, rx, rx * 0.28, 0, 0, TAU);
    c.fill();
  };
  const sphere = (x: number, y: number, rad: number, col: string) => {
    shadow(x + rad * 0.3, y + rad * 0.95, rad * 1.1);
    const g = c.createRadialGradient(x - rad * 0.35, y - rad * 0.4, rad * 0.05, x, y, rad);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.18, col);
    g.addColorStop(1, d0);
    c.fillStyle = g;
    c.beginPath();
    c.arc(x, y, rad, 0, TAU);
    c.fill();
  };
  const cube = (x: number, y: number, a: number, col: string) => {
    const h = a * 0.58;
    shadow(x + a * 0.2, y + a * 1.05, a * 0.9);
    const face = (pts: number[], k: number) => {
      c.fillStyle = vary(col, () => 0.5, 0, 1);
      c.globalAlpha = 1;
      c.beginPath();
      c.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
      c.closePath();
      c.fill();
      c.fillStyle = k > 0 ? `rgba(255,255,255,${k})` : `rgba(0,0,0,${-k})`;
      c.fill();
    };
    face([x, y - h, x + a, y - h * 2 + h, x, y - h * 2 + h - h, x - a, y - h], 0.25); // top
    face([x - a, y - h, x, y, x, y + a, x - a, y + a - h], -0.05); // left
    face([x + a, y - h, x, y, x, y + a, x + a, y + a - h], -0.28); // right
  };
  switch (v % 4) {
    case 0:
      sphere(0.5, 0.48, 0.24, p[1]);
      break;
    case 1:
      sphere(0.34, 0.56, 0.14, p[1]);
      sphere(0.63, 0.44, 0.19, p[3]);
      sphere(0.72, 0.72, 0.08, p[2]);
      break;
    case 2:
      cube(0.5, 0.5, 0.2, p[1]);
      cube(0.28, 0.7, 0.1, p[3]);
      break;
    default: {
      // isometric village: stacked blocks
      const cols = [p[1], p[2], p[3], p[4]];
      for (let i = 0; i < 6; i++) cube(0.22 + (i % 3) * 0.28, 0.38 + Math.floor(i / 3) * 0.3, 0.1, cols[i % 4]);
    }
  }
}

/* ───────────── Hand-laid mosaic (irregular tesserae + grout) ───────────── */
export function handMosaic({ c, r, p, s, v }: StudioEnv) {
  const grout = "#d9d3c7";
  c.fillStyle = grout;
  c.fillRect(0, 0, 1, 1);
  const sorted = byLum(p);
  const bgCol = sorted[3], fig = p[1] === bgCol ? p[2] : p[1], fig2 = p[4] === bgCol ? sorted[0] : p[4];
  const n = s < 30 ? 10 : 22;
  const cell = 1 / n;
  const motif = (x: number, y: number): string => {
    const dx = x - 0.5, dy = y - 0.5, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    switch (v % 4) {
      case 0: // sun
        if (d < 0.18) return fig;
        if (d < 0.36 && Math.cos(a * 12) > 0.3) return fig2;
        return bgCol;
      case 1: { // fish
        const body = (dx / 0.3) ** 2 + (dy / 0.16) ** 2 < 1;
        const tail = dx > 0.24 && dx < 0.42 && Math.abs(dy) < (dx - 0.24) * 1.2;
        if (Math.hypot(dx + 0.17, dy + 0.03) < 0.035) return sorted[0];
        if (body) return Math.sin(dx * 40) > 0.6 ? fig2 : fig;
        if (tail) return fig2;
        return Math.sin((y * 3 + x) * 12) > 0.85 ? sorted[4] : bgCol;
      }
      case 2: // eight-petal flower
        if (d < 0.08) return fig2;
        if (d < 0.38 && Math.cos(a * 4) > 0.15 - d) return fig;
        return bgCol;
      default: // concentric bands
        return [fig, bgCol, fig2, bgCol][Math.floor(d * 14) % 4];
    }
  };
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const x = i * cell, y = j * cell;
      const col = motif(x + cell / 2, y + cell / 2);
      const jit = () => (r() - 0.5) * cell * 0.22;
      const g = cell * 0.09;
      c.fillStyle = vary(col, r, 26);
      c.beginPath();
      c.moveTo(x + g + jit(), y + g + jit());
      c.lineTo(x + cell - g + jit(), y + g + jit());
      c.lineTo(x + cell - g + jit(), y + cell - g + jit());
      c.lineTo(x + g + jit(), y + cell - g + jit());
      c.closePath();
      c.fill();
      if (s > 150) {
        c.fillStyle = "rgba(255,255,255,0.12)";
        c.fillRect(x + g * 1.5, y + g * 1.5, cell * 0.25, cell * 0.12);
      }
    }
}

/* ───────────── Graphic design (posters, grid systems) ───────────── */
export const POSTER_WORDS = ["HOME", "ROOTS", "SALT", "BREAD", "TOGETHER", "MAQAM", "ZION", "SUD", "NORTE", "KAIROS", "UBUNTU", "HEIMAT", "SHALOM", "SALAAM", "AMANI", "NAMASTE"];
export function poster({ c, r, p, s, v }: StudioEnv) {
  const sorted = byLum(p);
  const bg = sorted[r() > 0.5 ? 4 : 1];
  const ink = lum(bg) > 0.5 ? sorted[0] : sorted[4];
  const acc = pick(r, p.filter((x) => x !== bg && x !== ink)) || ink;
  c.fillStyle = bg;
  c.fillRect(0, 0, 1, 1);
  const word = POSTER_WORDS[v % POSTER_WORDS.length];
  switch (v % 3) {
    case 0: // Swiss: big circle + rotated word
      c.fillStyle = acc;
      c.beginPath();
      c.arc(0.62, 0.4, 0.3, 0, TAU);
      c.fill();
      c.save();
      c.translate(0.12, 0.92);
      c.rotate(-Math.PI / 2);
      c.fillStyle = ink;
      c.font = `700 0.16px "Figtree",system-ui,sans-serif`;
      c.fillText(word, 0, 0);
      c.restore();
      break;
    case 1: // stacked type, cropped
      c.fillStyle = ink;
      c.font = `700 0.3px "Figtree",system-ui,sans-serif`;
      for (let i = 0; i < 4; i++) {
        c.fillStyle = i === 1 ? acc : ink;
        c.fillText(word, -0.04 - i * 0.07, 0.28 + i * 0.25);
      }
      break;
    default: // grid of squares with one break
      for (let j = 0; j < 5; j++)
        for (let i = 0; i < 5; i++) {
          c.fillStyle = i === (v % 5) && j === 2 ? acc : ink;
          c.fillRect(0.1 + i * 0.165, 0.1 + j * 0.13, 0.12, 0.09);
        }
      c.fillStyle = ink;
      c.font = `700 0.1px "Figtree",system-ui,sans-serif`;
      c.fillText(word, 0.1, 0.9);
  }
  if (s >= 80) {
    c.fillStyle = ink;
    c.font = `0.028px "IBM Plex Mono",monospace`;
    c.textAlign = "right";
    c.fillText(`NO. ${(v % 97) + 1} / ${word.length * 7}`, 0.94, 0.06);
    c.textAlign = "left";
  }
}
