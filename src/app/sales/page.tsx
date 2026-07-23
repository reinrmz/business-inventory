import { prisma } from "@/lib/prisma";
import { requireBusinessContext } from "@/lib/auth";
import { getCurrencySymbol } from "@/lib/currency";
import { NewSaleForm } from "./new-sale-form";
import { DateRangeFilter } from "@/components/date-range-filter";
import { Pagination } from "@/components/pagination";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; page?: string }>;
}) {
  const { businessId } = await requireBusinessContext();
  const { from, to, page: pageRaw } = await searchParams;
  const page = Math.max(1, Number(pageRaw) || 1);

  const soldAtFilter: { gte?: Date; lt?: Date } = {};
  if (from) soldAtFilter.gte = new Date(`${from}T00:00:00`);
  if (to) {
    const toDate = new Date(`${to}T00:00:00`);
    toDate.setDate(toDate.getDate() + 1); // inclusive of the whole "to" day
    soldAtFilter.lt = toDate;
  }

  const where = {
    businessId,
    ...(from || to ? { soldAt: soldAtFilter } : {}),
  };

  const [variants, sales, totalCount, cur] = await Promise.all([
    prisma.variant.findMany({
      where: { businessId, active: true, stockQty: { gt: 0 } },
      include: {
        product: true,
        attributes: { include: { attributeValue: true } },
      },
      orderBy: [{ product: { name: "asc" } }],
    }),
    prisma.sale.findMany({
      where,
      orderBy: { soldAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { items: { include: { variant: { include: { product: true } } } } },
    }),
    prisma.sale.count({ where }),
    getCurrencySymbol(businessId),
  ]);

  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const variantOptions = variants.map((v) => ({
    id: v.id,
    label: `${v.product.name} (${v.attributes.map((a) => a.attributeValue.value).join(" · ")})`,
    price: v.price,
    stockQty: v.stockQty,
  }));

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-accent">Transactions</p>
        <h1 className="font-display text-2xl font-bold">Sales</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Record a sale. Stock is deducted immediately; oversell is blocked.
        </p>
      </div>

      <NewSaleForm variants={variantOptions} currencySymbol={cur} />

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 className="font-display text-lg font-bold">
            Sales <span className="text-ink-muted font-normal">({totalCount})</span>
          </h2>
          <DateRangeFilter />
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-alt text-left text-xs font-semibold uppercase tracking-wide text-accent">
            <tr>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3">Customer</th>
              <th className="px-5 py-3">Items</th>
              <th className="px-5 py-3">Total</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0 even:bg-surface-alt">
                <td className="px-5 py-3 text-ink-muted">{s.soldAt.toLocaleString()}</td>
                <td className="px-5 py-3">{s.customer ?? "—"}</td>
                <td className="px-5 py-3 text-ink-muted">
                  {s.items.map((i) => `${i.qty}× ${i.variant.product.name}`).join(", ")}
                </td>
                <td className="tnum px-5 py-3 font-medium">
                  {cur}{s.totalAmount.toLocaleString()}
                </td>
              </tr>
            ))}
            {sales.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-ink-muted">
                  {from || to ? "No sales in this date range." : "No sales yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pagination page={page} pageCount={pageCount} basePath="/sales" searchParams={{ from, to }} />
      </section>
    </div>
  );
}
