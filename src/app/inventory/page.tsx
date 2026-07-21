import { prisma } from "@/lib/prisma";
import { requireBusinessContext } from "@/lib/auth";
import { getCurrencySymbol } from "@/lib/currency";
import { InventoryRow } from "./inventory-row";
import { SearchBox } from "@/components/search-box";
import { Pagination } from "@/components/pagination";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { businessId } = await requireBusinessContext();
  const { q, page: pageRaw } = await searchParams;
  const page = Math.max(1, Number(pageRaw) || 1);

  const where = {
    businessId,
    active: true,
    ...(q ? { product: { name: { contains: q } } } : {}),
  };

  const [variants, totalCount, allActiveVariants, cur] = await Promise.all([
    prisma.variant.findMany({
      where,
      include: {
        product: true,
        attributes: {
          include: { attributeValue: { include: { attribute: true } } },
        },
      },
      orderBy: [{ product: { name: "asc" } }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.variant.count({ where }),
    // Stock value reflects ALL inventory, not just the current search/page.
    prisma.variant.findMany({ where: { businessId, active: true }, select: { stockQty: true, price: true } }),
    getCurrencySymbol(businessId),
  ]);

  const stockValue = allActiveVariants.reduce((sum, v) => sum + v.stockQty * v.price, 0);
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-accent">Stock</p>
          <h1 className="font-display text-2xl font-bold">Inventory</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Stock on hand per SKU. Click price or stock to edit.
          </p>
        </div>
        <div className="label-card px-4 py-2 text-right">
          <p className="text-xs uppercase tracking-wide text-ink-muted">Stock value</p>
          <p className="tnum font-display text-xl font-bold">{cur}{stockValue.toLocaleString()}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <SearchBox placeholder="Search by product…" />
        <p className="text-xs text-ink-muted">
          {totalCount} variant{totalCount === 1 ? "" : "s"}
        </p>
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-bg text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-5 py-3">Product</th>
              <th className="px-5 py-3">Variant</th>
              <th className="px-5 py-3">Stock</th>
              <th className="px-5 py-3">Price / Cost</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v) => {
              const attributeLabel = v.attributes
                .map((a) => a.attributeValue.value)
                .join(" · ");
              return (
                <InventoryRow
                  key={v.id}
                  currencySymbol={cur}
                  variant={{
                    id: v.id,
                    productName: v.product.name,
                    attributeLabel,
                    price: v.price,
                    cost: v.cost,
                    stockQty: v.stockQty,
                    reorderLevel: v.reorderLevel,
                  }}
                />
              );
            })}
            {variants.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-ink-muted">
                  {q ? `No inventory matches "${q}".` : "No inventory yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pagination page={page} pageCount={pageCount} basePath="/inventory" searchParams={{ q }} />
      </section>
    </div>
  );
}
