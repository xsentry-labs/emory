import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { cookies } from "next/headers";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import "./globals.css";

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-sans",
  display: "swap",
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Emory",
  description: "Your website in, a growth plan out. Emory fixes what hurts search, finds who to sell to, and runs outreach with your approval.",
};

export const viewport: Viewport = {
  themeColor: "#1b1b1c",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = parseTheme(cookies().get(THEME_COOKIE)?.value);
  return (
    <html lang="en" data-theme={theme} className={`${mono.variable} ${sans.variable}`}>
      <body className="min-h-screen bg-paper text-mute">{children}</body>
    </html>
  );
}
