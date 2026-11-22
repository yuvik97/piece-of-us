import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-auth";
import { getRepo } from "@/lib/repo";
import { fmtDate } from "@/components/admin/ui";

export default async function Activity() {
  await requireAdminPage();
  const events = await getRepo().events(undefined, 300);
  return (
    <div>
      <h1 className="text-[2.2rem] font-bold tracking-[-0.03em]">Activity log</h1>
      <p className="mt-2 text-[0.92rem] text-muted">Every automated and human moderation action, report decision, refund, export and sign-in. Append-only.</p>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-[0.86rem]">
          <thead className="label border-b border-line"><tr><th className="py-2 font-normal">When</th><th className="font-normal">Who</th><th className="font-normal">Action</th><th className="font-normal">Status</th><th className="font-normal">Piece</th><th className="font-normal">Note</th></tr></thead>
          <tbody className="divide-y divide-line">
            {events.map((e) => (
              <tr key={e.id}>
                <td className="py-2 pr-3 font-mono text-[0.75rem] text-muted">{fmtDate(e.createdAt)}</td>
                <td className="pr-3">{e.actor}</td>
                <td className="pr-3">{e.action.replace(/_/g, " ")}</td>
                <td className="pr-3 text-muted">{e.fromStatus || e.toStatus ? `${e.fromStatus ?? "—"} → ${e.toStatus ?? "—"}` : ""}</td>
                <td className="pr-3">{e.submissionId ? <Link className="link" href={`/admin/moderation/${e.submissionId}`}>No. {((e.tile ?? 0) + 1).toLocaleString("en-US")}</Link> : e.tile !== null ? `No. ${(e.tile + 1).toLocaleString("en-US")}` : ""}</td>
                <td className="max-w-[280px] truncate text-ink-2">{e.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
