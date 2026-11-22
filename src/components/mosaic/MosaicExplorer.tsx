"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { TileState, formatPieceNumber, pieceNumber } from "@/lib/grid";
import { ArtworkOverlay } from "../ArtworkOverlay";
import { Mosaic, type MosaicHandle } from "./Mosaic";
import { loadMosaic } from "./data";

interface Props {
  mode?: "embedded" | "full";
  className?: string;
  focusTile?: number;
  onHandle?: (h: MosaicHandle) => void;
}

/** The mosaic plus what happens when you touch a square. */
export function MosaicExplorer({ mode = "full", className = "", focusTile, onHandle }: Props) {
  const [sel, setSel] = useState<{ tile: number; state: number } | null>(null);
  const [overlay, setOverlay] = useState<number | null>(null);
  const [handle, setHandle] = useState<MosaicHandle | null>(null);

  const onTile = useCallback((tile: number, state: number) => {
    if (state === TileState.Founding || state === TileState.Published) {
      setSel({ tile, state });
      setOverlay(pieceNumber(tile));
    } else setSel({ tile, state });
  }, []);

  useEffect(() => {
    if (handle && focusTile !== undefined && focusTile >= 0) {
      handle.flyToTile(focusTile, 90);
      setSel({ tile: focusTile, state: -1 });
      loadMosaic().then((d) => setSel((s) => (s?.tile === focusTile ? { tile: focusTile, state: d.state[focusTile] } : s)));
    }
  }, [handle, focusTile]);

  const ready = useCallback((h: MosaicHandle) => {
    setHandle(h);
    onHandle?.(h);
  }, [onHandle]);

  const closeOverlay = useCallback(() => setOverlay(null), []);

  return (
    <div className={`relative ${className}`}>
      <Mosaic mode={mode} className="h-full w-full" selected={sel?.tile ?? -1} onTile={onTile} onReady={ready} />

      {sel && (sel.state === TileState.Available || sel.state === TileState.Reserved || sel.state === TileState.Pending) && (
        <div className="absolute inset-x-3 bottom-3 z-20 md:inset-x-auto md:bottom-6 md:left-1/2 md:w-[440px] md:-translate-x-1/2">
          <div className="flex items-center gap-4 rounded-[6px] bg-paper p-4 shadow-[0_0_0_1px_var(--color-line),0_20px_40px_-20px_rgba(0,0,0,.35)] md:p-5">
            <div className="min-w-0 flex-1">
              <p className="label">Square No. {formatPieceNumber(pieceNumber(sel.tile))}</p>
              {sel.state === TileState.Available ? (
                <p className="mt-1 text-[1.05rem] font-medium">This square is waiting for you.</p>
              ) : (
                <p className="mt-1 text-[0.95rem] text-ink-2">Someone is making this square theirs right now.</p>
              )}
            </div>
            {sel.state === TileState.Available && (
              <Link href={`/add?tile=${sel.tile}`} className="btn btn-primary btn-sm shrink-0">
                Make it yours — $8
              </Link>
            )}
            <button onClick={() => setSel(null)} className="-mr-1 h-8 w-8 shrink-0 text-xl text-muted hover:text-ink" aria-label="Dismiss">×</button>
          </div>
        </div>
      )}

      {overlay !== null && <ArtworkOverlay number={overlay} onClose={closeOverlay} />}
    </div>
  );
}
