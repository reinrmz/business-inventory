import { prisma } from "./prisma";

export type TrendPoint = { label: string; date: Date; revenue: number };

function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function startOfWeek(d: Date) {
  const copy = startOfDay(d);
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Shared scope filter: productId narrows to one product, attributeValueId
// narrows to variants carrying that attribute value (e.g. "50 ML") across
// whichever product(s) have it - the two compose with AND when both are set.
function variantScopeWhere(productId?: number, attributeValueId?: number) {
  return {
    ...(productId ? { productId } : {}),
    ...(attributeValueId ? { attributes: { some: { attributeValueId } } } : {}),
  };
}

function saleItemScopeWhere(productId?: number, attributeValueId?: number) {
  if (!productId && !attributeValueId) return {};
  return { variant: variantScopeWhere(productId, attributeValueId) };
}

// Daily (last 30 days) or weekly (last 12 weeks) revenue trend. SQLite has no
// clean DATE_TRUNC via Prisma, so we fetch raw sale_items in range and bucket
// in JS - fine at this data scale (a few hundred rows per business).
export async function getSalesTrend(
  businessId: number,
  granularity: "daily" | "weekly",
  productId?: number,
  attributeValueId?: number,
) {
  const now = new Date();
  const bucketCount = granularity === "daily" ? 30 : 12;
  const bucketStart = granularity === "daily" ? startOfDay : startOfWeek;
  const bucketMs = granularity === "daily" ? DAY_MS : DAY_MS * 7;

  const rangeStart = new Date(bucketStart(now).getTime() - (bucketCount - 1) * bucketMs);

  const items = await prisma.saleItem.findMany({
    where: {
      businessId,
      sale: { soldAt: { gte: rangeStart } },
      ...saleItemScopeWhere(productId, attributeValueId),
    },
    select: { lineTotal: true, sale: { select: { soldAt: true } } },
  });

  const buckets = new Map<number, number>();
  for (let i = 0; i < bucketCount; i++) {
    buckets.set(bucketStart(now).getTime() - i * bucketMs, 0);
  }

  for (const item of items) {
    const key = bucketStart(item.sale.soldAt).getTime();
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + item.lineTotal);
    }
  }

  const points: TrendPoint[] = [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([time, revenue]) => {
      const date = new Date(time);
      const label =
        granularity === "daily"
          ? date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
          : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      return { label, date, revenue };
    });

  return points;
}

export type ProductRevenue = { productName: string; revenue: number; qty: number };

export async function getTopProducts(
  businessId: number,
  limit = 5,
  productId?: number,
  attributeValueId?: number,
) {
  const items = await prisma.saleItem.findMany({
    where: { businessId, ...saleItemScopeWhere(productId, attributeValueId) },
    select: { lineTotal: true, qty: true, variant: { select: { product: { select: { name: true } } } } },
  });

  const byProduct = new Map<string, { revenue: number; qty: number }>();
  for (const item of items) {
    const name = item.variant.product.name;
    const entry = byProduct.get(name) ?? { revenue: 0, qty: 0 };
    entry.revenue += item.lineTotal;
    entry.qty += item.qty;
    byProduct.set(name, entry);
  }

  const sorted: ProductRevenue[] = [...byProduct.entries()]
    .map(([productName, v]) => ({ productName, ...v }))
    .sort((a, b) => b.revenue - a.revenue);

  return sorted.slice(0, limit);
}

export type CategoryRevenue = { categoryName: string; revenue: number };

export async function getCategoryBreakdown(businessId: number, productId?: number, attributeValueId?: number) {
  const items = await prisma.saleItem.findMany({
    where: { businessId, ...saleItemScopeWhere(productId, attributeValueId) },
    select: {
      lineTotal: true,
      variant: { select: { product: { select: { category: { select: { name: true } } } } } },
    },
  });

  const byCategory = new Map<string, number>();
  for (const item of items) {
    const name = item.variant.product.category.name;
    byCategory.set(name, (byCategory.get(name) ?? 0) + item.lineTotal);
  }

  const sorted: CategoryRevenue[] = [...byCategory.entries()]
    .map(([categoryName, revenue]) => ({ categoryName, revenue }))
    .sort((a, b) => b.revenue - a.revenue);

  return sorted;
}

export type LowStockVariant = {
  id: number;
  productName: string;
  attributeLabel: string;
  stockQty: number;
  reorderLevel: number | null;
};

// Flags a variant if it's at/below the business low-stock threshold, at/below
// its own configured reorder level, OR simply out of stock (stockQty === 0) -
// out-of-stock is always worth surfacing even when no threshold was set (e.g.
// the Excel import never populated reorderLevel for any Fragrenz variant).
export async function getLowStockVariants(
  businessId: number,
  threshold: number,
  productId?: number,
  attributeValueId?: number,
) {
  const variants = await prisma.variant.findMany({
    where: { businessId, active: true, ...variantScopeWhere(productId, attributeValueId) },
    include: {
      product: true,
      attributes: { include: { attributeValue: true } },
    },
    orderBy: { stockQty: "asc" },
  });

  return variants
    .filter(
      (v) =>
        v.stockQty === 0 ||
        v.stockQty <= threshold ||
        (v.reorderLevel !== null && v.stockQty <= v.reorderLevel),
    )
    .map((v) => ({
      id: v.id,
      productName: v.product.name,
      attributeLabel: v.attributes.map((a) => a.attributeValue.value).join(" · "),
      stockQty: v.stockQty,
      reorderLevel: v.reorderLevel,
    }));
}

export type ExpiringVariant = {
  id: number;
  productName: string;
  attributeLabel: string;
  stockQty: number;
  expiresAt: Date;
  daysUntil: number; // negative = already expired
};

// Variants whose expiration is within `withinDays` (default 7) or already
// past. Only active variants with an expiration set and stock still on hand
// (stockQty > 0) - an out-of-stock expired variant needs no action.
export async function getExpiringVariants(
  businessId: number,
  withinDays = 7,
  productId?: number,
  attributeValueId?: number,
) {
  const variants = await prisma.variant.findMany({
    where: {
      businessId,
      active: true,
      expiresAt: { not: null },
      stockQty: { gt: 0 },
      ...variantScopeWhere(productId, attributeValueId),
    },
    include: {
      product: true,
      attributes: { include: { attributeValue: true } },
    },
  });

  const DAY = 24 * 60 * 60 * 1000;
  const now = new Date();
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

  return variants
    .map((v) => {
      const e = v.expiresAt as Date;
      const target = Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate());
      const days = Math.round((target - todayUtc) / DAY);
      return {
        id: v.id,
        productName: v.product.name,
        attributeLabel: v.attributes.map((a) => a.attributeValue.value).join(" · "),
        stockQty: v.stockQty,
        expiresAt: e,
        daysUntil: days,
      };
    })
    .filter((v) => v.daysUntil <= withinDays)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

// Unfiltered: average sale total. Filtered by product/variant: no single
// "order total" concept applies to one item within a multi-item sale, so this
// falls back to average line value (lineTotal) for that scope instead.
export async function getAverageOrderValue(businessId: number, productId?: number, attributeValueId?: number) {
  if (productId || attributeValueId) {
    const items = await prisma.saleItem.findMany({
      where: { businessId, ...saleItemScopeWhere(productId, attributeValueId) },
      select: { lineTotal: true },
    });
    if (items.length === 0) return 0;
    return Math.round(items.reduce((sum, i) => sum + i.lineTotal, 0) / items.length);
  }
  const sales = await prisma.sale.findMany({ where: { businessId }, select: { totalAmount: true } });
  if (sales.length === 0) return 0;
  return Math.round(sales.reduce((sum, s) => sum + s.totalAmount, 0) / sales.length);
}

export type ProductMargin = {
  productName: string;
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number; // profit / revenue, 0-100
};

export type CostAnalysis = {
  products: ProductMargin[];
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number;
  costedLineCount: number;
  totalLineCount: number;
};

// Margin analysis per product, using only sale_items with a captured unit_cost
// (unitCost is null for lines sold before cost was ever set - e.g. the Excel
// opening-balance import had no historical cost data). Products with zero
// costed lines are excluded from the per-product breakdown; costedLineCount vs
// totalLineCount lets the UI disclose how much of revenue this actually covers.
export async function getCostAnalysis(
  businessId: number,
  limit = 5,
  productId?: number,
  attributeValueId?: number,
): Promise<CostAnalysis> {
  const items = await prisma.saleItem.findMany({
    where: { businessId, ...saleItemScopeWhere(productId, attributeValueId) },
    select: {
      lineTotal: true,
      qty: true,
      unitPrice: true,
      unitCost: true,
      variant: { select: { product: { select: { name: true } } } },
    },
  });

  const totalLineCount = items.length;
  const costed = items.filter((i) => i.unitCost !== null);
  const costedLineCount = costed.length;

  const byProduct = new Map<string, { revenue: number; cost: number }>();
  for (const item of costed) {
    const name = item.variant.product.name;
    const entry = byProduct.get(name) ?? { revenue: 0, cost: 0 };
    entry.revenue += item.lineTotal;
    entry.cost += (item.unitCost ?? 0) * item.qty;
    byProduct.set(name, entry);
  }

  const products: ProductMargin[] = [...byProduct.entries()]
    .map(([productName, v]) => {
      const profit = v.revenue - v.cost;
      return {
        productName,
        revenue: v.revenue,
        cost: v.cost,
        profit,
        marginPct: v.revenue > 0 ? (profit / v.revenue) * 100 : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);

  const revenue = costed.reduce((sum, i) => sum + i.lineTotal, 0);
  const cost = costed.reduce((sum, i) => sum + (i.unitCost ?? 0) * i.qty, 0);
  const profit = revenue - cost;

  return {
    products,
    revenue,
    cost,
    profit,
    marginPct: revenue > 0 ? (profit / revenue) * 100 : 0,
    costedLineCount,
    totalLineCount,
  };
}
