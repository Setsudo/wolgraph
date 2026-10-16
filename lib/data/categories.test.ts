import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("next/server", () => ({ connection: vi.fn() }));

const { addSubCategory, archiveCategory, restoreCategory } = await import("./categories");
const { DUPLICATE_MESSAGE, GENERIC_ERROR_MESSAGE } = await import("./categoryRules");

type Result = { data: unknown; error: { code?: string; message: string } | null };
type Query = {
  table: string;
  op: "select" | "insert" | "update";
  payload?: Record<string, unknown>;
  filters: [string, ...unknown[]][];
};

/** A thenable stand-in for the supabase-js query builder; `resolve` answers each query. */
function fakeClient(resolve: (q: Query) => Result, seen: Query[] = []) {
  const builder = (table: string) => {
    const q: Query = { table, op: "select", filters: [] };
    seen.push(q);
    const chain: Record<string, unknown> = {};
    for (const m of ["eq", "is", "order"]) {
      chain[m] = (...args: unknown[]) => {
        q.filters.push([m, ...args]);
        return chain;
      };
    }
    chain.select = (...args: unknown[]) => {
      q.filters.push(["select", ...args]);
      return chain;
    };
    chain.insert = (payload: Record<string, unknown>) => {
      q.op = "insert";
      q.payload = payload;
      return chain;
    };
    chain.update = (payload: Record<string, unknown>) => {
      q.op = "update";
      q.payload = payload;
      return chain;
    };
    chain.maybeSingle = () => chain;
    chain.then = (ok: (r: Result) => unknown, fail: (e: unknown) => unknown) =>
      Promise.resolve(resolve(q)).then(ok, fail);
    return chain;
  };
  return {
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }) },
    from: builder,
  };
}

const eqValue = (q: Query, col: string) => q.filters.find(([m, c]) => m === "eq" && c === col)?.[2];
const ok = (data: unknown): Result => ({ data, error: null });

beforeEach(() => vi.clearAllMocks());

describe("addSubCategory", () => {
  const parentRow = (overrides: Record<string, unknown> = {}) => ({
    color: "#C8553D",
    parent_id: null,
    archived_at: null,
    ...overrides,
  });

  it("inserts the sub under an active main with the main's color and the next sibling order", async () => {
    const seen: Query[] = [];
    createClient.mockResolvedValue(
      fakeClient((q) => {
        if (q.op === "insert") return ok(null);
        if (eqValue(q, "id") === "career") return ok(parentRow());
        return ok([{ sort_order: 0 }, { sort_order: 4 }]); // siblings, archived included
      }, seen),
    );
    await expect(addSubCategory("career", "  Deep work ")).resolves.toEqual({ ok: true });
    const insert = seen.find((q) => q.op === "insert")!;
    expect(insert.payload).toEqual({
      user_id: "user-1",
      parent_id: "career",
      name: "Deep work",
      color: "#C8553D",
      sort_order: 5,
    });
  });

  /** Parent read answers `parent`; the siblings read and the insert succeed. */
  const withParent = (parent: Record<string, unknown>) => (q: Query) =>
    q.op === "insert" ? ok(null) : eqValue(q, "id") !== undefined ? ok(parent) : ok([]);

  it("refuses a parent that is itself a sub", async () => {
    const seen: Query[] = [];
    createClient.mockResolvedValue(
      fakeClient(withParent(parentRow({ parent_id: "career" })), seen),
    );
    await expect(addSubCategory("deep-work", "Focus")).resolves.toEqual({
      ok: false,
      message: GENERIC_ERROR_MESSAGE,
    });
    expect(seen.some((q) => q.op === "insert")).toBe(false);
  });

  it("refuses an archived main (stale screen on another device)", async () => {
    const seen: Query[] = [];
    createClient.mockResolvedValue(
      fakeClient(withParent(parentRow({ archived_at: "2026-10-01T00:00:00Z" })), seen),
    );
    await expect(addSubCategory("career", "Focus")).resolves.toEqual({
      ok: false,
      message: GENERIC_ERROR_MESSAGE,
    });
    expect(seen.some((q) => q.op === "insert")).toBe(false);
  });

  it("maps a duplicate active sibling (unique index) to the duplicate message", async () => {
    createClient.mockResolvedValue(
      fakeClient((q) => {
        if (q.op === "insert") return { data: null, error: { code: "23505", message: "dup" } };
        if (eqValue(q, "id") === "career") return ok(parentRow());
        return ok([]);
      }),
    );
    await expect(addSubCategory("career", "deep WORK")).resolves.toEqual({
      ok: false,
      message: DUPLICATE_MESSAGE,
    });
  });
});

describe("archiveCategory", () => {
  it("archiving a main also archives its active subs and reports every id", async () => {
    const seen: Query[] = [];
    createClient.mockResolvedValue(
      fakeClient((q) => {
        if (eqValue(q, "id") === "career") return ok([{ id: "career", parent_id: null }]);
        return ok([{ id: "deep-work" }, { id: "meetings" }]);
      }, seen),
    );
    await expect(archiveCategory("career")).resolves.toEqual({
      ok: true,
      archivedIds: ["career", "deep-work", "meetings"],
    });
    const subs = seen.find((q) => eqValue(q, "parent_id") === "career")!;
    expect(subs.op).toBe("update");
    // Only active subs: a sub archived earlier keeps its own archive date (and is not in Undo).
    expect(subs.filters).toContainEqual(["is", "archived_at", null]);
    expect(subs.payload!.archived_at).toBe(seen[0].payload!.archived_at);
  });

  it("archiving a sub touches only that sub", async () => {
    const seen: Query[] = [];
    createClient.mockResolvedValue(
      fakeClient(() => ok([{ id: "deep-work", parent_id: "career" }]), seen),
    );
    await expect(archiveCategory("deep-work")).resolves.toEqual({
      ok: true,
      archivedIds: ["deep-work"],
    });
    expect(seen.filter((q) => q.op === "update")).toHaveLength(1);
  });
});

describe("restoreCategory", () => {
  it("restores a sub whose main is active", async () => {
    const seen: Query[] = [];
    createClient.mockResolvedValue(
      fakeClient((q) => {
        if (q.op === "update") return ok(null);
        if (eqValue(q, "id") === "deep-work") return ok({ parent_id: "career" });
        return ok({ name: "Career", archived_at: null });
      }, seen),
    );
    await expect(restoreCategory("deep-work")).resolves.toEqual({ ok: true });
    const update = seen.find((q) => q.op === "update")!;
    expect(update.payload).toEqual({ archived_at: null });
    expect(eqValue(update, "id")).toBe("deep-work");
  });

  it("refuses a sub whose main is archived, naming the main", async () => {
    const seen: Query[] = [];
    createClient.mockResolvedValue(
      fakeClient((q) => {
        if (eqValue(q, "id") === "deep-work") return ok({ parent_id: "career" });
        return ok({ name: "Career", archived_at: "2026-10-01T00:00:00Z" });
      }, seen),
    );
    await expect(restoreCategory("deep-work")).resolves.toEqual({
      ok: false,
      message: "Restore Career first.",
    });
    expect(seen.some((q) => q.op === "update")).toBe(false);
  });

  it("maps a name taken meanwhile by an active sibling to the duplicate message", async () => {
    createClient.mockResolvedValue(
      fakeClient((q) => {
        if (q.op === "update") return { data: null, error: { code: "23505", message: "dup" } };
        if (eqValue(q, "id") === "deep-work") return ok({ parent_id: "career" });
        return ok({ name: "Career", archived_at: null });
      }),
    );
    await expect(restoreCategory("deep-work")).resolves.toEqual({
      ok: false,
      message: DUPLICATE_MESSAGE,
    });
  });
});
