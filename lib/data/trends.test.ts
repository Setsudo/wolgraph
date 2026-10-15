import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const { getTrendData } = await import("./trends");
const { periodFor } = await import("./period");

type Result = { data: unknown; error: { code?: string; message: string } | null };

/** A thenable stand-in for the supabase-js query builder, answered per table. */
function fakeClient(byTable: Record<string, Result>, calls: [string, ...unknown[]][] = []) {
  return {
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "gte", "lte"]) {
        chain[m] = (...args: unknown[]) => {
          calls.push([`${table}.${m}`, ...args]);
          return chain;
        };
      }
      chain.then = (ok: (r: Result) => unknown) => Promise.resolve(byTable[table]).then(ok);
      return chain;
    },
  };
}

const week = periodFor("week", "2026-10-14");
const CATEGORIES = [
  {
    id: "health",
    user_id: "u1",
    parent_id: null,
    name: "Health",
    color: "#2F8C8C",
    sort_order: 0,
    archived_at: null,
    created_at: "2026-01-01T00:00:00Z",
  },
];
const ENTRIES = [
  { user_id: "u1", category_id: "health", day: "2026-10-12", hours: 2, updated_at: "x" },
];

beforeEach(() => vi.clearAllMocks());

describe("getTrendData", () => {
  it("loads the period's ratings and averages them per main", async () => {
    const calls: [string, ...unknown[]][] = [];
    createClient.mockResolvedValue(
      fakeClient(
        {
          categories: { data: CATEGORIES, error: null },
          entries: { data: ENTRIES, error: null },
          ratings: {
            data: [
              { category_id: "health", day: "2026-10-12", score: 6 },
              { category_id: "health", day: "2026-10-13", score: 7 },
            ],
            error: null,
          },
        },
        calls,
      ),
    );
    const agg = await getTrendData(week);
    expect(calls).toContainEqual(["ratings.gte", "day", "2026-10-12"]);
    expect(calls).toContainEqual(["ratings.lte", "day", "2026-10-18"]);
    expect(agg.ratingsAvailable).toBe(true);
    expect(agg.ratingsEmpty).toBe(false);
    expect(agg.mains[0]).toMatchObject({ mainId: "health", total: 2, averageRating: 6.5 });
  });

  it("treats a missing ratings table as no ratings, without throwing", async () => {
    createClient.mockResolvedValue(
      fakeClient({
        categories: { data: CATEGORIES, error: null },
        entries: { data: ENTRIES, error: null },
        ratings: { data: null, error: { code: "PGRST205", message: "not in schema cache" } },
      }),
    );
    const agg = await getTrendData(week);
    expect(agg.ratingsAvailable).toBe(false);
    expect(agg.ratingsEmpty).toBe(true);
    expect(agg.mains[0]).toMatchObject({ total: 2, averageRating: null });
  });

  it("throws other ratings errors", async () => {
    createClient.mockResolvedValue(
      fakeClient({
        categories: { data: CATEGORIES, error: null },
        entries: { data: ENTRIES, error: null },
        ratings: { data: null, error: { code: "42501", message: "permission denied" } },
      }),
    );
    await expect(getTrendData(week)).rejects.toMatchObject({ code: "42501" });
  });
});
