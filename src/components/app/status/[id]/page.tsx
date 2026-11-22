import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { StatusView } from "@/components/add/StatusView";

export const metadata: Metadata = { title: "Your piece", robots: { index: false, follow: false } };

export default async function StatusPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string; cancelled?: string; returned?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  return (
    <>
      <Nav variant="minimal" />
      <main>
        <StatusView id={id} token={sp.t ?? ""} cancelled={!!sp.cancelled} returned={!!sp.returned} />
      </main>
    </>
  );
}
