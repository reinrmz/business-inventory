"use client";

import { useState } from "react";
import {
  createAttribute,
  updateAttribute,
  deleteAttribute,
  createAttributeValue,
  updateAttributeValue,
  deleteAttributeValue,
  reorderAttributeValue,
} from "@/app/products/actions";

type AttributeValue = { id: number; value: string; sortOrder: number };
type Attribute = { id: number; name: string; unit: string | null; values: AttributeValue[] };

async function runAction(action: (formData: FormData) => Promise<void>, formData: FormData) {
  try {
    await action(formData);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Something went wrong.";
  }
}

export function AttributesSection({ attributes }: { attributes: Attribute[] }) {
  const [error, setError] = useState<string | null>(null);
  const [addingAttribute, setAddingAttribute] = useState(false);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-bold">Variant attributes</h2>
        <p className="mt-1 text-sm text-ink-muted">
          The dimensions your products vary along — e.g. Size (ML), Length (in),
          Color. Define your own name and unit; this isn't limited to perfume sizes.
        </p>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="space-y-3">
        {attributes.map((attr) => (
          <AttributeCard key={attr.id} attribute={attr} onError={setError} />
        ))}
      </div>

      {addingAttribute ? (
        <form
          action={async (formData) => {
            const err = await runAction(createAttribute, formData);
            setError(err);
            if (!err) setAddingAttribute(false);
          }}
          className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-bg p-3"
        >
          <input
            name="name"
            placeholder="Attribute name (e.g. Size, Length, Color)"
            required
            className="flex-1 rounded border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent"
          />
          <input
            name="unit"
            placeholder="Unit (optional, e.g. ML, in, %)"
            className="w-48 rounded border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent"
          />
          <button className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-ink">
            Add attribute
          </button>
          <button
            type="button"
            onClick={() => setAddingAttribute(false)}
            className="text-xs text-ink-muted"
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          onClick={() => setAddingAttribute(true)}
          className="text-xs font-medium text-ink-muted underline decoration-border underline-offset-2 transition-standard hover:text-accent"
        >
          + Add attribute
        </button>
      )}
    </div>
  );
}

function AttributeCard({
  attribute,
  onError,
}: {
  attribute: Attribute;
  onError: (msg: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [addingValue, setAddingValue] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-bg p-3">
      {editing ? (
        <form
          action={async (formData) => {
            const err = await runAction(updateAttribute, formData);
            onError(err);
            if (!err) setEditing(false);
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <input type="hidden" name="id" value={attribute.id} />
          <input
            name="name"
            defaultValue={attribute.name}
            required
            className="flex-1 rounded border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent"
          />
          <input
            name="unit"
            defaultValue={attribute.unit ?? ""}
            placeholder="Unit (optional)"
            className="w-40 rounded border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent"
          />
          <button className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-ink">
            Save
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-xs text-ink-muted">
            Cancel
          </button>
        </form>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium">
            {attribute.name}
            {attribute.unit && <span className="text-ink-muted"> ({attribute.unit})</span>}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setEditing(true)}
              className="text-xs font-medium text-ink-muted underline decoration-border underline-offset-2 transition-standard hover:text-accent"
            >
              Edit
            </button>
            <form
              action={async (formData) => {
                const err = await runAction(deleteAttribute, formData);
                onError(err);
              }}
            >
              <input type="hidden" name="id" value={attribute.id} />
              <button className="text-xs font-medium text-ink-muted underline decoration-border underline-offset-2 transition-standard hover:text-danger">
                Delete
              </button>
            </form>
          </div>
        </div>
      )}

      <ul className="mt-3 space-y-1.5">
        {attribute.values.map((v, i) => (
          <ValueRow
            key={v.id}
            value={v}
            isFirst={i === 0}
            isLast={i === attribute.values.length - 1}
            onError={onError}
          />
        ))}
      </ul>

      {addingValue ? (
        <form
          action={async (formData) => {
            const err = await runAction(createAttributeValue, formData);
            onError(err);
            if (!err) setAddingValue(false);
          }}
          className="mt-2 flex items-center gap-2"
        >
          <input type="hidden" name="attributeId" value={attribute.id} />
          <input
            name="value"
            placeholder="New value (e.g. 50 ML)"
            required
            className="flex-1 rounded border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
          />
          <button className="rounded bg-accent px-2 py-1 text-xs font-medium text-accent-ink">
            Add
          </button>
          <button type="button" onClick={() => setAddingValue(false)} className="text-xs text-ink-muted">
            Cancel
          </button>
        </form>
      ) : (
        <button
          onClick={() => setAddingValue(true)}
          className="mt-2 text-xs font-medium text-ink-muted underline decoration-border underline-offset-2 transition-standard hover:text-accent"
        >
          + Add value
        </button>
      )}
    </div>
  );
}

function ValueRow({
  value,
  isFirst,
  isLast,
  onError,
}: {
  value: AttributeValue;
  isFirst: boolean;
  isLast: boolean;
  onError: (msg: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li>
        <form
          action={async (formData) => {
            const err = await runAction(updateAttributeValue, formData);
            onError(err);
            if (!err) setEditing(false);
          }}
          className="flex items-center gap-2"
        >
          <input type="hidden" name="id" value={value.id} />
          <input
            name="value"
            defaultValue={value.value}
            required
            className="flex-1 rounded border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
          />
          <button className="rounded bg-accent px-2 py-1 text-xs font-medium text-accent-ink">
            Save
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-xs text-ink-muted">
            Cancel
          </button>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-2 text-sm">
      <span className="text-ink-muted">{value.value}</span>
      <div className="flex items-center gap-2">
        <form action={async (formData) => onError(await runAction(reorderAttributeValue, formData))}>
          <input type="hidden" name="id" value={value.id} />
          <input type="hidden" name="direction" value="up" />
          <button
            disabled={isFirst}
            className="text-xs text-ink-muted transition-standard hover:text-accent disabled:opacity-30"
            title="Move up"
          >
            ↑
          </button>
        </form>
        <form action={async (formData) => onError(await runAction(reorderAttributeValue, formData))}>
          <input type="hidden" name="id" value={value.id} />
          <input type="hidden" name="direction" value="down" />
          <button
            disabled={isLast}
            className="text-xs text-ink-muted transition-standard hover:text-accent disabled:opacity-30"
            title="Move down"
          >
            ↓
          </button>
        </form>
        <button
          onClick={() => setEditing(true)}
          className="text-xs font-medium text-ink-muted underline decoration-border underline-offset-2 transition-standard hover:text-accent"
        >
          Edit
        </button>
        <form action={async (formData) => onError(await runAction(deleteAttributeValue, formData))}>
          <input type="hidden" name="id" value={value.id} />
          <button className="text-xs font-medium text-ink-muted underline decoration-border underline-offset-2 transition-standard hover:text-danger">
            Delete
          </button>
        </form>
      </div>
    </li>
  );
}
