import { describe, expect, it } from "vitest";
import { periodFor } from "@/lib/data/period";
import { formatHours, parseTrendsParams, periodLabel, trendsHref } from "./format";

describe("periodLabel", () => {
  it("formats a week within one month", () => {
    expect(periodLabel(periodFor("week", "2026-10-15"))).toBe("Oct 12 – 18, 2026");
  });
  it("formats a week across months", () => {
    expect(periodLabel(periodFor("week", "2026-10-01"))).toBe("Sep 28 – Oct 4, 2026");
  });
  it("formats a week across years", () => {
    expect(periodLabel(periodFor("week", "2026-12-31"))).toBe("Dec 28, 2026 – Jan 3, 2027");
  });
  it("formats a month", () => {
    expect(periodLabel(periodFor("month", "2026-10-15"))).toBe("October 2026");
  });
});

describe("formatHours", () => {
  it("drops trailing zeros", () => {
    expect(formatHours(12.5)).toBe("12.5 h");
    expect(formatHours(3)).toBe("3 h");
    expect(formatHours(2.25)).toBe("2.25 h");
    expect(formatHours(1 / 3)).toBe("0.33 h");
  });
});

describe("parseTrendsParams", () => {
  it("accepts valid kind and anchor", () => {
    expect(parseTrendsParams({ kind: "month", anchor: "2026-10-15" })).toEqual({
      kind: "month",
      anchor: "2026-10-15",
    });
  });
  it("rejects missing or invalid values", () => {
    expect(parseTrendsParams({})).toBeNull();
    expect(parseTrendsParams({ kind: "week" })).toBeNull();
    expect(parseTrendsParams({ kind: "year", anchor: "2026-10-15" })).toBeNull();
    expect(parseTrendsParams({ kind: "week", anchor: "2026-02-30" })).toBeNull();
    expect(parseTrendsParams({ kind: "week", anchor: "today" })).toBeNull();
  });
});

describe("trendsHref", () => {
  it("sets kind and anchor and keeps other params", () => {
    expect(trendsHref("/trends", "?few=1&kind=week", "month", "2026-10-01")).toBe(
      "/trends?few=1&kind=month&anchor=2026-10-01",
    );
  });
});
