"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireBusinessContext } from "@/lib/auth";
import { assertUnderDemoCap } from "@/lib/demo-limits";

export async function createProduct(formData: FormData) {
  const { businessId } = await requireBusinessContext();

  const name = String(formData.get("name") ?? "").trim();
  const categoryId = Number(formData.get("categoryId"));
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!name || !categoryId) {
    throw new Error("Name and category are required.");
  }

  await assertUnderDemoCap(businessId, "product");

  await prisma.product.create({
    data: { businessId, name, categoryId, notes },
  });

  revalidatePath("/products");
}

export async function updateProduct(formData: FormData) {
  const { businessId } = await requireBusinessContext();

  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const categoryId = Number(formData.get("categoryId"));
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!id || !name || !categoryId) {
    throw new Error("Name and category are required.");
  }

  const existing = await prisma.product.findFirst({ where: { id, businessId } });
  if (!existing) {
    throw new Error("Product not found.");
  }

  await prisma.product.update({
    where: { id },
    data: { name, categoryId, notes },
  });

  revalidatePath("/products");
}

// Soft-delete: keeps historical sale links intact (CLAUDE.md section 2/4).
export async function setProductActive(formData: FormData) {
  const { businessId } = await requireBusinessContext();

  const id = Number(formData.get("id"));
  const active = formData.get("active") === "true";

  const existing = await prisma.product.findFirst({ where: { id, businessId } });
  if (!existing) {
    throw new Error("Product not found.");
  }

  await prisma.product.update({
    where: { id },
    data: { active },
  });

  revalidatePath("/products");
}

export async function createCategory(formData: FormData) {
  const { businessId } = await requireBusinessContext();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    throw new Error("Category name is required.");
  }

  await assertUnderDemoCap(businessId, "category");

  await prisma.category.create({ data: { businessId, name } });

  revalidatePath("/products");
}

export async function createAttribute(formData: FormData) {
  const { businessId } = await requireBusinessContext();

  const name = String(formData.get("name") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim() || null;
  if (!name) {
    throw new Error("Attribute name is required.");
  }

  await assertUnderDemoCap(businessId, "attribute");

  await prisma.attribute.create({ data: { businessId, name, unit } });

  revalidatePath("/products");
}

// Creates a variant (sellable SKU) for a product, along with any brand-new
// attribute values typed inline (e.g. a new Size not seen before) - see
// CLAUDE.md section 4 on variant_attribute. Existing attribute dimensions are
// optional per variant: a business may leave one blank for a given SKU.
export async function createVariant(formData: FormData) {
  const { businessId } = await requireBusinessContext();

  const productId = Number(formData.get("productId"));
  const sku = String(formData.get("sku") ?? "").trim() || null;
  const price = Number(formData.get("price"));
  const costRaw = formData.get("cost");
  const cost = costRaw === null || costRaw === "" ? null : Number(costRaw);
  const stockQty = Number(formData.get("stockQty") ?? 0);
  const reorderRaw = formData.get("reorderLevel");
  const reorderLevel = reorderRaw === null || reorderRaw === "" ? null : Number(reorderRaw);

  if (!productId || Number.isNaN(price)) {
    throw new Error("Valid product and price are required.");
  }

  const product = await prisma.product.findFirst({ where: { id: productId, businessId } });
  if (!product) {
    throw new Error("Product not found.");
  }

  await assertUnderDemoCap(businessId, "variant");

  const attributes = await prisma.attribute.findMany({ where: { businessId } });

  // For each business attribute, the form submits either
  // `attrValue_<attributeId>` (an existing AttributeValue id) or
  // `attrNew_<attributeId>` (free text for a brand-new value).
  const attributeValueIds: number[] = [];
  for (const attr of attributes) {
    const existingId = formData.get(`attrValue_${attr.id}`);
    const newValue = String(formData.get(`attrNew_${attr.id}`) ?? "").trim();

    if (newValue) {
      await assertUnderDemoCap(businessId, "attributeValue");
      const created = await prisma.attributeValue.create({
        data: { businessId, attributeId: attr.id, value: newValue },
      });
      attributeValueIds.push(created.id);
    } else if (existingId && String(existingId).length > 0) {
      attributeValueIds.push(Number(existingId));
    }
  }

  await prisma.$transaction(async (tx) => {
    const variant = await tx.variant.create({
      data: { businessId, productId, sku, price, cost, stockQty, reorderLevel },
    });

    if (attributeValueIds.length > 0) {
      await tx.variantAttribute.createMany({
        data: attributeValueIds.map((attributeValueId) => ({
          businessId,
          variantId: variant.id,
          attributeValueId,
        })),
      });
    }

    if (stockQty !== 0) {
      await tx.stockAdjustment.create({
        data: { businessId, variantId: variant.id, delta: stockQty, reason: "initial" },
      });
    }
  });

  revalidatePath("/products");
  revalidatePath("/inventory");
}

// Edits a variant's SKU and attribute values only - price/cost/stock stay
// editable from the Inventory page (CLAUDE.md section 2: editable pricing &
// stock lives there). Re-links attributes from scratch each save, same
// new-value-inline support as createVariant.
export async function updateVariant(formData: FormData) {
  const { businessId } = await requireBusinessContext();

  const variantId = Number(formData.get("variantId"));
  const sku = String(formData.get("sku") ?? "").trim() || null;

  if (!variantId) {
    throw new Error("Valid variant is required.");
  }

  const variant = await prisma.variant.findFirst({ where: { id: variantId, businessId } });
  if (!variant) {
    throw new Error("Variant not found.");
  }

  const attributes = await prisma.attribute.findMany({ where: { businessId } });

  const attributeValueIds: number[] = [];
  for (const attr of attributes) {
    const existingId = formData.get(`attrValue_${attr.id}`);
    const newValue = String(formData.get(`attrNew_${attr.id}`) ?? "").trim();

    if (newValue) {
      await assertUnderDemoCap(businessId, "attributeValue");
      const created = await prisma.attributeValue.create({
        data: { businessId, attributeId: attr.id, value: newValue },
      });
      attributeValueIds.push(created.id);
    } else if (existingId && String(existingId).length > 0) {
      attributeValueIds.push(Number(existingId));
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.variant.update({ where: { id: variantId }, data: { sku } });
    await tx.variantAttribute.deleteMany({ where: { variantId } });
    if (attributeValueIds.length > 0) {
      await tx.variantAttribute.createMany({
        data: attributeValueIds.map((attributeValueId) => ({
          businessId,
          variantId,
          attributeValueId,
        })),
      });
    }
  });

  revalidatePath("/products");
  revalidatePath("/inventory");
}

// Soft-delete, mirrors setProductActive: keeps historical sale_item links
// intact for a retired SKU (CLAUDE.md section 2/4).
export async function setVariantActive(formData: FormData) {
  const { businessId } = await requireBusinessContext();

  const variantId = Number(formData.get("variantId"));
  const active = formData.get("active") === "true";

  const variant = await prisma.variant.findFirst({ where: { id: variantId, businessId } });
  if (!variant) {
    throw new Error("Variant not found.");
  }

  await prisma.variant.update({ where: { id: variantId }, data: { active } });

  revalidatePath("/products");
  revalidatePath("/inventory");
}
