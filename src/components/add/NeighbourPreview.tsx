"use client";

import { useEffect, useRef } from "react";
import { GRID, TileState } from "@/lib/grid";
import { drawFounding } from "@/lib/founding/render";
import { foundingFromExtra, loadMosaic } from "../mosaic/data";

/** Shows the cropped artwork in its real square, surrounded by its real neighbours. */
export function NeighbourPreview({ tile, source, version }: { tile: number; source: () => HTMLCanvasElement | null; version: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let alive = true;
    loadMosaic().then((d) => {
      const cv = ref.current;
      if (!cv || !alive) return;
      const n = 5, cell = 64, gap = 4;
      cv.width = cv.height = n * cell;
      const c = cv.getContext("2d")!;
      c.fillStyle = "#f6f3ee";
      c.fillRect(0, 0, cv.width, cv.height);
      const tx = tile % GRID, ty = Math.floor(tile / GRID);
      for (let j = 0; j < n; j++)
        for (let i = 0; i < n; i++) {
          const x = tx + i - 2, y = ty + j - 2;
          const px = i * cell + gap / 2, py = j * cell + gap / 2, s = cell - gap;
          if (x < 0 || y < 0 || x >= GRID || y >= GRID) continue;
          const t = y * GRID + x;
          if (t === tile) {
            const src = source();
            if (src) c.drawImage(src, px, py, s, s);
            continue;
          }
          const st = d.state[t];
          if (st === TileState.Founding) drawFounding(c, foundingFromExtra(d.extra[t]), px, py, s);
          else if (st === TileState.Published) {
            c.fillStyle = "#" + d.color[t].toString(16).padStart(6, "0");
            c.fillRect(px, py, s, s);
          } else {
            c.fillStyle = st === TileState.Available ? "#e9e4dc" : "#dcd5ca";
            c.fillRect(px, py, s, s);
          }
        }
      c.strokeStyle = "#d9441c";
      c.lineWidth = 2;
      c.strokeRect(2 * cell + 1, 2 * cell + 1, cell - 2, cell - 2);
    });
    return () => {
      alive = false;
    };
  }, [tile, source, version]);
  return <canvas ref={ref} className="block aspect-square w-full" aria-label="Your piece among its neighbours" role="img" />;
}
