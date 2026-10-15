"use server";

import { revalidatePath } from "next/cache";
import {
  addMainCategory,
  addSubCategory,
  archiveCategory,
  renameCategory,
  restoreCategory,
} from "@/lib/data/categories";
import type { ActionResult, ArchiveResult } from "@/lib/data/categoryRules";

function afterSuccess<R extends ActionResult | ArchiveResult>(result: R): R {
  if (result.ok) {
    revalidatePath("/categories");
    revalidatePath("/day", "layout");
  }
  return result;
}

export async function addMain(name: string, color: string): Promise<ActionResult> {
  return afterSuccess(await addMainCategory(name, color));
}

export async function addSub(parentId: string, name: string): Promise<ActionResult> {
  return afterSuccess(await addSubCategory(parentId, name));
}

export async function rename(id: string, name: string): Promise<ActionResult> {
  return afterSuccess(await renameCategory(id, name));
}

export async function archive(id: string): Promise<ArchiveResult> {
  return afterSuccess(await archiveCategory(id));
}

export async function restore(id: string): Promise<ActionResult> {
  return afterSuccess(await restoreCategory(id));
}
