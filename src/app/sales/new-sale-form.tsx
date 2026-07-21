"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordSale } from "./actions";

type VariantOption = {
  id: number;
  label: string;
  price: number;
  stockQty: number;
};

type Line = { variantId: number; qty: number };

export function NewSaleForm({
  variants,
  currencySymbol,
}: {
  variants: VariantOption[];
  currencySymbol: string;
}) {
  const [lines, setLines] = useState<Line[]>([{ variantId: 0, qty: 1 }]);
  const [customer, setCustomer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const variantById = new Map(variants.map((v) => [v.id, v]));

  const total = lines.reduce((sum, l) => {
    const v = variantById.get(l.variantId);
    return v ? sum + v.price * l.qty : sum;
  }, 0);

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { variantId: 0, qty: 1 }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await recordSale(lines, customer.trim() || null, null);
        setLines([{ variantId: 0, qty: 1 }]);
        setCustomer("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to record sale.");
      }
    });
  }

  return (
    <section className="label-card space-y-4 p-5">
      <h2 className="font-display text-lg font-bold">New sale</h2>

      {error && (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>
      )}

      <div className="space-y-2">
        {lines.map((line, i) => {
          const selected = variantById.get(line.variantId);
          const overStock = selected ? line.qty > selected.stockQty : false;
          return (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <select
                value={line.variantId}
                onChange={(e) => updateLine(i, { variantId: Number(e.target.value) })}
                className="min-w-[16rem] flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none transition-standard focus:border-accent"
              >
                <option value={0}>Select item…</option>
                {variants.map((v) => (
                  <option key={v.id} value={v.id} disabled={v.stockQty <= 0}>
                    {v.label} — {currencySymbol}{v.price} ({v.stockQty} in stock)
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={line.qty}
                onChange={(e) => updateLine(i, { qty: Number(e.target.value) })}
                className={`tnum w-20 rounded-lg border bg-bg px-3 py-2 text-sm outline-none transition-standard focus:border-accent ${
                  overStock ? "border-danger" : "border-border"
                }`}
              />
              {overStock && (
                <span className="text-xs text-danger">only {selected!.stockQty} available</span>
              )}
              <button
                type="button"
                onClick={() => removeLine(i)}
                className="text-xs text-ink-muted underline decoration-border underline-offset-2"
              >
                Remove
              </button>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={addLine}
        className="text-sm font-medium text-accent transition-standard hover:opacity-80"
      >
        + Add item
      </button>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <input
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
          placeholder="Customer (optional)"
          className="rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none transition-standard focus:border-accent"
        />
        <span className="tnum text-sm font-medium">Total: {currencySymbol}{total.toLocaleString()}</span>
        <button
          type="button"
          disabled={isPending}
          onClick={submit}
          className="ml-auto rounded-lg bg-accent px-5 py-2 text-sm font-medium text-accent-ink transition-standard hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Record sale"}
        </button>
      </div>
    </section>
  );
}
