/* Procedural renderers for the Founding Collection.
 * Every piece is drawn in a unit square (0..1) so the same artwork renders
 * crisply at 8px in the mosaic and at 1200px in the detail view. */

import { HOME_WORDS, KINDS, mulberry32, variantOf, type FoundingKind, type FoundingPiece } from "./layout";
import { PALETTES } from "./palettes";
import { handMosaic, painting, poster, render3d, typography } from "./studio";

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type R = () => number;

interface Env {
  c: Ctx;
  r: R;
  p: string[]; // palette
  s: number; // pixel size (for level-of-detail decisions)
  v: number; // variant
}

const TAU = Math.PI * 2;

function rect(c: Ctx, x: number, y: number, w: number, h: number, f: string) {
  c.fillStyle = f;
  c.fillRect(x, y, w, h);
}
function circle(c: Ctx, x: number, y: number, r: number, f: string) {
  c.fillStyle = f;
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fill();
}
function poly(c: Ctx, pts: number[], f: string) {
  c.fillStyle = f;
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath();
  c.fill();
}
function pick<T>(r: R, a: T[]): T {
  return a[Math.floor(r() * a.length)];
}
function shuffled(r: R, a: string[]) {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
function lum(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
function mix(a: string, b: string, t: number) {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  const ch = (s: number) =>
    Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
function lightest(p: string[]) {
  return p.slice().sort((a, b) => lum(b) - lum(a))[0];
}
function darkest(p: string[]) {
  return p.slice().sort((a, b) => lum(a) - lum(b))[0];
}

/* ───────────────────────────── Textiles ───────────────────────────── */

function stripweave({ c, r, p }: Env) {
  const strips = 3 + Math.floor(r() * 4);
  const w = 1 / strips;
  for (let i = 0; i < strips; i++) {
    const rows = 4 + Math.floor(r() * 4);
    let y = 0;
    for (let j = 0; j < rows; j++) {
      const h = j === rows - 1 ? 1 - y : (1 / rows) * (0.6 + r() * 0.8);
      const [a, b] = shuffled(r, p);
      const t = Math.floor(r() * 4);
      rect(c, i * w, y, w + 0.002, h + 0.002, a);
      if (t === 1) {
        const n = 3 + Math.floor(r() * 3);
        for (let k = 0; k < n; k++)
          for (let m = 0; m < n * 2; m++)
            if ((k + m) % 2 === 0) rect(c, i * w + (k * w) / n, y + (m * h) / (n * 2), w / n, h / (n * 2), b);
      } else if (t === 2) {
        const n = 3 + Math.floor(r() * 5);
        for (let k = 0; k < n; k++) rect(c, i * w, y + (k + 0.3) * (h / n), w, (h / n) * 0.35, b);
      } else if (t === 3) {
        c.fillStyle = b;
        c.beginPath();
        const n = 3;
        for (let k = 0; k <= n * 2; k++) c.lineTo(i * w + (k * w) / (n * 2), y + (k % 2 ? h * 0.25 : h * 0.75));
        c.lineTo(i * w + w, y + h);
        c.lineTo(i * w, y + h);
        c.fill();
      } else {
        rect(c, i * w + w * 0.12, y, w * 0.08, h, b);
        rect(c, i * w + w * 0.8, y, w * 0.08, h, b);
      }
      y += h;
      if (y >= 1) break;
    }
  }
  for (let i = 1; i < strips; i++) rect(c, i * w - 0.004, 0, 0.008, 1, "rgba(0,0,0,0.12)");
}

function ikat({ c, r, p }: Env) {
  rect(c, 0, 0, 1, 1, p[0]);
  const bands = 2 + Math.floor(r() * 2);
  const cols = shuffled(r, p.slice(1));
  for (let b = 0; b < bands; b++) {
    const cy = (b + 0.5) / bands;
    const hh = 0.5 / bands;
    const n = 2 + Math.floor(r() * 2);
    for (let d = 0; d < n; d++) {
      const cx = (d + 0.5) / n + (b % 2 ? 0.5 / n : 0);
      const ww = 0.5 / n;
      const rows = 26;
      for (let k = 0; k < rows; k++) {
        const t = k / (rows - 1);
        const yy = cy - hh + t * hh * 2;
        const span = (1 - Math.abs(t * 2 - 1)) * ww;
        for (const layer of [0, 1]) {
          const sp = layer ? span * 0.55 : span;
          const j = (r() - 0.5) * 0.03;
          rect(c, ((cx - sp + j) % 1 + 1) % 1, yy, sp * 2, (hh * 2) / rows + 0.002, cols[(layer + b) % cols.length]);
        }
      }
    }
  }
}

function zellige({ c, r, p }: Env) {
  const n = 2 + Math.floor(r() * 3);
  const s = 1 / n;
  const [g, a, b, d, e] = shuffled(r, p);
  rect(c, 0, 0, 1, 1, g);
  for (let i = 0; i <= n; i++)
    for (let j = 0; j <= n; j++) {
      const x = i * s, y = j * s;
      // corner cross tile
      c.save();
      c.translate(x, y);
      c.rotate(Math.PI / 4);
      rect(c, -s * 0.17, -s * 0.17, s * 0.34, s * 0.34, d);
      c.restore();
      if (i === n || j === n) continue;
      const cx = x + s / 2, cy = y + s / 2;
      for (const [k, col] of [[0.42, a], [0.28, b]] as const) {
        c.save();
        c.translate(cx, cy);
        rect(c, -s * k * 0.75, -s * k * 0.75, s * k * 1.5, s * k * 1.5, col);
        c.rotate(Math.PI / 4);
        rect(c, -s * k * 0.75, -s * k * 0.75, s * k * 1.5, s * k * 1.5, col);
        c.restore();
      }
      circle(c, cx, cy, s * 0.1, e);
    }
}

function plaid({ c, r, p }: Env) {
  rect(c, 0, 0, 1, 1, p[0]);
  const cols = p.slice(1);
  const bands: [number, number, string][] = [];
  const n = 4 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) bands.push([r(), 0.02 + r() * 0.12, pick(r, cols)]);
  c.globalAlpha = 0.55;
  for (const [o, w, col] of bands) rect(c, o, 0, w, 1, col);
  for (const [o, w, col] of bands) rect(c, 0, o, 1, w, col);
  c.globalAlpha = 1;
}

function quilt({ c, r, p }: Env) {
  const n = 3 + Math.floor(r() * 3);
  const s = 1 / n;
  const sym = r() > 0.4;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const ii = sym ? Math.min(i, n - 1 - i) : i;
      const jj = sym ? Math.min(j, n - 1 - j) : j;
      const rr = mulberry32(ii * 31 + jj * 7 + Math.floor(r() * (sym ? 1 : 1000)));
      const a = pick(rr, p), b = pick(rr, p);
      const x = i * s, y = j * s;
      rect(c, x, y, s + 0.002, s + 0.002, a);
      const o = (i < n / 2 ? 0 : 1) ^ (j < n / 2 ? 0 : 1);
      if (o) poly(c, [x, y, x + s, y, x, y + s], b);
      else poly(c, [x, y, x + s, y + s, x + s, y], b);
    }
}

function embroidery({ c, r, p, s }: Env) {
  const bg = lightest(p);
  rect(c, 0, 0, 1, 1, bg);
  const n = 11;
  const cell = 1 / n;
  const cols = shuffled(r, p.filter((x) => x !== bg)).slice(0, 2 + Math.floor(r() * 2));
  const half = Math.ceil(n / 2);
  const grid: number[][] = [];
  for (let i = 0; i < half; i++) {
    grid.push([]);
    for (let j = 0; j < half; j++) {
      if (j < i) { grid[i].push(grid[j][i]); continue; } // diagonal mirror → 8-fold symmetry
      grid[i].push(r() < 0.55 ? 1 + Math.floor(r() * cols.length) : 0);
    }
  }
  c.lineCap = "round";
  c.lineWidth = Math.max(cell * 0.22, 1 / Math.max(s, 1));
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const v = grid[Math.min(i, n - 1 - i)][Math.min(j, n - 1 - j)];
      if (!v) continue;
      const x = i * cell, y = j * cell, m = cell * 0.18;
      c.strokeStyle = cols[v - 1];
      if (s < 40) {
        rect(c, x + m, y + m, cell - 2 * m, cell - 2 * m, cols[v - 1]);
        continue;
      }
      c.beginPath();
      c.moveTo(x + m, y + m);
      c.lineTo(x + cell - m, y + cell - m);
      c.moveTo(x + cell - m, y + m);
      c.lineTo(x + m, y + cell - m);
      c.stroke();
    }
}

/* ───────────────────────────── Symbols ───────────────────────────── */

function starPoly(c: Ctx, cx: number, cy: number, ro: number, ri: number, n: number, rot = -Math.PI / 2) {
  c.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const rad = i % 2 ? ri : ro;
    const a = rot + (i * Math.PI) / n;
    c.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  c.closePath();
}

function symbol({ c, r, p, v }: Env) {
  const [g, a, b] = shuffled(r, p);
  const ink = lum(g) > 0.5 ? darkest(p) : lightest(p);
  rect(c, 0, 0, 1, 1, g);
  // quiet frame of dots
  if (r() > 0.4) {
    for (let i = 0; i < 24; i++) {
      const t = (i / 24) * TAU;
      circle(c, 0.5 + Math.cos(t) * 0.43, 0.5 + Math.sin(t) * 0.43, 0.012, b);
    }
  }
  c.strokeStyle = ink;
  c.fillStyle = ink;
  c.lineWidth = 0.05;
  c.lineJoin = "round";
  switch (v) {
    case 0: { // Star of David
      for (const rot of [-Math.PI / 2, Math.PI / 2]) {
        c.beginPath();
        for (let i = 0; i < 3; i++) {
          const t = rot + (i * TAU) / 3;
          c.lineTo(0.5 + Math.cos(t) * 0.3, 0.5 + Math.sin(t) * 0.3);
        }
        c.closePath();
        c.stroke();
      }
      break;
    }
    case 1: { // Crescent and star
      circle(c, 0.46, 0.5, 0.26, ink);
      circle(c, 0.54, 0.47, 0.22, g);
      starPoly(c, 0.68, 0.48, 0.08, 0.032, 5, -Math.PI / 2 + 0.3);
      c.fill();
      break;
    }
    case 2: // Cross
      rect(c, 0.455, 0.18, 0.09, 0.64, ink);
      rect(c, 0.3, 0.34, 0.4, 0.09, ink);
      break;
    case 3: { // Dharma wheel
      c.beginPath();
      c.arc(0.5, 0.5, 0.26, 0, TAU);
      c.stroke();
      circle(c, 0.5, 0.5, 0.06, ink);
      c.lineWidth = 0.025;
      for (let i = 0; i < 8; i++) {
        const t = (i * TAU) / 8;
        c.beginPath();
        c.moveTo(0.5, 0.5);
        c.lineTo(0.5 + Math.cos(t) * 0.33, 0.5 + Math.sin(t) * 0.33);
        c.stroke();
        circle(c, 0.5 + Math.cos(t) * 0.35, 0.5 + Math.sin(t) * 0.35, 0.025, ink);
      }
      break;
    }
    case 4: { // Yin and yang
      const R = 0.28;
      circle(c, 0.5, 0.5, R + 0.015, ink);
      c.fillStyle = a === ink ? b : a;
      c.beginPath();
      c.arc(0.5, 0.5, R, -Math.PI / 2, Math.PI / 2);
      c.arc(0.5, 0.5 + R / 2, R / 2, Math.PI / 2, -Math.PI / 2, true);
      c.arc(0.5, 0.5 - R / 2, R / 2, Math.PI / 2, -Math.PI / 2);
      c.fill();
      circle(c, 0.5, 0.5 - R / 2, R * 0.15, ink);
      circle(c, 0.5, 0.5 + R / 2, R * 0.15, a === ink ? b : a);
      break;
    }
    case 5: // Om
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.font = `0.56px "Noto Serif Devanagari", "Kohinoor Devanagari", "Nirmala UI", serif`;
      c.fillText("ॐ", 0.5, 0.54);
      break;
    case 6: // Nine-pointed star
      c.lineWidth = 0.035;
      starPoly(c, 0.5, 0.5, 0.32, 0.17, 9);
      c.stroke();
      break;
    default: { // Lotus
      for (let i = -2; i <= 2; i++) {
        c.save();
        c.translate(0.5, 0.66);
        c.rotate(i * 0.42);
        c.fillStyle = i % 2 ? a : ink;
        c.beginPath();
        c.ellipse(0, -0.2, 0.07, 0.2, 0, 0, TAU);
        c.fill();
        c.restore();
      }
      rect(c, 0.26, 0.7, 0.48, 0.025, ink);
    }
  }
}

function word({ c, r, p, v, s }: Env) {
  const paper = lightest(p);
  const ink = pick(r, p.filter((x) => lum(x) < 0.45)) || darkest(p);
  rect(c, 0, 0, 1, 1, paper);
  const [txt] = HOME_WORDS[v];
  c.save();
  c.translate(0.5, 0.52);
  c.rotate((r() - 0.5) * 0.12);
  c.fillStyle = ink;
  c.textAlign = "center";
  c.textBaseline = "middle";
  const fam = `"Instrument Serif", "Noto Serif", "Noto Sans", Georgia, serif`;
  const style = /^[\u0000-\u024f\u1e00-\u1eff]+$/.test(txt) ? "italic " : "";
  c.font = `${style}0.3px ${fam}`;
  const w = c.measureText(txt).width || 0.5;
  const size = Math.min(0.42, (0.3 * 0.78) / w);
  c.font = `${style}${size}px ${fam}`;
  c.fillText(txt, 0, 0);
  c.restore();
  if (s > 24) {
    c.strokeStyle = pick(r, p.filter((x) => x !== paper));
    c.lineWidth = 0.012;
    c.lineCap = "round";
    c.beginPath();
    for (let x = 0.24; x <= 0.76; x += 0.02) c.lineTo(x, 0.74 + Math.sin(x * 40 + r()) * 0.008);
    c.stroke();
  }
}

/* ─────────────────────────── Architecture ─────────────────────────── */

function architecture({ c, r, p, v }: Env) {
  const sky = lightest(p);
  const dark = darkest(p);
  const rest = shuffled(r, p.filter((x) => x !== sky && x !== dark));
  const [w1, w2] = [rest[0] || dark, rest[1] || dark];
  rect(c, 0, 0, 1, 1, sky);
  switch (v) {
    case 0: { // Arcade
      rect(c, 0, 0.3, 1, 0.7, w1);
      const n = 3 + Math.floor(r() * 2);
      for (let i = 0; i < n; i++) {
        const x = (i + 0.5) / n, hw = 0.33 / n;
        c.fillStyle = dark;
        c.beginPath();
        c.moveTo(x - hw, 0.92);
        c.lineTo(x - hw, 0.55);
        c.arc(x, 0.55, hw, Math.PI, 0);
        c.lineTo(x + hw, 0.92);
        c.fill();
      }
      rect(c, 0, 0.92, 1, 0.08, w2);
      rect(c, 0, 0.3, 1, 0.04, w2);
      break;
    }
    case 1: { // Domes
      rect(c, 0.15, 0.55, 0.7, 0.45, w1);
      circle(c, 0.5, 0.55, 0.22, w2);
      rect(c, 0.49, 0.22, 0.02, 0.12, dark);
      circle(c, 0.24, 0.62, 0.08, w2);
      circle(c, 0.76, 0.62, 0.08, w2);
      for (let i = 0; i < 5; i++) {
        c.fillStyle = dark;
        c.beginPath();
        const x = 0.26 + i * 0.12;
        c.moveTo(x - 0.025, 0.95);
        c.lineTo(x - 0.025, 0.8);
        c.arc(x, 0.8, 0.025, Math.PI, 0);
        c.lineTo(x + 0.025, 0.95);
        c.fill();
      }
      break;
    }
    case 2: { // Pagoda
      const tiers = 4;
      for (let i = 0; i < tiers; i++) {
        const y = 0.88 - i * 0.18, hw = 0.38 - i * 0.07;
        rect(c, 0.5 - hw * 0.62, y - 0.1, hw * 1.24, 0.12, w1);
        poly(c, [0.5 - hw - 0.04, y - 0.08, 0.5 + hw + 0.04, y - 0.08, 0.5 + hw * 0.6, y - 0.16, 0.5 - hw * 0.6, y - 0.16], dark);
      }
      rect(c, 0.495, 0.08, 0.01, 0.12, dark);
      rect(c, 0, 0.94, 1, 0.06, w2);
      break;
    }
    case 3: { // Gabled houses
      const n = 4;
      for (let i = 0; i < n; i++) {
        const x = i / n, w = 1 / n, top = 0.28 + r() * 0.14;
        const col = i % 2 ? w1 : w2;
        rect(c, x, top + 0.12, w, 1, col);
        poly(c, [x, top + 0.12, x + w / 2, top - 0.04, x + w, top + 0.12], col);
        for (let k = 0; k < 3; k++) for (let m = 0; m < 2; m++)
          rect(c, x + w * (0.2 + m * 0.38), top + 0.2 + k * 0.17, w * 0.22, 0.09, sky);
      }
      break;
    }
    case 4: { // Whitewashed village
      rect(c, 0, 0.72, 1, 0.28, w1);
      const white = "#f7f4ee";
      rect(c, 0.08, 0.42, 0.34, 0.36, white);
      rect(c, 0.46, 0.5, 0.42, 0.28, white);
      rect(c, 0.3, 0.3, 0.22, 0.48, white);
      circle(c, 0.41, 0.3, 0.11, w1);
      rect(c, 0.6, 0.6, 0.06, 0.18, w1);
      rect(c, 0.16, 0.52, 0.06, 0.08, w1);
      rect(c, 0.74, 0.58, 0.05, 0.06, w1);
      break;
    }
    case 5: { // Adobe walls
      rect(c, 0, 0, 1, 1, sky);
      rect(c, 0.05, 0.4, 0.55, 0.6, w1);
      rect(c, 0.45, 0.55, 0.5, 0.45, w2);
      for (let i = 0; i < 5; i++) rect(c, 0.08 + i * 0.1, 0.46, 0.05, 0.015, dark);
      rect(c, 0.2, 0.6, 0.08, 0.12, dark);
      rect(c, 0.68, 0.72, 0.1, 0.28, dark);
      break;
    }
    case 6: { // Stilt houses
      rect(c, 0, 0.74, 1, 0.26, w2);
      for (let i = 0; i < 2; i++) {
        const x = 0.12 + i * 0.44;
        for (let k = 0; k < 4; k++) rect(c, x + k * 0.09, 0.55, 0.012, 0.32, dark);
        rect(c, x - 0.02, 0.42, 0.34, 0.15, w1);
        poly(c, [x - 0.06, 0.43, x + 0.15, 0.2, x + 0.36, 0.43], dark);
      }
      for (let k = 0; k < 6; k++) rect(c, r(), 0.8 + r() * 0.15, 0.08, 0.008, sky);
      break;
    }
    default: { // Bell tower
      rect(c, 0.38, 0.28, 0.24, 0.72, w1);
      poly(c, [0.36, 0.28, 0.5, 0.08, 0.64, 0.28], dark);
      c.fillStyle = dark;
      c.beginPath();
      c.moveTo(0.45, 0.48);
      c.lineTo(0.45, 0.38);
      c.arc(0.5, 0.38, 0.05, Math.PI, 0);
      c.lineTo(0.55, 0.48);
      c.fill();
      rect(c, 0, 0.82, 1, 0.18, w2);
      rect(c, 0.08, 0.66, 0.24, 0.2, w2);
      rect(c, 0.7, 0.62, 0.22, 0.24, w2);
    }
  }
}

/* ─────────────────────────────── Food ─────────────────────────────── */

function food({ c, r, p, v, s }: Env) {
  const [g, a, b, d] = shuffled(r, p);
  rect(c, 0, 0, 1, 1, g);
  const plate = lum(g) > 0.6 ? "#ffffff" : "#efe9dd";
  switch (v) {
    case 0: { // Rice
      circle(c, 0.5, 0.5, 0.4, a);
      circle(c, 0.5, 0.5, 0.33, "#fbf8f1");
      if (s > 40)
        for (let i = 0; i < 70; i++) {
          const t = r() * TAU, d2 = Math.sqrt(r()) * 0.3;
          c.save();
          c.translate(0.5 + Math.cos(t) * d2, 0.5 + Math.sin(t) * d2);
          c.rotate(r() * TAU);
          c.fillStyle = "#e7e0d0";
          c.beginPath();
          c.ellipse(0, 0, 0.018, 0.008, 0, 0, TAU);
          c.fill();
          c.restore();
        }
      c.save();
      c.translate(0.5, 0.5);
      c.rotate(-0.6);
      rect(c, -0.45, 0.32, 0.9, 0.02, b);
      rect(c, -0.45, 0.37, 0.9, 0.02, b);
      c.restore();
      break;
    }
    case 1: { // Round bread
      circle(c, 0.5, 0.5, 0.36, "#b9783b");
      circle(c, 0.49, 0.48, 0.32, "#cf9150");
      c.strokeStyle = "#8a5326";
      c.lineWidth = 0.02;
      for (let i = -1; i <= 1; i++) {
        c.beginPath();
        c.moveTo(0.32, 0.5 + i * 0.1);
        c.quadraticCurveTo(0.5, 0.46 + i * 0.1, 0.68, 0.5 + i * 0.1);
        c.stroke();
      }
      break;
    }
    case 2: { // Citrus
      const cols = ["#f2a541", "#f5d547", "#ef7b45", "#e4572e"];
      for (const [x, y] of [[0.36, 0.38], [0.64, 0.62]]) {
        const col = pick(r, cols);
        circle(c, x, y, 0.22, col);
        circle(c, x, y, 0.19, "#fff3d6");
        circle(c, x, y, 0.17, mix(col.replace("#", "#"), "#ffffff", 0.25));
        c.strokeStyle = "#fff3d6";
        c.lineWidth = 0.012;
        for (let i = 0; i < 10; i++) {
          const t = (i * TAU) / 10;
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x + Math.cos(t) * 0.17, y + Math.sin(t) * 0.17);
          c.stroke();
        }
      }
      break;
    }
    case 3: { // Pomegranate
      circle(c, 0.5, 0.52, 0.32, "#a4161a");
      poly(c, [0.44, 0.22, 0.5, 0.14, 0.56, 0.22], "#7a0d10");
      circle(c, 0.5, 0.54, 0.24, "#f6d8c9");
      for (let i = 0; i < (s > 30 ? 60 : 16); i++) {
        const t = r() * TAU, d2 = Math.sqrt(r()) * 0.21;
        circle(c, 0.5 + Math.cos(t) * d2, 0.54 + Math.sin(t) * d2, 0.022, i % 3 ? "#c1121f" : "#e5383b");
      }
      break;
    }
    case 4: { // Dumplings
      circle(c, 0.5, 0.5, 0.42, plate);
      for (const [x, y, rot] of [[0.36, 0.38, 0.2], [0.64, 0.4, -0.3], [0.5, 0.64, 0.05]]) {
        c.save();
        c.translate(x, y);
        c.rotate(rot);
        c.fillStyle = "#f5ecd8";
        c.beginPath();
        c.arc(0, 0.04, 0.13, Math.PI, 0);
        c.closePath();
        c.fill();
        c.strokeStyle = "#d8c7a4";
        c.lineWidth = 0.012;
        for (let k = -2; k <= 2; k++) {
          c.beginPath();
          c.moveTo(k * 0.04, 0.03);
          c.lineTo(k * 0.05, -0.07);
          c.stroke();
        }
        c.restore();
      }
      break;
    }
    case 5: { // Watermelon
      c.save();
      c.translate(0.5, 0.36);
      c.fillStyle = "#2d6a4f";
      c.beginPath(); c.arc(0, 0, 0.42, 0, Math.PI); c.fill();
      c.fillStyle = "#f1f7e8";
      c.beginPath(); c.arc(0, 0, 0.38, 0, Math.PI); c.fill();
      c.fillStyle = "#e5383b";
      c.beginPath(); c.arc(0, 0, 0.35, 0, Math.PI); c.fill();
      for (let i = 0; i < 9; i++) {
        const t = 0.3 + (i / 8) * (Math.PI - 0.6);
        circle(c, Math.cos(t) * 0.22, Math.sin(t) * 0.2, 0.014, "#1b1b1b");
      }
      c.restore();
      break;
    }
    case 6: { // Olives
      circle(c, 0.5, 0.5, 0.38, b);
      circle(c, 0.5, 0.5, 0.32, plate);
      for (let i = 0; i < 9; i++) {
        const t = r() * TAU, d2 = Math.sqrt(r()) * 0.22;
        c.save();
        c.translate(0.5 + Math.cos(t) * d2, 0.5 + Math.sin(t) * d2);
        c.rotate(r() * TAU);
        c.fillStyle = i % 2 ? "#556b2f" : "#3b2f2f";
        c.beginPath(); c.ellipse(0, 0, 0.055, 0.04, 0, 0, TAU); c.fill();
        c.restore();
      }
      break;
    }
    default: { // Flatbread
      circle(c, 0.5, 0.5, 0.4, "#e9c48a");
      for (let i = 0; i < (s > 30 ? 26 : 8); i++) {
        const t = r() * TAU, d2 = Math.sqrt(r()) * 0.34;
        circle(c, 0.5 + Math.cos(t) * d2, 0.5 + Math.sin(t) * d2, 0.012 + r() * 0.025, "#9c6a2e");
      }
      void a; void d;
    }
  }
}

/* ──────────────────────────── Landscapes ──────────────────────────── */

function grad(c: Ctx, y0: number, y1: number, stops: string[]) {
  const g = c.createLinearGradient(0, y0, 0, y1);
  stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s));
  return g;
}

function landscape({ c, r, p, v, s }: Env) {
  const L = lightest(p), D = darkest(p);
  const mids = shuffled(r, p.filter((x) => x !== L && x !== D));
  const m1 = mids[0] || D, m2 = mids[1] || L;
  switch (v) {
    case 0: { // Sea at dusk
      c.fillStyle = grad(c, 0, 0.6, [mix(m1, D, 0.3), m2, L]);
      c.fillRect(0, 0, 1, 0.6);
      circle(c, 0.5, 0.58, 0.1, mix(L, "#ffd27a", 0.5));
      c.fillStyle = grad(c, 0.6, 1, [mix(m1, D, 0.5), D]);
      c.fillRect(0, 0.6, 1, 0.4);
      for (let i = 0; i < 9; i++) rect(c, 0.5 - 0.12 + r() * 0.05, 0.62 + i * 0.035, 0.18 - i * 0.01, 0.008, mix(L, "#ffd27a", 0.5));
      break;
    }
    case 1: { // Dunes
      c.fillStyle = grad(c, 0, 0.5, [m2, L]);
      c.fillRect(0, 0, 1, 1);
      for (let k = 0; k < 4; k++) {
        c.fillStyle = mix(m1, D, k * 0.18);
        c.beginPath();
        c.moveTo(0, 1);
        const base = 0.45 + k * 0.14;
        for (let x = 0; x <= 1.01; x += 0.05) c.lineTo(x, base - Math.sin(x * 4 + k * 2 + r() * 0.2) * 0.06);
        c.lineTo(1, 1);
        c.fill();
      }
      break;
    }
    case 2: { // Mountains
      c.fillStyle = grad(c, 0, 1, [L, m2]);
      c.fillRect(0, 0, 1, 1);
      for (let k = 0; k < 4; k++) {
        c.fillStyle = mix(L, D, 0.25 + k * 0.22);
        c.beginPath();
        c.moveTo(0, 1);
        let y = 0.35 + k * 0.13;
        for (let x = 0; x <= 1.05; x += 0.08) {
          y += (r() - 0.5) * 0.14;
          c.lineTo(x, Math.max(0.15, y));
        }
        c.lineTo(1, 1);
        c.fill();
      }
      break;
    }
    case 3: { // Terraced fields
      rect(c, 0, 0, 1, 0.2, L);
      for (let k = 0; k < 9; k++) {
        c.fillStyle = mix(k % 2 ? "#7fa650" : "#5c8a3a", m1, 0.15 + (k % 3) * 0.08);
        c.beginPath();
        c.moveTo(0, 1);
        const base = 0.16 + k * 0.1;
        for (let x = 0; x <= 1.01; x += 0.05) c.lineTo(x, base + Math.sin(x * 3 + k * 0.7) * 0.04);
        c.lineTo(1, 1);
        c.fill();
      }
      break;
    }
    case 4: { // Lake at dawn
      c.fillStyle = grad(c, 0, 0.55, [m2, L]);
      c.fillRect(0, 0, 1, 0.55);
      c.fillStyle = mix(D, m1, 0.3);
      c.beginPath();
      c.moveTo(0, 0.56);
      for (let x = 0; x <= 1.01; x += 0.025) c.lineTo(x, 0.5 - r() * 0.07);
      c.lineTo(1, 0.56);
      c.fill();
      c.fillStyle = grad(c, 0.55, 1, [L, m2]);
      c.fillRect(0, 0.56, 1, 0.44);
      for (let i = 0; i < 6; i++) rect(c, r() * 0.8, 0.62 + r() * 0.3, 0.2, 0.006, "rgba(255,255,255,0.5)");
      break;
    }
    case 5: { // Snowfield
      c.fillStyle = grad(c, 0, 0.6, [mix(m1, "#ffffff", 0.5), "#f4f6f8"]);
      c.fillRect(0, 0, 1, 1);
      c.fillStyle = "#ffffff";
      c.beginPath(); c.ellipse(0.3, 0.9, 0.6, 0.3, 0, 0, TAU); c.fill();
      c.fillStyle = "#e9eef2";
      c.beginPath(); c.ellipse(0.85, 0.95, 0.5, 0.25, 0, 0, TAU); c.fill();
      for (let i = 0; i < 7; i++) {
        const x = 0.1 + r() * 0.8, y = 0.58 + r() * 0.15, h = 0.05 + r() * 0.06;
        poly(c, [x, y - h, x - h * 0.35, y, x + h * 0.35, y], D);
      }
      break;
    }
    case 6: { // River bend
      rect(c, 0, 0, 1, 1, mix("#6a994e", m1, 0.25));
      c.strokeStyle = mix("#90caf9", m2, 0.3);
      c.lineWidth = 0.09;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(-0.1, 0.15);
      c.bezierCurveTo(0.7, 0.1, 0.2, 0.9, 1.1, 0.85);
      c.stroke();
      for (let i = 0; i < 14; i++) circle(c, r(), r(), 0.02 + r() * 0.025, mix("#386641", D, 0.2));
      break;
    }
    default: { // Night sky
      c.fillStyle = grad(c, 0, 1, [mix(D, "#000000", 0.4), mix(m1, D, 0.6)]);
      c.fillRect(0, 0, 1, 1);
      for (let i = 0; i < (s > 30 ? 60 : 14); i++) circle(c, r(), r() * 0.7, 0.002 + r() * 0.005, "#fffbe6");
      c.fillStyle = "#0b0b0c";
      c.beginPath();
      c.moveTo(0, 1);
      for (let x = 0; x <= 1.01; x += 0.1) c.lineTo(x, 0.82 - Math.sin(x * 3) * 0.05);
      c.lineTo(1, 1);
      c.fill();
    }
  }
}

/* ───────────────────────────── Folk art ───────────────────────────── */

function folk({ c, r, p, v }: Env) {
  const [g, a, b, d, e] = shuffled(r, p);
  rect(c, 0, 0, 1, 1, g);
  const petal = (x: number, y: number, rot: number, len: number, w: number, col: string) => {
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(w, -len / 2, 0, -len);
    c.quadraticCurveTo(-w, -len / 2, 0, 0);
    c.fill();
    c.restore();
  };
  switch (v) {
    case 0: { // Flower motif
      rect(c, 0.49, 0.5, 0.02, 0.42, d);
      petal(0.5, 0.75, -0.9, 0.2, 0.08, d);
      petal(0.5, 0.7, 0.9, 0.2, 0.08, d);
      for (let i = 0; i < 8; i++) petal(0.5, 0.42, (i * TAU) / 8, 0.22, 0.09, i % 2 ? a : b);
      circle(c, 0.5, 0.42, 0.06, e);
      break;
    }
    case 1: { // Two birds
      for (const dir of [-1, 1]) {
        c.save();
        c.translate(0.5 + dir * 0.2, 0.5);
        c.scale(dir, 1);
        c.fillStyle = a;
        c.beginPath(); c.ellipse(0, 0, 0.16, 0.1, -0.2, 0, TAU); c.fill();
        poly(c, [0.12, -0.02, 0.3, -0.12, 0.26, 0.06], a);
        circle(c, -0.14, -0.1, 0.06, a);
        poly(c, [-0.2, -0.11, -0.25, -0.09, -0.2, -0.07], d);
        circle(c, -0.15, -0.11, 0.012, e);
        petal(0.02, 0.02, -1.3, 0.16, 0.05, b);
        c.restore();
      }
      petal(0.5, 0.75, 0, 0.2, 0.06, d);
      break;
    }
    case 2: { // Tree of life
      rect(c, 0.48, 0.45, 0.04, 0.45, d);
      for (let i = 0; i < 4; i++) {
        const y = 0.75 - i * 0.12, l = 0.3 - i * 0.05;
        petal(0.5, y, -1.1, l, 0.06, a);
        petal(0.5, y, 1.1, l, 0.06, a);
        circle(c, 0.5 - Math.sin(1.1) * l, y - Math.cos(1.1) * l, 0.03, b);
        circle(c, 0.5 + Math.sin(1.1) * l, y - Math.cos(1.1) * l, 0.03, b);
      }
      circle(c, 0.5, 0.2, 0.06, e);
      rect(c, 0.3, 0.9, 0.4, 0.03, d);
      break;
    }
    case 3: { // Rosette
      for (let ring = 3; ring >= 1; ring--)
        for (let i = 0; i < ring * 6; i++)
          petal(0.5, 0.5, (i * TAU) / (ring * 6) + ring, ring * 0.13, 0.05 + ring * 0.01, [a, b, d][ring - 1]);
      circle(c, 0.5, 0.5, 0.05, e);
      break;
    }
    case 4: { // Vine
      c.strokeStyle = d;
      c.lineWidth = 0.02;
      c.beginPath();
      for (let y = 0; y <= 1.01; y += 0.02) c.lineTo(0.5 + Math.sin(y * 9) * 0.15, y);
      c.stroke();
      for (let k = 0; k < 7; k++) {
        const y = 0.08 + k * 0.14;
        const x = 0.5 + Math.sin(y * 9) * 0.15;
        petal(x, y, k % 2 ? 1.2 : -1.2, 0.18, 0.06, k % 3 ? a : b);
        if (k % 2) circle(c, x + (k % 4 ? 0.1 : -0.1), y + 0.04, 0.03, e);
      }
      break;
    }
    default: { // Paper-cut
      rect(c, 0, 0, 1, 1, a);
      c.fillStyle = g;
      for (let i = 0; i < 6; i++) {
        petal(0.5, 0.5, (i * TAU) / 6, 0.34, 0.08, g);
        circle(c, 0.5 + Math.cos((i * TAU) / 6 + Math.PI / 6) * 0.3, 0.5 + Math.sin((i * TAU) / 6 + Math.PI / 6) * 0.3, 0.04, g);
      }
      circle(c, 0.5, 0.5, 0.05, a);
      for (let i = 0; i < 20; i++) rect(c, i / 20 + 0.01, 0.03, 0.03, 0.03, g);
      for (let i = 0; i < 20; i++) rect(c, i / 20 + 0.01, 0.94, 0.03, 0.03, g);
    }
  }
}

/* ───────────────────────────── Abstract ───────────────────────────── */

function abstract({ c, r, p, v }: Env) {
  const [g, a, b, d, e] = shuffled(r, p);
  rect(c, 0, 0, 1, 1, g);
  switch (v) {
    case 0: // Composition
      circle(c, 0.3 + r() * 0.2, 0.35 + r() * 0.2, 0.18 + r() * 0.1, a);
      rect(c, 0.5, 0.45 + r() * 0.1, 0.35, 0.35, b);
      rect(c, 0.1, 0.78, 0.8, 0.025, d);
      c.fillStyle = e;
      c.beginPath(); c.arc(0.72, 0.3, 0.12, Math.PI, 0); c.fill();
      break;
    case 1: // Colour field
      c.globalAlpha = 0.92;
      rect(c, 0.1, 0.08, 0.8, 0.5, a);
      rect(c, 0.1, 0.62, 0.8, 0.3, b);
      c.globalAlpha = 0.2;
      rect(c, 0.12, 0.1, 0.76, 0.46, d);
      c.globalAlpha = 1;
      break;
    case 2: // Circles
      c.globalAlpha = 0.85;
      for (let i = 0; i < 4; i++) circle(c, 0.25 + r() * 0.5, 0.25 + r() * 0.5, 0.12 + r() * 0.2, [a, b, d, e][i]);
      c.globalAlpha = 1;
      break;
    case 3: { // Interval
      let x = 0.05;
      while (x < 0.95) {
        const w = 0.02 + r() * 0.12;
        rect(c, x, 0.1, Math.min(w, 0.95 - x), 0.8, pick(r, [a, b, d, e]));
        x += w + 0.02 + r() * 0.06;
      }
      break;
    }
    case 4: // Weight and balance
      rect(c, 0.08, 0.7, 0.84, 0.02, d);
      circle(c, 0.35, 0.47, 0.22, a);
      rect(c, 0.66, 0.56, 0.14, 0.14, b);
      poly(c, [0.5, 0.72, 0.44, 0.84, 0.56, 0.84], e);
      break;
    case 5: // Horizon
      rect(c, 0, 0.55, 1, 0.45, a);
      circle(c, 0.5, 0.55, 0.16, b);
      rect(c, 0, 0.55, 1, 0.45, a);
      rect(c, 0, 0.55, 1, 0.012, d);
      break;
    default: { // Rhythm
      const n = 6;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++)
          circle(c, (i + 0.5) / n, (j + 0.5) / n, (0.2 + 0.8 * Math.abs(Math.sin(i * 0.9 + j * 0.6 + r()))) * (0.45 / n), pick(r, [a, b, d]));
    }
  }
}

/* ────────────────────────── Vessels & sky ────────────────────────── */

function vessel({ c, r, p, v }: Env) {
  const [g, a, b, d] = shuffled(r, p);
  rect(c, 0, 0, 1, 1, g);
  rect(c, 0, 0.86, 1, 0.14, mix(g, "#000000", 0.12));
  c.fillStyle = a;
  switch (v) {
    case 2: { // Lantern
      rect(c, 0.495, 0, 0.01, 0.16, d);
      poly(c, [0.38, 0.22, 0.62, 0.22, 0.56, 0.16, 0.44, 0.16], d);
      poly(c, [0.34, 0.24, 0.66, 0.24, 0.6, 0.7, 0.4, 0.7], a);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++)
        poly(c, [0.42 + i * 0.07, 0.3 + j * 0.1, 0.455 + i * 0.07, 0.34 + j * 0.1, 0.42 + i * 0.07, 0.38 + j * 0.1, 0.385 + i * 0.07, 0.34 + j * 0.1], "#ffe8a3");
      poly(c, [0.4, 0.7, 0.6, 0.7, 0.55, 0.76, 0.45, 0.76], d);
      return;
    }
    case 3: { // Teapot
      c.beginPath(); c.ellipse(0.48, 0.62, 0.24, 0.2, 0, 0, TAU); c.fill();
      poly(c, [0.68, 0.62, 0.86, 0.42, 0.88, 0.45, 0.72, 0.7], a);
      c.strokeStyle = a; c.lineWidth = 0.04;
      c.beginPath(); c.arc(0.24, 0.6, 0.1, Math.PI * 0.5, Math.PI * 1.5); c.stroke();
      rect(c, 0.38, 0.4, 0.2, 0.05, d);
      circle(c, 0.48, 0.38, 0.03, d);
      rect(c, 0.25, 0.6, 0.46, 0.04, b);
      return;
    }
    case 4: { // Bowl
      c.beginPath(); c.arc(0.5, 0.5, 0.32, 0, Math.PI); c.fill();
      rect(c, 0.42, 0.82, 0.16, 0.04, a);
      c.fillStyle = b;
      c.beginPath(); c.ellipse(0.5, 0.5, 0.32, 0.06, 0, 0, TAU); c.fill();
      for (let i = 0; i < 7; i++) circle(c, 0.26 + i * 0.08, 0.64, 0.018, d);
      return;
    }
    default: { // Vessel / water jar
      const w = v === 1 ? 0.28 : 0.22;
      c.beginPath();
      c.moveTo(0.42, 0.14);
      c.lineTo(0.58, 0.14);
      c.bezierCurveTo(0.58, 0.28, 0.5 + w + 0.06, 0.32, 0.5 + w, 0.55);
      c.bezierCurveTo(0.5 + w - 0.02, 0.75, 0.62, 0.86, 0.58, 0.88);
      c.lineTo(0.42, 0.88);
      c.bezierCurveTo(0.38, 0.86, 0.5 - w + 0.02, 0.75, 0.5 - w, 0.55);
      c.bezierCurveTo(0.5 - w - 0.06, 0.32, 0.42, 0.28, 0.42, 0.14);
      c.fill();
      rect(c, 0.4, 0.12, 0.2, 0.03, d);
      rect(c, 0.5 - w + 0.01, 0.48, (w - 0.01) * 2, 0.04, b);
      rect(c, 0.5 - w + 0.03, 0.62, (w - 0.03) * 2, 0.02, d);
      for (let i = 0; i < 6; i++) poly(c, [0.36 + i * 0.05, 0.56, 0.385 + i * 0.05, 0.6, 0.41 + i * 0.05, 0.56], d);
      if (v === 1) {
        c.strokeStyle = a; c.lineWidth = 0.03;
        c.beginPath(); c.arc(0.28, 0.36, 0.07, Math.PI * 0.4, Math.PI * 1.6); c.stroke();
        c.beginPath(); c.arc(0.72, 0.36, 0.07, -Math.PI * 0.6, Math.PI * 0.6); c.stroke();
      }
    }
  }
}

function celestial({ c, r, p, v }: Env) {
  const [g, a, b] = shuffled(r, p);
  rect(c, 0, 0, 1, 1, g);
  const glow = lum(g) > 0.5 ? darkest(p) : lightest(p);
  switch (v) {
    case 0: // Sun
      for (let i = 0; i < 16; i++) {
        c.save();
        c.translate(0.5, 0.5);
        c.rotate((i * TAU) / 16);
        poly(c, [-0.03, -0.24, 0, -0.4 - (i % 2) * 0.05, 0.03, -0.24], i % 2 ? a : b);
        c.restore();
      }
      circle(c, 0.5, 0.5, 0.2, a);
      break;
    case 1: // Crescent moon
      circle(c, 0.5, 0.5, 0.28, glow);
      circle(c, 0.62, 0.42, 0.24, g);
      for (let i = 0; i < 6; i++) circle(c, r(), r(), 0.008, glow);
      break;
    case 2: // Full moon
      circle(c, 0.5, 0.5, 0.3, glow);
      c.globalAlpha = 0.15;
      for (let i = 0; i < 7; i++) circle(c, 0.38 + r() * 0.24, 0.38 + r() * 0.24, 0.02 + r() * 0.05, g);
      c.globalAlpha = 1;
      break;
    case 3: // Morning star
      c.fillStyle = glow;
      starPoly(c, 0.5, 0.5, 0.34, 0.06, 4);
      c.fill();
      c.fillStyle = a;
      starPoly(c, 0.5, 0.5, 0.16, 0.03, 4, 0);
      c.fill();
      break;
    default: // Eclipse
      circle(c, 0.5, 0.5, 0.3, a);
      c.globalAlpha = 0.5;
      circle(c, 0.5, 0.5, 0.33, a);
      c.globalAlpha = 1;
      circle(c, 0.5, 0.5, 0.27, darkest(p));
  }
}

const RENDERERS: Record<FoundingKind, (e: Env) => void> = {
  stripweave, ikat, zellige, plaid, quilt, symbol, word, architecture, food, landscape,
  folk, abstract, vessel, celestial, embroidery,
  painting, typography, render3d, handmosaic: handMosaic, poster,
};

/**
 * Draw a founding piece into ctx at (x, y) with pixel size s.
 * Set `grain` for large renders to add a subtle printed-paper texture.
 */
export function drawFounding(
  c: Ctx,
  piece: Pick<FoundingPiece, "kind" | "seed" | "palette">,
  x: number,
  y: number,
  s: number,
  grain = false,
) {
  const kind = KINDS[piece.kind];
  const p = PALETTES[piece.palette % PALETTES.length];
  const r = mulberry32(piece.seed * 7919 + piece.kind * 104729 + 1);
  c.save();
  c.beginPath();
  c.rect(x, y, s, s);
  c.clip();
  c.translate(x, y);
  c.scale(s, s);
  try {
    RENDERERS[kind]({ c, r, p, s, v: variantOf(kind, piece.seed) });
  } catch {
    rect(c, 0, 0, 1, 1, p[0]);
  }
  if (grain) {
    const gr = mulberry32(piece.seed + 3);
    for (let i = 0; i < 1400; i++) {
      c.fillStyle = gr() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
      c.fillRect(gr(), gr(), 0.004, 0.004);
    }
  }
  c.restore();
}
