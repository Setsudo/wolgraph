import { describe, expect, it } from "vitest";
import { aggregatePeriod } from "./aggregates";
import { periodFor } from "./period";
import type { CategoryRow, EntryRow } from "./types";

const ARCHIVED = "2026-09-01T00:00:00Z";

function cat(
  id: string,
  sort_order: number,
  opts: { parent?: string; archived?: boolean; name?: string; color?: string } = {},
): CategoryRow {
  return {
    id,
    user_id: "u1",
    parent_id: opts.parent ?? null,
    name: opts.name ?? id,
    color: opts.color ?? "#112233",
    sort_order,
    archived_at: opts.archived ? ARCHIVED : null,
    created_at: "2026-01-01T00:00:00Z",
  };
}

function entry(category_id: string, day: string, hours: number): EntryRow {
  return { user_id: "u1", category_id, day, hours, updated_at: "2026-10-01T00:00:00Z" };
}

// health: main with entries on itself and a sub
// growth: main with only sub entries (one sub archived)
// finance: active main, no hours
// oldArchived: archived main with hours; idleArchived: archived main without hours
const categories: CategoryRow[] = [
  cat("finance", 2, { name: "Finance" }),
  cat("health", 0, { name: "Health", color: "#aa0000" }),
  cat("growth", 1, { name: "Growth" }),
  cat("oldArchived", 5, { archived: true, name: "Old" }),
  cat("idleArchived", 6, { archived: true, name: "Idle" }),
  cat("run", 0, { parent: "health" }),
  cat("read", 0, { parent: "growth" }),
  cat("course", 1, { parent: "growth", archived: true }),
  cat("oldSub", 0, { parent: "oldArchived", archived: true }),
];

const week = periodFor("week", "2026-10-14"); // 2026-10-12 .. 2026-10-18

describe("aggregatePeriod", () => {
  it("rolls subs into mains, includes archived mains only with hours, orders by sort_order", () => {
    const entries = [
      entry("health", "2026-10-12", 1),
      entry("run", "2026-10-12", 0.5),
      entry("run", "2026-10-13", 1.25),
      entry("read", "2026-10-13", 2),
      entry("course", "2026-10-14", 1), // archived sub -> active main
      entry("oldSub", "2026-10-18", 3), // archived sub -> archived main
      entry("health", "2026-10-11", 9), // Sunday before: outside
      entry("health", "2026-10-19", 9), // Monday after: outside
      entry("ghost", "2026-10-15", 5), // unknown category
      entry("finance", "2026-10-16", 0), // zero-hour row: not a day
    ];
    const agg = aggregatePeriod(categories, entries, week);

    expect(agg.period).toBe(week);
    expect(agg.daysWithEntries).toBe(4); // 12, 13, 14, 18
    expect(agg.isEmpty).toBe(false);
    expect(agg.mains.map((m) => m.mainId)).toEqual(["health", "growth", "finance", "oldArchived"]);

    const [health, growth, finance, old] = agg.mains;
    expect(health).toEqual({
      mainId: "health",
      name: "Health",
      color: "#aa0000",
      archived: false,
      total: 2.75,
      average: 0.69, // 2.75 / 4 = 0.6875
    });
    expect(growth).toMatchObject({ total: 3, average: 0.75, archived: false });
    expect(finance).toMatchObject({ total: 0, average: 0, archived: false });
    expect(old).toMatchObject({ name: "Old", total: 3, average: 0.75, archived: true });
  });

  it("orders ties in sort_order by name", () => {
    const cats = [
      cat("b", 0, { name: "Beta" }),
      cat("a", 0, { name: "Alpha" }),
      cat("c", -1, { name: "Zed" }),
    ];
    const agg = aggregatePeriod(cats, [], week);
    expect(agg.mains.map((m) => m.name)).toEqual(["Zed", "Alpha", "Beta"]);
  });

  it("empty period: every active main at 0, no archived mains, isEmpty", () => {
    const entries = [entry("health", "2026-10-05", 3), entry("finance", "2026-10-13", 0)];
    const agg = aggregatePeriod(categories, entries, week);
    expect(agg.isEmpty).toBe(true);
    expect(agg.daysWithEntries).toBe(0);
    expect(agg.mains.map((m) => m.mainId)).toEqual(["health", "growth", "finance"]);
    expect(agg.mains.every((m) => m.total === 0 && m.average === 0)).toBe(true);
  });

  it("no categories and no entries", () => {
    expect(aggregatePeriod([], [], week)).toEqual({
      period: week,
      daysWithEntries: 0,
      mains: [],
      isEmpty: true,
    });
  });

  it("month of 28 days: divisor is days with entries, not period length", () => {
    const feb = periodFor("month", "2026-02-10");
    expect(feb.days).toBe(28);
    const entries = [
      entry("health", "2026-02-01", 2),
      entry("run", "2026-02-28", 1),
      entry("health", "2026-03-01", 8), // outside
      entry("health", "2026-01-31", 8), // outside
    ];
    const agg = aggregatePeriod(categories, entries, feb);
    expect(agg.daysWithEntries).toBe(2);
    expect(agg.mains[0]).toMatchObject({ mainId: "health", total: 3, average: 1.5 });
  });

  it("month of 31 days counts the 31st", () => {
    const jan = periodFor("month", "2026-01-15");
    expect(jan.days).toBe(31);
    const entries = [
      entry("read", "2026-01-31", 1),
      entry("read", "2026-01-01", 2),
      entry("health", "2026-01-15", 1),
    ];
    const agg = aggregatePeriod(categories, entries, jan);
    expect(agg.daysWithEntries).toBe(3);
    expect(agg.mains.find((m) => m.mainId === "growth")).toMatchObject({ total: 3, average: 1 });
    expect(agg.mains.find((m) => m.mainId === "health")).toMatchObject({ total: 1, average: 0.33 });
  });
});

describe("aggregatePeriod with subcategories", () => {
  // Career: 10 subs (one archived); Health: 3 subs and no own entries.
  const subCats: CategoryRow[] = [
    cat("health", 0, { name: "Health" }),
    cat("career", 1, { name: "Career" }),
    ...["sleep", "exercise", "meditation"].map((id, i) => cat(id, i, { parent: "health" })),
    ...Array.from({ length: 10 }, (_, i) =>
      cat(`p${i}`, i, { parent: "career", archived: i === 9 }),
    ),
  ];

  it("a day with only sub entries counts as a day with entries", () => {
    const agg = aggregatePeriod(subCats, [entry("sleep", "2026-10-12", 7)], week);
    expect(agg.isEmpty).toBe(false);
    expect(agg.daysWithEntries).toBe(1);
    expect(agg.mains.find((m) => m.mainId === "health")).toMatchObject({ total: 7, average: 7 });
  });

  it("rolls every sub, archived ones included, into its main's total and per-day average", () => {
    const entries = [
      entry("career", "2026-10-12", 1), // the main directly
      ...Array.from({ length: 10 }, (_, i) => entry(`p${i}`, "2026-10-13", 0.5)), // p9 archived
      entry("p9", "2026-10-14", 2), // a day with only an archived sub's hours
      entry("meditation", "2026-10-14", 0.25),
    ];
    const agg = aggregatePeriod(subCats, entries, week);
    expect(agg.daysWithEntries).toBe(3);
    expect(agg.mains.map((m) => m.mainId)).toEqual(["health", "career"]); // mains only
    expect(agg.mains[1]).toMatchObject({ total: 8, average: 2.67, archived: false }); // 1 + 5 + 2
    expect(agg.mains[0]).toMatchObject({ total: 0.25, average: 0.08 });
  });
});
