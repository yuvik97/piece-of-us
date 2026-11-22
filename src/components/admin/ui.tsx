import type { SubmissionStatus } from "@/lib/repo/types";

export const STATUS_LABEL: Record<SubmissionStatus, string> = {
  awaiting_payment: "Approved · awaiting payment",
  in_review: "Needs review",
  appealed: "Appeal",
  rejected: "Rejected",
  published: "Published",
  removed: "Removed",
  refunded: "Refunded",
  expired: "Expired",
};
const TONE: Record<SubmissionStatus, string> = {
  awaiting_payment: "bg-[#e7efe9] text-ok",
  in_review: "bg-[#fbe9d6] text-[#8a4b0f]",
  appealed: "bg-[#fbe9d6] text-[#8a4b0f]",
  rejected: "bg-accent/10 text-accent",
  published: "bg-ink text-paper",
  removed: "bg-accent/10 text-accent",
  refunded: "bg-paper-2 text-muted",
  expired: "bg-paper-2 text-muted",
};
export function StatusBadge({ s }: { s: SubmissionStatus }) {
  return <span className={`inline-block whitespace-nowrap rounded-[4px] px-2 py-0.5 font-mono text-[0.7rem] uppercase tracking-wide ${TONE[s]}`}>{STATUS_LABEL[s]}</span>;
}
export function CatChip({ c }: { c: string }) {
  return <span className="inline-block rounded-[4px] border border-line px-1.5 py-0.5 font-mono text-[0.68rem] text-ink-2">{c.replace(/_/g, " ")}</span>;
}
export function Stat({ k, v, hint }: { k: string; v: string | number; hint?: string }) {
  return (
    <div className="bg-paper p-5">
      <p className="label">{k}</p>
      <p className="mt-2 font-mono text-[1.8rem] tracking-[-0.02em] tabular">{typeof v === "number" ? v.toLocaleString("en-US") : v}</p>
      {hint && <p className="mt-1 text-[0.78rem] text-muted">{hint}</p>}
    </div>
  );
}
export const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
