type ProductMargin = {
  productName: string;
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number;
};

export function CostAnalysisChart({
  products,
  revenue,
  cost,
  profit,
  marginPct,
  costedLineCount,
  totalLineCount,
  currencySymbol,
}: {
  products: ProductMargin[];
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number;
  costedLineCount: number;
  totalLineCount: number;
  currencySymbol: string;
}) {
  if (totalLineCount === 0 || costedLineCount === 0) {
    return (
      <section className="label-card p-5">
        <h2 className="mb-1 font-display text-lg font-bold">Price &amp; cost analysis</h2>
        <p className="py-8 text-center text-sm text-ink-muted">
          No cost data yet. Set a cost on your variants to see margin analysis.
        </p>
      </section>
    );
  }

  const maxRevenue = Math.max(...products.map((p) => p.revenue));
  const uncostedCount = totalLineCount - costedLineCount;

  return (
    <section className="label-card p-5">
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-bold">Price &amp; cost analysis</h2>
        <span className="tnum text-sm text-ink-muted">{marginPct.toFixed(0)}% overall margin</span>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-muted">Revenue</p>
          <p className="tnum font-medium">
            {currencySymbol}
            {revenue.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-muted">Cost</p>
          <p className="tnum font-medium">
            {currencySymbol}
            {cost.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-muted">Profit</p>
          <p className="tnum font-medium text-gold">
            {currencySymbol}
            {profit.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {products.map((p) => {
          const totalWidthPct = maxRevenue > 0 ? (p.revenue / maxRevenue) * 100 : 0;
          const costSharePct = p.revenue > 0 ? (p.cost / p.revenue) * 100 : 0;
          return (
            <div key={p.productName}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate font-medium">{p.productName}</span>
                <span className="tnum shrink-0 text-ink-muted">
                  {currencySymbol}
                  {p.profit.toLocaleString()} profit · {p.marginPct.toFixed(0)}% margin
                </span>
              </div>
              <div className="h-4 overflow-hidden rounded-full bg-bg" style={{ width: `${totalWidthPct}%` }}>
                <div className="flex h-full w-full">
                  <div
                    className="h-full shrink-0 bg-ink-muted/40"
                    style={{ width: `${costSharePct}%` }}
                    title={`Cost: ${currencySymbol}${p.cost.toLocaleString()}`}
                  />
                  <div
                    className="h-full flex-1 bg-gold"
                    title={`Profit: ${currencySymbol}${p.profit.toLocaleString()}`}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {uncostedCount > 0 && (
        <p className="mt-4 text-xs text-ink-muted">
          {uncostedCount} of {totalLineCount} sale lines have no cost recorded and are excluded from this analysis.
        </p>
      )}
    </section>
  );
}
