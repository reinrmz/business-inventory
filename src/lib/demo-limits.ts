import { prisma } from "./prisma";

const DEMO_BUSINESS_NAME = "Demo Boutique";

const CAPS = {
  category: 20,
  product: 200,
  attribute: 20,
  attributeValue: 100,
  variant: 500,
  sale: 500,
} as const;

type CappedTable = keyof typeof CAPS;

let demoBusinessId: number | null | undefined;

async function getDemoBusinessId(): Promise<number | null> {
  if (demoBusinessId !== undefined) return demoBusinessId;
  const business = await prisma.business.findFirst({ where: { name: DEMO_BUSINESS_NAME } });
  demoBusinessId = business?.id ?? null;
  return demoBusinessId;
}

async function countForTable(table: CappedTable, businessId: number): Promise<number> {
  switch (table) {
    case "category":
      return prisma.category.count({ where: { businessId } });
    case "product":
      return prisma.product.count({ where: { businessId } });
    case "attribute":
      return prisma.attribute.count({ where: { businessId } });
    case "attributeValue":
      return prisma.attributeValue.count({ where: { businessId } });
    case "variant":
      return prisma.variant.count({ where: { businessId } });
    case "sale":
      return prisma.sale.count({ where: { businessId } });
  }
}

// Blocks further inserts once the demo business hits a per-table cap, so a
// spamming visitor can't bloat Turso storage or degrade the shared demo for
// everyone else before the nightly reset runs. No-op for real businesses.
export async function assertUnderDemoCap(businessId: number, table: CappedTable) {
  const demoId = await getDemoBusinessId();
  if (demoId === null || businessId !== demoId) return;

  const count = await countForTable(table, businessId);

  if (count >= CAPS[table]) {
    throw new Error(
      `Demo limit reached (${CAPS[table]} ${table}s). This resets nightly - try again later, or sign up for your own business.`,
    );
  }
}
