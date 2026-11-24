import { config } from "@/lib/config";
import { safeEqual } from "@/lib/crypto";
import { fail, json } from "@/lib/http";
import { getRepo } from "@/lib/repo";

/** Scheduled housekeeping: expire unpaid holds and apply data retention.
 *  Call every 15 minutes with `Authorization: Bearer $CRON_SECRET` (e.g. Vercel Cron). */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!config.cronSecret || !safeEqual(auth, `Bearer ${config.cronSecret}`)) return fail(401, "unauthorized");
  const repo = getRepo();
  const expired = await repo.expireHolds();
  const paths = await repo.retention();
  for (const p of paths) if (p && p !== "deleted") await repo.removeObject("submissions", p);
  return json({ expired, deletedObjects: paths.length });
}
