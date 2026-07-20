import { prisma } from "@/lib/prisma";
import { NewSaleForm } from "./new-sale-form";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const [variants, sales] = await Promise.all([
    prisma.variant.findMany({
      where: { active: true, stockQty: { gt: 0 } },
      include: {
        product: true,
        attributes: { include: { attributeValue: true } },
      },
      orderBy: [{ product: { name: "asc" } }],
    }),
    prisma.sale.findMany({
      orderBy: { soldAt: "desc" },
      take: 20,
      include: { items: { include: { variant: { include: { product: true } } } } },
    }),
  ]);

  const variantOptions = variants.map((v) => ({
    id: v.id,
    label: `${v.product.name} (${v.attributes.map((a) => a.attributeValue.value).join(" · ")})`,
    price: v.price,
    stockQty: v.stockQty,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Sales</h1>
        <p className="text-sm text-gray-500">
          Record a sale. Stock is deducted immediately; oversell is blocked.
        </p>
      </div>

      <NewSaleForm variants={variantOptions} />

      <section className="rounded border bg-white">
        <h2 className="border-b px-4 py-3 font-medium">Recent sales</h2>
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Customer</th>
              <th className="px-4 py-2 font-medium">Items</th>
              <th className="px-4 py-2 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="px-4 py-2 text-gray-600">
                  {s.soldAt.toLocaleString()}
                </td>
                <td className="px-4 py-2">{s.customer ?? "—"}</td>
                <td className="px-4 py-2 text-gray-600">
                  {s.items
                    .map((i) => `${i.qty}× ${i.variant.product.name}`)
                    .join(", ")}
                </td>
                <td className="px-4 py-2 font-medium">₱{s.totalAmount.toLocaleString()}</td>
              </tr>
            ))}
            {sales.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                  No sales yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
