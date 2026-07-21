"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  setActiveBusiness,
  getCurrentUser,
} from "@/lib/auth";

const DEMO_EMAIL = "demo@vessel.app";
const SUPPORTED_CURRENCIES = ["PHP", "USD", "EUR", "GBP"];

export async function signup(formData: FormData): Promise<{ error: string } | void> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim() || null;
  const businessName = String(formData.get("businessName") ?? "").trim();
  const currency = String(formData.get("currency") ?? "PHP");

  if (!email || !password || !businessName) {
    return { error: "Email, password, and business name are required." };
  }
  if (!SUPPORTED_CURRENCIES.includes(currency)) {
    return { error: "Please choose a valid currency." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with that email already exists." };
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: { email, passwordHash, name },
    // status defaults to PENDING - see CLAUDE.md section 9
  });

  const business = await prisma.business.create({
    data: { name: businessName },
    // status defaults to PENDING
  });

  await prisma.membership.create({
    data: { userId: user.id, businessId: business.id },
  });

  await prisma.setting.create({
    data: { businessId: business.id, key: "currency", value: currency },
  });

  redirect("/pending-approval?reason=pending");
}

export async function login(formData: FormData): Promise<{ error: string } | void> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Invalid email or password." };
  }

  await createSession(user.id);

  if (user.status !== "APPROVED") {
    redirect(`/pending-approval?reason=${user.status.toLowerCase()}`);
  }

  // Default to the user's first membership so they land somewhere useful.
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
  if (membership) {
    await setActiveBusiness(membership.businessId);
  }

  redirect("/");
}

export async function loginAsDemo() {
  const demoUser = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (!demoUser) {
    throw new Error("Demo account isn't set up yet.");
  }

  await createSession(demoUser.id);

  const membership = await prisma.membership.findFirst({ where: { userId: demoUser.id } });
  if (membership) {
    await setActiveBusiness(membership.businessId);
  }

  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

export async function createBusiness(formData: FormData) {
  const { user } = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const name = String(formData.get("name") ?? "").trim();
  const currency = String(formData.get("currency") ?? "PHP");
  if (!name) {
    throw new Error("Business name is required.");
  }
  if (!SUPPORTED_CURRENCIES.includes(currency)) {
    throw new Error("Please choose a valid currency.");
  }

  const business = await prisma.business.create({ data: { name } });
  await prisma.membership.create({ data: { userId: user.id, businessId: business.id } });
  await prisma.setting.create({
    data: { businessId: business.id, key: "currency", value: currency },
  });

  redirect("/pending-approval?reason=pending");
}

export async function switchBusiness(formData: FormData) {
  const { user } = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const businessId = Number(formData.get("businessId"));
  const membership = await prisma.membership.findUnique({
    where: { userId_businessId: { userId: user.id, businessId } },
  });
  if (!membership) {
    throw new Error("You don't belong to that business.");
  }

  await setActiveBusiness(businessId);
  redirect("/");
}
