"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

async function requireAdmin() {
  const { user } = await getCurrentUser();
  if (!user?.isAdmin) {
    throw new Error("Admin access required.");
  }
  return user;
}

export async function approveUser(formData: FormData) {
  const admin = await requireAdmin();
  const id = Number(formData.get("id"));
  await prisma.user.update({
    where: { id },
    data: { status: "APPROVED", approvedAt: new Date(), approvedById: admin.id },
  });
  revalidatePath("/admin");
}

export async function rejectUser(formData: FormData) {
  const admin = await requireAdmin();
  const id = Number(formData.get("id"));
  await prisma.user.update({
    where: { id },
    data: { status: "REJECTED", approvedAt: new Date(), approvedById: admin.id },
  });
  revalidatePath("/admin");
}

export async function approveBusiness(formData: FormData) {
  const admin = await requireAdmin();
  const id = Number(formData.get("id"));
  await prisma.business.update({
    where: { id },
    data: { status: "APPROVED", approvedAt: new Date(), approvedById: admin.id },
  });
  revalidatePath("/admin");
}

export async function rejectBusiness(formData: FormData) {
  const admin = await requireAdmin();
  const id = Number(formData.get("id"));
  await prisma.business.update({
    where: { id },
    data: { status: "REJECTED", approvedAt: new Date(), approvedById: admin.id },
  });
  revalidatePath("/admin");
}
