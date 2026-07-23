import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// One-off: applies the add_variant_expiry migration directly to the prod
// Turso DB (migrate deploy can't target a libsql:// URL with the classic
// CLI engine). Remove this route once run against production.
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.MIGRATION_TOKEN}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cols: { name: string }[] = await prisma.$queryRawUnsafe(
    "PRAGMA table_info(Variant)"
  );
  const hasExpiresAt = cols.some((c) => c.name === "expiresAt");

  if (!hasExpiresAt) {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "Variant" ADD COLUMN "expiresAt" DATETIME'
    );
  }

  const MIGRATION_NAME = "20260723000258_add_variant_expiry";
  const existing: { migration_name: string }[] = await prisma.$queryRawUnsafe(
    "SELECT migration_name FROM _prisma_migrations WHERE migration_name = ?",
    MIGRATION_NAME
  );
  if (existing.length === 0) {
    const now = new Date().toISOString();
    await prisma.$executeRawUnsafe(
      `INSERT INTO _prisma_migrations
        (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
        VALUES (?, ?, ?, ?, NULL, NULL, ?, 1)`,
      crypto.randomUUID(),
      "manual-apply",
      now,
      MIGRATION_NAME,
      now
    );
  }

  const finalCols: { name: string }[] = await prisma.$queryRawUnsafe(
    "PRAGMA table_info(Variant)"
  );

  return NextResponse.json({
    ok: true,
    hadExpiresAtAlready: hasExpiresAt,
    migrationRecorded: existing.length === 0,
    variantColumns: finalCols.map((c) => c.name),
  });
}
