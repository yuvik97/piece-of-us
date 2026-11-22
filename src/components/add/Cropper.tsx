"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

export interface CropperHandle {
  /** Renders the current crop to a square canvas. */
  render: (size: number) => HTMLCanvasElement | null;
}

interface Props {
  src: string;
  onChange?: () => void;
}

/** Square crop: drag to position, pinch / slider / wheel to zoom. */
export const Cropper = forwardRef<CropperHandle, Props>(function Cropper({ src, onChange }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [size, setSize] = useState(400);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 }); // offset of image centre from box centre, in box px
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<number | null>(null);

  useEffect(() => {
    const i = new Image();
    i.onload = () => {
      setImg(i);
      setZoom(1);
      setOff({ x: 0, y: 0 });
    };
    i.src = src;
  }, [src]);

  useEffect(() => {
    const el = box.current!;
    const ro = new ResizeObserver(([e]) => e.contentRect.width > 0 && setSize(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const base = img ? Math.max(size / img.naturalWidth, size / img.naturalHeight) : 1;
  const dispW = img ? img.naturalWidth * base * zoom : size;
  const dispH = img ? img.naturalHeight * base * zoom : size;

  const clampOff = useCallback(
    (o: { x: number; y: number }, z = zoom) => {
      if (!img) return o;
      const w = img.naturalWidth * base * z, h = img.naturalHeight * base * z;
      const mx = Math.max(0, (w - size) / 2), my = Math.max(0, (h - size) / 2);
      return { x: Math.min(mx, Math.max(-mx, o.x)), y: Math.min(my, Math.max(-my, o.y)) };
    },
    [img, base, size, zoom],
  );

  useEffect(() => {
    setOff((o) => clampOff(o));
  }, [zoom, size, clampOff]);

  useEffect(() => {
    onChange?.();
  }, [zoom, off, img, onChange]);

  useImperativeHandle(ref, () => ({
    render(out: number) {
      if (!img) return null;
      const cv = document.createElement("canvas");
      cv.width = cv.height = out;
      const c = cv.getContext("2d")!;
      c.imageSmoothingQuality = "high";
      const k = out / size;
      const w = dispW * k, h = dispH * k;
      c.fillStyle = "#ffffff";
      c.fillRect(0, 0, out, out);
      c.drawImage(img, out / 2 - w / 2 + off.x * k, out / 2 - h / 2 + off.y * k, w, h);
      return cv;
    },
  }));

  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };
  const onMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      setZoom((z) => Math.min(5, Math.max(1, z * (d / pinch.current!))));
      pinch.current = d;
      return;
    }
    setOff((o) => clampOff({ x: o.x + e.clientX - prev.x, y: o.y + e.clientY - prev.y }));
  };
  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  return (
    <div>
      <div
        ref={box}
        className="relative aspect-square w-full cursor-move touch-none overflow-hidden bg-paper-2"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={(e) => setZoom((z) => Math.min(5, Math.max(1, z * Math.exp(-e.deltaY * 0.0015))))}
        role="img"
        aria-label="Crop area. Drag to reposition, use the slider to zoom."
      >
        {img && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            draggable={false}
            className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
            style={{ width: dispW, height: dispH, transform: `translate(calc(-50% + ${off.x}px), calc(-50% + ${off.y}px))` }}
          />
        )}
        {/* thirds guide */}
        <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="border-[0.5px] border-white/25" />
          ))}
        </div>
        <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_1px_rgba(0,0,0,.15)]" />
      </div>
      <div className="mt-4 flex items-center gap-4">
        <span className="label w-12">Zoom</span>
        <input type="range" min={1} max={5} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="h-1 flex-1 accent-ink" aria-label="Zoom" />
        <button className="label hover:text-ink" onClick={() => { setZoom(1); setOff({ x: 0, y: 0 }); }}>Reset</button>
      </div>
    </div>
  );
});
