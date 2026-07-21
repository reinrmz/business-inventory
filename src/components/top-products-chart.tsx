type ProductRevenue = { productName: string; revenue: number; qty: number };

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export function TopProductsChart({
  products,
  currencySymbol,
}: {
  products: ProductRevenue[];
  currencySymbol: string;
}) {
  if (products.length === 0) {
    return (
      <section className="label-card p-5">
        <h2 className="mb-1 font-display text-lg font-bold">Top products</h2>
        <p className="py-8 text-center text-sm text-ink-muted">No sales yet.</p>
      </section>
    );
  }

  const maxRevenue = Math.max(...products.map((p) => p.revenue));

  return (
    <section className="label-card p-5">
      <h2 className="mb-4 font-display text-lg font-bold">Top products</h2>
      <div className="space-y-3">
        {products.map((p, i) => {
          const widthPct = maxRevenue > 0 ? (p.revenue / maxRevenue) * 100 : 0;
          return (
            <div key={p.productName}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate font-medium">{p.productName}</span>
                <span className="tnum shrink-0 text-ink-muted">
                  {currencySymbol}
                  {p.revenue.toLocaleString()} · {p.qty} sold
                </span>
              </div>
              <div className="h-4 w-full overflow-hidden rounded-full bg-bg">
                <div
                  className="h-full rounded-full transition-standard"
                  style={{ width: `${widthPct}%`, background: CHART_COLORS[i % CHART_COLORS.length] }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
