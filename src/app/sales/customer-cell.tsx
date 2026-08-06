"use client";

import { useState, useTransition } from "react";
import { updateSaleCustomer } from "./actions";

export function CustomerCell({ saleId, customer }: { saleId: number; customer: string | null }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(customer ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    setEditing(false);
    const trimmed = value.trim();
    if (trimmed === (customer ?? "")) return;
    startTransition(() => {
      updateSaleCustomer(saleId, trimmed || null);
    });
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        disabled={pending}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") {
            setValue(customer ?? "");
            setEditing(false);
          }
        }}
        className="w-full rounded border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-accent"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="w-full rounded px-2 py-1 text-left hover:bg-surface-alt"
      title="Click to edit"
    >
      {value || "—"}
    </button>
  );
}
