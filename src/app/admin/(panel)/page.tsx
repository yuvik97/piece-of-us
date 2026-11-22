import Link from "next/link";
import { can, requireAdminPage } from "@/lib/admin-auth";
import { config, isDemoMode } from "@/lib/config";
import { moderationProviders, allowLocalOnly } from "@/lib/moderation";
import { getRepo } from "@/lib/repo";
import { Stat, fmtDate } from "@/components/admin/ui";

export default async function Overview() {
  const s = await requireAdminPage();
  const repo = getRepo();
  const [st, events] = await Promise.all([repo.adminStats(), repo.events(undefined, 12)]);
  const providers = moderationProviders();
  const money = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

  const warnings: string[] = [];
  if (isDemoMode()) warnings.push("Demo mode: data is kept in memory and resets when the server restarts. Configure Supabase for production.");
  if (!providers.length)
    warnings.push(allowLocalOnly()
      ? "No AI moderation provider configured. Demo mode approves on local checks only — never in production."
      : "No AI moderation provider configured: every submission goes to manual review. Set ANTHROPIC_API_KEY.");
  if (config.paymentTestMode || config.paymentProvider === "mock") warnings.push(`Payments are in TEST mode (${config.paymentProvider}). No real money is collected.`);

  return (
    <div>
      <h1 className="text-[2.2rem] font-bold tracking-[-0.03em]">Overview</h1>
      {warnings.length > 0 && (
        <ul className="mt-6 space-y-2">
          {warnings.map((w) => <li key={w} className="rounded-[6px] bg-[#fbe9d6] px-4 py-2.5 text-[0.9rem] text-[#6b3a0b]">{w}</li>)}
        </ul>
      )}
      <div className="mt-8 grid grid-cols-2 gap-px bg-line shadow-[0_0_0_1px_var(--color-line)] lg:grid-cols-4">
        {can(s, "money") && <Stat k="Total revenue" v={money(st.revenueCents)} hint={`${money(st.refundedCents)} refunded`} />}
        <Stat k="Paid contributions" v={st.paid} />
        <Stat k="Published artworks" v={st.published} hint={`+ ${st.founding.toLocaleString("en-US")} founding`} />
        <Stat k="Available squares" v={st.available} />
        <Link href="/admin/moderation?status=needs_review" className="contents"><Stat k="Pending review" v={st.inReview} hint="incl. appeals" /></Link>
        <Stat k="Awaiting payment" v={st.awaitingPayment} />
        <Stat k="Rejected" v={st.rejected} />
        <Link href="/admin/reports" className="contents"><Stat k="Open reports" v={st.openReports} /></Link>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="label">Systems</h2>
          <dl className="mt-3 divide-y divide-line border-y border-line text-[0.92rem]">
            <Row k="Database" v={isDemoMode() ? "In-memory (demo)" : "Supabase"} />
            <Row k="Moderation" v={providers.length ? providers.join(" + ") + " + local checks" : "local checks only"} />
            <Row k="Payments" v={`${config.paymentProvider}${config.paymentTestMode ? " (test)" : " (live)"}`} />
            <Row k="Notifications" v={config.notify.resendKey ? "Resend" : "not configured (dry run)"} />
          </dl>
        </section>
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="label">Recent activity</h2>
            <Link href="/admin/activity" className="text-[0.85rem] text-muted hover:text-ink">All →</Link>
          </div>
          <ul className="mt-3 divide-y divide-line border-y border-line text-[0.88rem]">
            {events.length === 0 && <li className="py-3 text-muted">Nothing yet.</li>}
            {events.map((e) => (
              <li key={e.id} className="flex gap-3 py-2.5">
                <span className="w-32 shrink-0 font-mono text-[0.75rem] text-muted">{fmtDate(e.createdAt)}</span>
                <span className="min-w-0 truncate">
                  <span className="font-medium">{e.actor}</span> · {e.action.replace(/_/g, " ")}
                  {e.toStatus && <span className="text-muted"> → {e.toStatus}</span>}
                  {e.submissionId && <Link href={`/admin/moderation/${e.submissionId}`} className="ml-1 text-muted underline">open</Link>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}
