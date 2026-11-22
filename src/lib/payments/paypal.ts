/* PayPal Orders v2. Available to Israeli businesses; buyers can pay by card
 * without a PayPal account (guest checkout). Apply for PayPal's micropayment
 * rate before going live — at $8 the fixed fee dominates. */

import { config } from "../config";
import type { PaymentProvider, VerifiedPayment } from "./types";

const base = () => (config.paypal.env === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com");

let tokenCache: { token: string; exp: number } | null = null;
async function token() {
  if (tokenCache && tokenCache.exp > Date.now() + 60_000) return tokenCache.token;
  const res = await fetch(`${base()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: "Basic " + Buffer.from(`${config.paypal.clientId}:${config.paypal.clientSecret}`).toString("base64"),
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`paypal auth ${res.status}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}

async function pp<T>(path: string, init: RequestInit & { requestId?: string } = {}): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${await token()}`,
      "content-type": "application/json",
      ...(init.requestId ? { "PayPal-Request-Id": init.requestId } : {}),
      prefer: "return=representation",
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`paypal ${path} ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text) as T;
}

interface Capture { id: string; status: string; amount: { value: string; currency_code: string } }
interface Order { id: string; status: string; purchase_units: { payments?: { captures?: Capture[] } }[]; links: { rel: string; href: string }[] }

const toCents = (v: string) => Math.round(parseFloat(v) * 100);

function capturedPayment(o: Order): VerifiedPayment | null {
  const cap = o.purchase_units?.[0]?.payments?.captures?.find((c) => c.status === "COMPLETED");
  if (!cap) return null;
  return { orderId: o.id, captureId: cap.id, amountCents: toCents(cap.amount.value), currency: cap.amount.currency_code };
}

export const paypalProvider: PaymentProvider = {
  name: "paypal",
  testMode: config.paypal.env !== "live",

  async createCheckout({ submissionId, idempotencyKey, amountCents, currency, description, returnUrl, cancelUrl }) {
    const order = await pp<Order>("/v2/checkout/orders", {
      method: "POST",
      requestId: idempotencyKey,
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: submissionId,
          custom_id: submissionId,
          description,
          amount: { currency_code: currency, value: (amountCents / 100).toFixed(2) },
        }],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: "PIECE OF US",
              shipping_preference: "NO_SHIPPING",
              user_action: "PAY_NOW",
              return_url: returnUrl,
              cancel_url: cancelUrl,
            },
          },
        },
      }),
    });
    const approve = order.links.find((l) => l.rel === "payer-action" || l.rel === "approve");
    if (!approve) throw new Error("paypal: no approval link");
    return { orderId: order.id, redirectUrl: approve.href };
  },

  async completeReturn(params) {
    const orderId = params.get("token");
    if (!orderId || !/^[A-Z0-9]{10,30}$/.test(orderId)) return null;
    let order = await pp<Order>(`/v2/checkout/orders/${orderId}`);
    if (order.status === "APPROVED") {
      order = await pp<Order>(`/v2/checkout/orders/${orderId}/capture`, { method: "POST", requestId: `capture-${orderId}` });
    }
    return capturedPayment(order);
  },

  async parseWebhook(headers, body) {
    const event = JSON.parse(body);
    const verify = await pp<{ verification_status: string }>("/v1/notifications/verify-webhook-signature", {
      method: "POST",
      body: JSON.stringify({
        auth_algo: headers.get("paypal-auth-algo"),
        cert_url: headers.get("paypal-cert-url"),
        transmission_id: headers.get("paypal-transmission-id"),
        transmission_sig: headers.get("paypal-transmission-sig"),
        transmission_time: headers.get("paypal-transmission-time"),
        webhook_id: config.paypal.webhookId,
        webhook_event: event,
      }),
    });
    if (verify.verification_status !== "SUCCESS") throw new Error("invalid signature");
    if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
      const cap = event.resource;
      const orderId = cap?.supplementary_data?.related_ids?.order_id;
      return {
        id: event.id,
        type: "payment.completed",
        payment: { orderId, captureId: cap.id, amountCents: toCents(cap.amount.value), currency: cap.amount.currency_code },
        raw: event,
      };
    }
    if (event.event_type === "PAYMENT.CAPTURE.REFUNDED") return { id: event.id, type: "payment.refunded", raw: event };
    return { id: event.id, type: "ignored", raw: event };
  },

  async refund(captureId, idempotencyKey) {
    const r = await pp<{ id: string }>(`/v2/payments/captures/${captureId}/refund`, { method: "POST", requestId: idempotencyKey, body: "{}" });
    return { refundId: r.id };
  },
};
