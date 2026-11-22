"use client";
import { useEffect, useRef, useState } from "react";
import { TOTAL_TILES } from "@/lib/grid";
import { useStats } from "./mosaic/data";

function useTween(target: number, ms = 1400) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = performance.now(), a = from.current;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      const val = Math.round(a + (target - a) * e);
      setV(val);
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

/** Live count, shown transparently: founding pieces and paid contributions are never merged. */
export function Counter({ compact = false }: { compact?: boolean }) {
  const s = useStats();
  const added = (s?.founding ?? 0) + (s?.contributions ?? 0);
  const n = useTween(added);
  const pct = (added / TOTAL_TILES) * 100;
  if (compact)
    return (
      <span className="font-mono text-[0.8rem] tabular text-muted">
        {n.toLocaleString("en-US")} / 1,000,000
      </span>
    );
  return (
    <div aria-live="polite">
      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
        <p className="label">Pieces on the canvas — live</p>
        <p className="font-mono text-[clamp(1.6rem,3.4vw,2.6rem)] font-medium tracking-[-0.02em] tabular">
          {n.toLocaleString("en-US")}
          <span className="text-muted"> / 1,000,000</span>
        </p>
      </div>
      <div className="mt-4 h-[3px] w-full bg-empty" role="progressbar" aria-valuenow={added} aria-valuemin={0} aria-valuemax={TOTAL_TILES} aria-label="Pieces added">
        <div className="h-full bg-ink transition-[width] duration-1000" style={{ width: `${Math.max(pct, 0.15)}%` }} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-4 text-[0.85rem] sm:grid-cols-4">
        <Stat k="Founding Collection" v={s?.founding} note="created to open the canvas" />
        <Stat k="Contributions" v={s?.contributions} note="added by people, $8 each" />
        <Stat k="Being claimed" v={s?.held} note="right now" />
        <Stat k="Still waiting" v={s?.available} note="for someone" />
      </dl>
    </div>
  );
}

function Stat({ k, v, note }: { k: string; v?: number; note: string }) {
  return (
    <div>
      <dt className="label">{k}</dt>
      <dd className="mt-1 font-mono text-[1.05rem] tabular">{v === undefined ? "—" : v.toLocaleString("en-US")}</dd>
      <dd className="text-[0.78rem] text-muted">{note}</dd>
    </div>
  );
}
