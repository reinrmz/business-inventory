"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

// Editing price/cost never touches past sales (sale_item snapshots them).
// Every change is also appended to price_history so the timeline is visible.
export async function updatePricing(formData: FormData) {
  const variantId = Number(formData.get("variantId"));
  const price = Number(formData.get("price"));
  const costRaw = formData.get("cost");
  const cost = costRaw === null || costRaw === "" ? null : Number(costRaw);

  if (!variantId || Number.isNaN(price)) {
    throw new Error("Valid variant and price are required.");
  }

  await prisma.$transaction([
    prisma.variant.update({
      where: { id: variantId },
      data: { price, cost },
    }),
    prisma.priceHistory.create({
      data: { variantId, price, cost },
    }),
  ]);

  revalidatePath("/inventory");
}

// Manual stock correction/restock outside a sale. Logged in stock_adjustment
// for an audit trail (CLAUDE.md section 4).
export async function adjustStock(formData: FormData) {
  const variantId = Number(formData.get("variantId"));
  const delta = Number(formData.get("delta"));
  const reason = String(formData.get("reason") ?? "correction");
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!variantId || !delta) {
    throw new Error("Valid variant and non-zero delta are required.");
  }

  await prisma.$transaction([
    prisma.variant.update({
      where: { id: variantId },
      data: { stockQty: { increment: delta } },
    }),
    prisma.stockAdjustment.create({
      data: { variantId, delta, reason, note },
    }),
  ]);

  revalidatePath("/inventory");
}
