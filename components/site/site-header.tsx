import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/#plays", label: "Plays" },
  { href: "/#marketing", label: "Marketing" },
  { href: "/pricing", label: "Pricing" },
];

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-shell items-center gap-8 px-4 md:px-8">
        <Link href="/" className="font-display text-h3 font-medium">
          Emory
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-mute md:flex" aria-label="Main">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-ink">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {signedIn ? (
            <Link href="/plays" className={cn(buttonVariants({ size: "sm" }))}>
              Open app
            </Link>
          ) : (
            <>
              <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                Log in
              </Link>
              <Link href="/signup" className={cn(buttonVariants({ size: "sm" }))}>
                Start free
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
