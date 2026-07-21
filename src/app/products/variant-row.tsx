"use client";

import { useState } from "react";
import { updateVariant, setVariantActive } from "./actions";

type AttributeValue = { id: number; value: string };
type Attribute = { id: number; name: string; unit: string | null; values: AttributeValue[] };
type VariantAttr = { attributeValue: { id: number; attributeId: number; value: string } };
type Variant = {
  id: number;
  sku: string | null;
  active: boolean;
  attributes: VariantAttr[];
};

export function VariantRow({
  variant,
  attributes,
}: {
  variant: Variant;
  attributes: Attribute[];
}) {
  const [editing, setEditing] = useState(false);
  const [newValueFor, setNewValueFor] = useState<Record<number, boolean>>({});

  const label = variant.attributes.map((a) => a.attributeValue.value).join(" · ");
  const currentValueByAttr: Record<number, number> = {};
  for (const a of variant.attributes) {
    currentValueByAttr[a.attributeValue.attributeId] = a.attributeValue.id;
  }

  if (!editing) {
    return (
      <li className={`flex items-center gap-2 ${variant.active ? "" : "opacity-50"}`}>
        <button
          onClick={() => setEditing(true)}
          className="text-left transition-standard hover:text-accent"
        >
          {label || "(no attributes)"}
          {variant.sku ? ` · ${variant.sku}` : ""}
          {!variant.active ? " · retired" : ""}
        </button>
        <form action={setVariantActive}>
          <input type="hidden" name="variantId" value={variant.id} />
          <input type="hidden" name="active" value={(!variant.active).toString()} />
          <button className="text-ink-muted underline decoration-border underline-offset-2 transition-standard hover:text-accent">
            {variant.active ? "retire" : "reactivate"}
          </button>
        </form>
      </li>
    );
  }

  return (
    <li className="rounded-lg border border-border bg-bg p-2">
      <form
        action={async (formData) => {
          await updateVariant(formData);
          setEditing(false);
          setNewValueFor({});
        }}
        className="space-y-2"
      >
        <input type="hidden" name="variantId" value={variant.id} />

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
                  >
                    ×
                  </button>
                </div>
              ) : (
                <select
                  name={`attrValue_${attr.id}`}
                  defaultValue={currentValueByAttr[attr.id] ?? ""}
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

        <div className="flex items-center gap-2">
          <input
            name="sku"
            defaultValue={variant.sku ?? ""}
            placeholder="SKU (optional)"
            className="rounded border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
          />
          <button className="rounded bg-accent px-3 py-1 text-xs font-medium text-accent-ink">
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setNewValueFor({});
            }}
            className="text-xs text-ink-muted"
          >
            Cancel
          </button>
        </div>
      </form>
    </li>
  );
}
