type CategoryRevenue = { categoryName: string; revenue: number };

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export function CategoryBreakdownChart({
  categories,
  currencySymbol,
}: {
  categories: CategoryRevenue[];
  currencySymbol: string;
}) {
  const total = categories.reduce((sum, c) => sum + c.revenue, 0);

  if (categories.length === 0 || total === 0) {
    return (
      <section className="label-card p-5">
        <h2 className="mb-1 font-display text-lg font-bold">Revenue by category</h2>
        <p className="py-8 text-center text-sm text-ink-muted">No sales yet.</p>
      </section>
    );
  }

  return (
    <section className="label-card p-5">
      <h2 className="mb-4 font-display text-lg font-bold">Revenue by category</h2>

      <div className="flex h-6 w-full overflow-hidden rounded-full bg-bg">
        {categories.map((c, i) => {
          const pct = (c.revenue / total) * 100;
          return (
            <div
              key={c.categoryName}
              style={{ width: `${pct}%`, background: CHART_COLORS[i % CHART_COLORS.length] }}
              className="h-full first:rounded-l-full last:rounded-r-full"
              title={`${c.categoryName}: ${pct.toFixed(0)}%`}
            />
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        {categories.map((c, i) => {
          const pct = total > 0 ? (c.revenue / total) * 100 : 0;
          return (
            <div key={c.categoryName} className="flex items-center gap-2 text-sm">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
              />
              <span className="font-medium">{c.categoryName}</span>
              <span className="tnum text-ink-muted">
                {currencySymbol}
                {c.revenue.toLocaleString()} ({pct.toFixed(0)}%)
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
