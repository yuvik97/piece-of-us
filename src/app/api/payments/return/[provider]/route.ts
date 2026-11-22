import { NextResponse } from "next/server";
import { providerByName } from "@/lib/payments";
import { getRepo } from "@/lib/repo";
import { checkAccess, confirmPayment } from "@/lib/service";

/** The contributor lands here after paying. We verify with the provider server-side. */
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const url = new URL(req.url);
  const sid = url.searchParams.get("sid") || "";
  const t = url.searchParams.get("t");
  const back = new URL(`/status/${sid}?t=${encodeURIComponent(t || "")}`, url);
  const provider = providerByName((await params).provider);
  const s = await getRepo().getSubmission(sid);
  if (!provider || !checkAccess(s, t)) return NextResponse.redirect(new URL("/", url));
  try {
    const p = await provider.completeReturn(url.searchParams);
    if (p && p.orderId === s.paymentOrderId) await confirmPayment(provider.name, p);
  } catch (e) {
    console.error("[payment return]", e); // the webhook will still confirm it
  }
  back.searchParams.set("returned", "1");
  return NextResponse.redirect(back, 303);
}
