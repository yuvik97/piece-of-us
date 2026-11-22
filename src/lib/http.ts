import "server-only";
import { NextResponse } from "next/server";
import { config } from "./config";
import { sha256 } from "./crypto";
import { getRepo } from "./repo";

export function clientIp(req: Request) {
  const xf = req.headers.get("x-forwarded-for");
  return (xf?.split(",")[0] || req.headers.get("x-real-ip") || "0.0.0.0").trim();
}
export const ipHash = (req: Request) => sha256(`${config.ipHashSalt}:${clientIp(req)}`);

export const json = (data: unknown, init?: number | ResponseInit) =>
  NextResponse.json(data, typeof init === "number" ? { status: init } : init);
export const fail = (status: number, error: string, message?: string) => json({ error, message: message ?? error }, status);

/** Returns a 429 response if the caller exceeded the limit, otherwise null. */
export async function limit(req: Request, bucket: string, windowSec: number, max: number) {
  const ok = await getRepo().rateLimit(`${bucket}:${ipHash(req)}`, windowSec, max);
  return ok ? null : fail(429, "rate_limited", "Too many requests. Please wait a moment and try again.");
}

/** Reject cross-site POSTs for state-changing JSON endpoints. */
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(req.url).host || origin === config.siteUrl;
  } catch {
    return false;
  }
}
