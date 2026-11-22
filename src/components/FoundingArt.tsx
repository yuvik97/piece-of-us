"use client";
import { useEffect, useRef } from "react";
import { drawFounding } from "@/lib/founding/render";

/** Renders a Founding Collection piece crisply at any size. */
export function FoundingArt({ kind, seed, palette, className, label }: { kind: number; seed: number; palette: number; className?: string; label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const paint = () => {
      const size = Math.min(1600, Math.round((cv.clientWidth || 600) * Math.min(window.devicePixelRatio || 1, 2)));
      cv.width = cv.height = size;
      drawFounding(cv.getContext("2d")!, { kind, seed, palette }, 0, 0, size, size >= 300);
    };
    paint();
    document.fonts?.ready.then(paint);
    const ro = new ResizeObserver(paint);
    ro.observe(cv);
    return () => ro.disconnect();
  }, [kind, seed, palette]);
  return <canvas ref={ref} className={className} role="img" aria-label={label} style={{ aspectRatio: "1 / 1", width: "100%", display: "block" }} />;
}
