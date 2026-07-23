"use client";

import { useState } from "react";
import { createVariant } from "./actions";

type AttributeValue = { id: number; value: string };
type Attribute = { id: number; name: string; unit: string | null; values: AttributeValue[] };

export function AddVariantForm({
  productId,
  attributes,
}: {
  productId: number;
  attributes: Attribute[];
}) {
  const [open, setOpen] = useState(false);
  const [newValueFor, setNewValueFor] = useState<Record<number, boolean>>({});

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-ink-muted underline decoration-border underline-offset-2 transition-standard hover:text-accent"
      >
        + Add variant
      </button>
    );
  }

  return (
    <form
      action={async (formData) => {
        await createVariant(formData);
        setOpen(false);
        setNewValueFor({});
      }}
      className="w-full space-y-2 rounded-lg border border-border bg-bg p-3"
    >
      <input type="hidden" name="productId" value={productId} />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {attributes.map((attr) => (
          <div key={attr.id} className="space-y-1">
            <label className="text-xs font-medium text-ink-muted">
              {attr.name}
              {attr.unit ? ` (${attr.unit})` : ""}
            </label>
            {newValueFor[attr.id] ? (
              <div className="flex gap-1">
                <input
                  name={`attrNew_${attr.id}`}
                  placeholder="New value"
                  className="w-full rounded border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={() => setNewValueFor((s) => ({ ...s, [attr.id]: false }))}
                  className="text-xs text-ink-muted"
                  title="Pick existing value instead"
                >
                  ×
                </button>
              </div>
            ) : (
              <select
                name={`attrValue_${attr.id}`}
                onChange={(e) => {
                  if (e.target.value === "__new__") {
                    setNewValueFor((s) => ({ ...s, [attr.id]: true }));
                  }
                }}
                className="w-full rounded border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
              >
                <option value="">None</option>
                {attr.values.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.value}
                  </option>
                ))}
                <option value="__new__">+ New value…</option>
              </select>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <div className="space-y-1">
          <label className="text-xs font-medium text-ink-muted">SKU</label>
          <input
            name="sku"
            placeholder="Optional"
            className="w-full rounded border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-ink-muted">Price</label>
          <input
            name="price"
            type="number"
            step="1"
            placeholder="Required"
            required
            className="w-full rounded border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-ink-muted">Cost</label>
          <input
            name="cost"
            type="number"
            step="1"
            placeholder="Optional"
            className="w-full rounded border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-ink-muted">Stock qty</label>
          <input
            name="stockQty"
            type="number"
            step="1"
            defaultValue={0}
            className="w-full rounded border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-ink-muted">Reorder at</label>
          <input
            name="reorderLevel"
            type="number"
            step="1"
            placeholder="Optional"
            className="w-full rounded border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button className="rounded bg-accent px-3 py-1 text-xs font-medium text-accent-ink">
          Add variant
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-ink-muted">
          Cancel
        </button>
      </div>
    </form>
  );
}
