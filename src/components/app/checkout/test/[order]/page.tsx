import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { mockOrder } from "@/lib/payments/mock";

export const metadata: Metadata = { title: "Test checkout", robots: { index: false } };
export const dynamic = "force-dynamic";

/** TEST MODE checkout page. Clearly labelled; no real payment details are collected. */
export default async function TestCheckout({ params, searchParams }: { params: Promise<{ order: string }>; searchParams: Promise<{ return?: string }> }) {
  const { order } = await params;
  const o = mockOrder(order);
  if (!o) notFound();
  const ret = (await searchParams).return ?? "/";
  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper-2 px-5">
      <div className="w-full max-w-md rounded-[6px] bg-paper p-8 shadow-[0_0_0_1px_var(--color-line),0_30px_60px_-30px_rgba(0,0,0,.3)]">
        <p className="inline-block rounded-[4px] bg-accent px-2 py-1 font-mono text-[0.7rem] uppercase tracking-wider text-white">Test mode — no real payment</p>
        <h1 className="mt-6 text-[1.8rem] font-semibold tracking-[-0.02em]">PIECE OF US</h1>
        <div className="mt-6 flex items-baseline justify-between border-y border-line py-4">
          <span>One square, one time</span>
          <span className="font-mono text-[1.4rem]">${(o.amountCents / 100).toFixed(2)}</span>
        </div>
        <p className="mt-5 text-[0.9rem] leading-relaxed text-muted">
          This is the built-in test checkout used until a live payment provider is connected. It sends a signed webhook to the server exactly like a real provider would.
        </p>
        <form method="post" action={`/api/checkout/test/${order}`} className="mt-8 flex flex-col gap-3">
          <input type="hidden" name="return" value={ret} />
          <button name="action" value="pay" className="btn btn-primary">Complete test payment</button>
          <button name="action" value="cancel" className="btn text-muted hover:text-ink">Cancel</button>
        </form>
      </div>
    </main>
  );
}
