import { describe, expect, it } from "vitest";
import {
  addHours,
  clampHours,
  formatHours,
  formatHoursFixed,
  isValidHours,
  QUICK_ADD,
} from "./hours";

describe("isValidHours", () => {
  it("accepts 0..24 in 0.25 steps", () => {
    for (const h of [0, 0.25, 0.5, 7.75, 24]) expect(isValidHours(h)).toBe(true);
  });

  it("rejects off-step, out-of-range and non-numbers", () => {
    for (const h of [0.1, -0.25, 24.25, 25, Number.NaN, Infinity, "4", null]) {
      expect(isValidHours(h)).toBe(false);
    }
  });
});

describe("stepper math", () => {
  it("steps by 0.25 in both directions", () => {
    expect(addHours(4, 0.25)).toBe(4.25);
    expect(addHours(4, -0.25)).toBe(3.75);
  });

  it("clamps to [0, 24]", () => {
    expect(addHours(0, -0.25)).toBe(0);
    expect(addHours(24, 0.25)).toBe(24);
    expect(addHours(23, 8)).toBe(24);
  });

  it("quick-add chips add and clamp", () => {
    expect(QUICK_ADD).toEqual([0.5, 1, 2, 4, 8]);
    expect(QUICK_ADD.map((c) => addHours(3.5, c))).toEqual([4, 4.5, 5.5, 7.5, 11.5]);
    expect(addHours(20, 8)).toBe(24);
  });

  it("rounds to the nearest quarter", () => {
    expect(clampHours(1.1)).toBe(1);
    expect(clampHours(1.2)).toBe(1.25);
    expect(clampHours(Number.NaN)).toBe(0);
  });
});

describe("formatting", () => {
  it("drops trailing zeros", () => {
    expect(formatHours(6.5)).toBe("6.5");
    expect(formatHours(8)).toBe("8");
    expect(formatHours(19.25)).toBe("19.25");
    expect(formatHours(0)).toBe("0");
    expect(formatHours(0.1 + 0.2)).toBe("0.3");
  });

  it("fixed format always has two decimals", () => {
    expect(formatHoursFixed(4)).toBe("4.00");
    expect(formatHoursFixed(7.5)).toBe("7.50");
    expect(formatHoursFixed(0.25)).toBe("0.25");
  });
});
