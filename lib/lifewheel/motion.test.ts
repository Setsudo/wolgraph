import { describe, expect, it } from "vitest";
import { LIFEWHEEL_RADIUS as R, bridgeRadius, sectorCentres } from "./geometry";
import {
  ENTER_MS,
  LEAVE_MS,
  MOVE_MS,
  POP_PEAK,
  STAGGER_MS,
  easeOut,
  easePop,
  retarget,
  sample,
  settled,
  settledMotions,
} from "./motion";
import { polarToXY } from "@/lib/wheel/geometry";

const at = (shown: { index: number; r: number; scale: number }[], i: number) =>
  shown.find((s) => s.index === i);

describe("easing", () => {
  it("ease-out runs 0 -> 1 without overshoot", () => {
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);
    for (let p = 0; p <= 1; p += 0.05) expect(easeOut(p)).toBeLessThanOrEqual(1);
  });

  it("pop rises to the peak, then settles to 1", () => {
    expect(easePop(0)).toBe(0);
    expect(easePop(1)).toBeCloseTo(1, 12);
    const peak = Math.max(...Array.from({ length: 101 }, (_, i) => easePop(i / 100)));
    expect(peak).toBeCloseTo(POP_PEAK, 6);
  });
});

describe("settled", () => {
  it("draws every valued sector at full size, nothing for null", () => {
    expect(settled([10, null, 0])).toEqual([
      { index: 0, r: 10, scale: 1 },
      { index: 2, r: 0, scale: 1 },
    ]);
    const s = sample(settledMotions([10, null, 0]), 0, 3);
    expect(s.shown).toEqual(settled([10, null, 0]));
    expect(s.done).toBe(true);
  });
});

describe("enter", () => {
  it("first mount grows each point from the centre, staggered in sector order", () => {
    const m = retarget([], [100, 50, null, 80], 0, true);
    const s0 = sample(m, 0, 4).shown;
    expect(s0.map((s) => s.index)).toEqual([0, 1, 3]);
    for (const s of s0) expect(s).toMatchObject({ r: 0, scale: 0 });
    // Sector 1 starts 40 ms after sector 0; sector 3 at 120 ms.
    const mid = sample(m, STAGGER_MS, 4).shown;
    expect(at(mid, 0)!.r).toBeGreaterThan(0);
    expect(at(mid, 1)).toMatchObject({ r: 0, scale: 0 });
    expect(sample(m, 3 * STAGGER_MS, 4).shown.find((s) => s.index === 3)!.r).toBe(0);
    // Peak overshoot on the dot, never on the radius.
    const peakT = 0.6 * ENTER_MS;
    expect(at(sample(m, peakT, 4).shown, 0)!.scale).toBeCloseTo(POP_PEAK, 6);
    expect(at(sample(m, peakT, 4).shown, 0)!.r).toBeLessThan(100);
    const end = sample(m, 3 * STAGGER_MS + ENTER_MS, 4);
    expect(end.shown).toEqual(settled([100, 50, null, 80]));
    expect(end.done).toBe(true);
    expect(sample(m, 3 * STAGGER_MS + ENTER_MS - 1, 4).done).toBe(false);
  });

  it("null -> number between rated neighbours grows out of their bridge, no stagger", () => {
    const rest = settledMotions([R, null, R, R]);
    const m = retarget(rest, [R, 60, R, R], 1000, false);
    const centres = sectorCentres(4);
    const bridge = bridgeRadius(
      polarToXY(R, centres[0], 600),
      polarToXY(R, centres[2], 600),
      centres[1],
    );
    expect(bridge).toBeGreaterThan(0);
    expect(at(sample(m, 1000, 4).shown, 1)).toMatchObject({ r: bridge, scale: 0 });
    expect(at(sample(m, 1000 + ENTER_MS, 4).shown, 1)).toMatchObject({ r: 60, scale: 1 });
    // The dot still pops past full size.
    expect(at(sample(m, 1000 + 0.6 * ENTER_MS, 4).shown, 1)!.scale).toBeCloseTo(POP_PEAK, 6);
    // The others stay put.
    expect(at(sample(m, 1100, 4).shown, 0)).toMatchObject({ r: R, scale: 1 });
  });

  it("null -> number with fewer than two rated neighbours grows from the centre", () => {
    const m = retarget(settledMotions([R, null, null]), [R, 60, null], 0, false);
    expect(at(sample(m, 0, 3).shown, 1)).toMatchObject({ r: 0, scale: 0 });
    const none = retarget([], [null, 60, null], 0, false);
    expect(at(sample(none, 0, 3).shown, 1)).toMatchObject({ r: 0, scale: 0 });
  });
});

describe("move", () => {
  it("number -> number glides from the current radius over MOVE_MS, no overshoot", () => {
    const m = retarget(settledMotions([100, 50, 80]), [100, 90, 80], 0, false);
    const rs = Array.from({ length: 11 }, (_, i) => at(sample(m, (MOVE_MS * i) / 10, 3).shown, 1)!);
    expect(rs[0].r).toBe(50);
    expect(rs[10].r).toBe(90);
    for (const s of rs) {
      expect(s.r).toBeLessThanOrEqual(90);
      expect(s.scale).toBe(1);
    }
    expect(sample(m, MOVE_MS, 3).done).toBe(true);
  });

  it("a change mid-glide starts from where the point is", () => {
    const m1 = retarget(settledMotions([100, 50, 80]), [100, 90, 80], 0, false);
    const mid = at(sample(m1, MOVE_MS / 2, 3).shown, 1)!.r;
    const m2 = retarget(m1, [100, 20, 80], MOVE_MS / 2, false);
    expect(at(sample(m2, MOVE_MS / 2, 3).shown, 1)!.r).toBeCloseTo(mid, 9);
    expect(at(sample(m2, MOVE_MS * 1.5, 3).shown, 1)!.r).toBe(20);
  });

  it("an unchanged target keeps its motion", () => {
    const m = retarget([], [100, 50, 80], 0, true);
    expect(retarget(m, [100, 50, 80], 10, false)).toEqual(m);
  });
});

describe("leave", () => {
  it("number -> null shrinks the dot and retracts the vertex to its neighbours' bridge, then removes it", () => {
    const n = 4;
    const m = retarget(settledMotions([R, R, R, R]), [R, null, R, R], 0, false);
    const centres = sectorCentres(n);
    const bridge = bridgeRadius(
      polarToXY(R, centres[0], 600),
      polarToXY(R, centres[2], 600),
      centres[1],
    );
    expect(at(sample(m, 0, n).shown, 1)).toMatchObject({ r: R, scale: 1 });
    const end = at(sample(m, LEAVE_MS - 0.001, n).shown, 1)!;
    expect(end.r).toBeCloseTo(bridge, 1);
    expect(end.scale).toBeCloseTo(0, 3);
    const gone = sample(m, LEAVE_MS, n);
    expect(gone.shown.map((s) => s.index)).toEqual([0, 2, 3]);
    expect(gone.motions.map((x) => x.index)).toEqual([0, 2, 3]);
    expect(gone.done).toBe(true);
  });

  it("retracts toward the centre when fewer than two neighbours remain", () => {
    const m = retarget(settledMotions([R, R, null]), [R, null, null], 0, false);
    expect(at(sample(m, LEAVE_MS - 0.001, 3).shown, 1)!.r).toBeCloseTo(0, 1);
  });

  it("coming back mid-leave pops in again from where it is", () => {
    const m1 = retarget(settledMotions([R, R, R, R]), [R, null, R, R], 0, false);
    const s = at(sample(m1, LEAVE_MS / 2, 4).shown, 1)!;
    const m2 = retarget(m1, [R, 100, R, R], LEAVE_MS / 2, false);
    expect(at(sample(m2, LEAVE_MS / 2, 4).shown, 1)!.r).toBeCloseTo(s.r, 9);
    expect(at(sample(m2, LEAVE_MS / 2 + ENTER_MS, 4).shown, 1)).toMatchObject({ r: 100, scale: 1 });
  });
});
