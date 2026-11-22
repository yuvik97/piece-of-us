import "server-only";
import { config } from "../config";
import { mockProvider } from "./mock";
import { paypalProvider } from "./paypal";
import type { PaymentProvider } from "./types";

const providers: Record<string, PaymentProvider> = { mock: mockProvider, paypal: paypalProvider };

export function paymentProvider(): PaymentProvider {
  if (process.env.NODE_ENV === "production" && config.paymentProvider === "mock" && !config.paymentTestMode)
    throw new Error("Mock payments cannot run with PAYMENT_TEST_MODE=false");
  return providers[config.paymentProvider] ?? mockProvider;
}
export function providerByName(name: string): PaymentProvider | null {
  return providers[name] ?? null;
}
export type * from "./types";
