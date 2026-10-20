import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-3 px-6">
      <span className="tag">404</span>
      <h1 className="text-2xl font-semibold">nothing here</h1>
      <p>the page may have moved, or the link is wrong.</p>
      <Link href="/" className="btn self-start">
        go home
      </Link>
    </div>
  );
}
