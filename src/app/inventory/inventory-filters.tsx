"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const STOCK_OPTIONS = [
  { value: "", label: "All stock" },
  { value: "low", label: "Low stock" },
  { value: "out", label: "Out of stock" },
];

const EXPIRY_OPTIONS = [
  { value: "", label: "All expiry" },
  { value: "soon", label: "Expiring soon" },
  { value: "expired", label: "Expired" },
];

type AttributeValueOption = {
  id: number;
  value: string;
  attributeName: string;
};

export function InventoryFilters({
  lowStockThreshold,
  expirySoonDays,
  attributeValues,
}: {
  lowStockThreshold: number;
  expirySoonDays: number;
  attributeValues: AttributeValueOption[];
}) {
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

  const stock = searchParams.get("stock") ?? "";
  const expiry = searchParams.get("expiry") ?? "";
  const variant = searchParams.get("variant") ?? "";

  const selectClass =
    "rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none transition-standard focus:border-accent";

  // Group by attribute (e.g. Size, Concentration) so the dropdown reads as
  // sections rather than one flat alphabetical list.
  const groups = new Map<string, AttributeValueOption[]>();
  for (const av of attributeValues) {
    const group = groups.get(av.attributeName) ?? [];
    group.push(av);
    groups.set(av.attributeName, group);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={variant}
        onChange={(e) => setParam("variant", e.target.value)}
        className={selectClass}
        title="Filter by variant (attribute value)"
      >
        <option value="">All variants</option>
        {[...groups.entries()].map(([attributeName, values]) => (
          <optgroup key={attributeName} label={attributeName}>
            {values.map((av) => (
              <option key={av.id} value={av.id}>
                {av.value}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      <select
        value={stock}
        onChange={(e) => setParam("stock", e.target.value)}
        className={selectClass}
        title={`Low stock = ${lowStockThreshold} or fewer on hand`}
      >
        {STOCK_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.value === "low" ? `Low stock (≤${lowStockThreshold})` : o.label}
          </option>
        ))}
      </select>

      <select
        value={expiry}
        onChange={(e) => setParam("expiry", e.target.value)}
        className={selectClass}
        title={`Expiring soon = within ${expirySoonDays} days`}
      >
        {EXPIRY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.value === "soon" ? `Expiring soon (≤${expirySoonDays}d)` : o.label}
          </option>
        ))}
      </select>

      {(stock || expiry || variant) && (
        <button
          onClick={() => {
            const params = new URLSearchParams(searchParams);
            params.delete("stock");
            params.delete("expiry");
            params.delete("variant");
            params.delete("page");
            startTransition(() => router.push(`${pathname}?${params.toString()}`));
          }}
          className="text-xs font-medium text-ink-muted underline decoration-border underline-offset-2 transition-standard hover:text-accent"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
