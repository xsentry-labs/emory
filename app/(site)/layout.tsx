import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { currentUser } from "@/lib/request-db";

export const dynamic = "force-dynamic";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <SiteHeader signedIn={currentUser() !== null} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
