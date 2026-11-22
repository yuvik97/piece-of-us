/* The mosaic renderer.
 *
 * One million squares are never turned into DOM nodes. Instead:
 *  · an overview bitmap (1000×1000 px, one pixel per square) draws the far zoom levels;
 *  · closer in, the visible area is split into chunks that are rendered once per
 *    level of detail into offscreen canvases and cached (LRU);
 *  · at the closest zoom, individual squares are rendered at full resolution.
 * Only squares inside the viewport are ever drawn. */

import { GRID, TileState, pieceNumber } from "@/lib/grid";
import { drawFounding } from "@/lib/founding/render";
import { foundingFromExtra, mediaUrl, type MosaicData } from "./data";

export type Filter = "all" | "founding" | "contributions";

export interface Camera { x: number; y: number; scale: number } // x,y = world point at screen centre (in squares); scale = css px per square

const PAPER = "#f6f3ee";
const EMPTY = "#e9e4dc";
const HELD = "#dcd5ca";
const INK = "#1c1b19";
const ACCENT = "#d9441c";

const LEVELS = [
  { px: 16, chunk: 32 },
  { px: 48, chunk: 16 },
  { px: 128, chunk: 8 },
];
const DETAIL_FROM = 5; // css px per square where artworks start to show
const DIRECT_FROM = 150; // device px per square where squares are drawn individually
const MAX_CHUNKS = 160;

type Canvas2D = CanvasRenderingContext2D;

export class MosaicEngine {
  cam: Camera = { x: GRID / 2, y: GRID / 2, scale: 30 };
  minScale = 0.5;
  maxScale = 260;
  filter: Filter = "all";
  hover = -1;
  selected = -1;
  onChange?: () => void;

  private ctx: Canvas2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private data: MosaicData | null = null;
  private overview: HTMLCanvasElement;
  private chunks = new Map<string, HTMLCanvasElement>();
  private chunkOrder: string[] = [];
  private direct = new Map<number, HTMLCanvasElement>();
  private images = new Map<string, HTMLImageElement | "loading" | "error">();
  private raf = 0;
  private dirty = true;
  private anim: { from: Camera; to: Camera; t0: number; dur: number } | null = null;
  private destroyed = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    this.overview = document.createElement("canvas");
    this.overview.width = GRID;
    this.overview.height = GRID;
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.chunks.clear();
    this.direct.clear();
  }

  resize(w: number, h: number) {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = w;
    this.h = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.minScale = Math.min(w, h) / GRID * 0.92;
    this.cam.scale = Math.max(this.minScale, this.cam.scale);
    this.invalidate();
  }

  get size() {
    return { w: this.w, h: this.h };
  }

  fitScale() {
    return this.minScale;
  }

  setData(d: MosaicData) {
    const prev = this.data;
    this.data = d;
    this.buildOverview();
    if (prev) {
      // Only drop chunks whose squares changed.
      const changed = new Set<string>();
      const check = (t: number) => {
        if (prev.state[t] !== d.state[t] || prev.color[t] !== d.color[t] || prev.extra[t] !== d.extra[t]) {
          for (const L of LEVELS) changed.add(`${L.px}:${Math.floor((t % GRID) / L.chunk)}:${Math.floor(t / GRID / L.chunk)}`);
          this.direct.delete(t);
        }
      };
      prev.filled.forEach(check);
      d.filled.forEach(check);
      for (const k of changed) this.chunks.delete(k);
    } else {
      this.chunks.clear();
    }
    this.invalidate();
  }

  setFilter(f: Filter) {
    this.filter = f;
    this.chunks.clear();
    this.direct.clear();
    this.buildOverview();
    this.invalidate();
  }

  invalidate() {
    this.dirty = true;
  }

  /** Re-render all cached artwork (e.g. once web fonts have loaded). */
  refresh() {
    this.chunks.clear();
    this.chunkOrder = [];
    this.direct.clear();
    this.invalidate();
  }

  /* ───────── camera ───────── */

  screenToWorld(sx: number, sy: number) {
    return { x: this.cam.x + (sx - this.w / 2) / this.cam.scale, y: this.cam.y + (sy - this.h / 2) / this.cam.scale };
  }

  tileAt(sx: number, sy: number) {
    const p = this.screenToWorld(sx, sy);
    const x = Math.floor(p.x), y = Math.floor(p.y);
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) return -1;
    return y * GRID + x;
  }

  stateOf(t: number): number {
    return this.data ? this.data.state[t] : 0;
  }

  extraOf(t: number) {
    return this.data ? this.data.extra[t] : 0;
  }

  private clamp(c: Camera): Camera {
    const scale = Math.min(this.maxScale, Math.max(this.minScale, c.scale));
    // keep the canvas centred when it fits; otherwise allow panning up to its edges
    const halfW = this.w / 2 / scale, halfH = this.h / 2 / scale;
    const x = halfW * 2 >= GRID ? GRID / 2 : Math.min(GRID - halfW * 0.6, Math.max(halfW * 0.6, c.x));
    const y = halfH * 2 >= GRID ? GRID / 2 : Math.min(GRID - halfH * 0.6, Math.max(halfH * 0.6, c.y));
    return { x, y, scale };
  }

  pan(dxScreen: number, dyScreen: number) {
    this.anim = null;
    this.cam = this.clamp({ ...this.cam, x: this.cam.x - dxScreen / this.cam.scale, y: this.cam.y - dyScreen / this.cam.scale });
    this.invalidate();
  }

  zoomAt(sx: number, sy: number, factor: number) {
    this.anim = null;
    const before = this.screenToWorld(sx, sy);
    const scale = Math.min(this.maxScale, Math.max(this.minScale, this.cam.scale * factor));
    const x = before.x - (sx - this.w / 2) / scale;
    const y = before.y - (sy - this.h / 2) / scale;
    this.cam = this.clamp({ x, y, scale });
    this.invalidate();
  }

  setCamera(c: Partial<Camera>) {
    this.anim = null;
    this.cam = this.clamp({ ...this.cam, ...c });
    this.invalidate();
  }

  flyTo(to: Partial<Camera>, dur = 900) {
    const target = this.clamp({ ...this.cam, ...to });
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      this.cam = target;
      this.invalidate();
      return;
    }
    this.anim = { from: { ...this.cam }, to: target, t0: performance.now(), dur };
    this.invalidate();
  }

  /* ───────── overview bitmap ───────── */

  private buildOverview() {
    const d = this.data;
    if (!d) return;
    const ctx = this.overview.getContext("2d")!;
    const img = ctx.createImageData(GRID, GRID);
    const px = img.data;
    const er = 0xe9, eg = 0xe4, eb = 0xdc;
    for (let i = 0; i < GRID * GRID; i++) {
      const o = i * 4;
      px[o] = er; px[o + 1] = eg; px[o + 2] = eb; px[o + 3] = 255;
    }
    for (let k = 0; k < d.filled.length; k++) {
      const t = d.filled[k];
      const st = d.state[t];
      const o = t * 4;
      let c = d.color[t];
      if (st === TileState.Reserved || st === TileState.Pending) c = 0xdcd5ca;
      let r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
      if (!this.matches(st)) {
        r = Math.round(r * 0.15 + er * 0.85); g = Math.round(g * 0.15 + eg * 0.85); b = Math.round(b * 0.15 + eb * 0.85);
      }
      px[o] = r; px[o + 1] = g; px[o + 2] = b;
    }
    ctx.putImageData(img, 0, 0);
  }

  private matches(st: number) {
    if (this.filter === "all") return true;
    if (this.filter === "founding") return st === TileState.Founding;
    return st === TileState.Published;
  }

  /* ───────── tile drawing ───────── */

  private imageFor(t: number, size: "thumb" | "full"): HTMLImageElement | null {
    if (!this.data) return null;
    const url = mediaUrl(this.data.mediaBase, pieceNumber(t), size, this.data.color[t]);
    const cached = this.images.get(url);
    if (cached instanceof HTMLImageElement) return cached;
    if (cached) return null;
    this.images.set(url, "loading");
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      this.images.set(url, img);
      for (const L of LEVELS) this.chunks.delete(`${L.px}:${Math.floor((t % GRID) / L.chunk)}:${Math.floor(t / GRID / L.chunk)}`);
      this.direct.delete(t);
      this.invalidate();
    };
    img.onerror = () => this.images.set(url, "error");
    img.src = url;
    return null;
  }

  private drawTile(c: Canvas2D, t: number, x: number, y: number, s: number, big: boolean) {
    const d = this.data!;
    const st = d.state[t];
    if (st === TileState.Available) return;
    if (st === TileState.Reserved || st === TileState.Pending) {
      c.fillStyle = HELD;
      c.fillRect(x, y, s, s);
      if (s >= 10) {
        c.save();
        c.beginPath();
        c.rect(x, y, s, s);
        c.clip();
        c.strokeStyle = "rgba(28,27,25,0.18)";
        c.lineWidth = Math.max(1, s / 24);
        const step = Math.max(4, s / 5);
        c.beginPath();
        for (let k = -s; k < s; k += step) {
          c.moveTo(x + k, y + s);
          c.lineTo(x + k + s, y);
        }
        c.stroke();
        c.restore();
      }
      return;
    }
    if (st === TileState.Founding) {
      drawFounding(c, foundingFromExtra(d.extra[t]), x, y, s, big && s >= 200);
    } else {
      const img = this.imageFor(t, s > 64 ? "full" : "thumb");
      if (img) c.drawImage(img, x, y, s, s);
      else {
        c.fillStyle = "#" + d.color[t].toString(16).padStart(6, "0");
        c.fillRect(x, y, s, s);
      }
    }
    if (!this.matches(st)) {
      c.fillStyle = "rgba(233,228,220,0.86)";
      c.fillRect(x, y, s, s);
    }
  }

  private gapFor(px: number) {
    return px < 6 ? 0 : Math.max(1, Math.round(px * 0.07));
  }

  private chunk(L: (typeof LEVELS)[number], cx: number, cy: number): HTMLCanvasElement | null {
    const key = `${L.px}:${cx}:${cy}`;
    const hit = this.chunks.get(key);
    if (hit) return hit;
    return null;
  }

  private renderChunk(L: (typeof LEVELS)[number], cx: number, cy: number) {
    const key = `${L.px}:${cx}:${cy}`;
    const cv = document.createElement("canvas");
    cv.width = cv.height = L.chunk * L.px;
    const c = cv.getContext("2d")!;
    const gap = this.gapFor(L.px);
    const x0 = cx * L.chunk, y0 = cy * L.chunk;
    const d = this.data!;
    for (let j = 0; j < L.chunk; j++) {
      const y = y0 + j;
      if (y >= GRID) break;
      for (let i = 0; i < L.chunk; i++) {
        const x = x0 + i;
        if (x >= GRID) break;
        const t = y * GRID + x;
        if (d.state[t] === TileState.Available) continue;
        this.drawTile(c, t, i * L.px + gap / 2, j * L.px + gap / 2, L.px - gap, false);
      }
    }
    this.chunks.set(key, cv);
    this.chunkOrder.push(key);
    while (this.chunkOrder.length > MAX_CHUNKS) {
      const k = this.chunkOrder.shift()!;
      if (k !== key) this.chunks.delete(k);
    }
  }

  /* ───────── frame ───────── */

  private loop(now: number) {
    if (this.destroyed) return;
    if (this.anim) {
      const k = Math.min(1, (now - this.anim.t0) / this.anim.dur);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      const { from, to } = this.anim;
      // interpolate zoom in log space so it feels even
      const scale = Math.exp(Math.log(from.scale) + (Math.log(to.scale) - Math.log(from.scale)) * e);
      this.cam = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, scale };
      if (k >= 1) this.anim = null;
      this.dirty = true;
    }
    if (this.dirty && this.w > 0) {
      this.dirty = false;
      const pending = this.draw();
      if (pending) this.dirty = true;
      this.onChange?.();
    }
    this.raf = requestAnimationFrame(this.loop);
  }

  /** Returns true if more work remains (chunks still to render). */
  private draw(): boolean {
    const c = this.ctx;
    const { w, h, dpr, cam } = this;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = PAPER;
    c.fillRect(0, 0, w, h);
    if (!this.data) return false;

    const s = cam.scale;
    const ox = w / 2 - cam.x * s;
    const oy = h / 2 - cam.y * s;
    const vx0 = Math.max(0, Math.floor((0 - ox) / s));
    const vy0 = Math.max(0, Math.floor((0 - oy) / s));
    const vx1 = Math.min(GRID, Math.ceil((w - ox) / s));
    const vy1 = Math.min(GRID, Math.ceil((h - oy) / s));

    // Canvas bounds
    c.fillStyle = EMPTY;
    c.fillRect(ox + vx0 * s, oy + vy0 * s, (vx1 - vx0) * s, (vy1 - vy0) * s);

    let pending = false;

    if (s < DETAIL_FROM) {
      c.imageSmoothingEnabled = s < 1;
      c.imageSmoothingQuality = "high";
      c.drawImage(this.overview, vx0, vy0, vx1 - vx0, vy1 - vy0, ox + vx0 * s, oy + vy0 * s, (vx1 - vx0) * s, (vy1 - vy0) * s);
    } else {
      // grout between squares
      const gapCss = this.gapFor(s * dpr) / dpr;
      c.fillStyle = PAPER;
      for (let x = vx0; x <= vx1; x++) c.fillRect(ox + x * s - gapCss / 2, oy + vy0 * s, gapCss, (vy1 - vy0) * s);
      for (let y = vy0; y <= vy1; y++) c.fillRect(ox + vx0 * s, oy + y * s - gapCss / 2, (vx1 - vx0) * s, gapCss);

      const devPx = s * dpr;
      if (devPx >= DIRECT_FROM) {
        const d = this.data;
        for (let y = vy0; y < vy1; y++)
          for (let x = vx0; x < vx1; x++) {
            const t = y * GRID + x;
            if (d.state[t] === TileState.Available) continue;
            let cv = this.direct.get(t);
            if (!cv) {
              cv = document.createElement("canvas");
              cv.width = cv.height = 512;
              this.drawTile(cv.getContext("2d")!, t, 0, 0, 512, true);
              this.direct.set(t, cv);
              if (this.direct.size > 400) this.direct.delete(this.direct.keys().next().value!);
            }
            const g = gapCss;
            c.imageSmoothingEnabled = true;
            c.drawImage(cv, ox + x * s + g / 2, oy + y * s + g / 2, s - g, s - g);
          }
      } else {
        const L = LEVELS.find((l) => l.px >= devPx * 0.9) ?? LEVELS[LEVELS.length - 1];
        const cx0 = Math.floor(vx0 / L.chunk), cy0 = Math.floor(vy0 / L.chunk);
        const cx1 = Math.floor((vx1 - 1) / L.chunk), cy1 = Math.floor((vy1 - 1) / L.chunk);
        const t0 = performance.now();
        const cs = L.chunk * s;
        c.imageSmoothingEnabled = true;
        c.imageSmoothingQuality = "medium";
        // render from the centre outward so the focus appears first
        const order: [number, number][] = [];
        for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) order.push([cx, cy]);
        const mx = (cx0 + cx1) / 2, my = (cy0 + cy1) / 2;
        order.sort((a, b) => Math.hypot(a[0] - mx, a[1] - my) - Math.hypot(b[0] - mx, b[1] - my));
        for (const [cx, cy] of order) {
          let cv = this.chunk(L, cx, cy);
          if (!cv && performance.now() - t0 < 14) {
            if (this.chunkHasContent(L, cx, cy)) {
              this.renderChunk(L, cx, cy);
              cv = this.chunk(L, cx, cy);
            } else continue;
          }
          if (cv) c.drawImage(cv, ox + cx * cs, oy + cy * cs, cs, cs);
          else {
            pending = true;
            // fallback: flat colours from the overview while the chunk renders
            c.imageSmoothingEnabled = false;
            const x = cx * L.chunk, y = cy * L.chunk;
            const ww = Math.min(L.chunk, GRID - x), hh = Math.min(L.chunk, GRID - y);
            c.drawImage(this.overview, x, y, ww, hh, ox + x * s, oy + y * s, ww * s, hh * s);
            c.imageSmoothingEnabled = true;
          }
        }
      }
    }

    // hover & selection
    const outline = (t: number, color: string, width: number) => {
      if (t < 0) return;
      const x = t % GRID, y = Math.floor(t / GRID);
      const size = Math.max(s, 3);
      c.strokeStyle = color;
      c.lineWidth = width;
      c.strokeRect(ox + x * s - (size - s) / 2, oy + y * s - (size - s) / 2, size, size);
    };
    if (s >= 3) outline(this.hover, INK, 1.5);
    if (this.selected >= 0) {
      const x = this.selected % GRID, y = Math.floor(this.selected / GRID);
      if (s < 6) {
        // a locator ring so the square can be found when zoomed out
        c.strokeStyle = ACCENT;
        c.lineWidth = 2;
        c.beginPath();
        c.arc(ox + (x + 0.5) * s, oy + (y + 0.5) * s, 10, 0, Math.PI * 2);
        c.stroke();
      }
      outline(this.selected, ACCENT, 2.5);
    }
    return pending;
  }

  private chunkHasContent(L: (typeof LEVELS)[number], cx: number, cy: number) {
    const d = this.data!;
    for (let j = 0; j < L.chunk; j++) {
      const y = cy * L.chunk + j;
      if (y >= GRID) break;
      const row = y * GRID + cx * L.chunk;
      for (let i = 0; i < L.chunk && cx * L.chunk + i < GRID; i++) if (d.state[row + i] !== TileState.Available) return true;
    }
    return false;
  }
}
