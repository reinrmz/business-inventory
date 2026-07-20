import { prisma } from "@/lib/prisma";
import { createProduct, setProductActive, createCategory } from "./actions";
import { EditProductForm } from "./edit-product-form";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const [categories, products] = await Promise.all([
    prisma.category.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({
      include: { category: true, variants: { where: { active: true } } },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Products</h1>
        <p className="text-sm text-gray-500">
          Add, edit, or retire products. Retired products stay linked to past sales.
        </p>
      </div>

      {categories.length === 0 ? (
        <section className="rounded border bg-white p-4">
          <h2 className="mb-2 font-medium">Create your first category</h2>
          <form action={createCategory} className="flex gap-2">
            <input
              name="name"
              placeholder="e.g. Main Decants"
              required
              className="flex-1 rounded border px-3 py-2 text-sm"
            />
            <button className="rounded bg-gray-900 px-4 py-2 text-sm text-white">
              Add category
            </button>
          </form>
        </section>
      ) : (
        <section className="rounded border bg-white p-4">
          <h2 className="mb-3 font-medium">Add a product</h2>
          <form action={createProduct} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <input
              name="name"
              placeholder="Product name"
              required
              className="rounded border px-3 py-2 text-sm sm:col-span-2"
            />
            <select name="categoryId" required className="rounded border px-3 py-2 text-sm">
              <option value="">Category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button className="rounded bg-gray-900 px-4 py-2 text-sm text-white">
              Add product
            </button>
            <input
              name="notes"
              placeholder="Notes (optional)"
              className="rounded border px-3 py-2 text-sm sm:col-span-4"
            />
          </form>
        </section>
      )}

      <section className="rounded border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium">Variants</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="px-4 py-2">
                  <EditProductForm
                    product={{ id: p.id, name: p.name, categoryId: p.categoryId, notes: p.notes }}
                    categories={categories}
                  />
                </td>
                <td className="px-4 py-2 text-gray-600">{p.category.name}</td>
                <td className="px-4 py-2 text-gray-600">{p.variants.length}</td>
                <td className="px-4 py-2">
                  {p.active ? (
                    <span className="text-green-700">Active</span>
                  ) : (
                    <span className="text-gray-400">Retired</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <form action={setProductActive}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="active" value={(!p.active).toString()} />
                    <button className="text-xs text-gray-500 underline hover:text-gray-900">
                      {p.active ? "Retire" : "Reactivate"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  No products yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
