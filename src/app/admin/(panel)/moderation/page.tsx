import Link from "next/link";
import { can, requireAdminPage } from "@/lib/admin-auth";
import { CATEGORIES } from "@/lib/moderation/types";
import { getRepo, type SubmissionQuery } from "@/lib/repo";
import { CatChip, StatusBadge, fmtDate } from "@/components/admin/ui";

const TABS: [SubmissionQuery["status"], string][] = [
  ["needs_review", "Needs review"],
  ["awaiting_payment", "Approved"],
  ["published", "Published"],
  ["rejected", "Rejected"],
  ["removed", "Removed"],
  ["refunded", "Refunded"],
  ["expired", "Expired"],
  ["all", "All"],
];
const PAGE = 30;

export default async function Moderation({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const s = await requireAdminPage();
  const sp = await searchParams;
  const status = (TABS.find(([k]) => k === sp.status)?.[0] ?? "needs_review") as SubmissionQuery["status"];
  const page = Math.max(0, Number(sp.page) || 0);
  const q: SubmissionQuery = {
    status,
    category: CATEGORIES.includes(sp.category as never) ? sp.category : undefined,
    search: sp.q?.slice(0, 100) || undefined,
    from: /^\d{4}-\d{2}-\d{2}$/.test(sp.from || "") ? sp.from : undefined,
    to: /^\d{4}-\d{2}-\d{2}$/.test(sp.to || "") ? sp.to : undefined,
    limit: PAGE,
    offset: page * PAGE,
  };
  const repo = getRepo();
  const { rows, total } = await repo.listSubmissions(q);
  const thumbs = await Promise.all(rows.map((r) => (r.thumbPath === "deleted" ? null : repo.privateUrl(r.thumbPath))));
  const qs = (patch: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v !== undefined && v !== "") as [string, string][]);
    return `/admin/moderation?${u}`;
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-[2.2rem] font-bold tracking-[-0.03em]">Moderation</h1>
        {can(s, "export") && <a href={`/api/admin/export?status=${status === "needs_review" ? "all" : status}`} className="btn btn-ghost btn-sm">Export CSV</a>}
      </div>

      <nav className="mt-6 flex gap-1 overflow-x-auto border-b border-line" aria-label="Status">
        {TABS.map(([k, l]) => (
          <Link key={k} href={qs({ status: k, page: undefined })} className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-[0.92rem] ${status === k ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"}`}>{l}</Link>
        ))}
      </nav>

      <form className="mt-5 flex flex-wrap items-end gap-4 text-[0.88rem]" method="get">
        <input type="hidden" name="status" value={status} />
        <label className="flex flex-col gap-1"><span className="label">Search</span>
          <input name="q" defaultValue={sp.q} placeholder="No., name, title, text…" className="h-9 w-56 rounded-[4px] bg-paper-2 px-3 outline-none focus:ring-1 focus:ring-ink" /></label>
        <label className="flex flex-col gap-1"><span className="label">Violation</span>
          <select name="category" defaultValue={sp.category ?? ""} className="h-9 rounded-[4px] bg-paper-2 px-2">
            <option value="">Any</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
          </select></label>
        <label className="flex flex-col gap-1"><span className="label">From</span><input type="date" name="from" defaultValue={sp.from} className="h-9 rounded-[4px] bg-paper-2 px-2" /></label>
        <label className="flex flex-col gap-1"><span className="label">To</span><input type="date" name="to" defaultValue={sp.to} className="h-9 rounded-[4px] bg-paper-2 px-2" /></label>
        <button className="btn btn-primary btn-sm">Filter</button>
      </form>

      <p className="label mt-6">{total.toLocaleString("en-US")} submissions</p>
      <ul className="mt-2 divide-y divide-line border-y border-line">
        {rows.length === 0 && <li className="py-10 text-center text-muted">Nothing here.</li>}
        {rows.map((r, i) => {
          const top = Object.entries(r.moderationScores).sort((a, b) => b[1] - a[1])[0];
          return (
            <li key={r.id}>
              <Link href={`/admin/moderation/${r.id}`} className="grid grid-cols-[56px_1fr] items-center gap-4 py-3 hover:bg-paper-2 md:grid-cols-[56px_1.4fr_1fr_1fr_auto] md:px-2">
                {thumbs[i] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbs[i]!} alt="" className="h-14 w-14 object-cover" style={{ background: r.avgColor }} />
                ) : <div className="h-14 w-14" style={{ background: r.avgColor }} />}
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.title || "Untitled"} <span className="font-mono text-[0.8rem] text-muted">No. {(r.tile + 1).toLocaleString("en-US")}</span></p>
                  <p className="truncate text-[0.85rem] text-muted">{[r.displayName, r.country].filter(Boolean).join(" · ") || "Anonymous"}</p>
                </div>
                <div className="hidden flex-wrap gap-1 md:flex">
                  {r.moderationCategories.length ? r.moderationCategories.map((c) => <CatChip key={c} c={c} />) : <span className="text-[0.8rem] text-muted">no flags</span>}
                  {top && top[1] >= 0.2 && <span className="font-mono text-[0.7rem] text-muted">max {top[1].toFixed(2)}</span>}
                </div>
                <div className="hidden text-[0.82rem] text-muted md:block">
                  <p>{fmtDate(r.createdAt)}</p>
                  <p>{r.paidAt ? (r.refundedAt ? "Refunded" : "Paid") : "Not paid"}</p>
                </div>
                <div className="col-start-2 md:col-start-auto"><StatusBadge s={r.status} /></div>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-6 flex justify-between text-[0.9rem]">
        {page > 0 ? <Link href={qs({ page: page - 1 })} className="link">← Newer</Link> : <span />}
        {(page + 1) * PAGE < total && <Link href={qs({ page: page + 1 })} className="link">Older →</Link>}
      </div>
    </div>
  );
}
