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
        className="text-left font-medium transition-standard hover:text-accent"
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
        className="rounded border border-border bg-bg px-2 py-1 text-sm outline-none focus:border-accent"
      />
      <select
        name="categoryId"
        defaultValue={product.categoryId}
        required
        className="rounded border border-border bg-bg px-2 py-1 text-sm outline-none focus:border-accent"
      >
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <button type="submit" className="rounded bg-accent px-2 py-1 text-xs font-medium text-accent-ink">
        Save
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="text-xs text-ink-muted"
      >
        Cancel
      </button>
    </form>
  );
}
