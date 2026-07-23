"use client";

import { useState } from "react";
import { saveSettings } from "./actions";

const CURRENCIES = [
  { code: "PHP", label: "PHP ₱" },
  { code: "USD", label: "USD $" },
  { code: "EUR", label: "EUR €" },
  { code: "GBP", label: "GBP £" },
];

export function SettingsForm({
  initial,
}: {
  initial: {
    currency: string;
    reinvestmentGoalMin: number;
    reinvestmentGoalMax: number;
    lowStockThreshold: number;
    expirySoonDays: number;
  };
}) {
  const [status, setStatus] = useState<{ error?: string; ok?: boolean }>({});
  const [saving, setSaving] = useState(false);

  return (
    <form
      action={async (formData) => {
        setSaving(true);
        const res = await saveSettings(formData);
        setStatus(res);
        setSaving(false);
      }}
      className="space-y-6"
    >
      <Field label="Currency" hint="Display symbol only — no conversion.">
        <select
          name="currency"
          defaultValue={initial.currency}
          className="w-full max-w-xs rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none transition-standard focus:border-accent"
        >
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Reinvestment goal — min" hint="0 hides the goal bar.">
          <NumberInput name="reinvestmentGoalMin" defaultValue={initial.reinvestmentGoalMin} />
        </Field>
        <Field label="Reinvestment goal — max" hint="Upper end of the goal range.">
          <NumberInput name="reinvestmentGoalMax" defaultValue={initial.reinvestmentGoalMax} />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Low-stock threshold"
          hint="A variant counts as low stock at this quantity or less (default 3)."
        >
          <NumberInput name="lowStockThreshold" defaultValue={initial.lowStockThreshold} min={0} />
        </Field>
        <Field
          label="Expiring-soon window (days)"
          hint="Flag stock expiring within this many days (default 7)."
        >
          <NumberInput name="expirySoonDays" defaultValue={initial.expirySoonDays} min={0} />
        </Field>
      </div>

      <div className="flex items-center gap-4">
        <button
          disabled={saving}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-standard hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
        {status.ok && <span className="text-sm text-accent">Saved.</span>}
        {status.error && <span className="text-sm text-danger">{status.error}</span>}
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-muted">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
    </label>
  );
}

function NumberInput({
  name,
  defaultValue,
  min = 0,
}: {
  name: string;
  defaultValue: number;
  min?: number;
}) {
  return (
    <input
      name={name}
      type="number"
      step="1"
      min={min}
      defaultValue={defaultValue}
      className="w-full max-w-xs rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none transition-standard focus:border-accent"
    />
  );
}
