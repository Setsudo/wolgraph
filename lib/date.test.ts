import { describe, expect, it } from "vitest";
import { addDays, formatDayLabel, isValidDay, toLocalDateString, todayLocal } from "./date";

describe("toLocalDateString", () => {
  it("zero-pads month and day", () => {
    expect(toLocalDateString(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("uses the local calendar day near midnight", () => {
    expect(toLocalDateString(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31");
    expect(toLocalDateString(new Date(2027, 0, 1, 0, 0))).toBe("2027-01-01");
  });
});

describe("todayLocal", () => {
  it("formats the given instant", () => {
    expect(todayLocal(new Date(2026, 9, 15, 12))).toBe("2026-10-15");
  });

  it("matches YYYY-MM-DD by default", () => {
    expect(todayLocal()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("isValidDay", () => {
  it("accepts real calendar dates", () => {
    expect(isValidDay("2026-10-15")).toBe(true);
    expect(isValidDay("2028-02-29")).toBe(true);
  });

  it("rejects malformed or impossible dates", () => {
    for (const s of [
      "2026-02-30",
      "2027-02-29",
      "2026-13-01",
      "2026-1-05",
      "abc",
      "",
      "2026-10-15x",
    ]) {
      expect(isValidDay(s)).toBe(false);
    }
    expect(isValidDay(20261015)).toBe(false);
  });
});

describe("addDays", () => {
  it("crosses month and year boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});

describe("formatDayLabel", () => {
  it("formats weekday, month and day", () => {
    expect(formatDayLabel("2026-10-14")).toBe("Wed, Oct 14");
    expect(formatDayLabel("2026-10-13")).toBe("Tue, Oct 13");
  });
});
