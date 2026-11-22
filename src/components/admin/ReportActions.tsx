"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ReportActions({ id, canRemove }: { id: number; canRemove: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const send = async (status: "dismissed" | "actioned", removePiece = false) => {
    if (removePiece && !confirm("Remove this piece from the mosaic? Paid contributions are refunded automatically.")) return;
    setBusy(true);
    const r = await fetch(`/api/admin/reports/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status, removePiece }) });
    setBusy(false);
    if (!r.ok) setErr((await r.json().catch(() => ({}))).message || "Failed");
    else router.refresh();
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => send("dismissed")}>Dismiss</button>
      {canRemove && <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => send("actioned", true)}>Remove piece</button>}
      <button className="btn btn-sm text-muted hover:text-ink" disabled={busy} onClick={() => send("actioned")}>Mark handled</button>
      {err && <span className="text-[0.8rem] text-accent">{err}</span>}
    </div>
  );
}
