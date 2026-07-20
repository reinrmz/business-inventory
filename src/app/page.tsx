import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded border bg-white p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

export default async function DashboardPage() {
  const [saleItems, variants, settings] = await Promise.all([
    prisma.saleItem.findMany(),
    prisma.variant.findMany({ where: { active: true } }),
    prisma.setting.findMany(),
  ]);

  const settingMap = new Map(settings.map((s) => [s.key, s.value]));
  const currency = settingMap.get("currency") ?? "PHP";
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
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-gray-500">Overview of sales, profit, and stock.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Revenue" value={`₱${revenue.toLocaleString()}`} sub={currency} />
        <StatCard label="Profit" value={`₱${profit.toLocaleString()}`} />
        <StatCard label="Stock value" value={`₱${stockValue.toLocaleString()}`} />
      </div>

      {goalMax > 0 && (
        <section className="rounded border bg-white p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-medium">Reinvestment goal</h2>
            <span className="text-sm text-gray-500">
              ₱{goalMin.toLocaleString()}–₱{goalMax.toLocaleString()}
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded bg-gray-100">
            <div
              className="h-full bg-gray-900"
              style={{ width: `${goalProgress}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            ₱{profit.toLocaleString()} profit so far ({goalProgress}% of ₱{goalMax.toLocaleString()})
          </p>
        </section>
      )}
    </div>
  );
}
