import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const { getDay } = await import("./day");

type Query = { table: string; filters: [string, ...unknown[]][] };

/** A thenable stand-in for the supabase-js query builder, answered per table. */
type Rows = unknown[] | ((q: Query) => unknown[]);

function fakeClient(data: Record<string, Rows>, seen: Query[]) {
  return {
    auth: { getClaims: async () => ({ data: { claims: { sub: "user-1" } } }) },
    from: (table: string) => {
      const q: Query = { table, filters: [] };
      seen.push(q);
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "eq", "is", "order"]) {
        chain[m] = (...args: unknown[]) => {
          q.filters.push([m, ...args]);
          return chain;
        };
      }
      chain.then = (ok: (r: unknown) => unknown) => {
        const rows = data[table];
        return Promise.resolve({
          data: typeof rows === "function" ? rows(q) : rows,
          error: null,
        }).then(ok);
      };
      return chain;
    },
  };
}

beforeEach(() => vi.clearAllMocks());

describe("getDay", () => {
  it("loads active mains and subs for the wheel, and every entry of the day (archived included)", async () => {
    const seen: Query[] = [];
    createClient.mockResolvedValue(
      fakeClient(
        {
          categories: [
            { id: "career", parent_id: null, name: "Career", color: "#C8553D" },
            { id: "deep", parent_id: "career", name: "Deep work", color: "#C8553D" },
          ],
          entries: (q) =>
            q.filters.some(([m, col, v]) => m === "eq" && col === "day" && v === "2026-10-14")
              ? [
                  { category_id: "deep", hours: "1.75" },
                  { category_id: "archived-sub", hours: 3 },
                ]
              : [
                  { category_id: "deep", hours: "2.50", category: { parent_id: "career" } },
                  { category_id: "archived-sub", hours: 1, category: { parent_id: "career" } },
                  { category_id: "career", hours: 0.5, category: { parent_id: null } },
                ],
        },
        seen,
      ),
    );
    await expect(getDay("2026-10-15")).resolves.toEqual({
      categories: [
        { id: "career", parentId: null, name: "Career", color: "#C8553D" },
        { id: "deep", parentId: "career", name: "Deep work", color: "#C8553D" },
      ],
      entries: [
        { categoryId: "deep", hours: 2.5, parentId: "career" },
        { categoryId: "archived-sub", hours: 1, parentId: "career" },
        { categoryId: "career", hours: 0.5, parentId: null },
      ],
      // The day before, archived categories left out: what "Copy previous day" offers.
      previous: [{ categoryId: "deep", hours: 1.75 }],
    });
    const categories = seen.find((q) => q.table === "categories")!;
    expect(categories.filters).toContainEqual(["is", "archived_at", null]);
    expect(categories.filters.filter(([m]) => m === "order")).toEqual([
      ["order", "sort_order", { ascending: true }],
      ["order", "name", { ascending: true }],
    ]);
    const [entries, previous] = seen.filter((q) => q.table === "entries");
    expect(previous.filters).toContainEqual(["eq", "day", "2026-10-14"]);
    expect(previous.filters).toContainEqual(["eq", "user_id", "user-1"]);
    expect(entries.filters).toContainEqual(["eq", "day", "2026-10-15"]);
    // Each entry's parent comes from its category, so archived subs can be mapped to their main.
    expect(entries.filters).toContainEqual([
      "select",
      "category_id, hours, category:categories!entries_category_id_fkey(parent_id)",
    ]);
    expect(entries.filters.some(([m]) => m === "is")).toBe(false);
  });
});
