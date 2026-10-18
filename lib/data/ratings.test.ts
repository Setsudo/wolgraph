import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();
const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT ${url}`);
});

vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("next/navigation", () => ({ redirect }));

const { getRatings, isMissingTable } = await import("./ratings");

type Result = { data: unknown; error: { code?: string; message: string } | null };
type Query = { table: string; filters: [string, ...unknown[]][] };

/** A thenable stand-in for the supabase-js query builder; `resolve` answers each query. */
function fakeClient(resolve: (q: Query) => Result, sub: string | null = "user-1") {
  const builder = (table: string) => {
    const q: Query = { table, filters: [] };
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "is", "lt", "order", "limit"]) {
      chain[m] = (...args: unknown[]) => {
        q.filters.push([m, ...args]);
        return chain;
      };
    }
    chain.then = (ok: (r: Result) => unknown, fail: (e: unknown) => unknown) =>
      Promise.resolve(resolve(q)).then(ok, fail);
    return chain;
  };
  return {
    auth: { getClaims: async () => ({ data: sub ? { claims: { sub } } : null }) },
    from: builder,
  };
}

const MAINS = [
  { id: "health", name: "Health", color: "#2F8C8C" },
  { id: "career", name: "Career", color: "#C8553D" },
];
const has = (q: Query, m: string) => q.filters.some(([name]) => name === m);
const eqValue = (q: Query, col: string) => q.filters.find(([m, c]) => m === "eq" && c === col)?.[2];

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

describe("getRatings", () => {
  it("returns active mains and the day's scores", async () => {
    let categoriesQuery: Query | null = null;
    createClient.mockResolvedValue(
      fakeClient((q) => {
        if (q.table === "categories") {
          categoriesQuery = q;
          return { data: MAINS, error: null };
        }
        return {
          data: [
            { category_id: "career", score: 8 },
            { category_id: "archived-main", score: 1 },
          ],
          error: null,
        };
      }),
    );

    await expect(getRatings("2026-10-15")).resolves.toEqual({
      mains: MAINS,
      scores: { career: 8 },
      ghost: null,
      available: true,
    });
    expect(categoriesQuery!.filters).toEqual(
      expect.arrayContaining([
        ["is", "parent_id", null],
        ["is", "archived_at", null],
        ["eq", "user_id", "user-1"],
      ]),
    );
  });

  it("lists active mains only (no subs), ordered by sort_order then name", async () => {
    let categoriesQuery: Query | null = null;
    createClient.mockResolvedValue(
      fakeClient((q) => {
        if (q.table === "categories") categoriesQuery = q;
        return q.table === "categories" ? { data: MAINS, error: null } : { data: [], error: null };
      }),
    );
    await getRatings("2026-10-15");
    const filters = categoriesQuery!.filters;
    expect(filters).toContainEqual(["is", "parent_id", null]);
    expect(filters.filter(([m]) => m === "order")).toEqual([
      ["order", "sort_order", { ascending: true }],
      ["order", "name", { ascending: true }],
    ]);
  });

  it("takes the day's scores only from the day's rows", async () => {
    const seen: Query[] = [];
    createClient.mockResolvedValue(
      fakeClient((q) => {
        seen.push(q);
        if (q.table === "categories") return { data: MAINS, error: null };
        if (has(q, "lt")) return { data: [{ day: "2026-10-12" }], error: null };
        if (eqValue(q, "day") === "2026-10-12")
          return { data: [{ category_id: "health", score: 6 }], error: null };
        return { data: [{ category_id: "career", score: 3 }], error: null };
      }),
    );
    const data = await getRatings("2026-10-15");
    expect(data.scores).toEqual({ career: 3 });
    const dayQuery = seen.find((q) => q.table === "ratings" && eqValue(q, "day") === "2026-10-15");
    expect(dayQuery && has(dayQuery, "lt")).toBe(false);
  });

  it("returns the latest earlier rated day as the ghost, with its active mains' scores", async () => {
    const seen: Query[] = [];
    createClient.mockResolvedValue(
      fakeClient((q) => {
        seen.push(q);
        if (q.table === "categories") return { data: MAINS, error: null };
        if (has(q, "lt")) return { data: [{ day: "2026-10-12" }], error: null };
        if (eqValue(q, "day") === "2026-10-12")
          return {
            data: [
              { category_id: "health", score: 6 },
              { category_id: "career", score: 9 },
              { category_id: "archived-main", score: 2 },
            ],
            error: null,
          };
        return { data: [], error: null };
      }),
    );
    await expect(getRatings("2026-10-15")).resolves.toEqual({
      mains: MAINS,
      scores: {},
      ghost: { day: "2026-10-12", scores: { health: 6, career: 9 } },
      available: true,
    });
    const ratings = seen.filter((q) => q.table === "ratings");
    // The day, the latest earlier day, that day's rows: two ghost queries.
    expect(ratings).toHaveLength(3);
    const latest = ratings.find((q) => has(q, "lt"))!;
    expect(latest.filters).toEqual(
      expect.arrayContaining([
        ["select", "day"],
        ["eq", "user_id", "user-1"],
        ["lt", "day", "2026-10-15"],
        ["order", "day", { ascending: false }],
        ["limit", 1],
      ]),
    );
    const ghostRows = ratings.find((q) => eqValue(q, "day") === "2026-10-12")!;
    expect(eqValue(ghostRows, "user_id")).toBe("user-1");
  });

  it("has no ghost when no earlier day was rated", async () => {
    const seen: Query[] = [];
    createClient.mockResolvedValue(
      fakeClient((q) => {
        seen.push(q);
        if (q.table === "categories") return { data: MAINS, error: null };
        return { data: [], error: null };
      }),
    );
    const data = await getRatings("2026-10-15");
    expect(data.ghost).toBeNull();
    // No query for a ghost day's rows.
    expect(seen.filter((q) => q.table === "ratings")).toHaveLength(2);
  });

  it.each([
    { code: "42P01", message: 'relation "public.ratings" does not exist' },
    { code: "PGRST205", message: "Could not find the table 'public.ratings' in the schema cache" },
    { message: 'relation "ratings" does not exist' },
  ])("falls back to no scores when the ratings table is missing ($code)", async (error) => {
    createClient.mockResolvedValue(
      fakeClient((q) =>
        q.table === "categories" ? { data: MAINS, error: null } : { data: null, error },
      ),
    );
    await expect(getRatings("2026-10-15")).resolves.toEqual({
      mains: MAINS,
      scores: {},
      ghost: null,
      available: false,
    });
  });

  it("treats a missing table on the earlier-day query as a missing table (no ghost)", async () => {
    createClient.mockResolvedValue(
      fakeClient((q) => {
        if (q.table === "categories") return { data: MAINS, error: null };
        if (has(q, "lt")) return { data: null, error: { code: "42P01", message: "gone" } };
        return { data: [], error: null };
      }),
    );
    await expect(getRatings("2026-10-15")).resolves.toMatchObject({
      ghost: null,
      available: false,
    });
  });

  it("throws on other ratings errors", async () => {
    createClient.mockResolvedValue(
      fakeClient((q) =>
        q.table === "categories"
          ? { data: MAINS, error: null }
          : { data: null, error: { code: "57014", message: "timeout" } },
      ),
    );
    await expect(getRatings("2026-10-15")).rejects.toThrow(/timeout/);
  });

  it("throws when categories fail to load", async () => {
    createClient.mockResolvedValue(
      fakeClient(() => ({ data: null, error: { code: "42P01", message: "categories gone" } })),
    );
    await expect(getRatings("2026-10-15")).rejects.toThrow(/categories gone/);
  });

  it("redirects to login without a user", async () => {
    createClient.mockResolvedValue(fakeClient(() => ({ data: [], error: null }), null));
    await expect(getRatings("2026-10-15")).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirect).toHaveBeenCalledWith("/login?next=%2Frate");
  });
});

describe("isMissingTable", () => {
  it("recognises missing-table errors only", () => {
    expect(isMissingTable(null)).toBe(false);
    expect(isMissingTable({ code: "42P01" })).toBe(true);
    expect(isMissingTable({ code: "PGRST205" })).toBe(true);
    expect(isMissingTable({ code: "23505", message: "duplicate key" })).toBe(false);
  });
});
