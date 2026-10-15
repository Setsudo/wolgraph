/**
 * Dev-only fixture data for the trends preview: the 8 seeded mains (SPEC §7),
 * a few subcategories, one archived main with hours, and a week of entries
 * and 0-10 ratings for the Monday–Sunday week containing the anchor (some days
 * unrated; Spirituality never rated, so it shows as n/a).
 */

import { eachDay, periodFor } from "@/lib/data/period";
import type { CategoryRow, EntryRow, RatingRow } from "@/lib/data/types";

const USER = "preview-user";
const CREATED = "2026-01-01T00:00:00Z";

function cat(
  id: string,
  name: string,
  color: string,
  sort_order: number,
  opts: { parent?: string; archived?: boolean } = {},
): CategoryRow {
  return {
    id,
    user_id: USER,
    parent_id: opts.parent ?? null,
    name,
    color,
    sort_order,
    archived_at: opts.archived ? "2026-09-01T00:00:00Z" : null,
    created_at: CREATED,
  };
}

const MAINS: CategoryRow[] = [
  cat("health", "Health", "#2F8C8C", 0),
  cat("growth", "Personal Growth", "#5B6CC0", 1),
  cat("finance", "Finance", "#3E8E4F", 2),
  cat("family", "Family", "#C9831F", 3),
  cat("career", "Career", "#C8553D", 4),
  cat("relax", "Relaxation", "#7A5BA8", 5),
  cat("relations", "Relationships", "#C2557F", 6),
  cat("spirit", "Spirituality", "#4F7C9E", 7),
  cat("hobbies", "Hobbies", "#C9831F", 8, { archived: true }),
];

const SUBS: CategoryRow[] = [
  cat("health-exercise", "Exercise", "#2F8C8C", 0, { parent: "health" }),
  cat("health-sleep", "Sleep", "#2F8C8C", 1, { parent: "health" }),
  cat("growth-reading", "Reading", "#5B6CC0", 0, { parent: "growth" }),
  cat("career-deep", "Deep work", "#C8553D", 0, { parent: "career" }),
  cat("career-meetings", "Meetings", "#C8553D", 1, { parent: "career" }),
];

/** Hours per category id for each weekday, Monday first. */
const WEEK: Record<string, number[]> = {
  "health-exercise": [1, 0.5, 1, 0, 1, 1.5, 1],
  "health-sleep": [1, 1.5, 1, 1, 1.5, 2, 2],
  "growth-reading": [0.5, 1, 0.5, 1, 0.5, 1.5, 1],
  finance: [0.25, 0, 0.5, 0, 0.25, 1, 0],
  family: [1.5, 1, 2, 1.5, 1, 4, 5],
  "career-deep": [4, 4.5, 3.5, 4, 3, 0, 0],
  "career-meetings": [2.5, 2, 3, 2.5, 2, 0, 0],
  relax: [1, 1.5, 1, 2, 2.5, 3, 2],
  relations: [0.5, 1, 0.5, 1, 2, 2.5, 1.5],
  spirit: [0.25, 0.25, 0.5, 0.25, 0.25, 0.5, 1],
  hobbies: [0, 0.5, 0, 1, 0, 1.5, 0],
};

/** Score per main category id for each weekday, Monday first; null = unrated. */
const RATINGS: Record<string, (number | null)[]> = {
  health: [7, 6, null, 7, 8, 8, null],
  growth: [5, 6, 6, null, 5, 7, 7],
  finance: [4, null, null, 5, null, 6, null],
  family: [8, 7, 8, 8, null, 9, 9],
  career: [6, 5, 7, 6, 4, null, null],
  relax: [5, 6, null, 6, 7, 8, 8],
  relations: [7, null, 6, 7, 8, 8, null],
  hobbies: [null, 6, null, 7, null, 8, null],
};

export type PreviewVariant = "full" | "empty" | "few";

export function previewCategories(variant: PreviewVariant): CategoryRow[] {
  if (variant === "few") {
    const keep = new Set(["health", "career"]);
    return [...MAINS, ...SUBS].filter((c) => keep.has(c.parent_id ?? c.id));
  }
  return [...MAINS, ...SUBS];
}

export function previewEntries(variant: PreviewVariant, anchor: string): EntryRow[] {
  if (variant === "empty") return [];
  const ids = new Set(previewCategories(variant).map((c) => c.id));
  const days = eachDay(periodFor("week", anchor));
  return Object.entries(WEEK).flatMap(([category_id, hours]) =>
    ids.has(category_id)
      ? days.flatMap((day, i) =>
          hours[i] > 0
            ? [{ user_id: USER, category_id, day, hours: hours[i], updated_at: CREATED }]
            : [],
        )
      : [],
  );
}

export function previewRatings(variant: PreviewVariant, anchor: string): RatingRow[] {
  if (variant === "empty") return [];
  const ids = new Set(previewCategories(variant).map((c) => c.id));
  const days = eachDay(periodFor("week", anchor));
  return Object.entries(RATINGS).flatMap(([category_id, scores]) =>
    ids.has(category_id)
      ? days.flatMap((day, i) => {
          const score = scores[i];
          return score === null
            ? []
            : [{ user_id: USER, category_id, day, score, updated_at: CREATED }];
        })
      : [],
  );
}
