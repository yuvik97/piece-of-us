import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-auth";
import { getRepo } from "@/lib/repo";
import { fmtDate } from "@/components/admin/ui";
import { ReportActions } from "@/components/admin/ReportActions";

const LABEL: Record<string, string> = {
  hate: "Hate or discrimination", violence: "Violence or extremism", sexual: "Sexual content", political: "Political propaganda",
  copyright: "Copyright infringement", privacy: "Privacy violation", spam: "Advertising or spam", other: "Other",
};

export default async function Reports({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdminPage();
  const st = (await searchParams).status === "all" ? "all" : (await searchParams).status === "resolved" ? "all" : "open";
  const { rows, total } = await getRepo().listReports({ status: st as "open" | "all", limit: 200, offset: 0 });
  // group by piece so a coordinated wave shows as one item with a count
  const byTile = new Map<number, typeof rows>();
  for (const r of rows) byTile.set(r.tile, [...(byTile.get(r.tile) ?? []), r]);

  return (
    <div>
      <h1 className="text-[2.2rem] font-bold tracking-[-0.03em]">Reports</h1>
      <p className="mt-2 max-w-2xl text-[0.92rem] text-muted">Reports from visitors. Nothing is removed automatically, however many reports a piece receives — a person decides.</p>
      <nav className="mt-6 flex gap-4 text-[0.92rem]">
        <Link href="/admin/reports" className={st === "open" ? "font-medium" : "text-muted"}>Open</Link>
        <Link href="/admin/reports?status=all" className={st === "all" ? "font-medium" : "text-muted"}>All</Link>
        <span className="label ml-auto">{total} reports</span>
      </nav>
      <ul className="mt-4 divide-y divide-line border-y border-line">
        {byTile.size === 0 && <li className="py-10 text-center text-muted">No reports.</li>}
        {[...byTile.entries()].map(([tile, list]) => {
          const open = list.filter((r) => r.status === "open");
          const first = list[0];
          return (
            <li key={tile} className="grid gap-4 py-5 md:grid-cols-[1fr_auto]">
              <div>
                <p className="font-medium">
                  Piece No. {(tile + 1).toLocaleString("en-US")} {first.founding && <span className="label ml-1">founding</span>}
                  <span className="ml-2 rounded-[4px] bg-paper-2 px-1.5 py-0.5 font-mono text-[0.75rem]">{list.length} report{list.length > 1 ? "s" : ""}</span>
                </p>
                <div className="mt-1 flex flex-wrap gap-3 text-[0.85rem]">
                  <Link href={`/piece/${tile + 1}`} target="_blank" className="link">View piece</Link>
                  {first.submissionId && <Link href={`/admin/moderation/${first.submissionId}`} className="link">Open submission</Link>}
                </div>
                <ul className="mt-3 space-y-1.5 text-[0.88rem]">
                  {list.map((r) => (
                    <li key={r.id}>
                      <span className="font-medium">{LABEL[r.reason]}</span> <span className="text-muted">· {fmtDate(r.createdAt)} · {r.status}{r.resolvedBy ? ` by ${r.resolvedBy}` : ""}</span>
                      {r.details && <p className="text-ink-2">“{r.details}”</p>}
                      {r.status === "open" && list.length > 1 && <div className="mt-1"><ReportActions id={r.id} canRemove={false} /></div>}
                    </li>
                  ))}
                </ul>
              </div>
              {open.length > 0 && <ReportActions id={open[0].id} canRemove />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
