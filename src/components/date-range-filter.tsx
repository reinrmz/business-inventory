"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

function toDateInputValue(d: Date) {
  return d.toISOString().slice(0, 10);
}

function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function startOfWeek(d: Date) {
  const copy = startOfDay(d);
  const day = copy.getDay(); // 0 = Sunday
  copy.setDate(copy.getDate() - day);
  return copy;
}

function startOfMonth(d: Date) {
  const copy = startOfDay(d);
  copy.setDate(1);
  return copy;
}

const PRESETS = [
  { label: "Today", from: (now: Date) => startOfDay(now) },
  { label: "This week", from: (now: Date) => startOfWeek(now) },
  { label: "This month", from: (now: Date) => startOfMonth(now) },
  { label: "All time", from: () => null },
];

export function DateRangeFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  function applyParams(next: { from?: string | null; to?: string | null }) {
    const params = new URLSearchParams(searchParams);
    if (next.from !== undefined) {
      if (next.from) params.set("from", next.from);
      else params.delete("from");
    }
    if (next.to !== undefined) {
      if (next.to) params.set("to", next.to);
      else params.delete("to");
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  function applyPreset(preset: (typeof PRESETS)[number]) {
    const now = new Date();
    const fromDate = preset.from(now);
    applyParams({ from: fromDate ? toDateInputValue(fromDate) : null, to: null });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => applyPreset(preset)}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink-muted transition-standard hover:border-accent hover:text-accent"
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={from}
          onChange={(e) => applyParams({ from: e.target.value })}
          className="rounded-lg border border-border bg-bg px-2 py-1.5 text-xs outline-none focus:border-accent"
        />
        <span className="text-xs text-ink-muted">to</span>
        <input
          type="date"
          value={to}
          onChange={(e) => applyParams({ to: e.target.value })}
          className="rounded-lg border border-border bg-bg px-2 py-1.5 text-xs outline-none focus:border-accent"
        />
      </div>
    </div>
  );
}
