import Link from "next/link";
import { can, requireAdminPage } from "@/lib/admin-auth";
import { LogoutButton } from "@/components/admin/LogoutButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Studio", robots: { index: false, follow: false } };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const s = await requireAdminPage();
  const nav: [string, string, boolean][] = [
    ["Overview", "/admin", true],
    ["Moderation", "/admin/moderation", true],
    ["Reports", "/admin/reports", true],
    ["Activity log", "/admin/activity", true],
    ["Founding Collection", "/admin/founding", can(s, "founding")],
  ];
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[240px_1fr]">
      <aside className="border-b border-line bg-paper-2 px-5 py-5 md:sticky md:top-0 md:h-dvh md:border-b-0 md:border-r md:py-8">
        <Link href="/" className="text-[1.2rem] font-bold tracking-[-0.02em]">PIECE OF US.</Link>
        <p className="label mt-1">Studio</p>
        <nav className="mt-6 flex gap-4 overflow-x-auto text-[0.95rem] md:mt-10 md:flex-col md:gap-1" aria-label="Admin">
          {nav.filter(([, , ok]) => ok).map(([l, h]) => (
            <Link key={h} href={h} className="whitespace-nowrap rounded-[4px] py-1.5 text-ink-2 hover:text-ink md:px-2 md:hover:bg-paper">{l}</Link>
          ))}
        </nav>
        <div className="mt-6 hidden text-[0.85rem] md:absolute md:bottom-8 md:block">
          <p className="font-medium">{s.u}</p>
          <p className="label">{s.r}</p>
          <LogoutButton />
        </div>
      </aside>
      <main className="min-w-0 px-5 py-8 md:px-10 md:py-10">{children}</main>
    </div>
  );
}
