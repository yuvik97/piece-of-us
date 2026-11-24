import Link from "next/link";
import { Nav } from "@/components/Nav";

export default function NotFound() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-[1400px] px-5 py-28 md:px-10">
        <p className="label">404</p>
        <h1 className="mt-4 text-headline font-bold">This square is empty.</h1>
        <p className="mt-6 max-w-lg text-[1.1rem] text-ink-2">The page you’re looking for isn’t here — but there’s still plenty of room on the canvas.</p>
        <Link href="/" className="btn btn-primary mt-10">Back to the mosaic</Link>
      </main>
    </>
  );
}
