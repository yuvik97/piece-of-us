"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CONFIRM_TEXT } from "@/lib/copy";
import { GRID, TileState, formatPieceNumber, pieceNumber } from "@/lib/grid";
import { Mosaic, type MosaicHandle } from "../mosaic/Mosaic";
import { loadMosaic } from "../mosaic/data";
import { Cropper, type CropperHandle } from "./Cropper";
import { NeighbourPreview } from "./NeighbourPreview";

type Step = 0 | 1 | 2 | 3;
const STEPS = ["Your square", "Your artwork", "About it", "Review"];

interface Hold { tile: number; token: string; expiresAt: string }

const holdKey = "pou-hold";
function saveHold(h: Hold | null) {
  try {
    if (h) sessionStorage.setItem(holdKey, JSON.stringify(h));
    else sessionStorage.removeItem(holdKey);
  } catch {}
}
function readHold(): Hold | null {
  try {
    const h = JSON.parse(sessionStorage.getItem(holdKey) || "null") as Hold | null;
    return h && Date.parse(h.expiresAt) > Date.now() ? h : null;
  } catch {
    return null;
  }
}

export function AddFlow({ initialTile }: { initialTile?: number }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [hold, setHold] = useState<Hold | null>(null);
  const [holdError, setHoldError] = useState<string | null>(null);
  const [reserving, setReserving] = useState(false);
  const [file, setFile] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [cropVersion, setCropVersion] = useState(0);
  const cropper = useRef<CropperHandle>(null);
  const [meta, setMeta] = useState({ displayName: "", country: "", title: "", description: "", email: "", contactInstagram: "", contactEmail: "", contactPhone: "" });
  const [confirmed, setConfirmed] = useState(false);
  const [phase, setPhase] = useState<"idle" | "analyzing" | "error">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const pickerHandle = useRef<MosaicHandle | null>(null);
  const top = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const reserve = useCallback(async (tile: number) => {
    setReserving(true);
    setHoldError(null);
    const prev = readHold();
    const r = await fetch("/api/reserve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tile, token: prev?.tile === tile ? prev.token : undefined }),
    });
    const j = await r.json().catch(() => ({}));
    setReserving(false);
    if (!r.ok) {
      setHoldError(j.message || "This square isn’t available.");
      return false;
    }
    // release a previous, different hold
    if (prev && prev.tile !== tile)
      fetch("/api/reserve", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify(prev) });
    const h = { tile: j.tile, token: j.token, expiresAt: j.expiresAt };
    setHold(h);
    saveHold(h);
    return true;
  }, []);

  // initial square from URL or a previous hold in this tab
  useEffect(() => {
    const prev = readHold();
    if (initialTile !== undefined) {
      reserve(initialTile).then((ok) => ok && setStep(1));
    } else if (prev) {
      setHold(prev);
      setStep(1);
    }
  }, [initialTile, reserve]);

  useEffect(() => {
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  const remaining = hold ? Math.max(0, Date.parse(hold.expiresAt) - now) : 0;
  const expired = !!hold && remaining === 0;

  const pickForMe = async () => {
    const d = await loadMosaic();
    // somewhere near the heart of the canvas, among other pieces
    for (let k = 0; k < 4000; k++) {
      const r = 20 + Math.random() * (60 + k / 20);
      const a = Math.random() * Math.PI * 2;
      const x = Math.round(500 + Math.cos(a) * r), y = Math.round(500 + Math.sin(a) * r);
      const t = y * GRID + x;
      if (d.state[t] === TileState.Available) {
        pickerHandle.current?.flyToTile(t, 40);
        if (await reserve(t)) setStep(1);
        return;
      }
    }
  };

  const onPick = useCallback(
    async (tile: number, state: number) => {
      if (state !== TileState.Available) {
        setHoldError(state === TileState.Founding || state === TileState.Published ? "This square already holds a piece. Choose an empty one." : "Someone is making this square theirs right now. Choose another.");
        return;
      }
      if (await reserve(tile)) setStep(1);
    },
    [reserve],
  );

  const onFile = (f: File | undefined) => {
    setFileError(null);
    if (!f) return;
    if (!/^image\/(jpeg|png|webp|gif|heic|heif|avif)$/.test(f.type) && !/\.(jpe?g|png|webp|gif|heic|heif|avif)$/i.test(f.name)) {
      setFileError("Please choose an image file (JPG, PNG or WebP).");
      return;
    }
    if (f.size > 25 * 1024 * 1024) {
      setFileError("This file is very large. Please use an image under 25 MB.");
      return;
    }
    const url = URL.createObjectURL(f);
    const probe = new Image();
    probe.onload = () => {
      if (Math.min(probe.naturalWidth, probe.naturalHeight) < 200) {
        setFileError("This image is too small. Please use at least 200 × 200 pixels.");
        URL.revokeObjectURL(url);
        return;
      }
      if (file) URL.revokeObjectURL(file);
      setFile(url);
    };
    probe.onerror = () => {
      setFileError("Your browser couldn’t open this image. If it’s a HEIC photo, please export it as JPG first.");
      URL.revokeObjectURL(url);
    };
    probe.src = url;
  };

  const preview = useCallback(() => cropper.current?.render(192) ?? null, []);
  const bump = useCallback(() => setCropVersion((v) => v + 1), []);

  const submit = async () => {
    if (!hold) return;
    setPhase("analyzing");
    setSubmitError(null);
    const canvas = cropper.current?.render(1024);
    if (!canvas) return;
    const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.92));
    const fd = new FormData();
    fd.set("tile", String(hold.tile));
    fd.set("token", hold.token);
    fd.set("image", blob, "artwork.jpg");
    Object.entries(meta).forEach(([k, v]) => fd.set(k, v));
    fd.set("rightsConfirmed", confirmed ? "true" : "false");
    const started = Date.now();
    const r = await fetch("/api/submissions", { method: "POST", body: fd }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    // let the moment breathe; moderation is often instant in demo mode
    await new Promise((res) => setTimeout(res, Math.max(0, 1800 - (Date.now() - started))));
    if (!r || !r.ok) {
      setPhase("error");
      setSubmitError(j.message || "Something went wrong. Your square is still held — please try again.");
      if (j.error === "reservation_expired") saveHold(null);
      return;
    }
    saveHold(null);
    try {
      sessionStorage.setItem(`pou-card-${j.id}`, canvas.toDataURL("image/jpeg", 0.85));
    } catch {}
    router.push(`/status/${j.id}?t=${j.statusToken}&fresh=1`);
  };

  const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;

  /* ───────── analyzing screen ───────── */
  if (phase === "analyzing")
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-5 text-center" role="status" aria-live="polite">
        <div className="grid grid-cols-3 gap-1.5" aria-hidden>
          {Array.from({ length: 9 }).map((_, i) => (
            <span key={i} className="block h-5 w-5 bg-ink" style={{ animation: `pou-tiles 1.4s ${(i % 3) * 0.12 + Math.floor(i / 3) * 0.12}s infinite ease-in-out` }} />
          ))}
        </div>
        <p className="mt-10 text-[clamp(1.6rem,3vw,2.2rem)] font-semibold leading-tight tracking-[-0.025em]">Making sure your piece belongs in our shared world.</p>
        <p className="mt-4 text-muted">This usually takes a few seconds.</p>
      </div>
    );

  return (
    <div ref={top} className="mx-auto max-w-[1400px] scroll-mt-24 px-5 pb-24 md:px-10">
      {/* progress */}
      <ol className="flex gap-1 pt-6 md:pt-10" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1">
            <div className={`h-[3px] ${i <= step ? "bg-ink" : "bg-empty"} transition-colors`} />
            <p className={`mt-2 hidden text-[0.8rem] sm:block ${i === step ? "text-ink" : "text-muted"}`} aria-current={i === step ? "step" : undefined}>
              <span className="font-mono">0{i + 1}</span> {s}
            </p>
          </li>
        ))}
      </ol>

      {hold && step > 0 && (
        <div className={`mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[6px] px-4 py-3 text-[0.9rem] ${expired ? "bg-accent/10 text-accent" : "bg-paper-2"}`}>
          <span>
            <span className="font-mono">Square No. {formatPieceNumber(pieceNumber(hold.tile))}</span>
            {expired ? " — your hold ran out." : <> is held for you for <span className="font-mono tabular">{fmt(remaining)}</span></>}
          </span>
          {expired ? (
            <button className="link" onClick={() => reserve(hold.tile)}>Hold it again</button>
          ) : (
            <button className="text-muted hover:text-ink" onClick={() => setStep(0)}>Choose a different square</button>
          )}
        </div>
      )}

      {/* ───────── Step 1: square ───────── */}
      {step === 0 && (
        <section className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="label">Step 01</p>
              <h1 className="mt-3 text-[clamp(2.4rem,5vw,4.2rem)] font-bold leading-[0.98] tracking-[-0.035em]">Find your piece.</h1>
              <p className="mt-4 max-w-lg text-[1.05rem] text-ink-2">Choose any empty square. Every square is the same size, the same price and has the same place.</p>
            </div>
            <button onClick={pickForMe} disabled={reserving} className="btn btn-ghost">Choose one for me</button>
          </div>
          {holdError && <p className="mt-6 text-accent" role="alert">{holdError}</p>}
          <div className="mt-8 h-[68svh] min-h-[420px] shadow-[0_0_0_1px_var(--color-line)]">
            <Mosaic
              mode="picker"
              className="h-full w-full"
              selected={hold?.tile ?? -1}
              onTile={onPick}
              onReady={(h) => (pickerHandle.current = h)}
              showFilter={false}
              label="Choose an empty square. Use arrow keys to move, plus and minus to zoom, Enter to choose the square in the centre."
            />
          </div>
          <p className="mt-3 text-[0.85rem] text-muted">Drag to move · pinch or scroll to zoom · tap an empty square to choose it.</p>
        </section>
      )}

      {/* ───────── Step 2: artwork ───────── */}
      {(step === 1 || (file && step > 1)) && (
        <section className={`mt-10 grid gap-12 md:grid-cols-12 ${step === 1 ? "" : "hidden"}`} aria-hidden={step !== 1}>
          <div className="md:col-span-5">
            <p className="label">Step 02</p>
            <h1 className="mt-3 text-[clamp(2.4rem,5vw,4.2rem)] font-bold leading-[0.98] tracking-[-0.035em]">Make it yours.</h1>
            <p className="mt-4 max-w-md text-[1.05rem] leading-relaxed text-ink-2">
              Upload something that represents your world — your culture, a memory, a belief, your hometown, a pattern, a word, a photograph. It’s up to you.
            </p>
            <label className="mt-8 flex cursor-pointer flex-col items-center justify-center rounded-[6px] border border-dashed border-ink/30 px-6 py-10 text-center transition-colors hover:border-ink hover:bg-paper-2"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}
            >
              <span className="text-[1.05rem] font-medium">{file ? "Choose a different image" : "Choose an image"}</span>
              <span className="mt-1 text-[0.85rem] text-muted">or drop it here · JPG, PNG or WebP · up to 12 MB</span>
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
            {fileError && <p className="mt-3 text-[0.9rem] text-accent" role="alert">{fileError}</p>}
            <p className="mt-4 text-[0.82rem] leading-relaxed text-muted">
              We remove hidden information like location data from every image. Please only upload work you made or have permission to share — see the{" "}
              <Link href="/guidelines" target="_blank" className="underline underline-offset-2">Community Guidelines</Link>.
            </p>
          </div>
          <div className="md:col-span-7">
            {file ? (
              <div className="grid gap-8 sm:grid-cols-[minmax(0,1fr)_200px]">
                <Cropper ref={cropper} src={file} onChange={bump} />
                <div>
                  <p className="label">On the mosaic</p>
                  <div className="mt-3"><NeighbourPreview tile={hold?.tile ?? 0} source={preview} version={cropVersion} /></div>
                  <p className="label mt-6">Up close</p>
                  <PreviewTile source={preview} version={cropVersion} />
                </div>
              </div>
            ) : (
              <div className="flex aspect-square w-full max-w-[560px] items-center justify-center bg-paper-2 md:ml-auto">
                <p className="label">Your preview appears here</p>
              </div>
            )}
          </div>
          <div className="flex justify-between md:col-span-12">
            <button className="btn text-muted hover:text-ink" onClick={() => setStep(0)}>← Back</button>
            <button className="btn btn-primary" disabled={!file || expired} onClick={() => setStep(2)}>Continue</button>
          </div>
        </section>
      )}

      {/* ───────── Step 3: details ───────── */}
      {step === 2 && (
        <section className="mt-10 grid gap-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <p className="label">Step 03</p>
            <h1 className="mt-3 text-[clamp(2.4rem,5vw,4.2rem)] font-bold leading-[0.98] tracking-[-0.035em]">Tell us about it.</h1>
            <p className="mt-4 max-w-md text-[1.05rem] leading-relaxed text-ink-2">Everything here is optional. Share as much or as little as you like.</p>
            <p className="mt-6 max-w-md font-serif text-[1.35rem] italic leading-snug text-ink-2">Express who you are, not who you are against.</p>
          </div>
          <form className="space-y-7 md:col-span-6 md:col-start-7" onSubmit={(e) => { e.preventDefault(); setStep(3); }}>
            <Field label="Title of your artwork" hint="optional" max={80} value={meta.title} onChange={(v) => setMeta({ ...meta, title: v })} />
            <Field label="Display name" hint="optional · how you’d like to be credited" max={60} value={meta.displayName} onChange={(v) => setMeta({ ...meta, displayName: v })} />
            <Field label="Country" hint="optional" max={60} value={meta.country} onChange={(v) => setMeta({ ...meta, country: v })} autoComplete="country-name" />
            <Field label="A few words about it" hint="optional" max={150} value={meta.description} onChange={(v) => setMeta({ ...meta, description: v })} textarea />
            <Field label="E-mail" hint="optional · only to tell you when your piece is reviewed or live" max={254} value={meta.email} onChange={(v) => setMeta({ ...meta, email: v })} type="email" autoComplete="email" />
            <fieldset className="space-y-6 rounded-[6px] border border-line p-5">
              <legend className="px-1 text-[0.95rem] font-medium">Let people reach you <span className="font-normal text-muted">· optional</span></legend>
              <p className="-mt-2 text-[0.82rem] text-muted">If you’d like visitors to find you, add any of these. They are shown publicly on your piece, and you can ask us to remove them at any time.</p>
              <Field label="Instagram" hint="your username" max={60} value={meta.contactInstagram} onChange={(v) => setMeta({ ...meta, contactInstagram: v })} />
              <Field label="Public e-mail" max={254} value={meta.contactEmail} onChange={(v) => setMeta({ ...meta, contactEmail: v })} type="email" />
              <Field label="Phone" max={24} value={meta.contactPhone} onChange={(v) => setMeta({ ...meta, contactPhone: v })} type="tel" />
            </fieldset>
            <p className="text-[0.82rem] text-muted">We never ask about your religion, ethnicity or other sensitive details — and you don’t need to share them.</p>
            <div className="flex justify-between pt-2">
              <button type="button" className="btn text-muted hover:text-ink" onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn-primary" disabled={expired}>Continue</button>
            </div>
          </form>
        </section>
      )}

      {/* ───────── Step 4: review ───────── */}
      {step === 3 && hold && (
        <section className="mt-10 grid gap-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <p className="label">Step 04</p>
            <h1 className="mt-3 text-[clamp(2.4rem,5vw,4.2rem)] font-bold leading-[0.98] tracking-[-0.035em]">Become part of us.</h1>
            <div className="mt-8 max-w-[360px]"><PreviewTile source={preview} version={cropVersion} large /></div>
          </div>
          <div className="md:col-span-6 md:col-start-7">
            <dl className="divide-y divide-line border-y border-line text-[0.98rem]">
              {[
                ["Square", `No. ${formatPieceNumber(pieceNumber(hold.tile))}`],
                ["Title", meta.title || "Untitled"],
                ["Name", meta.displayName || "Anonymous"],
                ["Country", meta.country || "—"],
                ["Description", meta.description || "—"],
                ["Contact", [meta.contactInstagram && `@${meta.contactInstagram.replace(/^@/, "")}`, meta.contactEmail, meta.contactPhone].filter(Boolean).join(" · ") || "—"],
                ["Price", "$8.00, one time"],
              ].map(([k, v]) => (
                <div key={k} className="grid grid-cols-[8rem_1fr] gap-4 py-3.5">
                  <dt className="label pt-[3px]">{k}</dt>
                  <dd className="break-words">{v}</dd>
                </div>
              ))}
            </dl>

            <label className="mt-8 flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-ink" />
              <span className="text-[0.98rem] leading-relaxed">
                {CONFIRM_TEXT.replace(" Community Guidelines.", " ")}
                <Link href="/guidelines" target="_blank" className="underline underline-offset-2">Community Guidelines</Link>.
              </span>
            </label>

            <div className="mt-8 rounded-[6px] bg-paper-2 p-5 text-[0.9rem] leading-relaxed text-ink-2">
              <p className="font-medium text-ink">What happens next</p>
              <p className="mt-1.5">We check every piece before anyone pays. If yours is approved, you’ll pay $8 and it goes live straight away. If we need a closer look, we’ll hold your square while a person reviews it. If it can’t be accepted, you won’t be charged.</p>
            </div>

            {phase === "error" && submitError && <p className="mt-5 text-accent" role="alert">{submitError}</p>}

            <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
              <button className="btn text-muted hover:text-ink" onClick={() => setStep(2)}>← Back</button>
              <button className="btn btn-primary min-w-[16rem]" disabled={!confirmed || expired} onClick={submit}>
                Submit my piece
              </button>
            </div>
            <p className="mt-4 text-right text-[0.8rem] text-muted">No account. No subscription. Nothing recurring.</p>
          </div>
        </section>
      )}
    </div>
  );
}

function Field(p: { label: string; hint?: string; max: number; value: string; onChange: (v: string) => void; textarea?: boolean; type?: string; autoComplete?: string }) {
  const id = p.label.toLowerCase().replace(/\W+/g, "-");
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-[0.95rem] font-medium">{p.label}</label>
        <span className="font-mono text-[0.72rem] text-muted tabular">{p.value.length}/{p.max}</span>
      </div>
      {p.hint && <p className="text-[0.8rem] text-muted">{p.hint}</p>}
      {p.textarea ? (
        <textarea id={id} rows={3} maxLength={p.max} value={p.value} onChange={(e) => p.onChange(e.target.value)} className="field resize-none" />
      ) : (
        <input id={id} type={p.type || "text"} maxLength={p.max} value={p.value} onChange={(e) => p.onChange(e.target.value)} className="field" autoComplete={p.autoComplete || "off"} />
      )}
    </div>
  );
}

function PreviewTile({ source, version, large }: { source: () => HTMLCanvasElement | null; version: number; large?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const src = source();
    const cv = ref.current;
    if (!cv || !src) return;
    cv.width = cv.height = 384;
    cv.getContext("2d")!.drawImage(src, 0, 0, 384, 384);
  }, [source, version]);
  return <canvas ref={ref} className={`mt-3 block aspect-square w-full bg-paper-2 ${large ? "shadow-[0_24px_60px_-30px_rgba(0,0,0,.45)]" : ""}`} aria-hidden />;
}
