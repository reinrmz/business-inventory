import { prisma } from "@/lib/prisma";
import { requireBusinessContext } from "@/lib/auth";
import { currencySymbolFor } from "@/lib/currency";
import { getSettings } from "@/lib/settings";
import {
  getSalesTrend,
  getTopProducts,
  getCategoryBreakdown,
  getLowStockVariants,
  getExpiringVariants,
  getAverageOrderValue,
  getCostAnalysis,
} from "@/lib/dashboard-data";
import { SalesTrendChart } from "@/components/sales-trend-chart";
import { TopProductsChart } from "@/components/top-products-chart";
import { CategoryBreakdownChart } from "@/components/category-breakdown-chart";
import { LowStockPanel } from "@/components/low-stock-panel";
import { ExpiringPanel } from "@/components/expiring-panel";
import { CostAnalysisChart } from "@/components/cost-analysis-chart";
import { ProductFilter } from "@/components/product-filter";

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  sub,
  gold,
}: {
  label: string;
  value: string;
  sub?: string;
  gold?: boolean;
}) {
  return (
    <div className={`label-card p-5 ${gold ? "label-card--gold" : ""}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="tnum mt-2 font-display text-3xl font-bold">{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-muted">{sub}</p>}
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; attrValue?: string }>;
}) {
  const { businessId } = await requireBusinessContext();
  const { product: productRaw, attrValue: attrValueRaw } = await searchParams;
  const productId = productRaw ? Number(productRaw) : undefined;
  const attributeValueId = attrValueRaw ? Number(attrValueRaw) : undefined;

  const settings = await getSettings(businessId);

  const variantScopeWhere = {
    ...(productId ? { productId } : {}),
    ...(attributeValueId ? { attributes: { some: { attributeValueId } } } : {}),
  };
  const saleItemScopeWhere =
    productId || attributeValueId ? { variant: variantScopeWhere } : {};

  const [saleItems, activeVariants, dailyTrend, weeklyTrend, topProducts, categoryBreakdown, lowStock, expiring, avgOrderValue, costAnalysis, allProducts, allAttributeValues] =
    await Promise.all([
      prisma.saleItem.findMany({
        where: { businessId, ...saleItemScopeWhere },
      }),
      prisma.variant.findMany({
        where: { businessId, active: true, ...variantScopeWhere },
      }),
      getSalesTrend(businessId, "daily", productId, attributeValueId),
      getSalesTrend(businessId, "weekly", productId, attributeValueId),
      getTopProducts(businessId, 5, productId, attributeValueId),
      getCategoryBreakdown(businessId, productId, attributeValueId),
      getLowStockVariants(businessId, settings.lowStockThreshold, productId, attributeValueId),
      getExpiringVariants(businessId, settings.expirySoonDays, productId, attributeValueId),
      getAverageOrderValue(businessId, productId, attributeValueId),
      getCostAnalysis(businessId, 5, productId, attributeValueId),
      prisma.product.findMany({
        where: { businessId, active: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      // Distinct attribute values actually in use by an active variant, plus
      // which products carry each one - drives the "Variant" filter dropdown
      // and lets the product dropdown narrow when a variant is picked first.
      prisma.attributeValue.findMany({
        where: { businessId, variantLinks: { some: { variant: { active: true } } } },
        include: {
          attribute: true,
          variantLinks: { where: { variant: { active: true } }, select: { variant: { select: { productId: true } } } },
        },
        orderBy: [{ attribute: { name: "asc" } }, { sortOrder: "asc" }],
      }),
    ]);

  const currency = settings.currency;
  const cur = currencySymbolFor(currency);
  const goalMin = settings.reinvestmentGoalMin;
  const goalMax = settings.reinvestmentGoalMax;

  const revenue = saleItems.reduce((sum, i) => sum + i.lineTotal, 0);
  const profit = saleItems.reduce(
    (sum, i) => sum + (i.unitPrice - (i.unitCost ?? 0)) * i.qty,
    0,
  );
  const stockValue = activeVariants.reduce((sum, v) => sum + v.stockQty * v.price, 0);

  const attributeValueOptions = allAttributeValues.map((av) => ({
    id: av.id,
    label: av.value,
    attributeName: av.attribute.name,
    productIds: [...new Set(av.variantLinks.map((l) => l.variant.productId))],
  }));

  const goalProgress = goalMax > 0 ? Math.min(100, Math.round((profit / goalMax) * 100)) : 0;
  const isFiltered = Boolean(productId || attributeValueId);
  const selectedProductName = productId ? allProducts.find((p) => p.id === productId)?.name : undefined;
  const selectedAttrValueLabel = attributeValueId
    ? attributeValueOptions.find((av) => av.id === attributeValueId)?.label
    : undefined;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-accent">Overview</p>
        <h1 className="font-display text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Sales, profit, and stock at a glance.
        </p>
      </div>

      <div className="sticky top-0 z-10 -mx-6 border-b border-border bg-bg/95 px-6 py-3 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-3">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">Filter by</span>
            <ProductFilter products={allProducts} attributeValues={attributeValueOptions} />
          </div>

          {isFiltered && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 px-4 py-2 text-sm">
              <span className="text-ink-muted">Showing:</span>
              {selectedProductName && <span className="font-medium">{selectedProductName}</span>}
              {selectedAttrValueLabel && (
                <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                  {selectedAttrValueLabel}
                </span>
              )}
              <a href="/" className="ml-auto text-xs font-medium text-accent hover:underline">
                Clear filter
              </a>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Revenue" value={`${cur}${revenue.toLocaleString()}`} sub={currency} />
        <StatCard label="Profit" value={`${cur}${profit.toLocaleString()}`} gold />
        <StatCard label="Stock value" value={`${cur}${stockValue.toLocaleString()}`} />
        <StatCard label="Avg order value" value={`${cur}${avgOrderValue.toLocaleString()}`} />
      </div>

      {goalMax > 0 && !isFiltered && (
        <section className="label-card label-card--gold p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-lg font-bold">Reinvestment goal</h2>
            <span className="tnum text-sm text-ink-muted">
              {cur}{goalMin.toLocaleString()}–{cur}{goalMax.toLocaleString()}
            </span>
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gold-soft">
            <div
              className="transition-standard h-full rounded-full bg-gold"
              style={{ width: `${goalProgress}%` }}
            />
          </div>
          <p className="tnum mt-2 text-xs text-ink-muted">
            {cur}{profit.toLocaleString()} profit so far — {goalProgress}% of {cur}
            {goalMax.toLocaleString()} goal
          </p>
        </section>
      )}

      <SalesTrendChart
        daily={dailyTrend.map((p) => ({ label: p.label, revenue: p.revenue }))}
        weekly={weeklyTrend.map((p) => ({ label: p.label, revenue: p.revenue }))}
        currencySymbol={cur}
      />

      <CostAnalysisChart
        products={costAnalysis.products}
        revenue={costAnalysis.revenue}
        cost={costAnalysis.cost}
        profit={costAnalysis.profit}
        marginPct={costAnalysis.marginPct}
        costedLineCount={costAnalysis.costedLineCount}
        totalLineCount={costAnalysis.totalLineCount}
        currencySymbol={cur}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TopProductsChart products={topProducts} currencySymbol={cur} />
        <CategoryBreakdownChart categories={categoryBreakdown} currencySymbol={cur} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <LowStockPanel variants={lowStock} />
        <ExpiringPanel variants={expiring} />
      </div>
    </div>
  );
}
