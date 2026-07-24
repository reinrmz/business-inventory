"use client";

import { useRef, useState } from "react";
import { changePassword } from "./actions";

export function ChangePasswordForm() {
  const [status, setStatus] = useState<{ error?: string; ok?: boolean }>({});
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        setSaving(true);
        const res = await changePassword(formData);
        setStatus(res);
        setSaving(false);
        if (res.ok) formRef.current?.reset();
      }}
      className="space-y-4"
    >
      <Field label="Current password">
        <input
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          className="w-full max-w-xs rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none transition-standard focus:border-accent"
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="New password" hint="At least 8 characters.">
          <input
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none transition-standard focus:border-accent"
          />
        </Field>
        <Field label="Confirm new password">
          <input
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none transition-standard focus:border-accent"
          />
        </Field>
      </div>

      <div className="flex items-center gap-4">
        <button
          disabled={saving}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-standard hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Changing…" : "Change password"}
        </button>
        {status.ok && <span className="text-sm text-accent">Password changed.</span>}
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
