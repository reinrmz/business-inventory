"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";

type Category = { id: number; name: string };

export function ProductsFilters({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page"); // reset to page 1 on filter change
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  const category = searchParams.get("category") ?? "";

  const selectClass =
    "rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none transition-standard focus:border-accent";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={category}
        onChange={(e) => setParam("category", e.target.value)}
        className={selectClass}
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      {category && (
        <button
          onClick={() => {
            const params = new URLSearchParams(searchParams);
            params.delete("category");
            params.delete("page");
            startTransition(() => router.push(`${pathname}?${params.toString()}`));
          }}
          className="text-xs font-medium text-ink-muted underline decoration-border underline-offset-2 transition-standard hover:text-accent"
        >
          Clear filter
        </button>
      )}
    </div>
  );
}
