import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const upsert = vi.fn();
const eq = vi.fn();
const del = vi.fn();
const createClient = vi.fn();
const revalidatePath = vi.fn();

vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("next/cache", () => ({ revalidatePath }));

const { saveEntry } = await import("./actions");

const CAT = "0b8f8a52-5d0e-4c55-9a77-2f7f3c0e9a11";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-15T12:00:00Z")); // injected clock: UTC today is Oct 15
  const chain = { eq: eq.mockImplementation(() => chainResult) };
  const chainResult = Object.assign(Promise.resolve({ error: null }), chain);
  del.mockReturnValue(chain);
  upsert.mockResolvedValue({ error: null });
  createClient.mockResolvedValue({
    auth: { getClaims: async () => ({ data: { claims: { sub: "user-1" } } }) },
    from: () => ({ upsert, delete: del }),
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("saveEntry future-day guard", () => {
  it("rejects days after UTC today + 1 without touching the database", async () => {
    await expect(saveEntry("2026-10-17", CAT, 2)).resolves.toEqual({
      ok: false,
      message: "Future days can't be edited.",
    });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("allows UTC today + 1 (the furthest-ahead time zone's today)", async () => {
    await expect(saveEntry("2026-10-16", CAT, 2)).resolves.toEqual({ ok: true });
    expect(upsert).toHaveBeenCalledWith(
      { user_id: "user-1", category_id: CAT, day: "2026-10-16", hours: 2 },
      { onConflict: "user_id,category_id,day" },
    );
    expect(revalidatePath).toHaveBeenCalledWith("/day/2026-10-16");
  });

  it("follows the clock across a UTC day boundary", async () => {
    vi.setSystemTime(new Date("2026-10-16T00:00:00Z"));
    await expect(saveEntry("2026-10-17", CAT, 2)).resolves.toEqual({ ok: true });
  });
});

describe("saveEntry", () => {
  it("deletes the row at 0 hours", async () => {
    await expect(saveEntry("2026-10-15", CAT, 0)).resolves.toEqual({ ok: true });
    expect(del).toHaveBeenCalled();
    expect(eq.mock.calls).toEqual([
      ["user_id", "user-1"],
      ["category_id", CAT],
      ["day", "2026-10-15"],
    ]);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("validates input", async () => {
    expect((await saveEntry("2026-02-30", CAT, 1)).ok).toBe(false);
    expect((await saveEntry("2026-10-15", "nope", 1)).ok).toBe(false);
    expect((await saveEntry("2026-10-15", CAT, 0.1)).ok).toBe(false);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("does not revalidate on a database error", async () => {
    upsert.mockResolvedValue({ error: { message: "boom" } });
    await expect(saveEntry("2026-10-15", CAT, 1)).resolves.toEqual({
      ok: false,
      message: "Couldn't save.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
