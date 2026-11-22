"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FoundingArt } from "../FoundingArt";
import { foundingMeta } from "@/lib/founding/layout";
import type { FoundingRow } from "@/lib/repo/types";

export function FoundingGrid({ rows }: { rows: FoundingRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const toggle = async (r: FoundingRow) => {
    setBusy(r.tile);
    const res = await fetch(`/api/admin/founding/${r.tile}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ hidden: !r.hidden }) });
    setBusy(null);
    if (!res.ok) alert((await res.json().catch(() => ({}))).error || "Failed");
    router.refresh();
  };
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
      {rows.map((r) => (
        <li key={r.tile} className={r.hidden ? "opacity-40" : ""}>
          <FoundingArt kind={r.kind} seed={r.seed} palette={r.palette} />
          <p className="mt-1.5 truncate text-[0.82rem]">{foundingMeta(r).title}</p>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[0.72rem] text-muted">No. {(r.tile + 1).toLocaleString("en-US")}</span>
            <button className="text-[0.78rem] text-muted underline-offset-2 hover:text-ink hover:underline" disabled={busy === r.tile} onClick={() => toggle(r)}>
              {r.hidden ? "Restore" : "Remove"}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
