/** Mirrors the frontend's lib/mock-data.ts companyFromDomain — same simple heuristic, kept in sync deliberately rather than shared across the two deploy targets. */
export function companyFromDomain(url: string): string {
  const host = safeHostname(url);
  const root = host.split(".")[0]?.replace(/[-_]/g, " ") ?? "your company";
  return root
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
