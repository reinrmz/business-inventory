"use client";

import { useState } from "react";
import { updatePricing, adjustStock, getPriceHistory, updateExpiration } from "./actions";

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

// Days from today until `d` (UTC-date compared to UTC-date). Negative = past.
function daysUntil(d: Date) {
  const DAY = 24 * 60 * 60 * 1000;
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const target = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((target - todayUtc) / DAY);
}

// "YYYY-MM-DD" from a Date's UTC parts, for <input type="date"> defaultValue.
function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

type HistoryEntry = {
  id: number;
  price: number;
  cost: number | null;
  changedAt: Date;
};

export function InventoryRow({
  variant,
  currencySymbol,
  lowStockThreshold,
  expirySoonDays,
}: {
  variant: Variant;
  currencySymbol: string;
  lowStockThreshold: number;
  expirySoonDays: number;
}) {
  const [editingPrice, setEditingPrice] = useState(false);
  const [editingExpiry, setEditingExpiry] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Low if at/below the business low-stock threshold, or at/below this SKU's
  // own reorder level when one is set (per-SKU override still honored).
  const lowStock =
    variant.stockQty <= lowStockThreshold ||
    (variant.reorderLevel !== null && variant.stockQty <= variant.reorderLevel);

  const expiryDays = variant.expiresAt !== null ? daysUntil(variant.expiresAt) : null;
  const expired = expiryDays !== null && expiryDays < 0;
  const expiringSoon = expiryDays !== null && expiryDays >= 0 && expiryDays <= expirySoonDays;

  async function toggleHistory() {
    if (showHistory) {
      setShowHistory(false);
      return;
    }
    setShowHistory(true);
    if (history === null) {
      setLoadingHistory(true);
      const rows = await getPriceHistory(variant.id);
      setHistory(rows);
      setLoadingHistory(false);
    }
  }

  return (
    <>
      <tr className="border-b border-border align-top last:border-0">
        <td className="px-5 py-3 font-medium">{variant.productName}</td>
        <td className="px-5 py-3 text-ink-muted">{variant.attributeLabel}</td>
        <td className="tnum px-5 py-3">
          <span className={lowStock ? "font-semibold text-danger" : ""}>{variant.stockQty}</span>
          {lowStock && (
            <span className="ml-2 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">
              low
            </span>
          )}
        </td>
        <td className="px-5 py-3">
          {editingPrice ? (
            <form
              action={async (formData) => {
                await updatePricing(formData);
                setEditingPrice(false);
                setHistory(null);
              }}
              className="flex flex-wrap items-center gap-1"
            >
              <input type="hidden" name="variantId" value={variant.id} />
              <input
                name="price"
                type="number"
                step="1"
                defaultValue={variant.price}
                required
                className="w-20 rounded border border-border bg-bg px-1.5 py-1 text-xs outline-none focus:border-accent"
              />
              <input
                name="cost"
                type="number"
                step="1"
                defaultValue={variant.cost ?? ""}
                placeholder="cost"
                className="w-20 rounded border border-border bg-bg px-1.5 py-1 text-xs outline-none focus:border-accent"
              />
              <button className="rounded bg-accent px-2 py-1 text-xs font-medium text-accent-ink">
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingPrice(false)}
                className="text-xs text-ink-muted"
              >
                Cancel
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditingPrice(true)}
                className="tnum transition-standard hover:text-accent"
              >
                {currencySymbol}{variant.price}
                {variant.cost !== null && (
                  <span className="ml-1 text-xs text-ink-muted">(cost {currencySymbol}{variant.cost})</span>
                )}
              </button>
              <button
                onClick={toggleHistory}
                className="text-xs text-ink-muted underline decoration-border underline-offset-2 transition-standard hover:text-accent"
              >
                history
              </button>
            </div>
          )}
        </td>
        <td className="px-5 py-3">
          {editingExpiry ? (
            <form
              action={async (formData) => {
                await updateExpiration(formData);
                setEditingExpiry(false);
              }}
              className="flex flex-wrap items-center gap-1"
            >
              <input type="hidden" name="variantId" value={variant.id} />
              <input
                name="expiresAt"
                type="date"
                defaultValue={variant.expiresAt ? toDateInput(variant.expiresAt) : ""}
                className="rounded border border-border bg-bg px-1.5 py-1 text-xs outline-none focus:border-accent"
              />
              <button className="rounded bg-accent px-2 py-1 text-xs font-medium text-accent-ink">
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingExpiry(false)}
                className="text-xs text-ink-muted"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              onClick={() => setEditingExpiry(true)}
              className="transition-standard flex items-center gap-2 hover:text-accent"
            >
              {variant.expiresAt === null ? (
                <span className="text-xs text-ink-muted underline decoration-border underline-offset-2">
                  Set date
                </span>
              ) : (
                <>
                  <span
                    className={`tnum text-xs ${
                      expired ? "font-semibold text-danger" : expiringSoon ? "font-semibold text-gold" : ""
                    }`}
                  >
                    {toDateInput(variant.expiresAt)}
                  </span>
                  {expired && (
                    <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">
                      expired
                    </span>
                  )}
                  {expiringSoon && (
                    <span className="rounded-full bg-gold-soft px-2 py-0.5 text-xs font-medium text-gold">
                      soon
                    </span>
                  )}
                </>
              )}
            </button>
          )}
        </td>
        <td className="px-5 py-3">
          {adjusting ? (
            <form
              action={async (formData) => {
                await adjustStock(formData);
                setAdjusting(false);
              }}
              className="flex flex-wrap items-center gap-1"
            >
              <input type="hidden" name="variantId" value={variant.id} />
              <input
                name="delta"
                type="number"
                placeholder="+/-"
                required
                className="w-16 rounded border border-border bg-bg px-1.5 py-1 text-xs outline-none focus:border-accent"
              />
              <select
                name="reason"
                className="rounded border border-border bg-bg px-1.5 py-1 text-xs outline-none focus:border-accent"
              >
                <option value="restock">Restock</option>
                <option value="correction">Correction</option>
              </select>
              <button className="rounded bg-accent px-2 py-1 text-xs font-medium text-accent-ink">
                Apply
              </button>
              <button
                type="button"
                onClick={() => setAdjusting(false)}
                className="text-xs text-ink-muted"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              onClick={() => setAdjusting(true)}
              className="text-xs font-medium text-ink-muted underline decoration-border underline-offset-2 transition-standard hover:text-accent"
            >
              Adjust stock
            </button>
          )}
        </td>
      </tr>
      {showHistory && (
        <tr className="border-b border-border bg-bg last:border-0">
          <td colSpan={6} className="px-5 py-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
              Price history — {variant.productName} ({variant.attributeLabel})
            </p>
            {loadingHistory && <p className="text-xs text-ink-muted">Loading…</p>}
            {!loadingHistory && history && history.length === 0 && (
              <p className="text-xs text-ink-muted">No price changes recorded yet.</p>
            )}
            {!loadingHistory && history && history.length > 0 && (
              <ul className="space-y-1">
                {history.map((h) => (
                  <li key={h.id} className="tnum flex gap-3 text-xs">
                    <span className="font-medium">{currencySymbol}{h.price}</span>
                    <span className="text-ink-muted">
                      {h.cost !== null ? `cost ${currencySymbol}${h.cost}` : "cost —"}
                    </span>
                    <span className="text-ink-muted">
                      {new Date(h.changedAt).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
