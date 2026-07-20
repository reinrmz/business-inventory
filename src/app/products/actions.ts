"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function createProduct(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const categoryId = Number(formData.get("categoryId"));
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!name || !categoryId) {
    throw new Error("Name and category are required.");
  }

  await prisma.product.create({
    data: { name, categoryId, notes },
  });

  revalidatePath("/products");
}

export async function updateProduct(formData: FormData) {
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const categoryId = Number(formData.get("categoryId"));
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!id || !name || !categoryId) {
    throw new Error("Name and category are required.");
  }

  await prisma.product.update({
    where: { id },
    data: { name, categoryId, notes },
  });

  revalidatePath("/products");
}

// Soft-delete: keeps historical sale links intact (CLAUDE.md section 2/4).
export async function setProductActive(formData: FormData) {
  const id = Number(formData.get("id"));
  const active = formData.get("active") === "true";

  await prisma.product.update({
    where: { id },
    data: { active },
  });

  revalidatePath("/products");
}

export async function createCategory(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    throw new Error("Category name is required.");
  }

  await prisma.category.create({ data: { name } });

  revalidatePath("/products");
}
