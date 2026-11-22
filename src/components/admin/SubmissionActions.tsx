"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const REASONS = [
  "It appears to include content that targets or excludes people, or promotes violence.",
  "It appears to include sexual or explicit content.",
  "It appears to include graphic or distressing content.",
  "It appears to include political campaigning or propaganda.",
  "It appears to include advertising, links, QR codes or other promotion.",
  "It appears to include someone’s private information, or content that could mislead people.",
  "It appears to include artwork or imagery that may belong to someone else.",
  "It appears to include content that our guidelines don’t allow.",
];

export function SubmissionActions({ id, status, paid, refunded, canRefund }: { id: string; status: string; paid: boolean; refunded: boolean; canRefund: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState("");

  const act = async (action: string, extra: Record<string, unknown> = {}, path = `/api/admin/submissions/${id}`) => {
    if (["reject", "remove"].includes(action) && !confirm(action === "remove" ? "Remove this published piece and refund the contributor?" : "Reject this piece?")) return;
    if (action === "refund" && !confirm("Refund $8 to the contributor?")) return;
    setBusy(action);
    setMsg(null);
    const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, reason, note: note || undefined, ...extra }) });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) setMsg(j.message || j.error || "Action failed");
    else {
      setNote("");
      setMsg("Saved.");
      router.refresh();
    }
  };

  const reviewable = ["in_review", "appealed", "rejected"].includes(status);
  return (
    <div className="space-y-5">
      {reviewable && (
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary btn-sm" disabled={!!busy} onClick={() => act("approve")}>
            {status === "rejected" ? "Override: approve" : "Approve"}
          </button>
          {status !== "rejected" && <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => act("reject")}>Reject</button>}
        </div>
      )}
      {status === "awaiting_payment" && (
        <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => act("reject")}>Override: reject</button>
      )}
      {status === "published" && (
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => act("remove")}>Remove published piece</button>
          <button className="btn btn-sm text-muted hover:text-ink" disabled={!!busy} onClick={() => act("republish")}>Republish media</button>
        </div>
      )}
      {(reviewable || status === "awaiting_payment" || status === "published") && (
        <label className="block">
          <span className="label">Reason shown to the contributor (reject / remove)</span>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full rounded-[4px] bg-paper-2 p-2 text-[0.88rem]">
            {REASONS.map((r) => <option key={r}>{r}</option>)}
          </select>
        </label>
      )}
      {canRefund && paid && !refunded && (
        <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => act("refund", {}, `/api/admin/submissions/${id}/refund`)}>Refund $8</button>
      )}
      <div>
        <label className="label" htmlFor="note">Internal note</label>
        <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="field resize-none text-[0.92rem]" placeholder="Visible to the team only. Added to the history with your next action." />
        <button className="btn btn-sm mt-2 text-ink-2 hover:text-ink" disabled={!note || !!busy} onClick={() => act("note")}>Add note</button>
      </div>
      {msg && <p className="text-[0.88rem] text-muted" role="status">{msg}</p>}
    </div>
  );
}
