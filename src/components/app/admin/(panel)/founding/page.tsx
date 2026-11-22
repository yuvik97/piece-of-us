import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-auth";
import { getRepo } from "@/lib/repo";
import { FoundingGrid } from "@/components/admin/FoundingGrid";

const PAGE = 48;

export default async function Founding({ searchParams }: { searchParams: Promise<{ page?: string; hidden?: string }> }) {
  await requireAdminPage("founding");
  const sp = await searchParams;
  const page = Math.max(0, Number(sp.page) || 0);
  const hidden = sp.hidden === "1" ? true : undefined;
  const { rows, total } = await getRepo().listFounding({ limit: PAGE, offset: page * PAGE, hidden });
  return (
    <div>
      <h1 className="text-[2.2rem] font-bold tracking-[-0.03em]">Founding Collection</h1>
      <p className="mt-2 max-w-2xl text-[0.92rem] text-muted">
        {total.toLocaleString("en-US")} pieces created by the studio to open the canvas. Removing one frees its square for contributors; restoring works only while the square is still free.
      </p>
      <nav className="mt-6 flex gap-4 text-[0.92rem]">
        <Link href="/admin/founding" className={!hidden ? "font-medium" : "text-muted"}>All</Link>
        <Link href="/admin/founding?hidden=1" className={hidden ? "font-medium" : "text-muted"}>Removed</Link>
      </nav>
      <div className="mt-6"><FoundingGrid rows={rows} /></div>
      <div className="mt-8 flex justify-between text-[0.9rem]">
        {page > 0 ? <Link className="link" href={`/admin/founding?page=${page - 1}${hidden ? "&hidden=1" : ""}`}>← Previous</Link> : <span />}
        <span className="label">Page {page + 1} of {Math.max(1, Math.ceil(total / PAGE))}</span>
        {(page + 1) * PAGE < total ? <Link className="link" href={`/admin/founding?page=${page + 1}${hidden ? "&hidden=1" : ""}`}>Next →</Link> : <span />}
      </div>
    </div>
  );
}
