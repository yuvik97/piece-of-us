import type { Metadata } from "next";
import { ExploreClient } from "./ExploreClient";

export const metadata: Metadata = { title: "Explore the mosaic" };

export default async function Explore({ searchParams }: { searchParams: Promise<{ piece?: string }> }) {
  const n = Number((await searchParams).piece);
  return <ExploreClient focus={Number.isInteger(n) && n >= 1 && n <= 1_000_000 ? n - 1 : undefined} />;
}
