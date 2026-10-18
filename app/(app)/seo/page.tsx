import { redirect } from "next/navigation";

/** The SEO page became the site section. */
export default function SeoPage() {
  redirect("/site");
}
