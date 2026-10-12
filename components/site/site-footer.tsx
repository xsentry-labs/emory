import Link from "next/link";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/#plays", label: "Plays" },
      { href: "/#marketing", label: "SEO and content" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/login", label: "Log in" },
      { href: "/signup", label: "Sign up" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-wash">
      <div className="mx-auto flex max-w-shell flex-wrap justify-between gap-10 px-4 py-12 md:px-8">
        <div className="max-w-xs">
          <p className="font-display text-h3 font-medium">Emory</p>
          <p className="mt-2 text-sm text-mute">Find buyers who need you, and get found by the ones who don&apos;t know you yet.</p>
        </div>
        <div className="flex gap-16">
          {COLUMNS.map((c) => (
            <div key={c.title}>
              <p className="label mb-3">{c.title}</p>
              <ul className="space-y-2 text-sm">
                {c.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-mute hover:text-ink">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-shell px-4 py-4 text-caption text-mute md:px-8">© {new Date().getFullYear()} Emory. Early access.</p>
      </div>
    </footer>
  );
}
