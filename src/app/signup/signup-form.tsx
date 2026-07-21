"use client";

import { useState, useTransition } from "react";
import { signup } from "../(auth)/actions";

export function SignupForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await signup(formData);
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <form action={submit} className="label-card space-y-3 p-5">
      {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
      <div>
        <label className="mb-1 block text-xs font-medium text-ink-muted">Your name (optional)</label>
        <input
          name="name"
          type="text"
          className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-ink-muted">Email</label>
        <input
          name="email"
          type="email"
          required
          className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-ink-muted">Password</label>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-ink-muted">Business name</label>
        <input
          name="businessName"
          type="text"
          required
          placeholder="e.g. Fragrenz"
          className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-ink-muted">Currency</label>
        <select
          name="currency"
          defaultValue="PHP"
          className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="PHP">₱ PHP — Philippine Peso</option>
          <option value="USD">$ USD — US Dollar</option>
          <option value="EUR">€ EUR — Euro</option>
          <option value="GBP">£ GBP — British Pound</option>
        </select>
      </div>
      <button
        disabled={isPending}
        className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-standard hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Creating account…" : "Sign up"}
      </button>
    </form>
  );
}
