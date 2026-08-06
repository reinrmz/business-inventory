import { prisma } from "@/lib/prisma";
import { requireBusinessContext } from "@/lib/auth";

function csvEscape(value: string | number) {
  const s = String(value);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(request: Request) {
  const { businessId } = await requireBusinessContext();
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;

  const soldAtFilter: { gte?: Date; lt?: Date } = {};
  if (from) soldAtFilter.gte = new Date(`${from}T00:00:00`);
  if (to) {
    const toDate = new Date(`${to}T00:00:00`);
    toDate.setDate(toDate.getDate() + 1);
    soldAtFilter.lt = toDate;
  }

  const where = {
    businessId,
    ...(from || to ? { soldAt: soldAtFilter } : {}),
  };

  const sales = await prisma.sale.findMany({
    where,
    orderBy: { soldAt: "desc" },
    include: { items: { include: { variant: { include: { product: true } } } } },
  });

  const rows = [
    ["Date", "Customer", "Items", "Total", "Note"].join(","),
    ...sales.map((s) =>
      [
        csvEscape(s.soldAt.toISOString()),
        csvEscape(s.customer ?? ""),
        csvEscape(s.items.map((i) => `${i.qty}x ${i.variant.product.name}`).join("; ")),
        csvEscape(s.totalAmount),
        csvEscape(s.note ?? ""),
      ].join(","),
    ),
  ];

  const csv = rows.join("\n");
  const filenameParts = ["sales", from ?? "all", to ?? "present"];

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filenameParts.join("_")}.csv"`,
    },
  });
}
