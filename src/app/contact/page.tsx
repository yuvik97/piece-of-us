import type { Metadata } from "next";
import { PageShell } from "@/components/Prose";

export const metadata: Metadata = { title: "Contact" };

export default function Contact() {
  return (
    <PageShell label="Contact" title="Write to us." intro="We read everything. For questions about your piece, include its number or your status link.">
      <h2>General</h2>
      <p><a href="mailto:hello@pieceofus.art">hello@pieceofus.art</a></p>
      <h2>Moderation &amp; appeals</h2>
      <p>To appeal a decision, use “Request a manual review” on your piece’s status page. For anything else about moderation: <a href="mailto:moderation@pieceofus.art">moderation@pieceofus.art</a></p>
      <h2>Copyright &amp; privacy</h2>
      <p>If a piece uses your work without permission, or exposes your personal information, use “Report this piece” on it, or write to <a href="mailto:legal@pieceofus.art">legal@pieceofus.art</a> with the piece number and details. We respond to valid notices promptly.</p>
      <h2>Press</h2>
      <p><a href="mailto:press@pieceofus.art">press@pieceofus.art</a></p>
    </PageShell>
  );
}
