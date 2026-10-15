import { describe, expect, it } from "vitest";
import type { DayCategory } from "@/lib/data/day";
import { buildWheel, dayTotal, fitLabel, navigate } from "./model";

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

  it("a main without subs is one full-span segment that edits itself", () => {
    const s = byKey["inner:family"];
    expect(s.title).toBe("Family");
    expect(s.editId).toBe("family");
    expect(s.editHours).toBe(2);
    expect(s.fillHours).toBe(2);
    expect(s.subName).toBeNull();
    expect(s.innerR).toBeCloseTo(0.32 * 200, 9);
    expect(s.outerR).toBeCloseTo(0.98 * 200, 9);
    expect(s.ariaLabel).toBe("Family, general, 2 hours");
    expect(byKey["outer:family"]).toBeUndefined();
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
    expect(navigate(segs, "outer:exercise", "ArrowRight")).toBe("outer:sleep");
    expect(navigate(segs, "outer:sleep", "ArrowLeft")).toBe("outer:exercise");
  });

  it("Down goes to the main's first outer segment, Up back to the inner", () => {
    expect(navigate(segs, "inner:health", "ArrowDown")).toBe("outer:sleep");
    expect(navigate(segs, "inner:family", "ArrowDown")).toBe("inner:family"); // subless: stays
    expect(navigate(segs, "outer:exercise", "ArrowUp")).toBe("inner:health");
    expect(navigate(segs, "outer:exercise", "ArrowDown")).toBe("outer:exercise");
    expect(navigate(segs, "inner:health", "ArrowUp")).toBe("inner:health");
  });

  it("returns null for an empty wheel", () => {
    expect(navigate([], null, "ArrowRight")).toBeNull();
  });
});

describe("fitLabel", () => {
  it("keeps a short label at the base size", () => {
    expect(fitLabel("Sleep", 100, 12)).toEqual({ text: "Sleep", fontSize: 12 });
  });

  it("shrinks a long label to fit", () => {
    const { text, fontSize } = fitLabel("Personal Growth", 100, 13);
    expect(text).toBe("Personal Growth");
    expect(fontSize).toBeCloseTo(100 / (15 * 0.56), 9);
    expect(fontSize).toBeLessThan(13);
    expect(fontSize).toBeGreaterThanOrEqual(9);
  });

  it("truncates with an ellipsis at the minimum size", () => {
    const { text, fontSize } = fitLabel("Relationships and community", 40, 12);
    expect(fontSize).toBe(9);
    expect(text.endsWith("…")).toBe(true);
    expect(text.length * 0.56 * 9).toBeLessThanOrEqual(40);
    expect(text).toBe("Relati…"); // floor(40 / 5.04) = 7 characters
    expect(fitLabel("Relationships", 40, 12, 8).fontSize).toBe(8);
  });

  it("returns empty text when nothing fits", () => {
    expect(fitLabel("Health", 3, 12)).toEqual({ text: "", fontSize: 9 });
    expect(fitLabel("Health", -5, 12).text).toBe("");
  });
});
