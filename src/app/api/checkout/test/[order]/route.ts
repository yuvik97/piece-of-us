import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { fail } from "@/lib/http";
import { mockCapture, mockOrder } from "@/lib/payments/mock";
import { paymentProvider } from "@/lib/payments";
import { handleWebhook } from "@/lib/webhook";

/** TEST MODE ONLY: simulates the provider capturing the payment and sending its signed webhook. */
export async function POST(req: Request, { params }: { params: Promise<{ order: string }> }) {
  if (paymentProvider().name !== "mock") return fail(404, "not_found");
  const { order } = await params;
  const o = mockOrder(order);
  if (!o) return fail(404, "not_found");
  const form = await req.formData();
  const ret = String(form.get("return") || "/");
  const safeReturn = (ret.startsWith("/") && !ret.startsWith("//")) || ret.startsWith(new URL(req.url).origin + "/") || ret.startsWith(config.siteUrl + "/") ? ret : "/";
  if (form.get("action") === "pay") {
    const hook = mockCapture(order)!;
    await handleWebhook("mock", new Headers({ "x-mock-signature": hook.signature }), hook.body);
    const u = new URL(safeReturn, req.url);
    u.searchParams.set("order", order);
    return NextResponse.redirect(u, 303);
  }
  const back = new URL(safeReturn, req.url);
  return NextResponse.redirect(new URL(`/status/${back.searchParams.get("sid")}?t=${back.searchParams.get("t")}&cancelled=1`, req.url), 303);
}
