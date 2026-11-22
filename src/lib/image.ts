import "server-only";
import sharp from "sharp";

/** Detect real file type from magic bytes — never trust the extension or the client's MIME type. */
export function sniffImage(b: Buffer): "jpeg" | "png" | "webp" | "gif" | "heif" | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (b.toString("ascii", 0, 6) === "GIF87a" || b.toString("ascii", 0, 6) === "GIF89a") return "gif";
  if (b.toString("ascii", 4, 8) === "ftyp" && /^(heic|heix|mif1|msf1|avif)/.test(b.toString("ascii", 8, 12))) return "heif";
  return null;
}

export class ImageError extends Error {}

/**
 * Decode, auto-orient, centre-crop to a square and re-encode.
 * Re-encoding drops ALL metadata (EXIF, GPS, XMP, ICC comments), which is how
 * location data is stripped. Animated images are flattened to their first frame.
 */
export async function processUpload(input: Buffer) {
  const kind = sniffImage(input);
  if (!kind) throw new ImageError("This file isn’t a supported image. Please use JPG, PNG or WebP.");
  let img = sharp(input, { limitInputPixels: 50_000_000, failOn: "error", animated: false });
  const meta = await img.metadata().catch(() => null);
  if (!meta?.width || !meta.height) throw new ImageError("We couldn’t read this image.");
  if (Math.min(meta.width, meta.height) < 200) throw new ImageError("This image is too small. Please use at least 200 × 200 pixels.");
  img = img.rotate(); // apply EXIF orientation before metadata is discarded
  const full = await img.clone().resize(1024, 1024, { fit: "cover", position: "centre" }).webp({ quality: 86 }).toBuffer();
  const thumb = await sharp(full).resize(64, 64).webp({ quality: 80 }).toBuffer();
  const avg = await sharp(full).resize(1, 1, { fit: "fill" }).raw().toBuffer();
  const avgColor = "#" + [avg[0], avg[1], avg[2]].map((v) => v.toString(16).padStart(2, "0")).join("");
  return { full, thumb, avgColor };
}
