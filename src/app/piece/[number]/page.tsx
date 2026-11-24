import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArtistContact, PieceArtwork, PieceMeta, ReportPiece, ShareButton } from "@/components/ArtworkOverlay";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { formatPieceNumber, isValidTile, tileFromPieceNumber } from "@/lib/grid";
import { getRepo } from "@/lib/repo";

export const dynamic = "force-dynamic";

async function get(numberStr: string) {
  const n = Number(numberStr);
  const tile = tileFromPieceNumber(n);
  if (!Number.isInteger(n) || !isValidTile(tile)) return null;
  const piece = await getRepo().publicPiece(tile);
  return piece ? { n, piece } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ number: string }> }): Promise<Metadata> {
  const r = await get((await params).number);
  if (!r) return { title: "Piece not found" };
  const title = `${r.piece.title || "Untitled"} — No. ${formatPieceNumber(r.n)}`;
  const by = [r.piece.displayName, r.piece.country].filter(Boolean).join(", ");
  return {
    title,
    description: r.piece.founding ? "From the Founding Collection of PIECE OF US." : `A piece of PIECE OF US${by ? ` by ${by}` : ""}.`,
    openGraph: { title, images: r.piece.imageUrl ? [{ url: r.piece.imageUrl, width: 1024, height: 1024 }] : undefined },
  };
}

export default async function PiecePage({ params }: { params: Promise<{ number: string }> }) {
  const r = await get((await params).number);
  if (!r) notFound();
  const { n, piece } = r;
  return (
    <>
      <Nav />
      <main className="mx-auto grid max-w-[1400px] gap-10 px-5 pb-24 pt-6 md:grid-cols-12 md:gap-16 md:px-10 md:pt-12">
        <div className="md:col-span-7">
          <div className="bg-paper-2 p-4 md:p-10">
            <PieceArtwork piece={piece} className="shadow-[0_30px_70px_-35px_rgba(0,0,0,.5)]" />
          </div>
        </div>
        <div className="flex flex-col md:col-span-5 md:pt-6">
          <p className="label">{piece.founding ? "Founding Collection" : "Piece"} · No. {formatPieceNumber(n)}</p>
          <h1 className="mt-4 text-[clamp(2.4rem,4.6vw,4rem)] font-bold leading-[0.98] tracking-[-0.035em]">{piece.title || "Untitled"}</h1>
          {piece.description && <p className="mt-6 font-serif text-[1.5rem] leading-snug text-ink-2">{piece.description}</p>}
          <div className="rule my-8" />
          <PieceMeta piece={piece} number={n} />
          <ArtistContact piece={piece} />
          {piece.founding && (
            <p className="mt-6 text-[0.88rem] leading-relaxed text-muted">
              Created by the PIECE OF US studio to open the canvas. Founding pieces were not purchased and are not credited to any contributor.
            </p>
          )}
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href={`/explore?piece=${n}`} className="btn btn-primary btn-sm">See it in the mosaic</Link>
            <ShareButton number={n} title={piece.title || "A piece"} />
          </div>
          <div className="mt-10"><ReportPiece number={n} /></div>
        </div>
      </main>
      <Footer />
    </>
  );
}
