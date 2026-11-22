import "server-only";
import { config } from "./config";
import { formatPieceNumber, pieceNumber } from "./grid";
import type { Submission } from "./repo/types";

type Kind = "in_review" | "approved" | "rejected" | "published" | "refunded" | "removed";

const SUBJECT: Record<Kind, string> = {
  in_review: "Your piece is under review",
  approved: "Your piece is ready to become part of us",
  rejected: "About your piece",
  published: "You’re now a piece of us",
  refunded: "Your $8 has been refunded",
  removed: "Your piece has been removed",
};

function body(kind: Kind, s: Submission, statusUrl: string) {
  const n = formatPieceNumber(pieceNumber(s.tile));
  switch (kind) {
    case "in_review": return `Thank you for your piece for square No. ${n}.\n\nWe're taking a closer look before it joins the mosaic. We'll hold your square while we review and write to you once it's ready. You won't be charged unless your piece is approved.\n\nCheck its status any time: ${statusUrl}`;
    case "approved": return `Good news — your piece for square No. ${n} has been approved.\n\nWe're holding the square for you for the next 48 hours. Complete your $8 payment here: ${statusUrl}`;
    case "rejected": return `Thank you for wanting to be part of PIECE OF US.\n\nYour piece for square No. ${n} doesn't meet our community guidelines${s.publicReason ? `: ${s.publicReason}` : "."}\n\nYou have not been charged. You're welcome to upload a different artwork: ${config.siteUrl}/add?tile=${s.tile}\nCommunity guidelines: ${config.siteUrl}/guidelines`;
    case "published": return `Your piece is now part of the mosaic, permanently.\n\nPiece No. ${n}: ${config.siteUrl}/piece/${pieceNumber(s.tile)}\n\nThank you for being a piece of us.`;
    case "refunded": return `We've refunded your $8 for square No. ${n}. Depending on your bank it can take a few days to appear.\n\nStatus: ${statusUrl}`;
    case "removed": return `Your piece No. ${n} has been removed from the mosaic because it doesn't meet our community guidelines${s.publicReason ? `: ${s.publicReason}` : "."} Your $8 has been refunded.`;
  }
}

/** Sends a decision notice if the contributor left an e-mail. Never throws. */
export async function notify(kind: Kind, s: Submission, statusUrl: string) {
  if (!s.email) return false;
  const text = body(kind, s, statusUrl);
  if (!config.notify.resendKey) {
    console.info(`[notify:dry-run] to=${s.email.replace(/(.).*@/, "$1***@")} subject="${SUBJECT[kind]}"`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${config.notify.resendKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from: config.notify.from, to: [s.email], subject: SUBJECT[kind], text }),
    });
    return res.ok;
  } catch (e) {
    console.error("[notify] failed", e);
    return false;
  }
}
