"use client";

import { useState, useTransition } from "react";
import { login } from "../(auth)/actions";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await login(formData);
      if (result?.error) {
        setError(result.error);
      }
      // On success, login() calls redirect() itself - nothing more to do here.
    });
  }

  return (
    <form action={submit} className="label-card space-y-3 p-5">
      {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
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
          className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      <button
        disabled={isPending}
        className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-standard hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}
