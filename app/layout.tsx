import type { Metadata, Viewport } from "next";
import { Inter, Newsreader } from "next/font/google";
import { Nav } from "@/components/nav";
import "./globals.css";

const display = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Emory Growth",
  description: "A growth agent that finds, qualifies and ranks leads, runs outreach with your approval, and follows up until they book a conversation.",
};

export const viewport: Viewport = {
  themeColor: "#0D0D0F",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-screen bg-paper">
        <Nav />
        <main className="mx-auto max-w-shell px-4 pb-16 pt-8 md:px-8">{children}</main>
      </body>
    </html>
  );
}
