import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/Prose";
import { CONFIRM_TEXT } from "@/lib/copy";

export const metadata: Metadata = { title: "Community Guidelines" };

export default function Guidelines() {
  return (
    <PageShell
      label="Community Guidelines"
      title="Different worlds. Shared respect."
      intro="PIECE OF US celebrates the things that make us different and the space we share together. Every piece has an equal place in our artwork, regardless of culture, religion, nationality, or background."
      updated="19 November 2026"
    >
      <div className="-mt-4 mb-14 border-y border-ink py-10 text-center">
        <p className="label">Our guiding principle</p>
        <p className="mt-4 text-[clamp(1.8rem,3.4vw,2.8rem)] font-bold leading-[1.05] tracking-[-0.03em] text-ink">Express who you are,<br />not who you are against.</p>
      </div>

      <h2>Welcome here</h2>
      <p>We want this canvas to hold the full range of human identity. Peaceful personal, cultural, national and religious expression is welcome, including:</p>
      <ul>
        <li>Religious symbols and imagery, of any faith</li>
        <li>National flags</li>
        <li>Cultural and traditional clothing</li>
        <li>Heritage and historical references</li>
        <li>Religious texts and prayers, in any language</li>
        <li>Traditional food</li>
        <li>Architecture and landscapes</li>
        <li>Personal and family photographs, shared with permission</li>
        <li>Original illustrations and paintings</li>
        <li>Abstract artwork</li>
        <li>Cultural patterns and textiles</li>
        <li>Messages of peace, unity and coexistence</li>
        <li>Personal beliefs and identity</li>
        <li>Artistic expression in any language or script</li>
      </ul>
      <p>A religious symbol, a flag, a prayer or a culturally sensitive image is never rejected for being what it is. Every culture, religion, nationality and community is treated the same way — no one gets special treatment, and no one gets extra suspicion.</p>

      <h2>Not allowed</h2>
      <p>These rules apply to images, to any text inside them, and to titles, descriptions and display names.</p>
      <ul>
        <li>Racism, antisemitism, Islamophobia, xenophobia and any other hate speech</li>
        <li>Discrimination or exclusion based on religion, ethnicity, race, nationality or any other part of someone’s identity</li>
        <li>Terrorist or extremist propaganda, glorification of terrorist organisations, and symbols used to promote hatred</li>
        <li>Calls for violence, genocide, persecution or ethnic cleansing</li>
        <li>Threats, harassment, bullying and targeted humiliation</li>
        <li>Pornography, nudity and sexually explicit content</li>
        <li>Any sexual exploitation of minors — reported to the authorities</li>
        <li>Graphic violence, blood, gore and disturbing imagery</li>
        <li>Content that promotes or encourages suicide or self-harm</li>
        <li>Political propaganda, election campaigns and party advertising</li>
        <li>Commercial advertising and promotion, promotional QR codes, links and spam</li>
        <li>Other people’s private information</li>
        <li>Impersonation, fraud and scams</li>
        <li>Artwork that isn’t yours to share, where infringement is identified</li>
        <li>Anything else that is illegal</li>
      </ul>
      <p>Contact details you add in the optional “Let people reach you” fields — your Instagram, a public e-mail or phone number — are welcome there. Links, handles and phone numbers placed inside the artwork, the title or the description are treated as promotion.</p>
      <p>The line we draw is between expressing an identity and attacking one. A flag held with pride belongs here; a flag used to demean someone else does not.</p>

      <h2>How moderation works</h2>
      <p>Every submission is checked <strong>before you pay</strong>. Our system looks at the image as a whole — including any text inside it, in any language — together with the title, description and name. It considers meaning and context, not just keywords.</p>
      <p>Each piece receives one of three outcomes:</p>
      <ul>
        <li><strong>Approved</strong> — your piece is ready. You pay $8 and it goes live immediately.</li>
        <li><strong>Under review</strong> — when context matters, or we’re not sure, a person looks at it. We hold your square for 72 hours meanwhile, and you aren’t charged unless it’s approved.</li>
        <li><strong>Not accepted</strong> — the piece clearly doesn’t meet these guidelines. You are not charged, and you can upload something else.</li>
      </ul>
      <p>Cultural, religious, historical and political imagery that is ambiguous is always sent to a person rather than rejected automatically. If our moderation service is ever unavailable, pieces wait for a person — nothing is published without being checked.</p>
      <p>Published pieces can be reported by anyone using “Report this piece”. Reports are read by people; a piece is never removed just because it received many reports. If a published piece is removed, your $8 is refunded in full.</p>

      <h2>Appeals</h2>
      <p>If an automated decision doesn’t accept your piece and you think we got it wrong, use <strong>Request a manual review</strong> on your piece’s status page. You can add a note about its meaning or context. A person will decide, usually within a few days, and we’ll hold your square while they do. You can also write to us at any time through our <Link href="/contact">contact page</Link>.</p>

      <h2>Before you upload</h2>
      <p>Every contributor confirms:</p>
      <p className="note"><strong>“{CONFIRM_TEXT}”</strong></p>
    </PageShell>
  );
}
