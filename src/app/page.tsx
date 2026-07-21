import { prisma } from "@/lib/prisma";
import { requireBusinessContext } from "@/lib/auth";
import { currencySymbolFor } from "@/lib/currency";
import {
  getSalesTrend,
  getTopProducts,
  getCategoryBreakdown,
  getLowStockVariants,
  getAverageOrderValue,
} from "@/lib/dashboard-data";
import { SalesTrendChart } from "@/components/sales-trend-chart";
import { TopProductsChart } from "@/components/top-products-chart";
import { CategoryBreakdownChart } from "@/components/category-breakdown-chart";
import { LowStockPanel } from "@/components/low-stock-panel";

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

export default async function DashboardPage() {
  const { businessId } = await requireBusinessContext();

  const [saleItems, variants, settings, dailyTrend, weeklyTrend, topProducts, categoryBreakdown, lowStock, avgOrderValue] =
    await Promise.all([
      prisma.saleItem.findMany({ where: { businessId } }),
      prisma.variant.findMany({ where: { businessId, active: true } }),
      prisma.setting.findMany({ where: { businessId } }),
      getSalesTrend(businessId, "daily"),
      getSalesTrend(businessId, "weekly"),
      getTopProducts(businessId),
      getCategoryBreakdown(businessId),
      getLowStockVariants(businessId),
      getAverageOrderValue(businessId),
    ]);

  const settingMap = new Map(settings.map((s) => [s.key, s.value]));
  const currency = settingMap.get("currency") ?? "PHP";
  const cur = currencySymbolFor(currency);
  const goalMin = Number(settingMap.get("reinvestment_goal_min") ?? 0);
  const goalMax = Number(settingMap.get("reinvestment_goal_max") ?? 0);

  const revenue = saleItems.reduce((sum, i) => sum + i.lineTotal, 0);
  const profit = saleItems.reduce(
    (sum, i) => sum + (i.unitPrice - (i.unitCost ?? 0)) * i.qty,
    0,
  );
  const stockValue = variants.reduce((sum, v) => sum + v.stockQty * v.price, 0);

  const goalProgress = goalMax > 0 ? Math.min(100, Math.round((profit / goalMax) * 100)) : 0;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-accent">Overview</p>
        <h1 className="font-display text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Sales, profit, and stock at a glance.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Revenue" value={`${cur}${revenue.toLocaleString()}`} sub={currency} />
        <StatCard label="Profit" value={`${cur}${profit.toLocaleString()}`} gold />
        <StatCard label="Stock value" value={`${cur}${stockValue.toLocaleString()}`} />
        <StatCard label="Avg order value" value={`${cur}${avgOrderValue.toLocaleString()}`} />
      </div>

      {goalMax > 0 && (
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TopProductsChart products={topProducts} currencySymbol={cur} />
        <CategoryBreakdownChart categories={categoryBreakdown} currencySymbol={cur} />
      </div>

      <LowStockPanel variants={lowStock} />
    </div>
  );
}
