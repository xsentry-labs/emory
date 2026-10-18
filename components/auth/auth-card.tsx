import Link from "next/link";

export function AuthCard({
  title,
  subtitle,
  error,
  footer,
  children,
}: {
  title: string;
  subtitle: string;
  error?: string;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <Link href="/" className="mb-8 font-mono text-base tracking-[0.26em] text-ink">
        emory
      </Link>
      <h1 className="text-[28px] font-semibold">{title}</h1>
      <p className="mb-6 mt-2 text-mute">{subtitle}</p>
      {error ? (
        <p role="alert" className="mb-4 border border-dashed border-danger/60 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {children}
      <p className="mt-6 text-sm text-mute">{footer}</p>
    </div>
  );
}
