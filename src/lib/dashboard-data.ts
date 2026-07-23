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

// Daily (last 30 days) or weekly (last 12 weeks) revenue trend. SQLite has no
// clean DATE_TRUNC via Prisma, so we fetch raw sale_items in range and bucket
// in JS - fine at this data scale (a few hundred rows per business).
export async function getSalesTrend(businessId: number, granularity: "daily" | "weekly") {
  const now = new Date();
  const bucketCount = granularity === "daily" ? 30 : 12;
  const bucketStart = granularity === "daily" ? startOfDay : startOfWeek;
  const bucketMs = granularity === "daily" ? DAY_MS : DAY_MS * 7;

  const rangeStart = new Date(bucketStart(now).getTime() - (bucketCount - 1) * bucketMs);

  const items = await prisma.saleItem.findMany({
    where: { businessId, sale: { soldAt: { gte: rangeStart } } },
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

export async function getTopProducts(businessId: number, limit = 5) {
  const items = await prisma.saleItem.findMany({
    where: { businessId },
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

export async function getCategoryBreakdown(businessId: number) {
  const items = await prisma.saleItem.findMany({
    where: { businessId },
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
export async function getLowStockVariants(businessId: number, threshold: number) {
  const variants = await prisma.variant.findMany({
    where: { businessId, active: true },
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
export async function getExpiringVariants(businessId: number, withinDays = 7) {
  const variants = await prisma.variant.findMany({
    where: { businessId, active: true, expiresAt: { not: null }, stockQty: { gt: 0 } },
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

export async function getAverageOrderValue(businessId: number) {
  const sales = await prisma.sale.findMany({ where: { businessId }, select: { totalAmount: true } });
  if (sales.length === 0) return 0;
  return Math.round(sales.reduce((sum, s) => sum + s.totalAmount, 0) / sales.length);
}
