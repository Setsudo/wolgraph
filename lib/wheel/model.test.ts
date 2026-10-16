import { describe, expect, it } from "vitest";
import type { DayCategory } from "@/lib/data/day";
import { archivedSubParents, buildWheel, dayTotal, fitLabel, navigate } from "./model";

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

describe("archived subcategory hours", () => {
  const entries = [
    { categoryId: "health", hours: 0.5, parentId: null },
    { categoryId: "sleep", hours: 7.5, parentId: "health" },
    { categoryId: "old-health", hours: 1, parentId: "health" }, // archived sub of a main with subs
    { categoryId: "old-family", hours: 1.5, parentId: "family" }, // archived sub of a subless main
    { categoryId: "old-family-2", hours: 0.25, parentId: "family" },
    { categoryId: "old-main", hours: 3, parentId: null }, // archived main
    { categoryId: "orphan", hours: 2, parentId: "gone" }, // sub of an archived main
    { categoryId: "family", hours: 2 }, // no parent info (e.g. fixtures)
  ];
  const archived = archivedSubParents(cats, entries);
  const h = Object.fromEntries(entries.map((e) => [e.categoryId, e.hours]));
  const segs = buildWheel(cats, h, archived);
  const byKey = Object.fromEntries(segs.map((s) => [s.key, s]));

  it("maps only inactive categories with a parent to their main", () => {
    expect(archived).toEqual({
      "old-health": "health",
      "old-family": "family",
      "old-family-2": "family",
      orphan: "gone",
    });
  });

  it("archived subs get no segment", () => {
    expect(segs.map((s) => s.key)).toEqual([
      "inner:health",
      "inner:family",
      "inner:career",
      "outer:sleep",
      "outer:exercise",
    ]);
  });

  it("a main with active subs fills with own + active subs + archived subs; edits only its own", () => {
    const s = byKey["inner:health"];
    expect(s.fillHours).toBe(9); // 0.5 own + 7.5 sleep + 1 archived
    expect(s.editHours).toBe(0.5);
    expect(s.ariaLabel).toBe("Health, general, 0.5 hours");
    expect(byKey["outer:sleep"].fillHours).toBe(7.5);
    expect(byKey["outer:exercise"].fillHours).toBe(0);
  });

  it("a subless main fills and reads out own + archived subs; edits only its own", () => {
    const s = byKey["inner:family"];
    expect(s.fillHours).toBe(3.75);
    expect(s.editHours).toBe(2);
    expect(s.ariaLabel).toBe("Family, general, 3.75 hours");
    expect(byKey["inner:career"].fillHours).toBe(0);
  });

  it("leaves the day total unchanged", () => {
    expect(dayTotal(h)).toBe(17.75);
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

describe("buildWheel with crowded subcategories", () => {
  // Eight mains; Health has 3 subs, Career has 10 (the charter maximum), the rest none.
  const mainIds = [
    "health",
    "growth",
    "finance",
    "family",
    "career",
    "relax",
    "relations",
    "spirit",
  ];
  const crowded: DayCategory[] = [
    ...mainIds.map((id) => ({
      id,
      parentId: null,
      name: id,
      color: `#00000${mainIds.indexOf(id)}`,
    })),
    ...["Sleep", "Exercise", "Meditation"].map((name) => ({
      id: `health-${name}`,
      parentId: "health",
      name,
      color: "#000000",
    })),
    ...Array.from({ length: 10 }, (_, i) => ({
      id: `career-${i}`,
      parentId: "career",
      name: `Project ${i}`,
      color: "#000004",
    })),
  ];
  const hours = { "health-Sleep": 7, "career-3": 1.5, career: 0.5, "career-archived": 2 };
  const segs = buildWheel(crowded, hours);
  const outerOf = (mainId: string) => segs.filter((s) => s.ring === "outer" && s.mainId === mainId);

  it("subs split their main's angle equally and contiguously in sort order", () => {
    for (const [mainId, k] of [
      ["health", 3],
      ["career", 10],
    ] as const) {
      const main = segs.find((s) => s.key === `inner:${mainId}`)!;
      const outer = outerOf(mainId);
      expect(outer).toHaveLength(k);
      expect(outer[0].startAngle).toBeCloseTo(main.startAngle, 9);
      expect(outer[k - 1].endAngle).toBeCloseTo(main.endAngle, 9);
      for (let j = 0; j < k; j++) {
        expect(outer[j].endAngle - outer[j].startAngle).toBeCloseTo(45 / k, 9);
        if (j > 0) expect(outer[j].startAngle).toBeCloseTo(outer[j - 1].endAngle, 9);
      }
      // A main with subs keeps to the inner ring.
      expect(main.outerR).toBeCloseTo(0.66 * 200, 9);
    }
    expect(outerOf("career").map((s) => s.subName)).toEqual(
      Array.from({ length: 10 }, (_, i) => `Project ${i}`),
    );
  });

  it("every sub is labelled 'Main, Sub, N hours' and takes the main's color", () => {
    const sub = segs.find((s) => s.key === "outer:career-3")!;
    expect(sub.ariaLabel).toBe("career, Project 3, 1.5 hours");
    expect(sub.title).toBe("career · Project 3");
    expect(sub.color).toBe("#000004");
    expect(outerOf("career").every((s) => s.color === "#000004")).toBe(true);
  });

  it("the main's inner segment edits its own hours and fills with own + active subs", () => {
    const career = segs.find((s) => s.key === "inner:career")!;
    expect(career.editId).toBe("career");
    expect(career.editHours).toBe(0.5);
    expect(career.fillHours).toBe(2); // 0.5 own + 1.5 on Project 3; the archived sub is not on the wheel
    expect(dayTotal(hours)).toBe(11); // the day total still counts the archived sub's 2 h
  });

  it("arrow keys reach every outer segment from the first inner one", () => {
    const reached = new Set<string>();
    let key = navigate(segs, null, "ArrowRight");
    for (let i = 0; i < mainIds.length; i++) {
      reached.add(key!);
      const down = navigate(segs, key, "ArrowDown");
      if (down !== key) {
        // Walk the whole outer ring once from this main's first sub.
        let outer = down;
        for (let j = 0; j < 13; j++) {
          reached.add(outer!);
          outer = navigate(segs, outer, "ArrowRight");
        }
        expect(outer).toBe(down); // wrapped all the way round
      }
      key = navigate(segs, key, "ArrowRight");
    }
    expect(reached).toEqual(new Set(segs.map((s) => s.key)));
  });
});
