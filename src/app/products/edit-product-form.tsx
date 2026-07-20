"use client";

import { useState } from "react";
import { updateProduct } from "./actions";

type Category = { id: number; name: string };
type Product = { id: number; name: string; categoryId: number; notes: string | null };

export function EditProductForm({
  product,
  categories,
}: {
  product: Product;
  categories: Category[];
}) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-left hover:underline"
        title="Click to edit"
      >
        {product.name}
      </button>
    );
  }

  return (
    <form
      action={async (formData) => {
        await updateProduct(formData);
        setEditing(false);
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="id" value={product.id} />
      <input
        name="name"
        defaultValue={product.name}
        required
        className="rounded border px-2 py-1 text-sm"
      />
      <select
        name="categoryId"
        defaultValue={product.categoryId}
        required
        className="rounded border px-2 py-1 text-sm"
      >
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <button type="submit" className="rounded bg-gray-900 px-2 py-1 text-xs text-white">
        Save
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="text-xs text-gray-500"
      >
        Cancel
      </button>
    </form>
  );
}
