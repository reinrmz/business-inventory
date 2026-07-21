// Shared demo-business seed/reset function - CLAUDE.md section 9.
// Used both at initial setup and by the periodic reset (Vercel Cron route
// at src/app/api/cron/reset-demo/route.ts). Deleting-then-reseeding the same
// businessId keeps "what the demo looks like" defined in exactly one place.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

export const DEMO_EMAIL = "demo@vessel.app";
export const DEMO_PASSWORD = "demodemo";
const DEMO_BUSINESS_NAME = "Demo Boutique";

async function ensureDemoUserAndBusiness() {
  let user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (!user) {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    user = await prisma.user.create({
      data: { email: DEMO_EMAIL, passwordHash, isAdmin: false, status: "APPROVED", name: "Demo" },
    });
  }

  let business = await prisma.business.findFirst({ where: { name: DEMO_BUSINESS_NAME } });
  if (!business) {
    business = await prisma.business.create({
      data: { name: DEMO_BUSINESS_NAME, status: "APPROVED" },
    });
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_businessId: { userId: user.id, businessId: business.id } },
  });
  if (!membership) {
    await prisma.membership.create({ data: { userId: user.id, businessId: business.id } });
  }

  return business.id;
}

async function clearBusinessData(businessId: number) {
  // Order matters - delete children before parents to satisfy FK constraints.
  await prisma.saleItem.deleteMany({ where: { businessId } });
  await prisma.sale.deleteMany({ where: { businessId } });
  await prisma.priceHistory.deleteMany({ where: { businessId } });
  await prisma.stockAdjustment.deleteMany({ where: { businessId } });
  await prisma.variantAttribute.deleteMany({ where: { businessId } });
  await prisma.variant.deleteMany({ where: { businessId } });
  await prisma.product.deleteMany({ where: { businessId } });
  await prisma.attributeValue.deleteMany({ where: { businessId } });
  await prisma.attribute.deleteMany({ where: { businessId } });
  await prisma.category.deleteMany({ where: { businessId } });
  await prisma.setting.deleteMany({ where: { businessId } });
}

export async function seedDemoBusinessData() {
  const businessId = await ensureDemoUserAndBusiness();
  await clearBusinessData(businessId);

  await prisma.setting.createMany({
    data: [
      { businessId, key: "currency", value: "USD" },
      { businessId, key: "reinvestment_goal_min", value: "5000" },
      { businessId, key: "reinvestment_goal_max", value: "8000" },
    ],
  });

  const category = await prisma.category.create({
    data: { businessId, name: "Candles" },
  });

  const sizeAttr = await prisma.attribute.create({
    data: { businessId, name: "Size", unit: "oz" },
  });
  const sizeValues = await Promise.all(
    ["8 oz", "12 oz", "16 oz"].map((value, i) =>
      prisma.attributeValue.create({ data: { businessId, attributeId: sizeAttr.id, value, sortOrder: i } }),
    ),
  );

  const products = [
    { name: "Vanilla Bean", prices: [18, 24, 30], stock: [12, 8, 5] },
    { name: "Sandalwood Amber", prices: [20, 26, 32], stock: [9, 6, 3] },
    { name: "Sea Salt & Sage", prices: [18, 24, 30], stock: [15, 10, 7] },
  ];

  let firstVariantId: number | null = null;
  let firstVariantPrice = 0;

  for (const product of products) {
    const productRow = await prisma.product.create({
      data: { businessId, categoryId: category.id, name: product.name },
    });

    for (let i = 0; i < sizeValues.length; i++) {
      const variantRow = await prisma.variant.create({
        data: {
          businessId,
          productId: productRow.id,
          price: product.prices[i],
          cost: Math.round(product.prices[i] * 0.4),
          stockQty: product.stock[i],
        },
      });
      await prisma.variantAttribute.create({
        data: { businessId, variantId: variantRow.id, attributeValueId: sizeValues[i].id },
      });

      if (firstVariantId === null) {
        firstVariantId = variantRow.id;
        firstVariantPrice = product.prices[i];
      }
    }
  }

  if (firstVariantId !== null) {
    await prisma.sale.create({
      data: {
        businessId,
        note: "Demo sale",
        totalAmount: firstVariantPrice * 2,
        items: {
          create: [
            {
              businessId,
              variantId: firstVariantId,
              qty: 2,
              unitPrice: firstVariantPrice,
              unitCost: Math.round(firstVariantPrice * 0.4),
              lineTotal: firstVariantPrice * 2,
            },
          ],
        },
      },
    });
  }

  return businessId;
}

// Manual CLI entry point: `npx tsx prisma/seed-demo.ts`
if (require.main === module) {
  seedDemoBusinessData()
    .then((businessId) => {
      console.log(`Demo business (id ${businessId}) seeded/reset.`);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
