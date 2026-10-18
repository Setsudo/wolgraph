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

  it("reads only the day's ratings, never earlier days", async () => {
    const seen: Query[] = [];
    createClient.mockResolvedValue(
      fakeClient((q) => {
        seen.push(q);
        return q.table === "categories" ? { data: MAINS, error: null } : { data: [], error: null };
      }),
    );
    await getRatings("2026-10-15");
    const ratings = seen.filter((q) => q.table === "ratings");
    expect(ratings).toHaveLength(1);
    expect(eqValue(ratings[0], "day")).toBe("2026-10-15");
    expect(has(ratings[0], "lt")).toBe(false);
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
