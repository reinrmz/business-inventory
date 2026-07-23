import { prisma } from "./prisma";

// Central place for the per-business Setting keys the app reads, with their
// defaults. Settings are stored as string k/v rows (see CLAUDE.md section 4);
// this module maps them to typed values so callers don't re-parse everywhere.

export const DEFAULT_LOW_STOCK_THRESHOLD = 3;
export const DEFAULT_EXPIRY_SOON_DAYS = 7;

export const SUPPORTED_CURRENCIES = ["PHP", "USD", "EUR", "GBP"];

export type BusinessSettings = {
  currency: string;
  reinvestmentGoalMin: number;
  reinvestmentGoalMax: number;
  lowStockThreshold: number;
  expirySoonDays: number;
};

function toInt(value: string | undefined, fallback: number) {
  if (value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// One query, all settings resolved to typed values with defaults applied.
export async function getSettings(businessId: number): Promise<BusinessSettings> {
  const rows = await prisma.setting.findMany({ where: { businessId } });
  const map = new Map(rows.map((r) => [r.key, r.value]));

  return {
    currency: map.get("currency") ?? "PHP",
    reinvestmentGoalMin: toInt(map.get("reinvestment_goal_min"), 0),
    reinvestmentGoalMax: toInt(map.get("reinvestment_goal_max"), 0),
    lowStockThreshold: toInt(map.get("low_stock_threshold"), DEFAULT_LOW_STOCK_THRESHOLD),
    expirySoonDays: toInt(map.get("expiry_soon_days"), DEFAULT_EXPIRY_SOON_DAYS),
  };
}
