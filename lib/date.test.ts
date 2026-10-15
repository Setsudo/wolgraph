import { describe, expect, it } from "vitest";
import { toLocalDateString, todayLocal } from "./date";

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
