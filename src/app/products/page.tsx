import { prisma } from "@/lib/prisma";
import { requireBusinessContext } from "@/lib/auth";
import { createProduct, setProductActive, createCategory } from "./actions";
import { EditProductForm } from "./edit-product-form";
import { AddVariantForm } from "./add-variant-form";
import { VariantRow } from "./variant-row";
import { ProductsFilters } from "./products-filters";
import { SearchBox } from "@/components/search-box";
import { Pagination } from "@/components/pagination";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; category?: string }>;
}) {
  const { businessId } = await requireBusinessContext();
  const { q, page: pageRaw, category } = await searchParams;
  const page = Math.max(1, Number(pageRaw) || 1);
  const categoryId = category ? Number(category) : null;

  const where = {
    businessId,
    ...(q ? { name: { contains: q } } : {}),
    ...(categoryId ? { categoryId } : {}),
  };

  const [categories, products, totalCount, attributes] = await Promise.all([
    prisma.category.findMany({ where: { businessId, active: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({
      where,
      include: {
        category: true,
        variants: {
          include: { attributes: { include: { attributeValue: true } } },
          orderBy: { id: "asc" },
        },
      },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.product.count({ where }),
    prisma.attribute.findMany({
      where: { businessId },
      include: { values: { orderBy: { sortOrder: "asc" } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const filtersActive = Boolean(category);
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-accent">Catalog</p>
        <h1 className="font-display text-2xl font-bold">Products</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Add, edit, or retire products. Retired products stay linked to past sales.
        </p>
      </div>

      <section className="label-card p-5">
        <h2 className="mb-3 font-display text-lg font-bold">
          {categories.length === 0 ? "Create your first category" : "Add a category"}
        </h2>
        <form action={createCategory} className="flex gap-2">
          <input
            name="name"
            placeholder="e.g. Main Decants"
            required
            className="flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none transition-standard focus:border-accent"
          />
          <button className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-standard hover:opacity-90">
            Add category
          </button>
        </form>
      </section>

      {categories.length > 0 && (
        <section className="label-card p-5">
          <h2 className="mb-4 font-display text-lg font-bold">Add a product</h2>
          <form action={createProduct} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <input
              name="name"
              placeholder="Product name"
              required
              className="rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none transition-standard focus:border-accent sm:col-span-2"
            />
            <select
              name="categoryId"
              required
              className="rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none transition-standard focus:border-accent"
            >
              <option value="">Category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-standard hover:opacity-90">
              Add product
            </button>
            <input
              name="notes"
              placeholder="Notes (optional)"
              className="rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none transition-standard focus:border-accent sm:col-span-4"
            />
          </form>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <SearchBox placeholder="Search products…" />
          <ProductsFilters categories={categories} />
        </div>
        <p className="text-xs text-ink-muted">
          {totalCount} product{totalCount === 1 ? "" : "s"}
        </p>
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-alt text-left text-xs font-semibold uppercase tracking-wide text-accent">
            <tr>
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Category</th>
              <th className="px-5 py-3">Variants</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b border-border align-top last:border-0 even:bg-surface-alt">
                <td className="px-5 py-3">
                  <EditProductForm
                    product={{ id: p.id, name: p.name, categoryId: p.categoryId, notes: p.notes }}
                    categories={categories}
                  />
                </td>
                <td className="px-5 py-3 text-ink-muted">{p.category.name}</td>
                <td className="px-5 py-3">
                  <div className="space-y-1">
                    {p.variants.length > 0 && (
                      <ul className="space-y-1 text-xs text-ink-muted">
                        {p.variants.map((v) => (
                          <VariantRow key={v.id} variant={v} attributes={attributes} />
                        ))}
                      </ul>
                    )}
                    <AddVariantForm productId={p.id} attributes={attributes} />
                  </div>
                </td>
                <td className="px-5 py-3">
                  {p.active ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
                      <span className="h-1.5 w-1.5 rounded-full bg-success" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                      <span className="h-1.5 w-1.5 rounded-full bg-ink-muted" />
                      Retired
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  <form action={setProductActive}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="active" value={(!p.active).toString()} />
                    <button className="text-xs font-medium text-ink-muted underline decoration-border underline-offset-2 transition-standard hover:text-accent">
                      {p.active ? "Retire" : "Reactivate"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-ink-muted">
                  {q
                    ? `No products match "${q}".`
                    : filtersActive
                      ? "No products match the selected filters."
                      : "No products yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pagination
          page={page}
          pageCount={pageCount}
          basePath="/products"
          searchParams={{ q, category }}
        />
      </section>
    </div>
  );
}
