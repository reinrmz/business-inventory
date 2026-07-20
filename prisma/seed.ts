// Reads prisma/seed_data/seed.json (produced by scripts/extract_excel.py)
// and populates the local dev database. Run with: npx prisma db seed
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient();

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

type SeedData = {
  settings: { key: string; value: string }[];
  categories: { name: string }[];
  attributes: { name: string; unit: string | null; values: { value: string; sortOrder: number }[] }[];
  products: SeedProduct[];
};

// Fallback price per size, used when a variant has no explicit price
// (currently: the oil-concentration line — see CLAUDE.md section 5).
const SIZE_DEFAULT_PRICE: Record<string, number> = {
  "50 ML": 300,
  "30 ML": 200,
  "100 ML (type A)": 500,
  "100 ML (type B)": 450,
  Scraps: 200,
  "10 ML": 100,
  "10 ML (LP)": 80,
};

async function main() {
  const raw = readFileSync(join(__dirname, "seed_data", "seed.json"), "utf-8");
  const data: SeedData = JSON.parse(raw);

  for (const setting of data.settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }

  const categoryByName = new Map<string, number>();
  for (const cat of data.categories) {
    const row = await prisma.category.create({ data: { name: cat.name } });
    categoryByName.set(cat.name, row.id);
  }

  const attributeValueId = new Map<string, number>(); // key: "AttrName:Value"
  for (const attr of data.attributes) {
    const attrRow = await prisma.attribute.create({
      data: { name: attr.name, unit: attr.unit ?? undefined },
    });
    for (const v of attr.values) {
      const valRow = await prisma.attributeValue.create({
        data: { attributeId: attrRow.id, value: v.value, sortOrder: v.sortOrder },
      });
      attributeValueId.set(`${attr.name}:${v.value}`, valRow.id);
    }
  }

  let variantCount = 0;
  for (const product of data.products) {
    const categoryId = categoryByName.get(product.category);
    if (categoryId === undefined) {
      throw new Error(`Unknown category "${product.category}" for product "${product.name}"`);
    }

    const productRow = await prisma.product.create({
      data: { name: product.name, categoryId },
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
          productId: productRow.id,
          price,
          stockQty: variant.stockQty,
        },
      });

      for (const attributeValueIdVal of attributeLinks) {
        await prisma.variantAttribute.create({
          data: { variantId: variantRow.id, attributeValueId: attributeValueIdVal },
        });
      }

      variantCount += 1;
    }
  }

  console.log(`Seeded ${data.categories.length} categories, ${data.products.length} products, ${variantCount} variants.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
