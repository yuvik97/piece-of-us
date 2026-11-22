import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/Prose";

export const metadata: Metadata = { title: "FAQ" };

const QA: [string, React.ReactNode][] = [
  ["What is PIECE OF US?", "An independent digital art project bringing together one million pieces of human culture and identity in a single shared artwork. Anyone can add one square for $8."],
  ["What should I make?", "Whatever represents a piece of your world: your culture, faith, heritage, a tradition, a memory, your hometown, a word in your language, a photograph, a pattern. We don’t prescribe anything."],
  ["Is every square really equal?", "Yes. Every square is the same size, costs the same, and has the same visual weight. There are no premium positions, no larger squares and no featured contributors."],
  ["Can I choose where my square goes?", "Yes — pick any empty square on the canvas, or let us choose one near the heart of the mosaic for you."],
  ["What is the Founding Collection?", "So the canvas didn’t begin empty, the studio created a founding set of pieces — textiles, patterns, symbols, the word “home” in many languages, architecture, food, landscapes and more. They are clearly labelled, were not purchased, and are not attributed to anyone."],
  ["Do I need an account?", "No. No account, no subscription and no recurring payment. You get a private status link for your piece, and you can leave an e-mail if you’d like to be notified."],
  ["When do I pay?", <>Only after your piece passes moderation. If it needs a closer look, we hold your square while a person reviews it — you pay only once it’s approved. See the <Link href="/guidelines">Community Guidelines</Link>.</>],
  ["What if my piece is rejected?", "You are never charged for a piece that isn’t accepted. You can upload a different artwork for the same square, or request a manual review if you think we got it wrong."],
  ["Can I get a refund?", <>If your piece can’t be published after you’ve paid — for example, it’s removed later, or someone completed the same square at the same instant — you get a full refund automatically. See the <Link href="/terms">Terms</Link>.</>],
  ["Is it permanent?", "Published pieces stay on the canvas for the life of the project. A piece is only removed if it breaks the Community Guidelines or the law — and then it’s refunded."],
  ["What happens to my image?", <>We remove hidden metadata (including GPS location) from every upload. Pieces that aren’t published are stored privately and deleted after 30 days. Read the <Link href="/privacy">Privacy Policy</Link>.</>],
  ["Who is behind this?", "PIECE OF US is an independent art project. It is not a charity, a company campaign, a social network, an NFT, or a political movement."],
];

export default function FAQ() {
  return (
    <PageShell label="FAQ" title="Questions, answered.">
      <div className="divide-y divide-line border-y border-line">
        {QA.map(([q, a]) => (
          <details key={q} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[1.2rem] font-semibold text-ink">
              {q}
              <span className="text-2xl font-normal text-muted transition-transform group-open:rotate-45">+</span>
            </summary>
            <div className="mt-3 max-w-[40rem]">{a}</div>
          </details>
        ))}
      </div>
    </PageShell>
  );
}
