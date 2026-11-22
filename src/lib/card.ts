/* Personalised participation card (1080×1350 PNG), drawn in the browser. */
import { formatPieceNumber, GRID } from "./grid";

interface CardInput {
  pieceNumber: number;
  art: CanvasImageSource;
  title?: string | null;
  name?: string | null;
  country?: string | null;
  date?: string | null;
  url: string;
}

export async function makeCard(i: CardInput): Promise<Blob> {
  await document.fonts?.ready;
  const W = 1080, H = 1350, M = 96;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const c = cv.getContext("2d")!;
  c.fillStyle = "#f6f3ee";
  c.fillRect(0, 0, W, H);
  c.fillStyle = "#1c1b19";
  c.font = '700 40px "Figtree", sans-serif';
  c.textBaseline = "alphabetic";
  c.fillText("PIECE OF US.", M, M + 20);
  c.font = '500 22px "IBM Plex Mono", monospace';
  c.textAlign = "right";
  c.fillStyle = "#6f6a62";
  c.fillText(`NO. ${formatPieceNumber(i.pieceNumber)}`, W - M, M + 16);
  c.textAlign = "left";

  const A = 680, ax = M, ay = 170;
  c.save();
  c.shadowColor = "rgba(0,0,0,.18)";
  c.shadowBlur = 40;
  c.shadowOffsetY = 18;
  c.fillStyle = "#fff";
  c.fillRect(ax, ay, A, A);
  c.restore();
  c.drawImage(i.art, ax, ay, A, A);

  // location on the canvas
  const mx = ax + A + 40, mw = W - M - mx;
  c.fillStyle = "#e9e4dc";
  c.fillRect(mx, ay, mw, mw);
  const x = ((i.pieceNumber - 1) % GRID) / GRID, y = Math.floor((i.pieceNumber - 1) / GRID) / GRID;
  c.fillStyle = "#d9441c";
  c.beginPath();
  c.arc(mx + x * mw, ay + y * mw, 6, 0, Math.PI * 2);
  c.fill();
  c.font = '400 15px "IBM Plex Mono", monospace';
  c.fillStyle = "#6f6a62";
  wrap(c, "Its place among 1,000,000", mx, ay + mw + 30, mw, 20);

  let ty = ay + A + 92;
  c.fillStyle = "#1c1b19";
  c.font = '600 56px "Figtree", sans-serif';
  ty = wrap(c, i.title || "Untitled", M, ty, W - 2 * M, 60, 2);
  const by = [i.name, i.country].filter(Boolean).join(" — ");
  if (by) {
    c.font = 'italic 40px "Instrument Serif", serif';
    c.fillStyle = "#3a3834";
    ty = wrap(c, by, M, ty + 14, W - 2 * M, 44, 1);
  }
  c.fillStyle = "#1c1b19";
  c.fillRect(M, H - M - 70, W - 2 * M, 1);
  c.font = '500 22px "Figtree", sans-serif';
  c.fillText("A million pieces. One world.", M, H - M - 24);
  c.font = '400 18px "IBM Plex Mono", monospace';
  c.fillStyle = "#6f6a62";
  c.textAlign = "right";
  c.fillText(i.url.replace(/^https?:\/\//, ""), W - M, H - M - 24);
  if (i.date) c.fillText(i.date, W - M, H - M - 90 + 0);
  return new Promise((res) => cv.toBlob((b) => res(b!), "image/png"));
}

function wrap(c: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number, lines = 3) {
  const words = text.split(/\s+/);
  let line = "", n = 0;
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (c.measureText(t).width > max && line) {
      c.fillText(line, x, y);
      y += lh;
      line = w;
      if (++n >= lines - 1) break;
    } else line = t;
  }
  if (line) {
    c.fillText(line, x, y);
    y += lh;
  }
  return y;
}

export function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
