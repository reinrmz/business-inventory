"use client";

import { useState } from "react";
import { updatePricing, adjustStock } from "./actions";

type Variant = {
  id: number;
  productName: string;
  attributeLabel: string;
  price: number;
  cost: number | null;
  stockQty: number;
  reorderLevel: number | null;
};

export function InventoryRow({ variant }: { variant: Variant }) {
  const [editingPrice, setEditingPrice] = useState(false);
  const [adjusting, setAdjusting] = useState(false);

  const lowStock = variant.reorderLevel !== null && variant.stockQty <= variant.reorderLevel;

  return (
    <tr className="border-b last:border-0 align-top">
      <td className="px-4 py-2">{variant.productName}</td>
      <td className="px-4 py-2 text-gray-600">{variant.attributeLabel}</td>
      <td className="px-4 py-2">
        <span className={lowStock ? "font-semibold text-red-600" : ""}>
          {variant.stockQty}
        </span>
        {lowStock && <span className="ml-1 text-xs text-red-500">low</span>}
      </td>
      <td className="px-4 py-2">
        {editingPrice ? (
          <form
            action={async (formData) => {
              await updatePricing(formData);
              setEditingPrice(false);
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
              className="w-20 rounded border px-1 py-0.5 text-xs"
            />
            <input
              name="cost"
              type="number"
              step="1"
              defaultValue={variant.cost ?? ""}
              placeholder="cost"
              className="w-20 rounded border px-1 py-0.5 text-xs"
            />
            <button className="rounded bg-gray-900 px-2 py-0.5 text-xs text-white">
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditingPrice(false)}
              className="text-xs text-gray-500"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button onClick={() => setEditingPrice(true)} className="hover:underline">
            ₱{variant.price}
            {variant.cost !== null && (
              <span className="ml-1 text-xs text-gray-400">(cost ₱{variant.cost})</span>
            )}
          </button>
        )}
      </td>
      <td className="px-4 py-2">
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
              className="w-16 rounded border px-1 py-0.5 text-xs"
            />
            <select name="reason" className="rounded border px-1 py-0.5 text-xs">
              <option value="restock">Restock</option>
              <option value="correction">Correction</option>
            </select>
            <button className="rounded bg-gray-900 px-2 py-0.5 text-xs text-white">
              Apply
            </button>
            <button
              type="button"
              onClick={() => setAdjusting(false)}
              className="text-xs text-gray-500"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            onClick={() => setAdjusting(true)}
            className="text-xs text-gray-500 underline hover:text-gray-900"
          >
            Adjust stock
          </button>
        )}
      </td>
    </tr>
  );
}
