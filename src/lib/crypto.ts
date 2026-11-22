import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const randomToken = (bytes = 24) => randomBytes(bytes).toString("base64url");
export const hmac = (secret: string, data: string) => createHmac("sha256", secret).update(data).digest("hex");

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a), bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
