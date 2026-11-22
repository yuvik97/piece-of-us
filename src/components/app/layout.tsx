import type { Metadata, Viewport } from "next";
import "@fontsource/figtree/400.css";
import "@fontsource/figtree/500.css";
import "@fontsource/figtree/600.css";
import "@fontsource/figtree/700.css";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";
import { config } from "@/lib/config";

export const metadata: Metadata = {
  metadataBase: new URL(config.siteUrl),
  title: { default: "PIECE OF US — A million pieces. One world.", template: "%s — PIECE OF US" },
  description:
    "An independent global art project. One million squares, eight dollars each — every person leaving a small piece of their world in one shared artwork.",
  openGraph: {
    title: "PIECE OF US",
    description: "A million pieces. One world. Eight dollars. One piece of your world.",
    siteName: "PIECE OF US",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#f6f3ee", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-paper text-ink">{children}</body>
    </html>
  );
}
