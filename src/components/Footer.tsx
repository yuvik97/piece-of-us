import Link from "next/link";

const LINKS = [
  ["About", "/#about"],
  ["FAQ", "/faq"],
  ["Contact", "/contact"],
  ["Community Guidelines", "/guidelines"],
  ["Terms & Conditions", "/terms"],
  ["Privacy Policy", "/privacy"],
] as const;

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-[1600px] gap-12 px-5 py-14 md:grid-cols-12 md:px-10 md:py-20">
        <div className="md:col-span-5">
          <p className="text-[1.6rem] font-bold tracking-[-0.02em]">PIECE OF US.</p>
          <p className="mt-3 max-w-sm text-muted">Eight dollars. One piece of your world.</p>
          <p className="mt-6 max-w-sm font-serif text-xl italic text-ink-2">Express who you are, not who you are against.</p>
        </div>
        <nav className="md:col-span-4" aria-label="Footer">
          <ul className="grid grid-cols-2 gap-x-6 gap-y-3 text-[0.95rem]">
            {LINKS.map(([label, href]) => (
              <li key={href}>
                <Link href={href} className="text-ink-2 transition-colors hover:text-ink">{label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="md:col-span-3 md:text-right">
          <p className="label">An independent global art project</p>
          <p className="label mt-2">© {new Date().getFullYear()} PIECE OF US</p>
        </div>
      </div>
    </footer>
  );
}
