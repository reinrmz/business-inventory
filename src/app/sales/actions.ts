"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

type SaleLine = { variantId: number; qty: number };

// Records a sale as one atomic transaction: validates stock for every line
// BEFORE writing anything, then inserts sale + items and decrements stock.
// Oversell is blocked (CLAUDE.md section 6 decision) - the whole sale is
// rejected if any line requests more than what's on hand.
export async function recordSale(lines: SaleLine[], customer: string | null, note: string | null) {
  const validLines = lines.filter((l) => l.variantId && l.qty > 0);
  if (validLines.length === 0) {
    throw new Error("Add at least one item to the sale.");
  }

  await prisma.$transaction(async (tx) => {
    const variantIds = validLines.map((l) => l.variantId);
    const variants = await tx.variant.findMany({ where: { id: { in: variantIds } } });
    const variantById = new Map(variants.map((v) => [v.id, v]));

    for (const line of validLines) {
      const variant = variantById.get(line.variantId);
      if (!variant) {
        throw new Error(`Variant ${line.variantId} not found.`);
      }
      if (variant.stockQty < line.qty) {
        throw new Error(
          `Not enough stock for variant ${variant.id}: ${variant.stockQty} available, ${line.qty} requested.`,
        );
      }
    }

    let totalAmount = 0;
    const itemsData = validLines.map((line) => {
      const variant = variantById.get(line.variantId)!;
      const lineTotal = variant.price * line.qty;
      totalAmount += lineTotal;
      return {
        variantId: variant.id,
        qty: line.qty,
        unitPrice: variant.price,
        unitCost: variant.cost,
        lineTotal,
      };
    });

    const sale = await tx.sale.create({
      data: {
        customer: customer || null,
        note: note || null,
        totalAmount,
        items: { create: itemsData },
      },
    });

    for (const line of validLines) {
      await tx.variant.update({
        where: { id: line.variantId },
        data: { stockQty: { decrement: line.qty } },
      });
    }

    return sale;
  });

  revalidatePath("/sales");
  revalidatePath("/inventory");
  revalidatePath("/");
}
