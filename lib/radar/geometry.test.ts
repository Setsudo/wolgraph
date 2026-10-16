import { describe, expect, it } from "vitest";
import { polygonPath, ringSteps, scaleMax } from "./geometry";

describe("scaleMax", () => {
  it.each([
    [[0, 0], 1],
    [[], 1],
    [[0.5], 1],
    [[1], 1],
    [[1.01], 2],
    [[2.5], 3],
    [[3.5, 1], 4],
    [[4.25], 6],
    [[7], 8],
    [[9], 10],
    [[11], 12],
    [[12.5], 16],
    [[17], 20],
    [[21], 24],
    [[24], 24],
    [[0, NaN, -3, 5], 6],
  ])("%j -> %i", (values, expected) => {
    expect(scaleMax(values)).toBe(expected);
  });
});

describe("ringSteps", () => {
  it("every 1 up to 4, every 2 up to 12, every 4 above", () => {
    expect(ringSteps(1)).toEqual([1]);
    expect(ringSteps(3)).toEqual([1, 2, 3]);
    expect(ringSteps(8)).toEqual([2, 4, 6, 8]);
    expect(ringSteps(16)).toEqual([4, 8, 12, 16]);
    expect(ringSteps(24)).toEqual([4, 8, 12, 16, 20, 24]);
  });
});

describe("polygonPath", () => {
  it("formats M/L/Z with 2 decimals", () => {
    expect(
      polygonPath([
        { x: 1.005, y: 2 },
        { x: 3.14159, y: -0.0001 },
        { x: 5, y: 6 },
      ]),
    ).toBe("M 1 2 L 3.14 0 L 5 6 Z");
    expect(polygonPath([])).toBe("");
  });
});
