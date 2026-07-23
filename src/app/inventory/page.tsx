import { prisma } from "@/lib/prisma";
import { requireBusinessContext } from "@/lib/auth";
import { getCurrencySymbol } from "@/lib/currency";
import { getSettings } from "@/lib/settings";
import { InventoryRow } from "./inventory-row";
import { InventoryFilters } from "./inventory-filters";
import { SearchBox } from "@/components/search-box";
import { Pagination } from "@/components/pagination";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; stock?: string; expiry?: string; variant?: string }>;
}) {
  const { businessId } = await requireBusinessContext();
  const { q, page: pageRaw, stock, expiry, variant: variantAttrRaw } = await searchParams;
  const page = Math.max(1, Number(pageRaw) || 1);
  const variantAttributeValueId = variantAttrRaw ? Number(variantAttrRaw) : null;

  const settings = await getSettings(businessId);

  // Today at UTC midnight — expiresAt is stored at UTC midnight, so compare
  // date-to-date (no time-of-day drift). See updateExpiration in actions.ts.
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const soonCutoff = new Date(todayUtc.getTime() + settings.expirySoonDays * 24 * 60 * 60 * 1000);

  // Stock filter: "low" = 1..threshold (has some, running down); "out" = 0.
  const stockWhere =
    stock === "low"
      ? { stockQty: { gte: 1, lte: settings.lowStockThreshold } }
      : stock === "out"
        ? { stockQty: 0 }
        : {};

  // Expiry filter: "soon" = dated within the window and not yet past;
  // "expired" = dated before today. Both require an expiration set.
  const expiryWhere =
    expiry === "soon"
      ? { expiresAt: { gte: todayUtc, lte: soonCutoff } }
      : expiry === "expired"
        ? { expiresAt: { lt: todayUtc } }
        : {};

  const where = {
    businessId,
    active: true,
    ...(q ? { product: { name: { contains: q } } } : {}),
    ...stockWhere,
    ...expiryWhere,
    ...(variantAttributeValueId
      ? { attributes: { some: { attributeValueId: variantAttributeValueId } } }
      : {}),
  };

  const [variants, totalCount, allActiveVariants, cur, availableAttributeValues] = await Promise.all([
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
    // Distinct attribute values actually in use by an active variant, for the
    // "Variant" filter dropdown - not every AttributeValue ever defined.
    prisma.attributeValue.findMany({
      where: { businessId, variantLinks: { some: { variant: { active: true } } } },
      include: { attribute: true },
      orderBy: [{ attribute: { name: "asc" } }, { sortOrder: "asc" }],
    }),
  ]);

  const filtersActive = Boolean(stock || expiry || variantAttrRaw);

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

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <SearchBox placeholder="Search by product…" />
          <InventoryFilters
            lowStockThreshold={settings.lowStockThreshold}
            expirySoonDays={settings.expirySoonDays}
            attributeValues={availableAttributeValues.map((av) => ({
              id: av.id,
              value: av.value,
              attributeName: av.attribute.name,
            }))}
          />
        </div>
        <p className="text-xs text-ink-muted">
          {totalCount} variant{totalCount === 1 ? "" : "s"}
        </p>
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-alt text-left text-xs font-semibold uppercase tracking-wide text-accent">
            <tr>
              <th className="px-5 py-3">Product</th>
              <th className="px-5 py-3">Variant</th>
              <th className="px-5 py-3">Stock</th>
              <th className="px-5 py-3">Price / Cost</th>
              <th className="px-5 py-3">Expiration</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v, i) => {
              const attributeLabel = v.attributes
                .map((a) => a.attributeValue.value)
                .join(" · ");
              return (
                <InventoryRow
                  key={v.id}
                  striped={i % 2 === 1}
                  currencySymbol={cur}
                  lowStockThreshold={settings.lowStockThreshold}
                  expirySoonDays={settings.expirySoonDays}
                  variant={{
                    id: v.id,
                    productName: v.product.name,
                    attributeLabel,
                    price: v.price,
                    cost: v.cost,
                    stockQty: v.stockQty,
                    reorderLevel: v.reorderLevel,
                    expiresAt: v.expiresAt,
                  }}
                />
              );
            })}
            {variants.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-ink-muted">
                  {q
                    ? `No inventory matches "${q}".`
                    : filtersActive
                      ? "No variants match the selected filters."
                      : "No inventory yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pagination
          page={page}
          pageCount={pageCount}
          basePath="/inventory"
          searchParams={{ q, stock, expiry, variant: variantAttrRaw }}
        />
      </section>
    </div>
  );
}
