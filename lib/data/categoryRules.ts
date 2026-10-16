// Pure category rules shared by the server actions, the Categories screen and
// the dev preview's fake actions. No I/O here.

import type { CategoryRow } from "./types";

export type Category = CategoryRow;

export type ActionResult = { ok: true } | { ok: false; message: string };

/** Archive also reports every id it archived (the category, then any subs it took with it), for Undo. */
export type ArchiveResult = { ok: true; archivedIds: string[] } | { ok: false; message: string };

/** Mutations the Categories screen calls; Server Actions in the app, fakes in the dev preview. */
export type CategoryActions = {
  addMain: (name: string, color: string) => Promise<ActionResult>;
  addSub: (parentId: string, name: string) => Promise<ActionResult>;
  rename: (id: string, name: string) => Promise<ActionResult>;
  archive: (id: string) => Promise<ArchiveResult>;
  restore: (id: string) => Promise<ActionResult>;
};

/** Category colors (SPEC §7), in picker order. */
export const PALETTE = [
  "#2F8C8C",
  "#5B6CC0",
  "#3E8E4F",
  "#C9831F",
  "#C8553D",
  "#7A5BA8",
  "#C2557F",
  "#4F7C9E",
] as const;

export const NAME_MAX = 40;
export const NAME_EMPTY_MESSAGE = "Enter a name.";
export const NAME_TOO_LONG_MESSAGE = `Use ${NAME_MAX} characters or fewer.`;
export const DUPLICATE_MESSAGE = "A category with this name already exists.";
export const GENERIC_ERROR_MESSAGE = "Something went wrong. Try again.";

export function restoreMainFirstMessage(mainName: string): string {
  return `Restore ${mainName} first.`;
}

/** Length check on the trimmed name; returns an error message or null. */
export function validateName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return NAME_EMPTY_MESSAGE;
  if (trimmed.length > NAME_MAX) return NAME_TOO_LONG_MESSAGE;
  return null;
}

/**
 * Whether `name` collides (case-insensitively, after trim) with an active
 * sibling under `parentId` (null = mains), ignoring the category `excludeId`.
 */
export function isDuplicateName(
  categories: readonly Category[],
  parentId: string | null,
  name: string,
  excludeId?: string,
): boolean {
  const key = name.trim().toLowerCase();
  return categories.some(
    (c) =>
      c.archived_at === null &&
      c.parent_id === parentId &&
      c.id !== excludeId &&
      c.name.trim().toLowerCase() === key,
  );
}

/** Length check, then duplicate check among active siblings. */
export function validateCategoryName(
  categories: readonly Category[],
  parentId: string | null,
  name: string,
  excludeId?: string,
): string | null {
  return (
    validateName(name) ??
    (isDuplicateName(categories, parentId, name, excludeId) ? DUPLICATE_MESSAGE : null)
  );
}

/** First palette color not used by an active main, else the first palette color. */
export function defaultMainColor(categories: readonly Category[]): string {
  const used = new Set(
    categories
      .filter((c) => c.parent_id === null && c.archived_at === null)
      .map((c) => c.color.toUpperCase()),
  );
  return PALETTE.find((color) => !used.has(color)) ?? PALETTE[0];
}

/** max(sort_order) among the given siblings + 1, or 0 if there are none. */
export function nextSortOrder(siblings: readonly Pick<Category, "sort_order">[]): number {
  return siblings.reduce((max, c) => Math.max(max, c.sort_order), -1) + 1;
}

export function bySortOrder(a: Category, b: Category): number {
  return a.sort_order - b.sort_order || a.name.localeCompare(b.name);
}
