import { describe, expect, it } from "vitest";
import { eachDay, periodFor, shiftPeriod } from "./period";

describe("periodFor week", () => {
  it("Sunday anchor belongs to the week starting the Monday before", () => {
    // 2026-10-18 is a Sunday
    expect(periodFor("week", "2026-10-18")).toEqual({
      kind: "week",
      start: "2026-10-12",
      end: "2026-10-18",
      days: 7,
    });
  });

  it("Monday anchor starts its own week", () => {
    expect(periodFor("week", "2026-10-12")).toMatchObject({
      start: "2026-10-12",
      end: "2026-10-18",
    });
  });

  it("crosses a month boundary", () => {
    // 2026-09-30 is a Wednesday
    expect(periodFor("week", "2026-09-30")).toMatchObject({
      start: "2026-09-28",
      end: "2026-10-04",
      days: 7,
    });
  });

  it("crosses a year boundary", () => {
    // 2026-12-31 is a Thursday
    expect(periodFor("week", "2026-12-31")).toMatchObject({
      start: "2026-12-28",
      end: "2027-01-03",
      days: 7,
    });
    expect(periodFor("week", "2027-01-01")).toMatchObject({
      start: "2026-12-28",
      end: "2027-01-03",
    });
  });

  it("is unaffected by a DST change", () => {
    // EU DST ends 2026-10-25, US 2026-11-01
    expect(periodFor("week", "2026-10-25")).toMatchObject({
      start: "2026-10-19",
      end: "2026-10-25",
      days: 7,
    });
    expect(periodFor("week", "2026-11-01")).toMatchObject({
      start: "2026-10-26",
      end: "2026-11-01",
      days: 7,
    });
  });
});

describe("periodFor month", () => {
  it.each([
    ["2026-02-14", "2026-02-01", "2026-02-28", 28],
    ["2028-02-29", "2028-02-01", "2028-02-29", 29],
    ["2026-01-31", "2026-01-01", "2026-01-31", 31],
    ["2026-04-01", "2026-04-01", "2026-04-30", 30],
    ["2026-12-15", "2026-12-01", "2026-12-31", 31],
  ])("%s -> %s..%s (%i days)", (anchor, start, end, days) => {
    expect(periodFor("month", anchor)).toEqual({ kind: "month", start, end, days });
  });

  it("rejects malformed and impossible dates", () => {
    expect(() => periodFor("month", "2026-2-1")).toThrow();
    expect(() => periodFor("month", "2026-02-30")).toThrow();
  });
});

describe("shiftPeriod", () => {
  it("moves weeks both ways, across a year boundary", () => {
    const w = periodFor("week", "2026-12-31");
    expect(shiftPeriod(w, 1)).toMatchObject({ start: "2027-01-04", end: "2027-01-10" });
    expect(shiftPeriod(w, -1)).toMatchObject({ start: "2026-12-21", end: "2026-12-27" });
    expect(shiftPeriod(shiftPeriod(w, 3), -3)).toEqual(w);
  });

  it("moves months both ways, across year and length changes", () => {
    const jan = periodFor("month", "2026-01-31");
    expect(shiftPeriod(jan, 1)).toEqual({
      kind: "month",
      start: "2026-02-01",
      end: "2026-02-28",
      days: 28,
    });
    expect(shiftPeriod(jan, -1)).toEqual({
      kind: "month",
      start: "2025-12-01",
      end: "2025-12-31",
      days: 31,
    });
    expect(shiftPeriod(jan, 25)).toMatchObject({ start: "2028-02-01", days: 29 });
    expect(shiftPeriod(jan, 0)).toEqual(jan);
  });
});

describe("eachDay", () => {
  it("lists every day of a week across a year boundary", () => {
    expect(eachDay(periodFor("week", "2027-01-01"))).toEqual([
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
      "2027-01-03",
    ]);
  });

  it("lists every day of February 2026 and 2028", () => {
    const feb26 = eachDay(periodFor("month", "2026-02-10"));
    expect(feb26).toHaveLength(28);
    expect(feb26.at(-1)).toBe("2026-02-28");
    const feb28 = eachDay(periodFor("month", "2028-02-10"));
    expect(feb28).toHaveLength(29);
    expect(feb28.at(-1)).toBe("2028-02-29");
  });
});
