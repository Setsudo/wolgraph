import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const upsert = vi.fn();
const from = vi.fn();
const createClient = vi.fn();
const revalidatePath = vi.fn();

vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("next/cache", () => ({ revalidatePath }));

const { saveRating } = await import("./actions");

const CAT = "0b8f8a52-5d0e-4c55-9a77-2f7f3c0e9a11";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-15T12:00:00Z")); // UTC today is Oct 15
  upsert.mockResolvedValue({ error: null });
  from.mockReturnValue({ upsert });
  createClient.mockResolvedValue({
    auth: { getClaims: async () => ({ data: { claims: { sub: "user-1" } } }) },
    from,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("saveRating", () => {
  it("upserts the score and revalidates /rate", async () => {
    await expect(saveRating(CAT, "2026-10-15", 7)).resolves.toEqual({ ok: true });
    expect(from).toHaveBeenCalledWith("ratings");
    expect(upsert).toHaveBeenCalledWith(
      { user_id: "user-1", category_id: CAT, day: "2026-10-15", score: 7 },
      { onConflict: "user_id,category_id,day" },
    );
    expect(revalidatePath).toHaveBeenCalledWith("/rate");
  });

  it("accepts 0 and 10", async () => {
    await expect(saveRating(CAT, "2026-10-15", 0)).resolves.toEqual({ ok: true });
    await expect(saveRating(CAT, "2026-10-15", 10)).resolves.toEqual({ ok: true });
  });

  it.each([-1, 11, 5.5, Number.NaN, Infinity, "5" as unknown as number])(
    "rejects score %s without touching the database",
    async (score) => {
      const result = await saveRating(CAT, "2026-10-15", score);
      expect(result).toEqual({ ok: false, message: "Score must be a whole number 0 to 10." });
      expect(createClient).not.toHaveBeenCalled();
    },
  );

  it("rejects an invalid category or date", async () => {
    expect((await saveRating("nope", "2026-10-15", 5)).ok).toBe(false);
    expect((await saveRating(CAT, "2026-02-30", 5)).ok).toBe(false);
    expect((await saveRating(CAT, "15/10/2026", 5)).ok).toBe(false);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rejects days after UTC today + 1, allows UTC today + 1", async () => {
    await expect(saveRating(CAT, "2026-10-17", 5)).resolves.toEqual({
      ok: false,
      message: "Future days can't be edited.",
    });
    expect(createClient).not.toHaveBeenCalled();
    await expect(saveRating(CAT, "2026-10-16", 5)).resolves.toEqual({ ok: true });
  });

  it("fails without a user", async () => {
    createClient.mockResolvedValue({
      auth: { getClaims: async () => ({ data: null }) },
      from,
    });
    await expect(saveRating(CAT, "2026-10-15", 5)).resolves.toEqual({
      ok: false,
      message: "Not signed in.",
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("does not revalidate on a database error or a throw", async () => {
    upsert.mockResolvedValue({ error: { code: "23514", message: "main categories only" } });
    await expect(saveRating(CAT, "2026-10-15", 5)).resolves.toEqual({
      ok: false,
      message: "Couldn't save.",
    });
    upsert.mockRejectedValue(new Error("network"));
    await expect(saveRating(CAT, "2026-10-15", 5)).resolves.toEqual({
      ok: false,
      message: "Couldn't save.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
