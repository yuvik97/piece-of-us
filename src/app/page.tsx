import Link from "next/link";
import { Counter } from "@/components/Counter";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { Reveal } from "@/components/Reveal";
import { MosaicExplorer } from "@/components/mosaic/MosaicExplorer";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        {/* ───────── Hero ───────── */}
        <section className="mx-auto max-w-[1600px] px-5 pb-10 pt-10 text-center md:px-10 md:pb-14 md:pt-16">
          <p className="label">An independent global art project</p>
          <h1 className="mx-auto mt-6 text-display font-bold">
            A million pieces.
            <br />
            One world.
          </h1>
          <p className="mx-auto mt-7 text-[clamp(1.15rem,1.8vw,1.5rem)] tracking-[0.01em] text-muted">Eight dollars. One piece of your world.</p>
          <p className="mx-auto mt-6 max-w-[34rem] text-[1.05rem] leading-relaxed text-ink-2">
            Imagine a million people, each leaving a small piece of who they are. Different cultures, different beliefs, different lives.
            Together, one extraordinary artwork.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
            <Link href="/add" className="btn btn-primary w-full max-w-[22rem] sm:w-auto sm:min-w-[19rem]">
              Add your piece — $8
            </Link>
            <a href="#mosaic" className="link text-[1.0625rem]">Explore the mosaic</a>
          </div>
        </section>

        {/* ───────── Mosaic ───────── */}
        <section id="mosaic" aria-label="The mosaic" className="scroll-mt-20">
          <div className="mx-auto max-w-[1600px] px-0 md:px-10">
            <MosaicExplorer mode="embedded" className="h-[78svh] min-h-[460px] md:h-[82vh] md:max-h-[980px] md:shadow-[0_0_0_1px_var(--color-line)]" />
          </div>
          <div className="mx-auto max-w-[1600px] px-5 pt-8 md:px-10">
            <Counter />
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              <p className="text-[0.9rem] text-muted">
                Every square is the same size, the same price, and has the same place. No premium positions. No featured contributors.
              </p>
              <Link href="/explore" className="link text-[0.95rem]">Open the full-screen mosaic →</Link>
            </div>
          </div>
        </section>

        {/* ───────── About ───────── */}
        <section id="about" className="mx-auto mt-28 max-w-[1600px] scroll-mt-24 px-5 md:mt-44 md:px-10">
          <div className="grid gap-10 md:grid-cols-12">
            <Reveal className="md:col-span-2">
              <p className="label">About the project</p>
            </Reveal>
            <div className="md:col-span-10">
              <Reveal>
                <h2 className="text-headline font-bold">The world is made of pieces.</h2>
              </Reveal>
              <div className="mt-12 grid gap-12 md:grid-cols-10">
                <Reveal className="md:col-span-5" delay={100}>
                  <p className="font-serif text-[clamp(1.7rem,2.7vw,2.5rem)] leading-[1.16] text-ink">
                    Every person carries a world of their own. A culture, a story, a memory, a belief.
                  </p>
                  <p className="mt-8 text-[1.125rem] leading-relaxed text-ink-2">
                    Picture it: a grandmother’s embroidery beside a street corner in Lagos. A prayer in Hebrew next to the word for home in Tagalog. A family recipe, a mountain someone misses, the pattern a mother once wove.
                  </p>
                </Reveal>
                <Reveal className="md:col-span-4 md:col-start-7" delay={200}>
                  <p className="text-[1.125rem] leading-relaxed text-ink-2">
                    None of them larger. None of them louder. Each one is someone saying: <em className="font-serif text-[1.3rem] not-italic text-ink">this is where I come from. This is what I carry.</em>
                  </p>
                  <p className="mt-6 text-[1.125rem] leading-relaxed text-ink-2">
                    PIECE OF US is a place to leave a small part of that world behind. One square. Eight dollars. A permanent place in our shared digital artwork.
                  </p>
                  <p className="mt-8 border-l-2 border-ink pl-5 font-serif text-[1.45rem] italic leading-snug text-ink">
                    Alone, a square is a memory. Together, they become a portrait of all of us.
                  </p>
                </Reveal>
              </div>
            </div>
          </div>

          {/* the numbers, spread across the full width */}
          <Reveal className="mt-20 md:mt-28" delay={100}>
            <dl className="grid grid-cols-2 border-y border-ink md:grid-cols-4">
              {[
                ["1,000,000", "squares, one shared canvas"],
                ["$8", "each, once — the same for everyone"],
                ["1", "artwork made by all of us"],
                ["0", "premium positions"],
              ].map(([n, l], i) => (
                <div key={l} className={`px-1 py-8 md:px-8 md:py-12 ${i % 2 ? "border-l border-line" : ""} ${i > 1 ? "border-t border-line md:border-t-0" : ""} ${i === 2 ? "md:border-l" : ""} ${i === 0 ? "md:pl-0" : ""}`}>
                  <dt className="font-mono text-[clamp(2rem,4.2vw,3.6rem)] leading-none tracking-[-0.03em] tabular">{n}</dt>
                  <dd className="mt-3 max-w-[14rem] text-[0.95rem] text-muted">{l}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </section>

        {/* ───────── How it works ───────── */}
        <section className="mx-auto mt-28 max-w-[1600px] px-5 md:mt-44 md:px-10" aria-labelledby="how">
          <div className="grid gap-10 md:grid-cols-12">
            <Reveal className="md:col-span-2">
              <p className="label" id="how">How it works</p>
            </Reveal>
            <ol className="grid gap-y-12 md:col-span-10 md:grid-cols-3 md:gap-y-0">
              {[
                ["01", "Find your piece", "Choose an available square on the canvas."],
                ["02", "Make it yours", "Upload something that represents your world."],
                ["03", "Become part of us", "Pay $8 and leave your mark."],
              ].map(([n, t, d], i) => (
                <Reveal as="li" key={n} delay={i * 120} className={`pt-2 md:pr-10 ${i > 0 ? "border-t border-line pt-10 md:border-l md:border-t-0 md:pl-12 md:pt-2" : ""}`}>
                  <span className="font-mono text-[0.9rem] text-muted">{n} —</span>
                  <h3 className="mt-5 text-[clamp(1.7rem,2.3vw,2.25rem)] font-semibold leading-[1.04] tracking-[-0.03em]">{t}</h3>
                  <p className="mt-4 max-w-[20rem] text-[1.05rem] leading-relaxed text-ink-2">{d}</p>
                </Reveal>
              ))}
            </ol>
          </div>
          <Reveal className="mt-14 grid md:grid-cols-12">
            <p className="max-w-[40rem] text-[0.95rem] leading-relaxed text-muted md:col-span-8 md:col-start-3">
              Every piece is checked against our{" "}
              <Link href="/guidelines" className="link text-ink-2">Community Guidelines</Link> before you pay. If yours can’t be accepted, you won’t be charged.
              No account, no subscription, nothing recurring.
            </p>
          </Reveal>
        </section>

        {/* ───────── Closing ───────── */}
        <section className="mx-auto mt-28 max-w-[1600px] px-5 pb-28 text-center md:mt-44 md:px-10 md:pb-40">
          <Reveal>
            <p className="font-serif text-[clamp(1.5rem,2.4vw,2.1rem)] italic text-ink-2">This is not about buying a square.</p>
            <h2 className="mx-auto mt-3 max-w-[16ch] text-headline font-bold">It’s about becoming part of something.</h2>
            <Link href="/add" className="btn btn-primary mt-12 min-w-[19rem]">Add your piece — $8</Link>
          </Reveal>
        </section>
      </main>
      <Footer />
    </>
  );
}
