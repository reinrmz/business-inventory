"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireBusinessContext } from "@/lib/auth";
import { SUPPORTED_CURRENCIES } from "@/lib/settings";

export type SettingsResult = { error?: string; ok?: boolean };

export async function saveSettings(formData: FormData): Promise<SettingsResult> {
  const { businessId } = await requireBusinessContext();

  const currency = String(formData.get("currency") ?? "PHP");
  const goalMinRaw = String(formData.get("reinvestmentGoalMin") ?? "").trim();
  const goalMaxRaw = String(formData.get("reinvestmentGoalMax") ?? "").trim();
  const lowStockRaw = String(formData.get("lowStockThreshold") ?? "").trim();
  const expiryDaysRaw = String(formData.get("expirySoonDays") ?? "").trim();

  if (!SUPPORTED_CURRENCIES.includes(currency)) {
    return { error: "Please choose a valid currency." };
  }

  const goalMin = goalMinRaw === "" ? 0 : Number(goalMinRaw);
  const goalMax = goalMaxRaw === "" ? 0 : Number(goalMaxRaw);
  const lowStock = lowStockRaw === "" ? 3 : Number(lowStockRaw);
  const expiryDays = expiryDaysRaw === "" ? 7 : Number(expiryDaysRaw);

  if ([goalMin, goalMax, lowStock, expiryDays].some((n) => !Number.isFinite(n) || n < 0)) {
    return { error: "Numeric values must be zero or greater." };
  }
  if (goalMax > 0 && goalMin > goalMax) {
    return { error: "Goal minimum cannot exceed the maximum." };
  }
  if (lowStock < 0 || expiryDays < 0) {
    return { error: "Thresholds cannot be negative." };
  }

  await prisma.$transaction([
    prisma.setting.upsert({
      where: { businessId_key: { businessId, key: "currency" } },
      create: { businessId, key: "currency", value: currency },
      update: { value: currency },
    }),
    prisma.setting.upsert({
      where: { businessId_key: { businessId, key: "reinvestment_goal_min" } },
      create: { businessId, key: "reinvestment_goal_min", value: String(goalMin) },
      update: { value: String(goalMin) },
    }),
    prisma.setting.upsert({
      where: { businessId_key: { businessId, key: "reinvestment_goal_max" } },
      create: { businessId, key: "reinvestment_goal_max", value: String(goalMax) },
      update: { value: String(goalMax) },
    }),
    prisma.setting.upsert({
      where: { businessId_key: { businessId, key: "low_stock_threshold" } },
      create: { businessId, key: "low_stock_threshold", value: String(lowStock) },
      update: { value: String(lowStock) },
    }),
    prisma.setting.upsert({
      where: { businessId_key: { businessId, key: "expiry_soon_days" } },
      create: { businessId, key: "expiry_soon_days", value: String(expiryDays) },
      update: { value: String(expiryDays) },
    }),
  ]);

  revalidatePath("/settings");
  revalidatePath("/inventory");
  revalidatePath("/");
  return { ok: true };
}
