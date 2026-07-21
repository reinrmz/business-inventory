// Reads prisma/seed_data/seed.json (produced by scripts/extract_excel.py)
// and populates the local dev database. Run with: npx prisma db seed
//
// Creates (idempotently, by name/email) the Fragrenz business and its admin
// login, then imports the Excel-derived data scoped to that business.
// See CLAUDE.md section 9 for the multi-tenant auth design this supports.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

const FRAGRENZ_BUSINESS_NAME = "Fragrenz";
const ADMIN_EMAIL = "admin@fragrenz.local";
const ADMIN_PASSWORD = "changeme123"; // placeholder - change after first login

type SeedVariant = {
  size: string;
  concentration: number | null;
  stockQty: number;
  price: number | null;
};

type SeedProduct = {
  name: string;
  category: string;
  variants: SeedVariant[];
};

type OpeningSaleLine = {
  productName: string;
  category: string;
  size: string;
  concentration: number | null;
  qty: number;
  unitPrice: number | null;
};

type SeedData = {
  settings: { key: string; value: string }[];
  categories: { name: string }[];
  attributes: { name: string; unit: string | null; values: { value: string; sortOrder: number }[] }[];
  products: SeedProduct[];
  openingSale: OpeningSaleLine[];
};

// Last-resort fallback price per size, used only when extract_excel.py
// couldn't resolve a price at all (currently just the 10 ML / 20% oil
// variant — that cell was left blank in the workbook, no formula anywhere).
// Client should set the real price for that one variant in the Inventory
// screen once seeded.
const SIZE_DEFAULT_PRICE: Record<string, number> = {
  "50 ML": 300,
  "30 ML": 200,
  "100 ML (type A)": 500,
  "100 ML (type B)": 450,
  Scraps: 200,
  "10 ML": 100,
  "10 ML (LP)": 80,
};

async function ensureFragrenzBusinessAndAdmin() {
  let business = await prisma.business.findFirst({ where: { name: FRAGRENZ_BUSINESS_NAME } });
  if (!business) {
    business = await prisma.business.create({
      data: { name: FRAGRENZ_BUSINESS_NAME, status: "APPROVED" },
    });
  }

  let admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!admin) {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    admin = await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        passwordHash,
        isAdmin: true,
        status: "APPROVED",
      },
    });
    console.log(`Created admin login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD} (change after first login)`);
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_businessId: { userId: admin.id, businessId: business.id } },
  });
  if (!membership) {
    await prisma.membership.create({ data: { userId: admin.id, businessId: business.id } });
  }

  return business.id;
}

async function main() {
  const businessId = await ensureFragrenzBusinessAndAdmin();

  const raw = readFileSync(join(__dirname, "seed_data", "seed.json"), "utf-8");
  const data: SeedData = JSON.parse(raw);

  for (const setting of data.settings) {
    await prisma.setting.upsert({
      where: { businessId_key: { businessId, key: setting.key } },
      update: { value: setting.value },
      create: { businessId, key: setting.key, value: setting.value },
    });
  }

  const categoryByName = new Map<string, number>();
  for (const cat of data.categories) {
    const row = await prisma.category.create({ data: { businessId, name: cat.name } });
    categoryByName.set(cat.name, row.id);
  }

  const attributeValueId = new Map<string, number>(); // key: "AttrName:Value"
  for (const attr of data.attributes) {
    const attrRow = await prisma.attribute.create({
      data: { businessId, name: attr.name, unit: attr.unit ?? undefined },
    });
    for (const v of attr.values) {
      const valRow = await prisma.attributeValue.create({
        data: { businessId, attributeId: attrRow.id, value: v.value, sortOrder: v.sortOrder },
      });
      attributeValueId.set(`${attr.name}:${v.value}`, valRow.id);
    }
  }

  // key: "productName|size|concentration" -> variant id, used to match
  // opening-sale lines below to the variant they sold.
  const variantIdByKey = new Map<string, { id: number; price: number; cost: number | null }>();

  let variantCount = 0;
  for (const product of data.products) {
    const categoryId = categoryByName.get(product.category);
    if (categoryId === undefined) {
      throw new Error(`Unknown category "${product.category}" for product "${product.name}"`);
    }

    const productRow = await prisma.product.create({
      data: { businessId, name: product.name, categoryId },
    });

    for (const variant of product.variants) {
      const price = variant.price ?? SIZE_DEFAULT_PRICE[variant.size] ?? 0;

      const attributeLinks: number[] = [];
      const sizeValueId = attributeValueId.get(`Size:${variant.size}`);
      if (sizeValueId === undefined) {
        throw new Error(`Unknown size "${variant.size}" for product "${product.name}"`);
      }
      attributeLinks.push(sizeValueId);

      if (variant.concentration !== null) {
        const concValueId = attributeValueId.get(`Concentration:${variant.concentration}`);
        if (concValueId === undefined) {
          throw new Error(`Unknown concentration "${variant.concentration}" for product "${product.name}"`);
        }
        attributeLinks.push(concValueId);
      }

      const variantRow = await prisma.variant.create({
        data: {
          businessId,
          productId: productRow.id,
          price,
          stockQty: variant.stockQty,
        },
      });

      for (const attributeValueIdVal of attributeLinks) {
        await prisma.variantAttribute.create({
          data: { businessId, variantId: variantRow.id, attributeValueId: attributeValueIdVal },
        });
      }

      const key = `${product.name}|${variant.size}|${variant.concentration}`;
      variantIdByKey.set(key, { id: variantRow.id, price, cost: null });

      variantCount += 1;
    }
  }

  console.log(`Seeded ${data.categories.length} categories, ${data.products.length} products, ${variantCount} variants.`);

  // Opening-balance sale: one Sale record built from the SALES sheet's
  // period totals (CLAUDE.md section 6). unitCost stays null - Excel never
  // tracked cost per sale, so this contributes to revenue but not profit.
  const openingLines = data.openingSale
    .map((line) => {
      const key = `${line.productName}|${line.size}|${line.concentration}`;
      const variant = variantIdByKey.get(key);
      if (!variant) {
        console.warn(`Skipping opening sale line - no matching variant for ${key}`);
        return null;
      }
      const unitPrice = line.unitPrice ?? variant.price;
      return {
        businessId,
        variantId: variant.id,
        qty: line.qty,
        unitPrice,
        unitCost: null,
        lineTotal: unitPrice * line.qty,
      };
    })
    .filter((line): line is NonNullable<typeof line> => line !== null);

  if (openingLines.length > 0) {
    const totalAmount = openingLines.reduce((sum, l) => sum + l.lineTotal, 0);
    await prisma.sale.create({
      data: {
        businessId,
        note: "Opening balance (migrated from SALES AND INVENTORY.xlsx)",
        totalAmount,
        items: { create: openingLines },
      },
    });
    console.log(`Seeded opening sale: ${openingLines.length} lines, total PHP ${totalAmount}.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
