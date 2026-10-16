import { describe, expect, it } from "vitest";
import { aggregatePeriod } from "./aggregates";
import { periodFor } from "./period";
import { withRatings, type RatingInput } from "./ratingAggregates";
import type { CategoryRow, EntryRow } from "./types";

function cat(
  id: string,
  sort_order: number,
  opts: { parent?: string; archived?: boolean } = {},
): CategoryRow {
  return {
    id,
    user_id: "u1",
    parent_id: opts.parent ?? null,
    name: id,
    color: "#112233",
    sort_order,
    archived_at: opts.archived ? "2026-09-01T00:00:00Z" : null,
    created_at: "2026-01-01T00:00:00Z",
  };
}

const entry = (category_id: string, day: string, hours: number): EntryRow => ({
  user_id: "u1",
  category_id,
  day,
  hours,
  updated_at: "2026-10-01T00:00:00Z",
});

const rating = (category_id: string, day: string, score: number): RatingInput => ({
  category_id,
  day,
  score,
});

// oldArchived has hours this week (listed); idleArchived has none (not listed).
const categories = [
  cat("health", 0),
  cat("career", 1),
  cat("finance", 2),
  cat("oldArchived", 3, { archived: true }),
  cat("idleArchived", 4, { archived: true }),
  cat("run", 0, { parent: "health" }),
];

const week = periodFor("week", "2026-10-14"); // 2026-10-12 .. 2026-10-18
const weekEntries = [
  entry("health", "2026-10-12", 1),
  entry("career", "2026-10-13", 4),
  entry("oldArchived", "2026-10-14", 2),
];

describe("withRatings", () => {
  it("averages rated days only, rounds to 1 decimal, null when unrated", () => {
    const agg = withRatings(aggregatePeriod(categories, weekEntries, week), [
      rating("health", "2026-10-12", 7),
      rating("health", "2026-10-14", 8),
      rating("health", "2026-10-18", 8), // 23 / 3 = 7.666… -> 7.7
      rating("career", "2026-10-15", 4),
      rating("career", "2026-10-16", 5), // 4.5
    ]);
    expect(agg.ratingsEmpty).toBe(false);
    expect(agg.ratingsAvailable).toBe(true);
    expect(agg.mains.map((m) => [m.mainId, m.averageRating])).toEqual([
      ["health", 7.7],
      ["career", 4.5],
      ["finance", null],
      ["oldArchived", null],
    ]);
  });

  it("keeps the hours aggregate's mains, order and values unchanged", () => {
    const hours = aggregatePeriod(categories, weekEntries, week);
    const agg = withRatings(hours, [rating("finance", "2026-10-12", 3)]);
    expect(agg.period).toBe(hours.period);
    expect(agg.daysWithEntries).toBe(hours.daysWithEntries);
    expect(agg.isEmpty).toBe(hours.isEmpty);
    expect(agg.mains).toEqual(
      hours.mains.map((m) => ({ ...m, averageRating: m.mainId === "finance" ? 3 : null })),
    );
  });

  it("archived mains follow the hours inclusion rule", () => {
    const agg = withRatings(aggregatePeriod(categories, weekEntries, week), [
      rating("oldArchived", "2026-10-13", 6),
      rating("idleArchived", "2026-10-13", 9), // archived, no hours: not listed
    ]);
    expect(agg.mains.find((m) => m.mainId === "oldArchived")?.averageRating).toBe(6);
    expect(agg.mains.some((m) => m.mainId === "idleArchived")).toBe(false);
  });

  it("ignores rows outside the period", () => {
    const agg = withRatings(aggregatePeriod(categories, weekEntries, week), [
      rating("health", "2026-10-11", 0), // Sunday before
      rating("health", "2026-10-19", 0), // Monday after
      rating("health", "2026-10-13", 9),
    ]);
    expect(agg.mains[0].averageRating).toBe(9);
  });

  it("ratingsEmpty when no rows fall inside the period", () => {
    const agg = withRatings(aggregatePeriod(categories, weekEntries, week), [
      rating("health", "2026-10-05", 5),
    ]);
    expect(agg.ratingsEmpty).toBe(true);
    expect(agg.mains.every((m) => m.averageRating === null)).toBe(true);
  });

  it("counts a repeated rated day once", () => {
    const agg = withRatings(aggregatePeriod(categories, weekEntries, week), [
      rating("health", "2026-10-12", 2),
      rating("health", "2026-10-12", 6),
      rating("health", "2026-10-13", 8),
    ]);
    expect(agg.mains[0].averageRating).toBe(7); // (6 + 8) / 2
  });

  it("month: averages across the whole month, a 0 score counts", () => {
    const oct = periodFor("month", "2026-10-14");
    const agg = withRatings(aggregatePeriod(categories, [entry("health", "2026-10-02", 1)], oct), [
      rating("health", "2026-10-01", 0),
      rating("health", "2026-10-31", 5),
      rating("health", "2026-10-15", 6), // (0 + 5 + 6) / 3 = 3.666… -> 3.7
      rating("health", "2026-09-30", 10), // outside
      rating("health", "2026-11-01", 10), // outside
    ]);
    expect(agg.mains[0].averageRating).toBe(3.7);
    expect(agg.ratingsEmpty).toBe(false);
  });

  it("unavailable: passes the flag through with no ratings", () => {
    const agg = withRatings(aggregatePeriod(categories, weekEntries, week), [], false);
    expect(agg.ratingsAvailable).toBe(false);
    expect(agg.ratingsEmpty).toBe(true);
    expect(agg.mains.every((m) => m.averageRating === null)).toBe(true);
  });
});

describe("withRatings with subcategories", () => {
  it("keeps ratings main-only: subs roll their hours into the main, sub ids match no row", () => {
    const agg = withRatings(
      aggregatePeriod(
        [cat("career", 0), cat("deep", 0, { parent: "career" })],
        [entry("deep", "2026-10-12", 3)],
        periodFor("week", "2026-10-14"),
      ),
      // The second is rejected by the ratings_enforce_main trigger; ignored here if it ever appeared.
      [rating("career", "2026-10-12", 6), rating("deep", "2026-10-12", 1)],
    );
    expect(agg.mains).toHaveLength(1);
    expect(agg.mains[0]).toMatchObject({ mainId: "career", total: 3, averageRating: 6 });
  });
});
