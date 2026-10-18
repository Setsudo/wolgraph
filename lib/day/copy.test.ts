import { describe, expect, it } from "vitest";
import {
  canOfferCopy,
  copiedMessage,
  copyableEntries,
  copyLabel,
  copyPlan,
  previousDayName,
} from "./copy";

describe("copyableEntries", () => {
  it("keeps active categories with positive valid hours, once each", () => {
    expect(
      copyableEntries(
        ["a", "b", "c"],
        [
          { categoryId: "a", hours: 2 },
          { categoryId: "archived", hours: 3 },
          { categoryId: "b", hours: 0 },
          { categoryId: "c", hours: 0.1 },
          { categoryId: "a", hours: 5 },
          { categoryId: "c", hours: 1.25 },
        ],
      ),
    ).toEqual([
      { categoryId: "a", hours: 2 },
      { categoryId: "c", hours: 1.25 },
    ]);
  });

  it("drops parentId and anything else beyond id and hours", () => {
    expect(copyableEntries(["a"], [{ categoryId: "a", hours: 1, parentId: "m" } as never])).toEqual(
      [{ categoryId: "a", hours: 1 }],
    );
  });
});

describe("copyPlan", () => {
  it("sums the copyable hours", () => {
    const cats = [
      { id: "a", parentId: null, name: "A", color: "#000000" },
      { id: "s", parentId: "a", name: "S", color: "#000000" },
    ];
    expect(
      copyPlan(cats, [
        { categoryId: "a", hours: 1.5 },
        { categoryId: "s", hours: 2 },
        { categoryId: "gone", hours: 4 },
      ]),
    ).toEqual({
      entries: [
        { categoryId: "a", hours: 1.5 },
        { categoryId: "s", hours: 2 },
      ],
      total: 3.5,
    });
  });
});

describe("canOfferCopy", () => {
  const base = { readOnly: false, dayTotal: 0, unsettled: false, copyable: 3 };
  it("offers on an empty editable day with something to copy", () => {
    expect(canOfferCopy(base)).toBe(true);
  });
  it("never offers once anything is logged, waiting to save, read-only or empty to copy", () => {
    expect(canOfferCopy({ ...base, dayTotal: 0.25 })).toBe(false);
    expect(canOfferCopy({ ...base, unsettled: true })).toBe(false);
    expect(canOfferCopy({ ...base, readOnly: true })).toBe(false);
    expect(canOfferCopy({ ...base, copyable: 0 })).toBe(false);
  });
});

describe("previousDayName", () => {
  it("says yesterday on today, the date label otherwise", () => {
    expect(previousDayName("2026-10-18", "2026-10-18")).toBe("yesterday");
    expect(previousDayName("2026-10-16", "2026-10-18")).toBe("Thu, Oct 15");
    expect(previousDayName("2026-10-18", null)).toBe("Sat, Oct 17");
  });
});

describe("copyLabel and copiedMessage", () => {
  it("names the source day and the hours", () => {
    expect(copyLabel("2026-10-18", "2026-10-18", 17.5)).toBe("Copy yesterday's hours (17.5 h)");
    expect(copyLabel("2026-10-16", "2026-10-18", 2)).toBe("Copy hours from Thu, Oct 15 (2 h)");
  });
  it("counts what was written", () => {
    expect(copiedMessage(6, "yesterday")).toBe("Copied 6 entries from yesterday.");
    expect(copiedMessage(1, "Thu, Oct 15")).toBe("Copied 1 entry from Thu, Oct 15.");
    expect(copiedMessage(0, "yesterday")).toBe("Nothing new to copy.");
  });
});
