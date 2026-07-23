"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

type AttributeValueOption = { id: number; label: string; attributeName: string; productIds: number[] };

export function ProductFilter({
  products,
  attributeValues,
}: {
  products: { id: number; name: string }[];
  attributeValues: AttributeValueOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const productId = searchParams.get("product") ?? "";
  const attrValueId = searchParams.get("attrValue") ?? "";

  function applyProduct(value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set("product", value);
    else params.delete("product");
    // Drop attrValue if it no longer applies to the newly picked product.
    if (attrValueId && value) {
      const stillValid = attributeValues
        .find((av) => av.id === Number(attrValueId))
        ?.productIds.includes(Number(value));
      if (!stillValid) params.delete("attrValue");
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function applyAttrValue(value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set("attrValue", value);
    else params.delete("attrValue");
    // Drop product if it no longer carries the newly picked variant.
    if (productId && value) {
      const stillValid = attributeValues
        .find((av) => av.id === Number(value))
        ?.productIds.includes(Number(productId));
      if (!stillValid) params.delete("product");
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  // Each dropdown narrows the other: picking a variant hides products that
  // never come in it; picking a product hides variants it doesn't have.
  const productsToShow = attrValueId
    ? products.filter((p) =>
        attributeValues.find((av) => av.id === Number(attrValueId))?.productIds.includes(p.id),
      )
    : products;

  const attributeValuesToShow = productId
    ? attributeValues.filter((av) => av.productIds.includes(Number(productId)))
    : attributeValues;

  const groups = new Map<string, AttributeValueOption[]>();
  for (const av of attributeValuesToShow) {
    const group = groups.get(av.attributeName) ?? [];
    group.push(av);
    groups.set(av.attributeName, group);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={productId}
        onChange={(e) => applyProduct(e.target.value)}
        className="rounded-lg border border-border bg-bg px-3 py-1.5 text-xs font-medium outline-none focus:border-accent"
      >
        <option value="">All products</option>
        {productsToShow.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <select
        value={attrValueId}
        onChange={(e) => applyAttrValue(e.target.value)}
        className="rounded-lg border border-border bg-bg px-3 py-1.5 text-xs font-medium outline-none focus:border-accent"
      >
        <option value="">All variants</option>
        {[...groups.entries()].map(([attributeName, values]) => (
          <optgroup key={attributeName} label={attributeName}>
            {values.map((av) => (
              <option key={av.id} value={av.id}>
                {av.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
