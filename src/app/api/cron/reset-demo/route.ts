import { NextRequest, NextResponse } from "next/server";
import { seedDemoBusinessData } from "../../../../../prisma/seed-demo";

// Triggered by Vercel Cron (see vercel.json). Protected by CRON_SECRET so
// it can't be publicly triggered by anyone hitting the URL.
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const businessId = await seedDemoBusinessData();
  return NextResponse.json({ ok: true, businessId });
}
