import type { Metadata, Viewport } from "next";
import { Inter, Newsreader } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
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

export const metadata: Metadata = {
  title: "Emory — the only marketing team you'll need",
  description:
    "Emory is an AI marketing team. Eleven agents handle getting found, content, ads, conversations and follow-ups, run by one brain that learns your business. Free analysis, no signup.",
};

export const viewport: Viewport = {
  themeColor: "#0D0D0F",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-screen bg-paper">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
