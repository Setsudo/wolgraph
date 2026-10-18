import { describe, expect, it } from "vitest";
import { SCORE_MIN, displayedScore, isValidScore } from "./score";

describe("displayedScore", () => {
  it("shows the day's saved score", () => {
    expect(displayedScore("a", { a: 8 })).toBe(8);
    expect(displayedScore("a", { a: 0 })).toBe(0);
  });

  it("shows 0 for a category with no score that day, never 5 or an earlier score", () => {
    expect(displayedScore("a", {})).toBe(0);
    expect(displayedScore("a", { b: 9 })).toBe(0);
    expect(SCORE_MIN).toBe(0);
  });
});

describe("isValidScore", () => {
  it("accepts integers 0..10 only", () => {
    for (let s = 0; s <= 10; s++) expect(isValidScore(s)).toBe(true);
    for (const bad of [-1, 11, 5.5, Number.NaN, Infinity, "5", null, undefined]) {
      expect(isValidScore(bad)).toBe(false);
    }
  });
});
