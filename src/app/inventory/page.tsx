import { prisma } from "@/lib/prisma";
import { InventoryRow } from "./inventory-row";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const variants = await prisma.variant.findMany({
    where: { active: true },
    include: {
      product: true,
      attributes: {
        include: { attributeValue: { include: { attribute: true } } },
      },
    },
    orderBy: [{ product: { name: "asc" } }],
  });

  const stockValue = variants.reduce((sum, v) => sum + v.stockQty * v.price, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold">Inventory</h1>
          <p className="text-sm text-gray-500">
            Stock on hand per SKU. Click price/stock to edit.
          </p>
        </div>
        <div className="text-right text-sm text-gray-600">
          Stock value: <span className="font-semibold">₱{stockValue.toLocaleString()}</span>
        </div>
      </div>

      <section className="rounded border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">Product</th>
              <th className="px-4 py-2 font-medium">Variant</th>
              <th className="px-4 py-2 font-medium">Stock</th>
              <th className="px-4 py-2 font-medium">Price / Cost</th>
              <th className="px-4 py-2 font-medium"></th>
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
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  No inventory yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
