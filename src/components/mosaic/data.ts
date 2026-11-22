"use client";
import { useEffect, useState } from "react";
import { TOTAL_TILES } from "@/lib/grid";
import type { PublicStats } from "@/lib/repo/types";

export interface MosaicData {
  state: Uint8Array;       // TileState per tile
  color: Uint32Array;      // 0xRRGGBB per tile
  extra: Uint32Array;      // founding params / published flag
  filled: Int32Array;      // indices of non-empty tiles
  mediaBase: string;
  version: number;
}

export function parseOverview(buf: ArrayBuffer, mediaBase: string, version: number): MosaicData {
  const dv = new DataView(buf);
  const n = Math.floor(buf.byteLength / 12);
  const state = new Uint8Array(TOTAL_TILES);
  const color = new Uint32Array(TOTAL_TILES);
  const extra = new Uint32Array(TOTAL_TILES);
  const filled = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 12;
    const t = dv.getUint32(o, true);
    state[t] = dv.getUint8(o + 4);
    color[t] = (dv.getUint8(o + 5) << 16) | (dv.getUint8(o + 6) << 8) | dv.getUint8(o + 7);
    extra[t] = dv.getUint32(o + 8, true);
    filled[i] = t;
  }
  return { state, color, extra, filled, mediaBase, version };
}

/** How a published square's image URL is built (overridable, e.g. for an offline preview). */
let mediaResolver = (base: string, n: number, size: "thumb" | "full", v: number) => `${base}${n}/${size}.webp?v=${v}`;
export const mediaUrl = (base: string, n: number, size: "thumb" | "full", v: number) => mediaResolver(base, n, size, v);
export function setMediaResolver(fn: typeof mediaResolver) {
  mediaResolver = fn;
}

export const foundingFromExtra = (e: number) => ({ kind: (e >>> 24) & 0xff, seed: (e >>> 8) & 0xffff, palette: e & 0xff });

let shared: Promise<MosaicData> | null = null;
let sharedAt = 0;
let version = 0;

/** Forget the cached snapshot (after a change made in this browser). */
export function invalidateMosaic() {
  shared = null;
}

export async function loadMosaic(force = false): Promise<MosaicData> {
  if (!force && shared && Date.now() - sharedAt < 15000) return shared;
  sharedAt = Date.now();
  shared = fetch("/api/mosaic/overview", { cache: "no-store" }).then(async (r) => {
    if (!r.ok) throw new Error("overview failed");
    return parseOverview(await r.arrayBuffer(), r.headers.get("x-media-base") || "/api/media/", ++version);
  });
  return shared;
}

export function useMosaicData(pollMs = 20000) {
  const [data, setData] = useState<MosaicData | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    const tick = (force: boolean) =>
      loadMosaic(force)
        .then((d) => alive && setData(d))
        .catch(() => alive && setError(true));
    tick(false);
    const id = setInterval(() => document.visibilityState === "visible" && tick(true), pollMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [pollMs]);
  return { data, error };
}

export function useStats(pollMs = 15000) {
  const [stats, setStats] = useState<PublicStats | null>(null);
  useEffect(() => {
    let alive = true;
    const tick = () =>
      fetch("/api/mosaic/stats", { cache: "no-store" })
        .then((r) => r.json())
        .then((s) => alive && setStats(s))
        .catch(() => {});
    tick();
    const id = setInterval(() => document.visibilityState === "visible" && tick(), pollMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [pollMs]);
  return stats;
}

