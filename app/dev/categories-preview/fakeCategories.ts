// Fixture data and in-memory fake of the category Server Actions, for the dev
// preview and component tests. Mirrors lib/data/categories.ts rules.

import {
  DUPLICATE_MESSAGE,
  GENERIC_ERROR_MESSAGE,
  isDuplicateName,
  nextSortOrder,
  restoreMainFirstMessage,
  validateName,
  type ActionResult,
  type ArchiveResult,
  type Category,
} from "@/lib/data/categoryRules";

const USER = "00000000-0000-0000-0000-0000000000aa";
const CREATED = "2026-01-01T00:00:00.000Z";
const ARCHIVED = "2026-02-01T00:00:00.000Z";

function row(
  id: string,
  name: string,
  color: string,
  sortOrder: number,
  parentId: string | null = null,
  archivedAt: string | null = null,
): Category {
  return {
    id,
    user_id: USER,
    parent_id: parentId,
    name,
    color,
    sort_order: sortOrder,
    archived_at: archivedAt,
    created_at: CREATED,
  };
}

/** 8 seeded mains; Health has Sleep and Exercise; Hobbies (main) and Side project (sub of Career) are archived. */
export const FIXTURE_CATEGORIES: Category[] = [
  row("health", "Health", "#2F8C8C", 0),
  row("growth", "Personal Growth", "#5B6CC0", 1),
  row("finance", "Finance", "#3E8E4F", 2),
  row("family", "Family", "#C9831F", 3),
  row("career", "Career", "#C8553D", 4),
  row("relaxation", "Relaxation", "#7A5BA8", 5),
  row("relationships", "Relationships", "#C2557F", 6),
  row("spirituality", "Spirituality", "#4F7C9E", 7),
  row("hobbies", "Hobbies", "#7A5BA8", 8, null, ARCHIVED),
  row("sleep", "Sleep", "#2F8C8C", 0, "health"),
  row("exercise", "Exercise", "#2F8C8C", 1, "health"),
  row("side-project", "Side project", "#C8553D", 0, "career", ARCHIVED),
];

export type FakeOp =
  | { type: "addMain"; name: string; color: string }
  | { type: "addSub"; parentId: string; name: string }
  | { type: "rename"; id: string; name: string }
  | { type: "archive"; id: string }
  | { type: "restore"; id: string };

export type FakeResult = { result: ActionResult | ArchiveResult; categories: Category[] };

let nextId = 0;

function failed(categories: Category[], message: string): FakeResult {
  return { result: { ok: false, message }, categories };
}

/** Applies one action to the list, enforcing the same rules as the database and server. */
export function applyFakeOp(categories: Category[], op: FakeOp, now: string): FakeResult {
  const ok = (next: Category[]): FakeResult => ({ result: { ok: true }, categories: next });
  const find = (id: string) => categories.find((c) => c.id === id);

  if (op.type === "addMain" || op.type === "addSub" || op.type === "rename") {
    const invalid = validateName(op.name);
    if (invalid) return failed(categories, invalid);
  }

  switch (op.type) {
    case "addMain": {
      if (isDuplicateName(categories, null, op.name)) return failed(categories, DUPLICATE_MESSAGE);
      const mains = categories.filter((c) => c.parent_id === null);
      return ok([
        ...categories,
        row(`new-${++nextId}`, op.name.trim(), op.color, nextSortOrder(mains)),
      ]);
    }
    case "addSub": {
      const parent = find(op.parentId);
      if (!parent || parent.parent_id !== null) return failed(categories, GENERIC_ERROR_MESSAGE);
      if (isDuplicateName(categories, parent.id, op.name))
        return failed(categories, DUPLICATE_MESSAGE);
      const siblings = categories.filter((c) => c.parent_id === parent.id);
      return ok([
        ...categories,
        row(`new-${++nextId}`, op.name.trim(), parent.color, nextSortOrder(siblings), parent.id),
      ]);
    }
    case "rename": {
      const target = find(op.id);
      if (!target) return failed(categories, GENERIC_ERROR_MESSAGE);
      if (
        target.archived_at === null &&
        isDuplicateName(categories, target.parent_id, op.name, target.id)
      ) {
        return failed(categories, DUPLICATE_MESSAGE);
      }
      return ok(categories.map((c) => (c.id === op.id ? { ...c, name: op.name.trim() } : c)));
    }
    case "archive": {
      const target = find(op.id);
      if (!target || target.archived_at !== null) return failed(categories, GENERIC_ERROR_MESSAGE);
      const isMain = target.parent_id === null;
      const archivedIds = [
        target.id,
        ...(isMain
          ? categories
              .filter((c) => c.parent_id === op.id && c.archived_at === null)
              .map((c) => c.id)
          : []),
      ];
      return {
        result: { ok: true, archivedIds },
        categories: categories.map((c) =>
          archivedIds.includes(c.id) ? { ...c, archived_at: now } : c,
        ),
      };
    }
    case "restore": {
      const target = find(op.id);
      if (!target) return failed(categories, GENERIC_ERROR_MESSAGE);
      if (target.parent_id !== null) {
        const parent = find(target.parent_id);
        if (!parent) return failed(categories, GENERIC_ERROR_MESSAGE);
        if (parent.archived_at !== null)
          return failed(categories, restoreMainFirstMessage(parent.name));
      }
      if (isDuplicateName(categories, target.parent_id, target.name, target.id)) {
        return failed(categories, DUPLICATE_MESSAGE);
      }
      return ok(categories.map((c) => (c.id === op.id ? { ...c, archived_at: null } : c)));
    }
  }
}
