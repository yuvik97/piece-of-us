/** Provider-agnostic payment interface. Swap providers via PAYMENT_PROVIDER. */
export interface CheckoutSession {
  orderId: string;      // provider's order/session id (stored on the submission)
  redirectUrl: string;  // where to send the contributor
}

export interface VerifiedPayment {
  orderId: string;
  captureId: string;
  amountCents: number;
  currency: string;
}

export interface WebhookEvent {
  id: string;
  type: "payment.completed" | "payment.refunded" | "ignored";
  payment?: VerifiedPayment;
  raw: unknown;
}

export interface PaymentProvider {
  name: string;
  testMode: boolean;
  createCheckout(input: {
    submissionId: string;
    idempotencyKey: string;
    amountCents: number;
    currency: string;
    description: string;
    returnUrl: string;
    cancelUrl: string;
  }): Promise<CheckoutSession>;
  /** Called on the return URL. Must verify server-side with the provider, never trust the query string. */
  completeReturn(params: URLSearchParams): Promise<VerifiedPayment | null>;
  /** Verify signature and normalise. Throws on invalid signature. */
  parseWebhook(headers: Headers, body: string): Promise<WebhookEvent>;
  refund(captureId: string, idempotencyKey: string): Promise<{ refundId: string }>;
}
