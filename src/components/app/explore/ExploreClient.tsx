"use client";

import Link from "next/link";
import { useState } from "react";
import { Counter } from "@/components/Counter";
import type { MosaicHandle } from "@/components/mosaic/Mosaic";
import { MosaicExplorer } from "@/components/mosaic/MosaicExplorer";
import { loadMosaic } from "@/components/mosaic/data";
import { TileState } from "@/lib/grid";

export function ExploreClient({ focus }: { focus?: number }) {
  const [handle, setHandle] = useState<MosaicHandle | null>(null);
  const [q, setQ] = useState("");
  const [focusTile, setFocusTile] = useState<number | undefined>(focus);

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(q.replace(/[^\d]/g, ""));
    if (n >= 1 && n <= 1_000_000) setFocusTile(n - 1);
  };
  const surprise = async () => {
    const d = await loadMosaic();
    const taken = Array.from(d.filled).filter((t) => d.state[t] === TileState.Founding || d.state[t] === TileState.Published);
    if (taken.length) setFocusTile(taken[Math.floor(Math.random() * taken.length)]);
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-paper">
      <header className="z-30 flex h-[64px] shrink-0 items-center justify-between gap-4 border-b border-line px-4 md:h-[72px] md:px-6">
        <Link href="/" className="text-[1.2rem] font-bold tracking-[-0.02em] md:text-[1.35rem]">PIECE OF US.</Link>
        <div className="hidden md:block"><Counter compact /></div>
        <div className="flex items-center gap-2 md:gap-3">
          <form onSubmit={go} className="hidden items-center sm:flex" role="search">
            <label htmlFor="goto" className="sr-only">Go to piece number</label>
            <input id="goto" value={q} onChange={(e) => setQ(e.target.value)} inputMode="numeric" placeholder="Go to No." className="h-10 w-32 rounded-[6px] bg-paper-2 px-3 font-mono text-[0.85rem] outline-none focus:ring-1 focus:ring-ink" />
          </form>
          <button onClick={surprise} className="btn btn-ghost btn-sm hidden sm:inline-flex">Show me a piece</button>
          <Link href="/add" className="btn btn-primary btn-sm">Add your piece — $8</Link>
        </div>
      </header>
      <MosaicExplorer mode="full" className="min-h-0 flex-1" focusTile={focusTile} onHandle={setHandle} />
    </div>
  );
}
