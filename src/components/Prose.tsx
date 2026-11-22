import { Footer } from "./Footer";
import { Nav } from "./Nav";

export function PageShell({ label, title, intro, children, updated }: { label: string; title: React.ReactNode; intro?: React.ReactNode; children: React.ReactNode; updated?: string }) {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-[1400px] px-5 pb-28 pt-10 md:px-10 md:pt-16">
        <div className="grid gap-8 md:grid-cols-12">
          <p className="label md:col-span-2 md:pt-4">{label}</p>
          <div className="md:col-span-9">
            <h1 className="text-headline font-bold">{title}</h1>
            {intro && <div className="mt-8 max-w-[44rem] font-serif text-[clamp(1.4rem,2.2vw,1.9rem)] leading-[1.25] text-ink-2">{intro}</div>}
            {updated && <p className="label mt-8">Last updated {updated}</p>}
          </div>
        </div>
        <div className="mt-16 grid gap-8 md:grid-cols-12">
          <div className="prose-pou md:col-span-7 md:col-start-3">{children}</div>
        </div>
      </main>
      <Footer />
    </>
  );
}
