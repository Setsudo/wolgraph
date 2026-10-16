import { describe, expect, it } from "vitest";
import { sideOrder } from "./layout";

describe("sideOrder", () => {
  it("n = 8: right 4,3,2,1; left 5,6,7,0", () => {
    expect(sideOrder(8)).toEqual({ right: [4, 3, 2, 1], left: [5, 6, 7, 0] });
  });

  it("n = 3: right 1; left 2,0", () => {
    expect(sideOrder(3)).toEqual({ right: [1], left: [2, 0] });
  });

  it("n = 9: right 4,3,2,1; left 5,6,7,8,0", () => {
    expect(sideOrder(9)).toEqual({ right: [4, 3, 2, 1], left: [5, 6, 7, 8, 0] });
  });

  it("uses every index exactly once", () => {
    for (let n = 1; n <= 12; n++) {
      const { left, right } = sideOrder(n);
      expect([...left, ...right].sort((a, b) => a - b)).toEqual([...Array(n).keys()]);
    }
  });

  it("handles 0, 1 and 2", () => {
    expect(sideOrder(0)).toEqual({ right: [], left: [] });
    expect(sideOrder(1)).toEqual({ right: [], left: [0] });
    expect(sideOrder(2)).toEqual({ right: [1], left: [0] });
  });
});
