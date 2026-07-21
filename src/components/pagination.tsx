import Link from "next/link";

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-disabled={disabled}
      className={`rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-standard ${
        disabled
          ? "pointer-events-none text-ink-muted opacity-40"
          : "text-ink-muted hover:border-accent hover:text-accent"
      }`}
    >
      {children}
    </Link>
  );
}

export function Pagination({
  page,
  pageCount,
  basePath,
  searchParams,
}: {
  page: number;
  pageCount: number;
  basePath: string;
  searchParams: Record<string, string | undefined>;
}) {
  if (pageCount <= 1) return null;

  function hrefFor(p: number) {
    const params = new URLSearchParams(
      Object.entries(searchParams).filter(([, v]) => v !== undefined) as [string, string][],
    );
    params.set("page", String(p));
    return `${basePath}?${params.toString()}`;
  }

  const atStart = page <= 1;
  const atEnd = page >= pageCount;

  return (
    <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm">
      <span className="text-ink-muted">
        Page {page} of {pageCount}
      </span>
      <div className="flex gap-2">
        <PageLink href={hrefFor(1)} disabled={atStart}>
          First
        </PageLink>
        <PageLink href={hrefFor(Math.max(1, page - 1))} disabled={atStart}>
          Previous
        </PageLink>
        <PageLink href={hrefFor(Math.min(pageCount, page + 1))} disabled={atEnd}>
          Next
        </PageLink>
        <PageLink href={hrefFor(pageCount)} disabled={atEnd}>
          Last
        </PageLink>
      </div>
    </div>
  );
}
