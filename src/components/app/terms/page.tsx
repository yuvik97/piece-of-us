import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/Prose";

export const metadata: Metadata = { title: "Terms & Conditions" };

export default function Terms() {
  return (
    <PageShell label="Terms & Conditions" title="Terms & Conditions." updated="19 November 2026">
      <p className="note">Draft for launch. These terms must be reviewed by a lawyer qualified in the project owner’s jurisdiction before accepting real payments.</p>

      <h2>1. The project</h2>
      <p>PIECE OF US (“the project”, “we”) is an independent digital artwork made of 1,000,000 equal squares. By adding a piece you take part in that artwork. You are paying a one-time participation fee of US$8.00 for one square — not buying property, a security, a token, or advertising space.</p>

      <h2>2. Your piece</h2>
      <ul>
        <li>You must have the right to share what you upload, and it must follow the <Link href="/guidelines">Community Guidelines</Link>.</li>
        <li>You keep the copyright in your artwork. You grant us a worldwide, non-exclusive, royalty-free licence to display, reproduce and distribute it as part of the project — on the website, in images of the whole mosaic, in exhibitions, press and publications about the project.</li>
        <li>You are responsible for the titles, names and descriptions you provide.</li>
      </ul>

      <h2>3. Moderation</h2>
      <p>Every piece is reviewed — automatically and, where needed, by a person — before payment. We may decline any piece that does not meet the guidelines, and we may remove a published piece that breaks the guidelines or the law, including following a valid report.</p>

      <h2>4. Payment</h2>
      <p>The fee is US$8.00, charged once, through our payment provider. We do not see or store your card details. There is no subscription and nothing recurring.</p>

      <h2>5. Refund policy</h2>
      <ul>
        <li><strong>Rejected before payment:</strong> you are never charged.</li>
        <li><strong>Paid but not published</strong> (for example, the square was completed by someone else at the same moment, or the payment didn’t match): automatic full refund.</li>
        <li><strong>Published, then removed by us</strong> for breaking the guidelines: full refund.</li>
        <li><strong>Charged twice</strong> for the same piece: the duplicate is refunded in full.</li>
        <li>Because your piece goes live immediately at your request, published pieces that remain on the canvas are not otherwise refundable, except where the law of your country gives you a right to a refund.</li>
      </ul>
      <p>Refunds go back to the original payment method and can take several business days to appear.</p>

      <h2>6. Permanence</h2>
      <p>We intend for published pieces to remain for the life of the project. We can’t promise the website will exist forever, but we will make reasonable efforts to preserve the artwork, including archival copies.</p>

      <h2>7. Liability</h2>
      <p>The project is provided as is. To the extent permitted by law, our total liability to you is limited to the amount you paid.</p>

      <h2>8. Law</h2>
      <p>These terms are governed by the laws of the State of Israel, without prejudice to mandatory consumer protections in your country of residence.</p>

      <h2>9. Contact</h2>
      <p>See our <Link href="/contact">contact page</Link>.</p>
    </PageShell>
  );
}
