"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Login() {
  const router = useRouter();
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const r = await fetch("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: u, password: p }) });
    setBusy(false);
    if (r.ok) router.replace("/admin");
    else setErr((await r.json().catch(() => ({}))).message || "Those details didn’t work.");
  };
  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <form onSubmit={submit} className="w-full max-w-sm">
        <p className="text-[1.4rem] font-bold tracking-[-0.02em]">PIECE OF US.</p>
        <p className="label mt-1">Studio</p>
        <div className="mt-10 space-y-6">
          <div>
            <label htmlFor="u" className="text-[0.9rem] font-medium">Username</label>
            <input id="u" autoComplete="username" value={u} onChange={(e) => setU(e.target.value)} className="field" />
          </div>
          <div>
            <label htmlFor="p" className="text-[0.9rem] font-medium">Password</label>
            <input id="p" type="password" autoComplete="current-password" value={p} onChange={(e) => setP(e.target.value)} className="field" />
          </div>
        </div>
        {err && <p className="mt-4 text-[0.9rem] text-accent" role="alert">{err}</p>}
        <button className="btn btn-primary mt-8 w-full" disabled={busy || !u || !p}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </main>
  );
}
