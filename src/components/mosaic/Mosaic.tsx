"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GRID, TileState, formatPieceNumber, pieceNumber } from "@/lib/grid";
import { MosaicEngine, type Camera, type Filter } from "./engine";
import { useMosaicData } from "./data";

export interface MosaicHandle {
  flyToTile: (t: number, scale?: number) => void;
  fit: () => void;
}

interface Props {
  /** embedded: lives inside a scrolling page (wheel needs ⌘/Ctrl, one finger scrolls the page).
   *  full: owns the viewport. picker: like full but clicks choose available squares. */
  mode?: "embedded" | "full" | "picker";
  className?: string;
  initial?: Partial<Camera>;
  selected?: number;
  onTile?: (tile: number, state: number) => void;
  onReady?: (h: MosaicHandle) => void;
  showFilter?: boolean;
  label?: string;
}

const STATE_LABEL: Record<number, string> = {
  [TileState.Available]: "Available",
  [TileState.Reserved]: "Being claimed",
  [TileState.Pending]: "Being claimed",
  [TileState.Published]: "Contribution",
  [TileState.Founding]: "Founding Collection",
};

export function Mosaic({ mode = "full", className = "", initial, selected = -1, onTile, onReady, showFilter = true, label }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engine = useRef<MosaicEngine | null>(null);
  const { data, error } = useMosaicData();
  const [hover, setHover] = useState<{ t: number; x: number; y: number } | null>(null);
  const [scale, setScale] = useState(initial?.scale ?? 30);
  const [filter, setFilter] = useState<Filter>("all");
  const [hint, setHint] = useState<string | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback((msg: string) => {
    setHint(msg);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(null), 1600);
  }, []);

  // engine lifecycle
  useEffect(() => {
    const cv = canvasRef.current!;
    const e = new MosaicEngine(cv);
    engine.current = e;
    let pending: Partial<Camera> | null = null; // a focus requested before the canvas had a size
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const first = e.size.w === 0;
      e.resize(width, height);
      if (first) {
        const small = width < 700;
        e.setCamera({ x: initial?.x ?? GRID / 2, y: initial?.y ?? GRID / 2, scale: initial?.scale ?? (small ? 30 : 46) });
        if (pending) e.flyTo(pending, 1400);
        pending = null;
      }
    });
    ro.observe(cv);
    let last = 0;
    e.onChange = () => {
      const now = performance.now();
      if (now - last > 80) {
        last = now;
        setScale(e.cam.scale);
      }
    };
    document.fonts?.ready.then(() => e.refresh());
    onReady?.({
      flyToTile: (t, s) => {
        const target = { x: (t % GRID) + 0.5, y: Math.floor(t / GRID) + 0.5, scale: s ?? Math.max(e.cam.scale, 60) };
        if (e.size.w === 0) pending = target;
        else e.flyTo(target);
      },
      fit: () => e.flyTo({ x: GRID / 2, y: GRID / 2, scale: e.fitScale() }, 1200),
    });
    return () => {
      ro.disconnect();
      e.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (data) engine.current?.setData(data);
  }, [data]);

  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    e.selected = selected;
    e.invalidate();
  }, [selected]);

  useEffect(() => {
    engine.current?.setFilter(filter);
  }, [filter]);

  // pointer + wheel interaction
  useEffect(() => {
    const cv = canvasRef.current!;
    const pointers = new Map<number, { x: number; y: number; type: string }>();
    let downAt: { x: number; y: number; t: number } | null = null;
    let moved = false;
    let pinch: { d: number; cx: number; cy: number } | null = null;
    let velocity = { x: 0, y: 0, t: 0 };
    let inertia = 0;

    const rel = (ev: PointerEvent | WheelEvent | MouseEvent) => {
      const r = cv.getBoundingClientRect();
      return { x: ev.clientX - r.left, y: ev.clientY - r.top };
    };

    const onDown = (ev: PointerEvent) => {
      cancelAnimationFrame(inertia);
      const p = rel(ev);
      pointers.set(ev.pointerId, { ...p, type: ev.pointerType });
      if (pointers.size === 1) {
        downAt = { ...p, t: performance.now() };
        moved = false;
      }
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
        moved = true;
      }
      if (ev.pointerType !== "touch" || mode !== "embedded" || pointers.size === 2) cv.setPointerCapture(ev.pointerId);
    };

    const onMove = (ev: PointerEvent) => {
      const e = engine.current!;
      const p = rel(ev);
      if (!pointers.has(ev.pointerId)) {
        if (ev.pointerType === "mouse") {
          const t = e.tileAt(p.x, p.y);
          e.hover = t;
          e.invalidate();
          setHover(t >= 0 ? { t, x: p.x, y: p.y } : null);
        }
        return;
      }
      const prev = pointers.get(ev.pointerId)!;
      pointers.set(ev.pointerId, { ...p, type: ev.pointerType });
      if (pointers.size === 2 && pinch) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        e.pan(cx - pinch.cx, cy - pinch.cy);
        e.zoomAt(cx, cy, d / pinch.d);
        pinch = { d, cx, cy };
        return;
      }
      if (pointers.size !== 1 || !downAt) return;
      if (ev.pointerType === "touch" && mode === "embedded") {
        if (Math.hypot(p.x - downAt.x, p.y - downAt.y) > 8) {
          moved = true;
          flash("Use two fingers to explore the mosaic");
        }
        return;
      }
      if (!moved && Math.hypot(p.x - downAt.x, p.y - downAt.y) > 4) moved = true;
      if (moved) {
        const dx = p.x - prev.x, dy = p.y - prev.y;
        e.pan(dx, dy);
        const now = performance.now();
        const dt = Math.max(1, now - velocity.t);
        velocity = { x: dx / dt, y: dy / dt, t: now };
        cv.style.cursor = "grabbing";
        setHover(null);
      }
    };

    const onUp = (ev: PointerEvent) => {
      const e = engine.current!;
      const p = rel(ev);
      const wasSingle = pointers.size === 1;
      pointers.delete(ev.pointerId);
      if (pointers.size < 2) pinch = null;
      cv.style.cursor = "";
      if (wasSingle && downAt && !moved && ev.type === "pointerup") {
        const t = e.tileAt(p.x, p.y);
        if (t >= 0) onTile?.(t, e.stateOf(t));
      } else if (wasSingle && moved && performance.now() - velocity.t < 60 && !(ev.pointerType === "touch" && mode === "embedded")) {
        // gentle inertia
        let vx = velocity.x * 16, vy = velocity.y * 16;
        const step = () => {
          vx *= 0.92;
          vy *= 0.92;
          if (Math.abs(vx) + Math.abs(vy) < 0.3) return;
          e.pan(vx, vy);
          inertia = requestAnimationFrame(step);
        };
        inertia = requestAnimationFrame(step);
      }
      if (pointers.size === 0) downAt = null;
    };

    const onLeave = () => {
      const e = engine.current!;
      e.hover = -1;
      e.invalidate();
      setHover(null);
    };

    const onWheel = (ev: WheelEvent) => {
      const e = engine.current!;
      if (mode === "embedded" && !ev.ctrlKey && !ev.metaKey) {
        flash(navigator.platform?.toLowerCase().includes("mac") ? "Hold ⌘ and scroll to zoom" : "Hold Ctrl and scroll to zoom");
        return;
      }
      ev.preventDefault();
      const p = rel(ev);
      const dy = ev.deltaMode === 1 ? ev.deltaY * 16 : ev.deltaY;
      e.zoomAt(p.x, p.y, Math.exp(-dy * (ev.ctrlKey ? 0.01 : 0.0018)));
    };

    const onDbl = (ev: MouseEvent) => {
      const p = rel(ev);
      engine.current!.zoomAt(p.x, p.y, 2.2);
    };

    cv.addEventListener("pointerdown", onDown);
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerup", onUp);
    cv.addEventListener("pointercancel", onUp);
    cv.addEventListener("pointerleave", onLeave);
    cv.addEventListener("wheel", onWheel, { passive: false });
    cv.addEventListener("dblclick", onDbl);
    return () => {
      cancelAnimationFrame(inertia);
      cv.removeEventListener("pointerdown", onDown);
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerup", onUp);
      cv.removeEventListener("pointercancel", onUp);
      cv.removeEventListener("pointerleave", onLeave);
      cv.removeEventListener("wheel", onWheel);
      cv.removeEventListener("dblclick", onDbl);
    };
  }, [mode, onTile, flash]);

  const onKey = (ev: React.KeyboardEvent) => {
    const e = engine.current!;
    const { w, h } = e.size;
    const step = 80;
    const map: Record<string, () => void> = {
      ArrowLeft: () => e.pan(step, 0),
      ArrowRight: () => e.pan(-step, 0),
      ArrowUp: () => e.pan(0, step),
      ArrowDown: () => e.pan(0, -step),
      "+": () => e.zoomAt(w / 2, h / 2, 1.5),
      "=": () => e.zoomAt(w / 2, h / 2, 1.5),
      "-": () => e.zoomAt(w / 2, h / 2, 1 / 1.5),
      Enter: () => {
        const t = e.tileAt(w / 2, h / 2);
        if (t >= 0) onTile?.(t, e.stateOf(t));
      },
    };
    if (map[ev.key]) {
      ev.preventDefault();
      map[ev.key]();
    }
  };

  const zoomBy = (f: number) => {
    const e = engine.current!;
    e.flyTo({ scale: e.cam.scale * f }, 350);
  };
  const fit = () => engine.current?.flyTo({ x: GRID / 2, y: GRID / 2, scale: engine.current.fitScale() }, 1200);
  const isFit = engine.current ? scale <= engine.current.fitScale() * 1.05 : false;

  const hoverState = hover && engine.current ? engine.current.stateOf(hover.t) : 0;

  return (
    <div ref={wrap} className={`relative overflow-hidden bg-paper select-none ${className}`}>
      <canvas
        ref={canvasRef}
        tabIndex={0}
        role="application"
        aria-roledescription="mosaic"
        aria-label={label ?? "The PIECE OF US mosaic: one million squares. Use arrow keys to move, plus and minus to zoom, Enter to open the square in the centre."}
        onKeyDown={onKey}
        className="block h-full w-full cursor-grab outline-none"
        style={{ touchAction: mode === "embedded" ? "pan-y" : "none" }}
      />

      {!data && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="label pulse">{error ? "The mosaic couldn’t load. Please refresh." : "Assembling the mosaic…"}</span>
        </div>
      )}

      {/* hover tooltip (desktop) */}
      {hover && scale >= 3 && (
        <div
          className="pointer-events-none absolute z-10 rounded-[4px] bg-ink px-2.5 py-1.5 text-[0.75rem] text-paper shadow-lg"
          style={{ left: Math.min(hover.x + 14, (wrap.current?.clientWidth ?? 0) - 200), top: hover.y + 16 }}
        >
          <span className="font-mono tabular">No. {formatPieceNumber(pieceNumber(hover.t))}</span>
          <span className="ml-2 opacity-70">{STATE_LABEL[hoverState]}</span>
        </div>
      )}

      {hint && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-20 flex -translate-y-1/2 justify-center">
          <span className="rounded-[4px] bg-ink/85 px-4 py-2 text-sm text-paper backdrop-blur">{hint}</span>
        </div>
      )}

      {/* controls */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col overflow-hidden rounded-[6px] bg-paper/95 shadow-[0_0_0_1px_var(--color-line),0_8px_24px_-12px_rgba(0,0,0,.25)] backdrop-blur md:bottom-6 md:right-6">
        <button className="flex h-11 w-11 items-center justify-center text-xl hover:bg-paper-2" onClick={() => zoomBy(1.8)} aria-label="Zoom in">+</button>
        <button className="flex h-11 w-11 items-center justify-center border-t border-line text-xl hover:bg-paper-2" onClick={() => zoomBy(1 / 1.8)} aria-label="Zoom out">−</button>
        <button
          className="flex h-11 w-11 items-center justify-center border-t border-line hover:bg-paper-2"
          onClick={() => (isFit ? engine.current?.flyTo({ x: GRID / 2, y: GRID / 2, scale: 46 }, 1200) : fit())}
          aria-label={isFit ? "Zoom into the centre" : "See the whole canvas"}
          title={isFit ? "Zoom into the centre" : "See all 1,000,000 squares"}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
            {isFit ? <path d="M6 1v5H1M10 1v5h5M6 15v-5H1M10 15v-5h5" /> : <path d="M1 6V1h5M15 6V1h-5M1 10v5h5M15 10v5h-5" />}
          </svg>
        </button>
      </div>

      {showFilter && (
        <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-1 rounded-[6px] bg-paper/95 p-1 text-[0.8rem] shadow-[0_0_0_1px_var(--color-line)] backdrop-blur md:left-6 md:top-6">
          {(
            [
              ["all", "All pieces"],
              ["founding", "Founding Collection"],
              ["contributions", "Contributions"],
            ] as [Filter, string][]
          ).map(([f, l]) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={`rounded-[4px] px-3 py-1.5 transition-colors ${filter === f ? "bg-ink text-paper" : "text-ink-2 hover:bg-paper-2"}`}
            >
              {l}
            </button>
          ))}
        </div>
      )}

      <div className="pointer-events-none absolute bottom-4 left-4 z-10 hidden items-center gap-4 text-[0.72rem] text-muted md:bottom-6 md:left-6 md:flex">
        <Legend swatch="bg-empty" label="Available" />
        <Legend swatch="bg-[repeating-linear-gradient(135deg,#dcd5ca_0_3px,#c9c1b4_3px_4px)]" label="Being claimed" />
        <Legend swatch="bg-[linear-gradient(135deg,#1f2a5a_0_50%,#e9b949_50%)]" label="Taken" />
        <span className="label ml-2 tabular">{scale < 1 ? "1,000,000 squares" : `${Math.round(scale)} px / square`}</span>
      </div>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-3 w-3 ${swatch}`} />
      {label}
    </span>
  );
}
