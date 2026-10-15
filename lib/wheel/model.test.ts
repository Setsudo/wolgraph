import { describe, expect, it } from "vitest";
import type { DayCategory } from "@/lib/data/day";
import { buildWheel, dayTotal, navigate, truncate } from "./model";

const cats: DayCategory[] = [
  { id: "health", parentId: null, name: "Health", color: "#2F8C8C" },
  { id: "family", parentId: null, name: "Family", color: "#C9831F" },
  { id: "career", parentId: null, name: "Career", color: "#C8553D" },
  { id: "sleep", parentId: "health", name: "Sleep", color: "#2F8C8C" },
  { id: "exercise", parentId: "health", name: "Exercise", color: "#2F8C8C" },
];
const hours = { health: 0.5, sleep: 7.5, exercise: 1, family: 2, archived: 3 };

describe("buildWheel", () => {
  const segs = buildWheel(cats, hours);
  const byKey = Object.fromEntries(segs.map((s) => [s.key, s]));

  it("orders inner mains, then outer segments", () => {
    expect(segs.map((s) => s.key)).toEqual([
      "inner:health",
      "inner:family",
      "inner:career",
      "outer:sleep",
      "outer:exercise",
      "outer:family",
      "outer:career",
    ]);
  });

  it("inner edits the main's own entry and fills with main + subs", () => {
    const s = byKey["inner:health"];
    expect(s.editId).toBe("health");
    expect(s.editHours).toBe(0.5);
    expect(s.fillHours).toBe(9);
    expect(s.title).toBe("Health · general");
    expect(s.ariaLabel).toBe("Health, general, 0.5 hours");
  });

  it("outer sub segments edit the sub", () => {
    const s = byKey["outer:sleep"];
    expect(s.editId).toBe("sleep");
    expect(s.fillHours).toBe(7.5);
    expect(s.color).toBe("#2F8C8C");
    expect(s.title).toBe("Health · Sleep");
    expect(s.ariaLabel).toBe("Health, Sleep, 7.5 hours");
  });

  it("a main without subs edits itself from both rings", () => {
    expect(byKey["inner:family"].title).toBe("Family");
    expect(byKey["outer:family"].title).toBe("Family");
    expect(byKey["outer:family"].editId).toBe("family");
    expect(byKey["outer:family"].ariaLabel).toBe("Family, general, 2 hours");
    expect(byKey["inner:career"].ariaLabel).toBe("Career, general, 0 hours");
  });
});

describe("dayTotal", () => {
  it("sums every entry, archived included", () => {
    expect(dayTotal(hours)).toBe(14);
    expect(dayTotal({})).toBe(0);
  });
});

describe("navigate", () => {
  const segs = buildWheel(cats, {});

  it("starts at the first inner segment", () => {
    expect(navigate(segs, null, "ArrowRight")).toBe("inner:health");
  });

  it("Left/Right wrap within the ring", () => {
    expect(navigate(segs, "inner:health", "ArrowRight")).toBe("inner:family");
    expect(navigate(segs, "inner:career", "ArrowRight")).toBe("inner:health");
    expect(navigate(segs, "inner:health", "ArrowLeft")).toBe("inner:career");
    expect(navigate(segs, "outer:career", "ArrowRight")).toBe("outer:sleep");
    expect(navigate(segs, "outer:sleep", "ArrowLeft")).toBe("outer:career");
  });

  it("Down goes to the main's first outer segment, Up back to the inner", () => {
    expect(navigate(segs, "inner:health", "ArrowDown")).toBe("outer:sleep");
    expect(navigate(segs, "inner:family", "ArrowDown")).toBe("outer:family");
    expect(navigate(segs, "outer:exercise", "ArrowUp")).toBe("inner:health");
    expect(navigate(segs, "outer:exercise", "ArrowDown")).toBe("outer:exercise");
    expect(navigate(segs, "inner:health", "ArrowUp")).toBe("inner:health");
  });

  it("returns null for an empty wheel", () => {
    expect(navigate([], null, "ArrowRight")).toBeNull();
  });
});

describe("truncate", () => {
  it("keeps short text and ellipsizes long text to the limit", () => {
    expect(truncate("Spirituality", 12)).toBe("Spirituality");
    expect(truncate("Personal Growth", 12)).toBe("Personal Gr…");
    expect(truncate("Personal Growth", 12)).toHaveLength(12);
    expect(truncate("Deep work", 8)).toBe("Deep wo…");
  });
});
