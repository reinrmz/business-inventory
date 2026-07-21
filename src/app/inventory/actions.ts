"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireBusinessContext } from "@/lib/auth";

// Editing price/cost never touches past sales (sale_item snapshots them).
// Every change is also appended to price_history so the timeline is visible.
export async function updatePricing(formData: FormData) {
  const { businessId } = await requireBusinessContext();

  const variantId = Number(formData.get("variantId"));
  const price = Number(formData.get("price"));
  const costRaw = formData.get("cost");
  const cost = costRaw === null || costRaw === "" ? null : Number(costRaw);

  if (!variantId || Number.isNaN(price)) {
    throw new Error("Valid variant and price are required.");
  }

  const variant = await prisma.variant.findFirst({ where: { id: variantId, businessId } });
  if (!variant) {
    throw new Error("Variant not found.");
  }

  await prisma.$transaction([
    prisma.variant.update({
      where: { id: variantId },
      data: { price, cost },
    }),
    prisma.priceHistory.create({
      data: { businessId, variantId, price, cost },
    }),
  ]);

  revalidatePath("/inventory");
}

export async function getPriceHistory(variantId: number) {
  const { businessId } = await requireBusinessContext();

  return prisma.priceHistory.findMany({
    where: { variantId, businessId },
    orderBy: { changedAt: "desc" },
  });
}

// Manual stock correction/restock outside a sale. Logged in stock_adjustment
// for an audit trail (CLAUDE.md section 4).
export async function adjustStock(formData: FormData) {
  const { businessId } = await requireBusinessContext();

  const variantId = Number(formData.get("variantId"));
  const delta = Number(formData.get("delta"));
  const reason = String(formData.get("reason") ?? "correction");
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!variantId || !delta) {
    throw new Error("Valid variant and non-zero delta are required.");
  }

  const variant = await prisma.variant.findFirst({ where: { id: variantId, businessId } });
  if (!variant) {
    throw new Error("Variant not found.");
  }

  await prisma.$transaction([
    prisma.variant.update({
      where: { id: variantId },
      data: { stockQty: { increment: delta } },
    }),
    prisma.stockAdjustment.create({
      data: { businessId, variantId, delta, reason, note },
    }),
  ]);

  revalidatePath("/inventory");
}
