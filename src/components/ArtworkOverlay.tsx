"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatPieceNumber } from "@/lib/grid";
import type { PublicPiece } from "@/lib/repo/types";
import { FoundingArt } from "./FoundingArt";

export function PieceArtwork({ piece, className = "" }: { piece: PublicPiece; className?: string }) {
  if (piece.founding && piece.kind !== undefined)
    return <FoundingArt kind={piece.kind} seed={piece.seed!} palette={piece.palette!} className={className} label={piece.title ?? "Founding Collection piece"} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={piece.imageUrl!} alt={piece.title ?? "Contributed artwork"} className={`block aspect-square w-full object-cover ${className}`} style={{ background: piece.avgColor }} />
  );
}

export function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function PieceMeta({ piece, number }: { piece: PublicPiece; number: number }) {
  const rows: [string, string | null][] = piece.founding
    ? [["Piece", `No. ${formatPieceNumber(number)}`], ["Discipline", piece.discipline ?? null], ["Collection", "Founding Collection"], ["Published", formatDate(piece.publishedAt)]]
    : [
        ["Piece", `No. ${formatPieceNumber(number)}`],
        ["Artist", piece.displayName],
        ["From", piece.country],
        ["Published", formatDate(piece.publishedAt)],
      ];
  return (
    <dl className="grid grid-cols-[7rem_1fr] gap-y-2.5 text-[0.95rem]">
      {rows.filter(([, v]) => v).map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="label pt-[3px]">{k}</dt>
          <dd className="tabular">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Optional contact details the artist chose to publish (real contributions only). */
export function ArtistContact({ piece }: { piece: PublicPiece }) {
  const c = piece.contact;
  if (piece.founding || !c || (!c.instagram && !c.email && !c.phone)) return null;
  return (
    <div className="mt-7">
      <p className="label">Contact the artist</p>
      <ul className="mt-2.5 space-y-1.5 text-[0.95rem]">
        {c.instagram && (
          <li><a className="link" href={`https://www.instagram.com/${encodeURIComponent(c.instagram)}/`} target="_blank" rel="noopener noreferrer nofollow">Instagram · @{c.instagram}</a></li>
        )}
        {c.email && <li><a className="link" href={`mailto:${c.email}`}>{c.email}</a></li>}
        {c.phone && <li><a className="link" href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}>{c.phone}</a></li>}
      </ul>
    </div>
  );
}

export function ShareButton({ number, title }: { number: number; title: string }) {
  const [done, setDone] = useState(false);
  const share = async () => {
    const url = `${location.origin}/piece/${number}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${title} — PIECE OF US`, url });
        return;
      }
    } catch {
      return;
    }
    await navigator.clipboard?.writeText(url);
    setDone(true);
    setTimeout(() => setDone(false), 1800);
  };
  return (
    <button onClick={share} className="btn btn-ghost btn-sm">
      {done ? "Link copied" : "Share"}
    </button>
  );
}

const REASONS = [
  ["hate", "Hate or discrimination"],
  ["violence", "Violence or extremism"],
  ["sexual", "Sexual content"],
  ["political", "Political propaganda"],
  ["copyright", "Copyright infringement"],
  ["privacy", "Privacy violation"],
  ["spam", "Advertising or spam"],
  ["other", "Other"],
] as const;

export function ReportPiece({ number }: { number: number }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [msg, setMsg] = useState("");

  const send = async () => {
    setState("sending");
    const r = await fetch("/api/reports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pieceNumber: number, reason, details }),
    });
    if (r.ok) setState("sent");
    else {
      const j = await r.json().catch(() => ({}));
      setMsg(j.message || "Something went wrong. Please try again later.");
      setState("error");
    }
  };

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="text-[0.8rem] text-muted underline-offset-4 hover:text-ink hover:underline">
        Report this piece
      </button>
    );

  if (state === "sent")
    return <p className="text-[0.9rem] text-muted">Thank you. A person on our team will look at this piece. Reports never remove a piece automatically.</p>;

  return (
    <fieldset className="rounded-[6px] border border-line p-4">
      <legend className="label px-1">Report this piece</legend>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {REASONS.map(([v, l]) => (
          <label key={v} className="flex cursor-pointer items-center gap-2 py-1 text-[0.9rem]">
            <input type="radio" name="reason" value={v} checked={reason === v} onChange={() => setReason(v)} className="accent-ink" />
            {l}
          </label>
        ))}
      </div>
      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value.slice(0, 500))}
        placeholder="Anything we should know? (optional)"
        rows={2}
        className="field mt-3 resize-none text-[0.95rem]"
      />
      {state === "error" && <p className="mt-2 text-[0.85rem] text-accent">{msg}</p>}
      <div className="mt-4 flex gap-3">
        <button disabled={!reason || state === "sending"} onClick={send} className="btn btn-primary btn-sm">
          {state === "sending" ? "Sending…" : "Send report"}
        </button>
        <button onClick={() => setOpen(false)} className="btn btn-sm text-muted hover:text-ink">Cancel</button>
      </div>
    </fieldset>
  );
}

export function ArtworkOverlay({ number, onClose }: { number: number; onClose: () => void }) {
  const [piece, setPiece] = useState<PublicPiece | null | "missing">(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let alive = true;
    setPiece(null);
    fetch(`/api/pieces/${number}`)
      .then((r) => (r.ok ? r.json() : "missing"))
      .then((p) => alive && setPiece(p));
    return () => {
      alive = false;
    };
  }, [number]);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label={`Piece No. ${formatPieceNumber(number)}`}>
      <div className="absolute inset-0 bg-ink/45 backdrop-blur-[2px] animate-[fade_.3s_ease]" onClick={onClose} />
      <div className="relative z-10 max-h-[94dvh] w-full max-w-[1120px] overflow-y-auto bg-paper shadow-2xl md:mx-6 md:rounded-[6px]">
        <button ref={closeRef} onClick={onClose} className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-paper/90 text-2xl leading-none hover:bg-paper-2" aria-label="Close">
          ×
        </button>
        {piece === null && <div className="flex aspect-[2/1] items-center justify-center"><span className="label pulse">Loading piece…</span></div>}
        {piece === "missing" && <div className="p-10"><p className="text-lg">This piece isn’t on the mosaic.</p></div>}
        {piece && piece !== "missing" && (
          <div className="grid md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <div className="bg-paper-2 p-4 md:p-8">
              <PieceArtwork piece={piece} className="shadow-[0_20px_50px_-30px_rgba(0,0,0,.5)]" />
            </div>
            <div className="flex flex-col p-6 md:p-10">
              {piece.founding && <p className="label mb-4 text-ink-2">Founding Collection</p>}
              <h2 className="text-[2rem] font-semibold leading-[1.05] tracking-[-0.03em] md:text-[2.6rem]">{piece.title || "Untitled"}</h2>
              {piece.description && <p className="mt-4 font-serif text-[1.35rem] leading-snug text-ink-2">{piece.description}</p>}
              <div className="rule my-7" />
              <PieceMeta piece={piece} number={number} />
              <ArtistContact piece={piece} />
              {piece.founding && (
                <p className="mt-6 text-[0.85rem] leading-relaxed text-muted">
                  The Founding Collection was created by the PIECE OF US studio to open the canvas. These pieces were not purchased, and they are not credited to any contributor.
                </p>
              )}
              <div className="mt-auto flex flex-wrap items-center gap-3 pt-8">
                <ShareButton number={number} title={piece.title || "A piece"} />
                <Link href={`/piece/${number}`} className="btn btn-sm text-ink-2 hover:text-ink">Permanent page →</Link>
              </div>
              <div className="mt-6">
                <ReportPiece number={number} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
