import { randomUUID } from "crypto";
import { config } from "@/lib/config";
import { sha256 } from "@/lib/crypto";
import { isValidTile } from "@/lib/grid";
import { fail, ipHash, json, limit, sameOrigin } from "@/lib/http";
import { ImageError, processUpload } from "@/lib/image";
import { moderate } from "@/lib/moderation";
import { getRepo } from "@/lib/repo";
import { accessTokenFor, notifyOnce, publicStatus } from "@/lib/service";

export const runtime = "nodejs";
export const maxDuration = 60;

const clean = (v: FormDataEntryValue | null, max: number) => {
  if (typeof v !== "string") return null;
  const s = v.normalize("NFC").replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : null;
};

/** Optional public contact details. undefined = present but invalid. */
function contactFields(form: FormData) {
  const ig = clean(form.get("contactInstagram"), 60)?.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/.*$/, "") ?? null;
  const em = clean(form.get("contactEmail"), 254);
  const ph = clean(form.get("contactPhone"), 24);
  return {
    contactInstagram: ig === null ? null : /^[A-Za-z0-9._]{1,30}$/.test(ig) ? ig : undefined,
    contactEmail: em === null ? null : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em) ? em : undefined,
    contactPhone: ph === null ? null : /^\+?[0-9 ()-]{7,24}$/.test(ph) ? ph : undefined,
  } as { contactInstagram: string | null; contactEmail: string | null; contactPhone: string | null };
}

/**
 * Upload + automatic moderation. The decision is made here, on the server,
 * before any payment can be started. Nothing the client sends can set it.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "forbidden");
  const limited = (await limit(req, "submit-burst", 60, 4)) || (await limit(req, "submit", 3600, 15));
  if (limited) return limited;

  const len = Number(req.headers.get("content-length") || 0);
  if (len > config.maxUploadBytes + 64 * 1024) return fail(413, "too_large", "Please use an image under 12 MB.");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, "invalid_form");
  }

  const tile = Number(form.get("tile"));
  const token = form.get("token");
  if (!isValidTile(tile) || typeof token !== "string") return fail(400, "invalid_tile");
  if (form.get("rightsConfirmed") !== "true") return fail(400, "confirmation_required", "Please confirm you have the right to share this artwork and that it follows the Community Guidelines.");

  const file = form.get("image");
  if (!(file instanceof Blob) || file.size === 0) return fail(400, "image_required", "Please add an image.");
  if (file.size > config.maxUploadBytes) return fail(413, "too_large", "Please use an image under 12 MB.");

  const email = clean(form.get("email"), 254);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail(400, "invalid_email", "That e-mail address doesn’t look right.");
  const meta = {
    displayName: clean(form.get("displayName"), 60),
    country: clean(form.get("country"), 60),
    title: clean(form.get("title"), 80),
    description: clean(form.get("description"), 150),
    email,
    ...contactFields(form),
  };
  if (meta.contactInstagram === undefined || meta.contactEmail === undefined || meta.contactPhone === undefined)
    return fail(400, "invalid_contact", "Please check your contact details: Instagram username, e-mail or phone number.");

  let processed;
  try {
    processed = await processUpload(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    if (e instanceof ImageError) return fail(400, "invalid_image", e.message);
    return fail(400, "invalid_image", "We couldn’t read this image.");
  }

  const moderation = await moderate({
    image: processed.full,
    displayName: meta.displayName,
    title: meta.title,
    description: meta.description,
    country: meta.country,
  });

  const repo = getRepo();
  const folder = randomUUID();
  const imagePath = `${folder}/full.webp`;
  const thumbPath = `${folder}/thumb.webp`;
  await repo.putObject("submissions", imagePath, processed.full, "image/webp");
  await repo.putObject("submissions", thumbPath, processed.thumb, "image/webp");

  const id = randomUUID();
  const sub = await repo.createSubmission({
    id,
    tile,
    reservationTokenHash: sha256(token),
    accessTokenHash: sha256(accessTokenFor(id)),
    meta: meta as typeof meta & { contactInstagram: string | null; contactEmail: string | null; contactPhone: string | null },
    imagePath,
    thumbPath,
    avgColor: processed.avgColor,
    ipHash: ipHash(req),
    moderation,
    holdMinutes: moderation.decision === "approved" ? config.paymentHoldMinutes : config.reviewHoldMinutes,
  });
  if (!sub) {
    await repo.removeObject("submissions", imagePath);
    await repo.removeObject("submissions", thumbPath);
    return fail(409, "reservation_expired", "Your hold on this square ran out. Please choose it again.");
  }
  if (sub.status === "in_review") await notifyOnce("in_review", sub);
  return json({ ...publicStatus(sub), statusToken: accessTokenFor(sub.id) }, 201);
}
