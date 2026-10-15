import { describe, expect, it } from "vitest";
import { DEFAULT_SCORE, displayedScore, isValidScore } from "./score";

describe("displayedScore", () => {
  it("prefers today's score over the previous one", () => {
    expect(displayedScore("a", { a: 8 }, { a: 3 })).toBe(8);
  });

  it("keeps a score of 0 today rather than falling back", () => {
    expect(displayedScore("a", { a: 0 }, { a: 3 })).toBe(0);
  });

  it("falls back to the previous score, then to 5", () => {
    expect(displayedScore("a", {}, { a: 0 })).toBe(0);
    expect(displayedScore("a", {}, { a: 3 })).toBe(3);
    expect(displayedScore("a", { b: 9 }, { b: 1 })).toBe(DEFAULT_SCORE);
    expect(DEFAULT_SCORE).toBe(5);
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
