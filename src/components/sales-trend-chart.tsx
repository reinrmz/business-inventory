"use client";

import { useState, useMemo, useId } from "react";

type TrendPoint = { label: string; revenue: number };

const WIDTH = 640;
const HEIGHT = 220;
const PAD_LEFT = 48;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;

function niceMax(value: number) {
  if (value <= 0) return 100;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

export function SalesTrendChart({
  daily,
  weekly,
  currencySymbol,
}: {
  daily: TrendPoint[];
  weekly: TrendPoint[];
  currencySymbol: string;
}) {
  const [granularity, setGranularity] = useState<"daily" | "weekly">("daily");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const gradientId = useId();

  const points = granularity === "daily" ? daily : weekly;

  const { path, areaPath, coords, maxValue } = useMemo(() => {
    const max = niceMax(Math.max(...points.map((p) => p.revenue), 1));
    const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
    const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;
    const stepX = points.length > 1 ? plotW / (points.length - 1) : 0;

    const coords = points.map((p, i) => ({
      x: PAD_LEFT + stepX * i,
      y: PAD_TOP + plotH - (p.revenue / max) * plotH,
      ...p,
    }));

    const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
    const areaPath =
      coords.length > 0
        ? `${path} L${coords[coords.length - 1].x},${PAD_TOP + plotH} L${coords[0].x},${PAD_TOP + plotH} Z`
        : "";

    return { path, areaPath, coords, maxValue: max };
  }, [points]);

  const hovered = hoverIndex !== null ? coords[hoverIndex] : null;

  return (
    <section className="label-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">Sales trend</h2>
        <div className="flex gap-1.5">
          {(["daily", "weekly"] as const).map((g) => (
            <button
              key={g}
              onClick={() => {
                setGranularity(g);
                setHoverIndex(null);
              }}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-standard ${
                granularity === g
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border text-ink-muted hover:border-accent hover:text-accent"
              }`}
            >
              {g === "daily" ? "Last 30 days" : "Last 12 weeks"}
            </button>
          ))}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label={`Sales revenue trend, ${granularity === "daily" ? "last 30 days" : "last 12 weeks"}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = PAD_TOP + (HEIGHT - PAD_TOP - PAD_BOTTOM) * (1 - t);
          return (
            <g key={t}>
              <line
                x1={PAD_LEFT}
                x2={WIDTH - PAD_RIGHT}
                y1={y}
                y2={y}
                stroke="var(--chart-grid)"
                strokeWidth={1}
              />
              <text
                x={PAD_LEFT - 8}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-ink-muted"
                fontSize={10}
              >
                {currencySymbol}
                {Math.round((maxValue * t) / 1000)}
                {maxValue * t >= 1000 ? "K" : ""}
              </text>
            </g>
          );
        })}

        {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}
        {path && <path d={path} fill="none" stroke="var(--chart-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}

        {coords.map((c, i) => (
          <g key={i}>
            <rect
              x={c.x - (coords.length > 1 ? (coords[1].x - coords[0].x) / 2 : 20)}
              y={PAD_TOP}
              width={coords.length > 1 ? coords[1].x - coords[0].x : 40}
              height={HEIGHT - PAD_TOP - PAD_BOTTOM}
              fill="transparent"
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
              style={{ cursor: "pointer" }}
            />
            {hoverIndex === i && (
              <>
                <line
                  x1={c.x}
                  x2={c.x}
                  y1={PAD_TOP}
                  y2={HEIGHT - PAD_BOTTOM}
                  stroke="var(--chart-axis)"
                  strokeWidth={1}
                />
                <circle cx={c.x} cy={c.y} r={4} fill="var(--chart-1)" stroke="var(--surface)" strokeWidth={2} />
              </>
            )}
          </g>
        ))}

        {/* x-axis labels: show every nth to avoid crowding */}
        {coords.map((c, i) => {
          const showEvery = granularity === "daily" ? 5 : 2;
          if (i % showEvery !== 0 && i !== coords.length - 1) return null;
          return (
            <text
              key={i}
              x={c.x}
              y={HEIGHT - PAD_BOTTOM + 16}
              textAnchor="middle"
              className="fill-ink-muted"
              fontSize={10}
            >
              {c.label}
            </text>
          );
        })}
      </svg>

      {hovered && (
        <div className="mt-2 flex items-center gap-2 text-sm">
          <span className="h-2 w-2 rounded-full" style={{ background: "var(--chart-1)" }} />
          <span className="font-medium">{hovered.label}</span>
          <span className="tnum text-ink-muted">
            {currencySymbol}
            {hovered.revenue.toLocaleString()}
          </span>
        </div>
      )}
      {!hovered && (
        <p className="mt-2 text-xs text-ink-muted">Hover the chart to see values per period.</p>
      )}
    </section>
  );
}
