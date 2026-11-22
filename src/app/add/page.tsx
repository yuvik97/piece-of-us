import type { Metadata } from "next";
import { AddFlow } from "@/components/add/AddFlow";
import { Nav } from "@/components/Nav";
import { isValidTile } from "@/lib/grid";

export const metadata: Metadata = { title: "Add your piece", robots: { index: false } };

export default async function AddPage({ searchParams }: { searchParams: Promise<{ tile?: string }> }) {
  const t = Number((await searchParams).tile);
  return (
    <>
      <Nav variant="minimal" />
      <main>
        <AddFlow initialTile={isValidTile(t) ? t : undefined} />
      </main>
    </>
  );
}
