"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export function Nav({ variant = "default" }: { variant?: "default" | "overlay" | "minimal" }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <header
      className={`${variant === "overlay" ? "absolute" : "sticky"} top-0 z-40 w-full transition-colors duration-300 ${
        scrolled && variant === "default" ? "bg-paper/90 backdrop-blur-md shadow-[0_1px_0_var(--color-line)]" : ""
      }`}
    >
      <nav className="mx-auto flex h-[72px] max-w-[1600px] items-center justify-between px-5 md:h-[88px] md:px-10" aria-label="Main">
        <Link href="/" className="text-[1.35rem] font-bold tracking-[-0.02em] md:text-[1.6rem]" aria-label="PIECE OF US — home">
          PIECE OF US.
        </Link>
        {variant !== "minimal" && (
          <>
            <div className="hidden items-center gap-9 md:flex">
              <Link href="/#about" className="text-[0.95rem] tracking-[0.06em] text-muted uppercase transition-colors hover:text-ink">
                About the project
              </Link>
              <Link href="/explore" className="text-[0.95rem] tracking-[0.06em] text-muted uppercase transition-colors hover:text-ink">
                Explore
              </Link>
              <Link href="/add" className="btn btn-primary btn-sm">
                Add your piece — $8
              </Link>
            </div>
            <button
              className="flex h-10 w-10 items-center justify-center md:hidden"
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen(!open)}
            >
              <span className="relative block h-3 w-6">
                <span className={`absolute left-0 h-[1.5px] w-6 bg-ink transition-transform ${open ? "top-1.5 rotate-45" : "top-0"}`} />
                <span className={`absolute left-0 h-[1.5px] w-6 bg-ink transition-transform ${open ? "top-1.5 -rotate-45" : "top-3"}`} />
              </span>
            </button>
          </>
        )}
      </nav>
      {open && (
        <div id="mobile-menu" className="border-t border-line bg-paper px-5 pb-8 pt-4 md:hidden">
          <ul className="space-y-1 text-[2rem] font-semibold tracking-[-0.03em]">
            <li><Link href="/#about" onClick={() => setOpen(false)}>About</Link></li>
            <li><Link href="/explore" onClick={() => setOpen(false)}>Explore</Link></li>
            <li><Link href="/guidelines" onClick={() => setOpen(false)}>Guidelines</Link></li>
          </ul>
          <Link href="/add" className="btn btn-primary mt-6 w-full" onClick={() => setOpen(false)}>
            Add your piece — $8
          </Link>
        </div>
      )}
    </header>
  );
}
