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

export function NewSaleForm({ variants }: { variants: VariantOption[] }) {
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
    <section className="space-y-3 rounded border bg-white p-4">
      <h2 className="font-medium">New sale</h2>

      {error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
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
                className="min-w-[16rem] flex-1 rounded border px-2 py-1 text-sm"
              >
                <option value={0}>Select item…</option>
                {variants.map((v) => (
                  <option key={v.id} value={v.id} disabled={v.stockQty <= 0}>
                    {v.label} — ₱{v.price} ({v.stockQty} in stock)
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={line.qty}
                onChange={(e) => updateLine(i, { qty: Number(e.target.value) })}
                className={`w-20 rounded border px-2 py-1 text-sm ${overStock ? "border-red-500" : ""}`}
              />
              {overStock && (
                <span className="text-xs text-red-600">
                  only {selected!.stockQty} available
                </span>
              )}
              <button
                type="button"
                onClick={() => removeLine(i)}
                className="text-xs text-gray-500 underline"
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
        className="text-sm text-gray-600 underline hover:text-gray-900"
      >
        + Add item
      </button>

      <div className="flex flex-wrap items-center gap-3 border-t pt-3">
        <input
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
          placeholder="Customer (optional)"
          className="rounded border px-2 py-1 text-sm"
        />
        <span className="text-sm font-medium">Total: ₱{total.toLocaleString()}</span>
        <button
          type="button"
          disabled={isPending}
          onClick={submit}
          className="ml-auto rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Record sale"}
        </button>
      </div>
    </section>
  );
}
