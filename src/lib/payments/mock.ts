/* Built-in TEST checkout. No money moves. It exercises the same code paths as a
 * real provider: hosted checkout page → signed webhook → server verification. */

import { config } from "../config";
import { hmac, randomToken, safeEqual } from "../crypto";
import type { PaymentProvider, VerifiedPayment } from "./types";

interface MockOrder { submissionId: string; amountCents: number; currency: string; captured?: string; refunded?: string }
const g = globalThis as unknown as { __pouMockOrders?: Map<string, MockOrder> };
const orders = (g.__pouMockOrders ??= new Map());

export function mockOrder(id: string) {
  return orders.get(id);
}

/** Simulates the provider capturing the payment (called from the mock checkout page). */
export function mockCapture(orderId: string): { body: string; signature: string } | null {
  const o = orders.get(orderId);
  if (!o) return null;
  o.captured ??= `cap_${randomToken(9)}`;
  const body = JSON.stringify({
    id: `evt_${randomToken(9)}`,
    type: "payment.completed",
    data: { orderId, captureId: o.captured, amountCents: o.amountCents, currency: o.currency },
  });
  return { body, signature: hmac(config.mockWebhookSecret, body) };
}

export const mockProvider: PaymentProvider = {
  name: "mock",
  testMode: true,

  async createCheckout({ submissionId, amountCents, currency, returnUrl }) {
    const orderId = `mock_${randomToken(12)}`;
    orders.set(orderId, { submissionId, amountCents, currency });
    const ret = encodeURIComponent(returnUrl);
    return { orderId, redirectUrl: `/checkout/test/${orderId}?return=${ret}` };
  },

  async completeReturn(params): Promise<VerifiedPayment | null> {
    const orderId = params.get("order") || "";
    const o = orders.get(orderId);
    if (!o?.captured) return null;
    return { orderId, captureId: o.captured, amountCents: o.amountCents, currency: o.currency };
  },

  async parseWebhook(headers, body) {
    const sig = headers.get("x-mock-signature") || "";
    if (!safeEqual(sig, hmac(config.mockWebhookSecret, body))) throw new Error("invalid signature");
    const e = JSON.parse(body);
    if (e.type !== "payment.completed") return { id: e.id, type: "ignored", raw: e };
    return { id: e.id, type: "payment.completed", payment: e.data, raw: e };
  },

  async refund(captureId) {
    for (const o of orders.values()) if (o.captured === captureId) o.refunded = `ref_${randomToken(9)}`;
    return { refundId: `ref_${randomToken(9)}` };
  },
};
