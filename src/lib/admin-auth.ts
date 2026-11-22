import "server-only";
import { randomBytes, scryptSync } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { config } from "./config";
import { hmac, safeEqual } from "./crypto";

export type Role = "admin" | "moderator";
export interface AdminSession { u: string; r: Role; exp: number }

export const PERMISSIONS = {
  moderate: ["admin", "moderator"],   // approve / reject / remove / notes / appeals / reports
  refund: ["admin"],                  // manual refunds
  money: ["admin"],                   // revenue figures
  export: ["admin"],                  // CSV export (contains personal data)
  founding: ["admin"],                // founding collection
} as const satisfies Record<string, Role[]>;
export type Permission = keyof typeof PERMISSIONS;
export const can = (s: AdminSession | null, p: Permission) => !!s && (PERMISSIONS[p] as readonly Role[]).includes(s.r);

const COOKIE = "pou_admin";
const TTL = 8 * 3600 * 1000;

export function hashPassword(pw: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(pw, salt, 32).toString("hex")}`;
}
function verifyHash(pw: string, stored: string) {
  const [alg, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  return safeEqual(scryptSync(pw, salt, 32).toString("hex"), hash);
}

function accounts(): { u: string; r: Role; h: string }[] {
  const list = config.adminAccounts
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean)
    .map((e) => {
      const [u, r, ...rest] = e.split(":");
      return { u, r: (r === "admin" ? "admin" : "moderator") as Role, h: rest.join(":") };
    });
  if (config.adminPassword) list.push({ u: "owner", r: "admin", h: "" });
  return list;
}

export function checkLogin(username: string, password: string): AdminSession | null {
  const acc = accounts().find((a) => a.u === username);
  // constant-ish work even for unknown users
  const ok = acc ? (acc.h ? verifyHash(password, acc.h) : safeEqual(password, config.adminPassword)) : (verifyHash(password, "scrypt$00$00"), false);
  if (!acc || !ok) return null;
  return { u: acc.u, r: acc.r, exp: Date.now() + TTL };
}

const sign = (payload: string) => hmac(config.adminSessionSecret, payload);

export async function setSession(s: AdminSession) {
  const payload = Buffer.from(JSON.stringify(s)).toString("base64url");
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: TTL / 1000,
  });
}
export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<AdminSession | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig || !safeEqual(sig, sign(payload))) return null;
  try {
    const s = JSON.parse(Buffer.from(payload, "base64url").toString()) as AdminSession;
    if (s.exp < Date.now()) return null;
    if (!accounts().some((a) => a.u === s.u && a.r === s.r)) return null; // revoked accounts lose access immediately
    return s;
  } catch {
    return null;
  }
}

/** For server components under /admin. */
export async function requireAdminPage(p: Permission = "moderate") {
  const s = await getSession();
  if (!s) redirect("/admin/login");
  if (!can(s, p)) redirect("/admin");
  return s;
}

/** For API routes. Returns the session or null (caller responds 401/403). */
export async function adminApi(p: Permission = "moderate") {
  const s = await getSession();
  if (!s) return { session: null, status: 401 as const };
  if (!can(s, p)) return { session: null, status: 403 as const };
  return { session: s, status: 200 as const };
}
