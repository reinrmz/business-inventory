"use client";

import { useState, useTransition } from "react";
import { InventoryRow } from "./inventory-row";
import { bulkUpdateExpiration } from "./actions";

type Variant = {
  id: number;
  productName: string;
  attributeLabel: string;
  price: number;
  cost: number | null;
  stockQty: number;
  reorderLevel: number | null;
  expiresAt: Date | null;
};

export function InventoryTable({
  variants,
  currencySymbol,
  lowStockThreshold,
  expirySoonDays,
  emptyMessage,
}: {
  variants: Variant[];
  currencySymbol: string;
  lowStockThreshold: number;
  expirySoonDays: number;
  emptyMessage: string;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDate, setBulkDate] = useState("");
  const [isPending, startTransition] = useTransition();

  const allSelected = variants.length > 0 && selected.size === variants.length;

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(variants.map((v) => v.id)));
  }

  function applyBulkExpiry() {
    const ids = Array.from(selected);
    startTransition(async () => {
      await bulkUpdateExpiration(ids, bulkDate);
      setSelected(new Set());
      setBulkDate("");
    });
  }

  return (
    <div className="space-y-3">
      {selected.size > 0 && (
        <div className="label-card flex flex-wrap items-center gap-3 px-4 py-3">
          <span className="text-sm font-medium">
            {selected.size} variant{selected.size === 1 ? "" : "s"} selected
          </span>
          <input
            type="date"
            value={bulkDate}
            onChange={(e) => setBulkDate(e.target.value)}
            className="rounded border border-border bg-bg px-2 py-1 text-sm outline-none focus:border-accent"
          />
          <button
            onClick={applyBulkExpiry}
            disabled={isPending || bulkDate === ""}
            className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink disabled:opacity-50"
          >
            {isPending ? "Applying…" : "Set expiration"}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-sm text-ink-muted hover:text-accent"
          >
            Clear selection
          </button>
        </div>
      )}

      <table className="w-full text-sm">
        <thead className="border-b border-border bg-surface-alt text-left text-xs font-semibold uppercase tracking-wide text-accent">
          <tr>
            <th className="px-5 py-3">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="h-4 w-4 rounded border-border accent-accent"
                aria-label="Select all variants on this page"
              />
            </th>
            <th className="px-5 py-3">Product</th>
            <th className="px-5 py-3">Variant</th>
            <th className="px-5 py-3">Stock</th>
            <th className="px-5 py-3">Price / Cost</th>
            <th className="px-5 py-3">Expiration</th>
            <th className="px-5 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {variants.map((v, i) => (
            <InventoryRow
              key={v.id}
              striped={i % 2 === 1}
              currencySymbol={currencySymbol}
              lowStockThreshold={lowStockThreshold}
              expirySoonDays={expirySoonDays}
              variant={v}
              selected={selected.has(v.id)}
              onToggleSelect={toggleOne}
            />
          ))}
          {variants.length === 0 && (
            <tr>
              <td colSpan={7} className="px-5 py-10 text-center text-ink-muted">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
