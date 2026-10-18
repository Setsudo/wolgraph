import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();
const revalidatePath = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("next/cache", () => ({ revalidatePath }));

const { copyPreviousDay } = await import("./actions");

type Call = { table: string; ops: [string, ...unknown[]][] };

/**
 * A thenable supabase-js stand-in: selects answer from `rows[table]`, an upsert answers
 * with `inserted` (rows a DO NOTHING insert would return).
 */
function fakeClient(
  rows: Record<string, unknown[]>,
  inserted: unknown[] | { error: unknown },
  calls: Call[],
) {
  return {
    auth: { getClaims: async () => ({ data: { claims: { sub: "user-1" } } }) },
    from: (table: string) => {
      const call: Call = { table, ops: [] };
      calls.push(call);
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "eq", "is", "upsert"]) {
        chain[m] = (...args: unknown[]) => {
          call.ops.push([m, ...args]);
          return chain;
        };
      }
      chain.then = (ok: (r: unknown) => unknown) => {
        const upsert = call.ops.some(([m]) => m === "upsert");
        const result = upsert
          ? Array.isArray(inserted)
            ? { data: inserted, error: null }
            : { data: null, error: inserted.error }
          : { data: rows[table], error: null };
        return Promise.resolve(result).then(ok);
      };
      return chain;
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("copyPreviousDay", () => {
  it("inserts yesterday's active entries without overwriting, and returns what was written", async () => {
    const calls: Call[] = [];
    createClient.mockResolvedValue(
      fakeClient(
        {
          categories: [{ id: "deep" }, { id: "family" }],
          entries: [
            { category_id: "deep", hours: "4.00" },
            { category_id: "family", hours: 2 },
            { category_id: "archived", hours: 1 },
          ],
        },
        [{ category_id: "deep", hours: "4.00" }],
        calls,
      ),
    );
    await expect(copyPreviousDay("2026-10-15")).resolves.toEqual({
      ok: true,
      copied: [{ categoryId: "deep", hours: 4 }],
    });
    const [cats, prev, write] = calls;
    expect(cats.ops).toContainEqual(["is", "archived_at", null]);
    expect(prev.ops).toContainEqual(["eq", "day", "2026-10-14"]);
    expect(prev.ops).toContainEqual(["eq", "user_id", "user-1"]);
    expect(write.ops).toContainEqual([
      "upsert",
      [
        { user_id: "user-1", category_id: "deep", day: "2026-10-15", hours: 4 },
        { user_id: "user-1", category_id: "family", day: "2026-10-15", hours: 2 },
      ],
      { onConflict: "user_id,category_id,day", ignoreDuplicates: true },
    ]);
    expect(revalidatePath).toHaveBeenCalledWith("/day/2026-10-15");
  });

  it("writes nothing when the previous day has nothing to copy", async () => {
    const calls: Call[] = [];
    createClient.mockResolvedValue(
      fakeClient(
        { categories: [{ id: "deep" }], entries: [{ category_id: "x", hours: 1 }] },
        [],
        calls,
      ),
    );
    await expect(copyPreviousDay("2026-10-15")).resolves.toEqual({ ok: true, copied: [] });
    expect(calls.some((c) => c.ops.some(([m]) => m === "upsert"))).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects invalid and future days without touching the database", async () => {
    expect((await copyPreviousDay("2026-02-30")).ok).toBe(false);
    expect(await copyPreviousDay("2026-10-17")).toEqual({
      ok: false,
      message: "Future days can't be edited.",
    });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("reports a write error and does not revalidate", async () => {
    createClient.mockResolvedValue(
      fakeClient(
        { categories: [{ id: "deep" }], entries: [{ category_id: "deep", hours: 1 }] },
        { error: { message: "boom" } },
        [],
      ),
    );
    await expect(copyPreviousDay("2026-10-15")).resolves.toEqual({
      ok: false,
      message: "Couldn't copy.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
