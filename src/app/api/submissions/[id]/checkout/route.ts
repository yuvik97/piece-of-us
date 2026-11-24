import { fail, json, limit, sameOrigin } from "@/lib/http";
import { getRepo } from "@/lib/repo";
import { checkAccess, startCheckout } from "@/lib/service";

/** Starts payment. Only possible when the server has approved the piece. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return fail(403, "forbidden");
  const limited = await limit(req, "checkout", 600, 20);
  if (limited) return limited;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const s = await getRepo().getSubmission(id);
  if (!checkAccess(s, body.t ?? null)) return fail(404, "not_found");
  if (s.status !== "awaiting_payment") return fail(409, "not_payable", "This piece can’t be paid for right now.");
  try {
    const session = await startCheckout(s);
    return json({ redirectUrl: session.redirectUrl });
  } catch (e) {
    const m = (e as Error).message;
    if (m === "hold_expired") return fail(409, "hold_expired", "Your hold on this square ran out.");
    console.error("[checkout]", e);
    return fail(502, "payment_unavailable", "Payments are unavailable for a moment. Your square is still held — please try again.");
  }
}
