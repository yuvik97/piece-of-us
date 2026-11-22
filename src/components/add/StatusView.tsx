"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatPieceNumber } from "@/lib/grid";
import { download, makeCard } from "@/lib/card";

interface Status {
  id: string;
  tile: number;
  pieceNumber: number;
  status: "awaiting_payment" | "in_review" | "appealed" | "rejected" | "published" | "removed" | "refunded" | "expired";
  title: string | null;
  displayName: string | null;
  country: string | null;
  description: string | null;
  avgColor: string;
  holdUntil: string | null;
  publicReason: string | null;
  appealable: boolean;
  appealed: boolean;
  paid: boolean;
  refunded: boolean;
  publishedAt: string | null;
}

const H = ({ children }: { children: React.ReactNode }) => (
  <h1 className="text-[clamp(2rem,4vw,3.4rem)] font-bold leading-[1.02] tracking-[-0.035em]">{children}</h1>
);

function until(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { weekday: "long", hour: "2-digit", minute: "2-digit", day: "numeric", month: "long" });
}

export function StatusView({ id, token, cancelled, returned }: { id: string; token: string; cancelled: boolean; returned: boolean }) {
  const [s, setS] = useState<Status | null | "missing">(null);
  const [art, setArt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [appealOpen, setAppealOpen] = useState(false);
  const [appealMsg, setAppealMsg] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/submissions/${id}?t=${encodeURIComponent(token)}`, { cache: "no-store" });
    if (!r.ok) return setS("missing");
    setS(await r.json());
  }, [id, token]);

  useEffect(() => {
    load();
    try {
      setArt(sessionStorage.getItem(`pou-card-${id}`));
    } catch {}
  }, [id, load]);

  // poll while something is in motion
  useEffect(() => {
    if (!s || s === "missing") return;
    const waitingForPayment = returned && s.status === "awaiting_payment";
    const inReview = s.status === "in_review" || s.status === "appealed";
    if (!waitingForPayment && !inReview) return;
    const t = setInterval(load, waitingForPayment ? 2500 : 30000);
    return () => clearInterval(t);
  }, [s, returned, load]);

  const pay = async () => {
    setBusy(true);
    setErr(null);
    const r = await fetch(`/api/submissions/${id}/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ t: token }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setBusy(false);
      setErr(j.message || "Payments are unavailable for a moment. Please try again.");
      load();
      return;
    }
    window.location.href = j.redirectUrl;
  };

  const appeal = async () => {
    setBusy(true);
    const r = await fetch(`/api/submissions/${id}/appeal`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ t: token, message: appealMsg }),
    });
    setBusy(false);
    if (r.ok) {
      setAppealOpen(false);
      setS(await r.json());
    } else setErr("This piece can’t be sent for review.");
  };

  const permalink = s && s !== "missing" ? `${typeof location !== "undefined" ? location.origin : ""}/piece/${s.pieceNumber}` : "";

  const downloadCard = async () => {
    if (!s || s === "missing") return;
    setBusy(true);
    const img = new Image();
    img.crossOrigin = "anonymous";
    const src = art || `/api/pieces/${s.pieceNumber}`;
    let source = src;
    if (!art) {
      const p = await fetch(src).then((r) => r.json()).catch(() => null);
      source = p?.imageUrl ?? "";
    }
    img.src = source;
    await img.decode().catch(() => null);
    const blob = await makeCard({
      pieceNumber: s.pieceNumber,
      art: img,
      title: s.title,
      name: s.displayName,
      country: s.country,
      date: s.publishedAt ? new Date(s.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null,
      url: permalink,
    });
    download(blob, `piece-of-us-${s.pieceNumber}.png`);
    setBusy(false);
  };

  if (s === null) return <div className="flex min-h-[60vh] items-center justify-center"><span className="label pulse">Loading…</span></div>;
  if (s === "missing")
    return (
      <div className="mx-auto max-w-2xl px-5 py-24">
        <H>We couldn’t find this piece.</H>
        <p className="mt-6 text-ink-2">The link may be incomplete. Please use the full link from your confirmation.</p>
        <Link href="/" className="btn btn-primary mt-10">Back to the mosaic</Link>
      </div>
    );

  const n = formatPieceNumber(s.pieceNumber);
  const preview = art ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={art} alt={s.title ?? "Your artwork"} className="block aspect-square w-full object-cover shadow-[0_24px_60px_-30px_rgba(0,0,0,.45)]" />
  ) : (
    <div className="aspect-square w-full" style={{ background: s.avgColor }} />
  );

  return (
    <div className="mx-auto grid max-w-[1300px] gap-12 px-5 py-12 md:grid-cols-12 md:px-10 md:py-20">
      <div className="md:col-span-5">
        {s.status === "published" ? <PublishedArt n={s.pieceNumber} fallback={art} /> : preview}
        <p className="label mt-4">Square No. {n}</p>
      </div>

      <div className="md:col-span-6 md:col-start-7" aria-live="polite">
        {s.status === "awaiting_payment" && returned && !cancelled && (
          <>
            <p className="label">One moment</p>
            <H>Confirming your payment…</H>
            <p className="mt-6 max-w-lg text-[1.1rem] text-ink-2">This page will update by itself.</p>
          </>
        )}

        {s.status === "awaiting_payment" && !(returned && !cancelled) && (
          <>
            <p className="label">Approved</p>
            <H>Your piece is ready to become part of us.</H>
            {cancelled && <p className="mt-6 text-ink-2">Your payment was cancelled — nothing was charged. Your square is still held for you.</p>}
            <p className="mt-6 max-w-lg text-[1.1rem] leading-relaxed text-ink-2">
              Square No. {n} is held for you until <span className="whitespace-nowrap">{until(s.holdUntil)}</span>. Complete a one-time payment of $8 and your piece joins the mosaic straight away.
            </p>
            {err && <p className="mt-5 text-accent" role="alert">{err}</p>}
            <button className="btn btn-primary mt-9 min-w-[18rem]" onClick={pay} disabled={busy}>{busy ? "Opening secure checkout…" : "Pay $8 and publish"}</button>
            <p className="mt-4 text-[0.82rem] text-muted">Secure checkout. One-time payment, no account needed.</p>
          </>
        )}

        {(s.status === "in_review" || s.status === "appealed") && (
          <>
            <p className="label">{s.status === "appealed" ? "Review requested" : "Under review"}</p>
            <H>Your piece is under review. We’ll let you know once it’s ready.</H>
            <p className="mt-6 max-w-lg text-[1.1rem] leading-relaxed text-ink-2">
              A person on our team is taking a closer look. We’re holding square No. {n} for you until {until(s.holdUntil)}. You haven’t been charged — you’ll only pay if your piece is approved.
            </p>
            <div className="mt-8 rounded-[6px] bg-paper-2 p-5 text-[0.92rem] leading-relaxed text-ink-2">
              <p className="font-medium text-ink">Keep this page</p>
              <p className="mt-1">Bookmark it to check your piece at any time. If you left an e-mail, we’ll also write to you when there’s a decision.</p>
              <button
                className="link mt-3 text-ink"
                onClick={() => { navigator.clipboard?.writeText(location.href); setCopied(true); setTimeout(() => setCopied(false), 1600); }}
              >
                {copied ? "Link copied" : "Copy the link to this page"}
              </button>
            </div>
          </>
        )}

        {s.status === "rejected" && (
          <>
            <H>Your piece doesn’t meet our community guidelines.</H>
            <p className="mt-6 max-w-lg text-[1.1rem] leading-relaxed text-ink-2">
              PIECE OF US is a space for cultural diversity, creativity, and mutual respect. Please upload a different artwork that follows our community guidelines.
            </p>
            {s.publicReason && (
              <p className="mt-5 max-w-lg rounded-[6px] bg-paper-2 px-4 py-3 text-[0.95rem] text-ink-2">
                <span className="label mr-2">Why</span>{s.publicReason}
              </p>
            )}
            <p className="mt-5 text-[0.9rem] text-muted">You have not been charged.</p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link href={`/add?tile=${s.tile}`} className="btn btn-primary">Upload another artwork</Link>
              <Link href="/guidelines" className="btn btn-ghost">View community guidelines</Link>
            </div>
            {s.appealable && !appealOpen && (
              <p className="mt-8 text-[0.95rem] text-ink-2">
                Think we got it wrong? <button className="link text-ink" onClick={() => setAppealOpen(true)}>Request a manual review</button>
              </p>
            )}
            {appealOpen && (
              <div className="mt-8 max-w-lg rounded-[6px] border border-line p-5">
                <label htmlFor="appeal" className="font-medium">Request a manual review</label>
                <p className="mt-1 text-[0.88rem] text-muted">A person will look at your piece. Tell us anything that helps us understand it — its meaning, its context, where it comes from. (optional)</p>
                <textarea id="appeal" rows={3} maxLength={500} value={appealMsg} onChange={(e) => setAppealMsg(e.target.value)} className="field mt-2 resize-none" />
                <div className="mt-4 flex gap-3">
                  <button className="btn btn-primary btn-sm" disabled={busy} onClick={appeal}>Send for review</button>
                  <button className="btn btn-sm text-muted" onClick={() => setAppealOpen(false)}>Cancel</button>
                </div>
              </div>
            )}
            {err && <p className="mt-5 text-accent">{err}</p>}
          </>
        )}

        {s.status === "published" && (
          <>
            <p className="label">Piece No. {n}</p>
            <H>You’re now a piece of us.</H>
            <p className="mt-6 max-w-lg font-serif text-[1.5rem] leading-snug text-ink-2">
              {s.title ? `“${s.title}” ` : "Your piece "}now has a permanent place in the mosaic, among a million others.
            </p>
            <div className="mt-9 max-w-lg">
              <p className="label">Your permanent link</p>
              <div className="mt-2 flex items-center gap-3 border-b border-line pb-2">
                <span className="min-w-0 flex-1 truncate font-mono text-[0.95rem]">{permalink.replace(/^https?:\/\//, "")}</span>
                <button className="label hover:text-ink" onClick={() => { navigator.clipboard?.writeText(permalink); setCopied(true); setTimeout(() => setCopied(false), 1600); }}>{copied ? "Copied" : "Copy"}</button>
              </div>
            </div>
            <div className="mt-9 flex flex-wrap gap-4">
              <button className="btn btn-primary" onClick={downloadCard} disabled={busy}>{busy ? "Preparing…" : "Download your participation card"}</button>
              <Link href={`/explore?piece=${s.pieceNumber}`} className="btn btn-ghost">Return to the mosaic</Link>
            </div>
          </>
        )}

        {s.status === "expired" && (
          <>
            <H>Your hold on this square ran out.</H>
            <p className="mt-6 max-w-lg text-[1.1rem] text-ink-2">Nothing was charged. If the square is still free, you can choose it again.</p>
            <Link href={`/add?tile=${s.tile}`} className="btn btn-primary mt-9">Try this square again</Link>
          </>
        )}

        {(s.status === "refunded" || s.status === "removed") && (
          <>
            <H>{s.status === "removed" ? "This piece has been removed." : "Your $8 has been refunded."}</H>
            <p className="mt-6 max-w-lg text-[1.1rem] leading-relaxed text-ink-2">
              {s.status === "removed"
                ? `It no longer meets our community guidelines${s.publicReason ? ` — ${s.publicReason.charAt(0).toLowerCase()}${s.publicReason.slice(1)}` : "."} Your payment has been refunded in full.`
                : "We couldn’t place your piece — most often because someone else completed the same square at the same moment. Your payment has been refunded in full; it can take a few days to appear."}
            </p>
            <Link href="/add" className="btn btn-primary mt-9">Choose another square</Link>
          </>
        )}
      </div>
    </div>
  );
}

function PublishedArt({ n, fallback }: { n: number; fallback: string | null }) {
  const [url, setUrl] = useState<string | null>(fallback);
  useEffect(() => {
    fetch(`/api/pieces/${n}`).then((r) => r.ok && r.json()).then((p) => p?.imageUrl && setUrl(p.imageUrl)).catch(() => {});
  }, [n]);
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="Your artwork" className="block aspect-square w-full object-cover shadow-[0_24px_60px_-30px_rgba(0,0,0,.45)]" />
  ) : (
    <div className="aspect-square w-full bg-paper-2" />
  );
}
