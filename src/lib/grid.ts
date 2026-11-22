/** The canvas: 1,000 × 1,000 equal squares. Tile index is 0-based, piece number is 1-based. */
export const GRID = 1000;
export const TOTAL_TILES = GRID * GRID;
export const PRICE_CENTS = 800;
export const CURRENCY = "USD";

export const tileX = (i: number) => i % GRID;
export const tileY = (i: number) => Math.floor(i / GRID);
export const tileIndex = (x: number, y: number) => y * GRID + x;
export const isValidTile = (i: unknown): i is number =>
  typeof i === "number" && Number.isInteger(i) && i >= 0 && i < TOTAL_TILES;

export const pieceNumber = (i: number) => i + 1;
export const tileFromPieceNumber = (n: number) => n - 1;

export function formatPieceNumber(n: number) {
  return n.toLocaleString("en-US");
}

/** Tile states, as transmitted in the binary overview. */
export const TileState = {
  Available: 0,
  Reserved: 1,
  Pending: 2,
  Published: 3,
  Founding: 4,
} as const;
export type TileState = (typeof TileState)[keyof typeof TileState];
