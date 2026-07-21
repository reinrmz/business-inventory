import { prisma } from "./prisma";

const SYMBOLS: Record<string, string> = {
  PHP: "₱",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

export function currencySymbolFor(code: string) {
  return SYMBOLS[code] ?? code + " ";
}

export async function getCurrencySymbol(businessId: number) {
  const setting = await prisma.setting.findUnique({
    where: { businessId_key: { businessId, key: "currency" } },
  });
  return currencySymbolFor(setting?.value ?? "PHP");
}
