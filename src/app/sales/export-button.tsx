"use client";

import { useSearchParams } from "next/navigation";

export function ExportButton() {
  const searchParams = useSearchParams();
  const params = new URLSearchParams();
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  return (
    <a
      href={`/sales/export?${params.toString()}`}
      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink-muted transition-standard hover:border-accent hover:text-accent"
    >
      Export CSV
    </a>
  );
}
