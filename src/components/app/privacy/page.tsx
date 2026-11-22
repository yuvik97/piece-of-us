import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/Prose";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function Privacy() {
  return (
    <PageShell label="Privacy Policy" title="Privacy Policy." intro="We collect as little as we can, keep it only as long as we need it, and never sell it." updated="19 November 2026">
      <p className="note">Draft for launch — to be reviewed by a privacy lawyer (Israeli Privacy Protection Law, GDPR for EU/UK visitors).</p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Your artwork</strong> and anything you choose to add: title, display name, country, description. All optional.</li>
        <li><strong>An e-mail address</strong>, only if you give one, used only to tell you about your piece.</li>
        <li><strong>Public contact details</strong> (Instagram, e-mail, phone), only if you choose to add them. They are displayed on your piece so visitors can reach you; ask us to remove them at any time.</li>
        <li><strong>A one-way hash of your IP address</strong>, to prevent abuse (rate limits, duplicate reports). We never store the address itself.</li>
        <li><strong>Payment records</strong> from our payment provider: an order reference, amount and status. We never receive your card details.</li>
      </ul>
      <p>We never ask for your religion, ethnicity or other sensitive information. If your artwork expresses these, it’s because you chose to share them.</p>

      <h2>Images</h2>
      <p>Every upload is re-encoded on our servers, which removes hidden metadata such as GPS location, camera details and timestamps. Images are kept privately until they are approved and paid for; only published pieces are public.</p>

      <h2>Moderation</h2>
      <p>To check pieces against our <Link href="/guidelines">Community Guidelines</Link>, the image and its text are analysed on our servers by automated moderation services (currently Anthropic and, optionally, OpenAI), acting as processors on our behalf and not using your content to train their models under their API terms. Moderators may view unpublished pieces to make decisions.</p>

      <h2>How long we keep things</h2>
      <ul>
        <li><strong>Published pieces:</strong> for the life of the project.</li>
        <li><strong>Pieces not published</strong> (not accepted, expired or removed): images deleted 30 days after the final decision.</li>
        <li><strong>E-mail addresses:</strong> deleted 30 days after a final decision on your piece.</li>
        <li><strong>IP hashes:</strong> deleted after 90 days.</li>
        <li><strong>Reports:</strong> details deleted after one year.</li>
        <li><strong>Moderation and payment records:</strong> kept as long as needed for legal, tax and accounting obligations.</li>
      </ul>

      <h2>Your rights</h2>
      <p>You can ask to see, correct or delete your data, or to remove a published piece, by writing to us via the <Link href="/contact">contact page</Link> with your piece number or status link.</p>

      <h2>Cookies</h2>
      <p>The public website uses no tracking or advertising cookies. A strictly necessary cookie is used only for the private admin area.</p>
    </PageShell>
  );
}
