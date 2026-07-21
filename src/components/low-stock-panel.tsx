import Link from "next/link";

type LowStockVariant = {
  id: number;
  productName: string;
  attributeLabel: string;
  stockQty: number;
  reorderLevel: number | null;
};

export function LowStockPanel({ variants }: { variants: LowStockVariant[] }) {
  return (
    <section className="label-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">Low stock</h2>
        {variants.length > 0 && (
          <span className="rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-semibold text-danger">
            {variants.length}
          </span>
        )}
      </div>

      {variants.length === 0 ? (
        <p className="text-sm text-ink-muted">Nothing out of stock or below its reorder level. Nice.</p>
      ) : (
        <ul className="space-y-2">
          {variants.slice(0, 6).map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{v.productName}</p>
                {v.attributeLabel && (
                  <p className="truncate text-xs text-ink-muted">{v.attributeLabel}</p>
                )}
              </div>
              <span className="tnum shrink-0 text-xs font-semibold text-danger">
                {v.stockQty === 0
                  ? "OUT OF STOCK"
                  : `${v.stockQty} / ${v.reorderLevel}`}
              </span>
            </li>
          ))}
        </ul>
      )}

      {variants.length > 6 && (
        <Link
          href="/inventory"
          className="mt-3 inline-block text-xs font-medium text-accent hover:underline"
        >
          + {variants.length - 6} more in Inventory
        </Link>
      )}
    </section>
  );
}
