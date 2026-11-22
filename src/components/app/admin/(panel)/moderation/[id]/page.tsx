import Link from "next/link";
import { notFound } from "next/navigation";
import { can, requireAdminPage } from "@/lib/admin-auth";
import { getRepo } from "@/lib/repo";
import { CatChip, StatusBadge, fmtDate } from "@/components/admin/ui";
import { SubmissionActions } from "@/components/admin/SubmissionActions";
import { THRESHOLDS } from "@/lib/moderation/policy";
import type { Category, Signal } from "@/lib/moderation/types";

export default async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireAdminPage();
  const repo = getRepo();
  const sub = await repo.getSubmission((await params).id);
  if (!sub) notFound();
  const [img, events] = await Promise.all([sub.imagePath === "deleted" ? null : repo.privateUrl(sub.imagePath), repo.events(sub.id, 200)]);
  const d = sub.moderationDetail as { signals?: Signal[]; summaries?: Record<string, string>; protectedExpression?: string[]; errors?: string[]; reasons?: string[]; aiAvailable?: boolean };
  const scores = Object.entries(sub.moderationScores).sort((a, b) => b[1] - a[1]) as [Category, number][];

  return (
    <div>
      <Link href="/admin/moderation" className="text-[0.88rem] text-muted hover:text-ink">← Moderation</Link>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-[2rem] font-bold tracking-[-0.03em]">{sub.title || "Untitled"}</h1>
        <StatusBadge s={sub.status} />
      </div>
      <p className="mt-1 font-mono text-[0.85rem] text-muted">Square No. {(sub.tile + 1).toLocaleString("en-US")} · {sub.id}</p>

      <div className="mt-8 grid gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div>
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt="Submitted artwork" className="w-full max-w-[640px] bg-paper-2" />
          ) : <div className="flex aspect-square max-w-[640px] items-center justify-center bg-paper-2 text-muted">Image deleted (retention)</div>}

          <section className="mt-8">
            <h2 className="label">Contributor</h2>
            <dl className="mt-2 grid grid-cols-[9rem_1fr] gap-y-1.5 text-[0.92rem]">
              <dt className="text-muted">Display name</dt><dd>{sub.displayName || "—"}</dd>
              <dt className="text-muted">Country</dt><dd>{sub.country || "—"}</dd>
              <dt className="text-muted">Description</dt><dd>{sub.description || "—"}</dd>
              <dt className="text-muted">E-mail (private)</dt><dd>{sub.email || "—"}</dd>
              <dt className="text-muted">Public contact</dt><dd>{[sub.contactInstagram && `@${sub.contactInstagram}`, sub.contactEmail, sub.contactPhone].filter(Boolean).join(" · ") || "—"}</dd>
              <dt className="text-muted">IP hash</dt><dd className="font-mono text-[0.78rem]">{sub.ipHash?.slice(0, 16) || "—"}</dd>
              <dt className="text-muted">Submitted</dt><dd>{fmtDate(sub.createdAt)}</dd>
              <dt className="text-muted">Held until</dt><dd>{fmtDate(sub.holdUntil)}</dd>
            </dl>
          </section>

          <section className="mt-8">
            <h2 className="label">Payment</h2>
            <dl className="mt-2 grid grid-cols-[9rem_1fr] gap-y-1.5 text-[0.92rem]">
              <dt className="text-muted">Status</dt><dd>{sub.refundedAt ? "Refunded" : sub.paidAt ? "Paid" : "Not paid"}</dd>
              <dt className="text-muted">Provider</dt><dd>{sub.paymentProvider || "—"}</dd>
              <dt className="text-muted">Order / capture</dt><dd className="break-all font-mono text-[0.78rem]">{sub.paymentOrderId || "—"} / {sub.paymentCaptureId || "—"}</dd>
              <dt className="text-muted">Amount</dt><dd>{sub.amountCents !== null ? `${(sub.amountCents / 100).toFixed(2)} ${sub.currency}` : "—"}</dd>
              <dt className="text-muted">Paid / published</dt><dd>{fmtDate(sub.paidAt)} / {fmtDate(sub.publishedAt)}</dd>
              <dt className="text-muted">Refund</dt><dd className="font-mono text-[0.78rem]">{sub.refundId || "—"} {sub.refundedAt && `(${fmtDate(sub.refundedAt)})`}</dd>
            </dl>
          </section>
        </div>

        <div className="space-y-10">
          <section className="rounded-[6px] bg-paper-2 p-6">
            <h2 className="label">Decision</h2>
            <div className="mt-4">
              <SubmissionActions id={sub.id} status={sub.status} paid={!!sub.paidAt} refunded={!!sub.refundedAt} canRefund={can(s, "refund")} />
            </div>
          </section>

          {sub.appealMessage !== null && (
            <section>
              <h2 className="label">Appeal from contributor</h2>
              <p className="mt-2 rounded-[6px] border border-line p-4 text-[0.95rem]">{sub.appealMessage || <span className="text-muted">(no message)</span>}</p>
              <p className="mt-1 text-[0.8rem] text-muted">{fmtDate(sub.appealedAt)}</p>
            </section>
          )}

          <section>
            <h2 className="label">Automated moderation</h2>
            <p className="mt-2 text-[0.92rem]">
              Decision: <strong>{sub.moderationDecision ?? "—"}</strong> · provider <span className="font-mono text-[0.82rem]">{sub.moderationProvider}</span> · {fmtDate(sub.moderatedAt)}
              {d.aiAvailable === false && <span className="ml-2 rounded-[4px] bg-[#fbe9d6] px-1.5 py-0.5 text-[0.75rem] text-[#6b3a0b]">AI unavailable</span>}
            </p>
            {sub.moderationCategories.length > 0 && <div className="mt-3 flex flex-wrap gap-1">{sub.moderationCategories.map((c) => <CatChip key={c} c={c} />)}</div>}
            {d.reasons && d.reasons.length > 0 && <ul className="mt-3 list-disc pl-5 text-[0.85rem] text-ink-2">{d.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}

            {scores.length > 0 && (
              <div className="mt-5 space-y-1.5">
                {scores.map(([c, v]) => {
                  const t = THRESHOLDS[c];
                  return (
                    <div key={c} className="grid grid-cols-[11rem_1fr_3rem] items-center gap-3 text-[0.82rem]">
                      <span className="truncate">{c.replace(/_/g, " ")}</span>
                      <span className="relative h-2 bg-paper-2">
                        <span className={`absolute inset-y-0 left-0 ${v >= (t?.reject ?? 1) ? "bg-accent" : v >= (t?.review ?? 1) ? "bg-[#d98a1c]" : "bg-ink/40"}`} style={{ width: `${v * 100}%` }} />
                        {t && <span className="absolute inset-y-[-3px] w-px bg-ink/50" style={{ left: `${Math.min(100, t.review * 100)}%` }} title="review threshold" />}
                        {t && t.reject <= 1 && <span className="absolute inset-y-[-3px] w-px bg-accent" style={{ left: `${t.reject * 100}%` }} title="reject threshold" />}
                      </span>
                      <span className="text-right font-mono">{v.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {d.summaries && Object.keys(d.summaries).length > 0 && (
              <div className="mt-5 text-[0.9rem]">{Object.entries(d.summaries).map(([p, t]) => <p key={p}><span className="label mr-2">{p}</span>{t}</p>)}</div>
            )}
            {sub.extractedText && (
              <div className="mt-4"><p className="label">Text found in image</p><p className="mt-1 whitespace-pre-wrap rounded-[4px] bg-paper-2 p-3 font-mono text-[0.82rem]">{sub.extractedText}</p></div>
            )}
            {d.protectedExpression && d.protectedExpression.length > 0 && (
              <p className="mt-4 text-[0.85rem]"><span className="label mr-2">Protected expression</span>{d.protectedExpression.join(" · ")}</p>
            )}
            {d.signals && d.signals.length > 0 && (
              <details className="mt-4 text-[0.82rem]">
                <summary className="cursor-pointer text-muted">All signals ({d.signals.length})</summary>
                <ul className="mt-2 space-y-1">{d.signals.map((g, i) => <li key={i}><span className="font-mono">{g.source}</span> · {g.category} · {g.confidence.toFixed(2)} {g.evidence && <span className="text-muted">— {g.evidence}</span>}</li>)}</ul>
              </details>
            )}
            {d.errors && d.errors.length > 0 && <p className="mt-3 text-[0.82rem] text-accent">Provider errors: {d.errors.join("; ")}</p>}
          </section>

          <section>
            <h2 className="label">History</h2>
            <ol className="mt-3 space-y-3 border-l border-line pl-4 text-[0.88rem]">
              {events.map((e) => (
                <li key={e.id}>
                  <p><span className="font-medium">{e.action.replace(/_/g, " ")}</span> {e.toStatus && e.fromStatus !== e.toStatus && <span className="text-muted">{e.fromStatus ?? "—"} → {e.toStatus}</span>}</p>
                  <p className="text-[0.78rem] text-muted">{e.actor} · {fmtDate(e.createdAt)}</p>
                  {e.note && <p className="mt-1 rounded-[4px] bg-paper-2 px-2 py-1">{e.note}</p>}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
