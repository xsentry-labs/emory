import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
// Fonts are bundled from npm rather than fetched from Google at build time,
// so builds work without network access.
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "./globals.css";

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
    <html lang="en" data-theme={theme}>
      <body className="min-h-screen bg-paper text-mute">{children}</body>
    </html>
  );
}
