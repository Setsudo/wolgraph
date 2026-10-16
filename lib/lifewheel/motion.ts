/**
 * Life-wheel point motion: pure interpolation of each sector's plotted radius
 * and dot scale over time. No DOM or React; components/LifeWheelPlot drives it
 * with requestAnimationFrame timestamps (ms).
 *
 * - Enter (first value, or null -> number): the dot pops 0 -> 1.15 -> 1 over
 *   ENTER_MS while the radius grows to its value: from the centre on first
 *   mount (each sector STAGGER_MS after the previous one, in sector order),
 *   later from the bridge between its rated neighbours (the centre when fewer
 *   than two remain).
 * - Move (number -> number): radius glides over MOVE_MS, no overshoot.
 * - Leave (number -> null): the dot shrinks to 0 and the vertex retracts to
 *   the bridge between its remaining neighbours over LEAVE_MS, then is removed.
 */

import { LIFEWHEEL_SIZE, bridgeRadius, sectorCentres } from "./geometry";
import { polarToXY } from "@/lib/wheel/geometry";

export const ENTER_MS = 450;
export const MOVE_MS = 250;
export const LEAVE_MS = 200;
export const STAGGER_MS = 40;
/** Peak dot scale of the pop-in. */
export const POP_PEAK = 1.15;
/** Fraction of ENTER_MS spent rising to POP_PEAK; the rest settles to 1. */
const POP_RISE = 0.6;

export type Ease = "out" | "pop";

export type Track = { from: number; to: number; start: number; duration: number; ease: Ease };

export type Motion = {
  index: number;
  /** The value radius this sector is heading to; null while leaving. */
  target: number | null;
  /** While leaving, `radius.to` is ignored: the vertex heads for the bridge. */
  radius: Track;
  scale: Track;
};

/** What to draw for one sector at one instant. */
export type Shown = { index: number; r: number; scale: number };

/** Ease-out cubic. */
export function easeOut(p: number): number {
  return 1 - (1 - p) ** 3;
}

/** 0 -> POP_PEAK (ease-out) -> 1 (ease-in-out); f(0) = 0, f(1) = 1. */
export function easePop(p: number): number {
  if (p < POP_RISE) {
    const q = p / POP_RISE;
    return POP_PEAK * (1 - (1 - q) ** 2);
  }
  const q = (p - POP_RISE) / (1 - POP_RISE);
  const io = q < 0.5 ? 2 * q * q : 1 - (-2 * q + 2) ** 2 / 2;
  return POP_PEAK - (POP_PEAK - 1) * io;
}

function progress(t: Track, now: number): number {
  if (!(t.duration > 0)) return 1;
  return Math.min(1, Math.max(0, (now - t.start) / t.duration));
}

function ease(t: Track, p: number): number {
  return t.ease === "pop" ? easePop(p) : easeOut(p);
}

/** Value of a track at `now`: `from` before its start, `to` after its end. */
export function trackValue(t: Track, now: number): number {
  return t.from + (t.to - t.from) * ease(t, progress(t, now));
}

const hold = (v: number, now: number): Track => ({
  from: v,
  to: v,
  start: now,
  duration: 0,
  ease: "out",
});

/** Motions already at rest on `targets` (no animation). */
export function settledMotions(targets: (number | null)[], now = 0): Motion[] {
  const out: Motion[] = [];
  targets.forEach((r, index) => {
    if (r !== null) out.push({ index, target: r, radius: hold(r, now), scale: hold(1, now) });
  });
  return out;
}

/** What `settledMotions(targets)` draws: every valued sector at full size. */
export function settled(targets: (number | null)[]): Shown[] {
  const out: Shown[] = [];
  targets.forEach((r, index) => {
    if (r !== null) out.push({ index, r, scale: 1 });
  });
  return out;
}

/**
 * Samples every motion at `now`. Leaving vertices retract toward the bridge
 * between the nearest non-leaving vertices on either side (toward the centre
 * when fewer than two remain). Finished leavers are dropped from `motions`.
 */
export function sample(
  motions: Motion[],
  now: number,
  n: number,
  size: number = LIFEWHEEL_SIZE,
): { shown: Shown[]; motions: Motion[]; done: boolean } {
  const sorted = [...motions].sort((a, b) => a.index - b.index);
  const centres = sectorCentres(n);
  const staying = sorted.filter((m) => m.target !== null);
  const at = new Map<number, number>();
  for (const m of staying) at.set(m.index, trackValue(m.radius, now));

  const shown: Shown[] = [];
  const kept: Motion[] = [];
  let done = true;
  for (const m of sorted) {
    const scale = trackValue(m.scale, now);
    const ps = progress(m.scale, now);
    const pr = progress(m.radius, now);
    if (m.target === null) {
      if (pr >= 1 && ps >= 1) continue;
      const bridge = bridgeFor(m.index, staying, at, centres, size);
      const r = m.radius.from + (bridge - m.radius.from) * easeOut(pr);
      shown.push({ index: m.index, r, scale });
      kept.push(m);
      done = false;
    } else {
      shown.push({ index: m.index, r: at.get(m.index)!, scale });
      kept.push(m);
      if (pr < 1 || ps < 1) done = false;
    }
  }
  return { shown, motions: kept, done };
}

function bridgeFor(
  index: number,
  staying: Motion[],
  at: Map<number, number>,
  centres: number[],
  size: number,
): number {
  if (staying.length < 2) return 0;
  // Nearest staying vertex before and after `index`, wrapping around.
  const after = staying.find((m) => m.index > index) ?? staying[0];
  const before = [...staying].reverse().find((m) => m.index < index) ?? staying[staying.length - 1];
  if (before === after) return 0;
  const point = (m: Motion) => polarToXY(at.get(m.index)!, centres[m.index], size);
  return bridgeRadius(point(before), point(after), centres[index], size);
}

/**
 * New motions for `targets` (one radius or null per sector), starting at
 * `now` from wherever `motions` are. `first` staggers the pop-in by sector.
 */
export function retarget(
  motions: Motion[],
  targets: (number | null)[],
  now: number,
  first: boolean,
  size: number = LIFEWHEEL_SIZE,
): Motion[] {
  const n = targets.length;
  const current = sample(
    motions.filter((m) => m.index < n),
    now,
    n,
    size,
  );
  const byIndex = new Map(current.motions.map((m) => [m.index, m]));
  const shownAt = new Map(current.shown.map((s) => [s.index, s]));
  const staying = current.motions.filter((m) => m.target !== null);
  const at = new Map(current.shown.map((s) => [s.index, s.r]));
  const centres = sectorCentres(n);
  const out: Motion[] = [];

  targets.forEach((target, index) => {
    const m = byIndex.get(index);
    const s = shownAt.get(index);
    if (target === null) {
      if (!m || !s) return;
      if (m.target === null) {
        out.push(m);
        return;
      }
      out.push({
        index,
        target: null,
        radius: { from: s.r, to: 0, start: now, duration: LEAVE_MS, ease: "out" },
        scale: { from: s.scale, to: 0, start: now, duration: LEAVE_MS, ease: "out" },
      });
      return;
    }
    if (!m || !s) {
      const start = now + (first ? index * STAGGER_MS : 0);
      // On first mount the shape grows from the centre; later, a new vertex
      // grows out of the bridge between its rated neighbours (no notch).
      const from = first ? 0 : bridgeFor(index, staying, at, centres, size);
      out.push({
        index,
        target,
        radius: { from, to: target, start, duration: ENTER_MS, ease: "out" },
        scale: { from: 0, to: 1, start, duration: ENTER_MS, ease: "pop" },
      });
      return;
    }
    if (m.target === null) {
      // Back before it finished leaving: pop in again from where it is.
      out.push({
        index,
        target,
        radius: { from: s.r, to: target, start: now, duration: ENTER_MS, ease: "out" },
        scale: { from: s.scale, to: 1, start: now, duration: ENTER_MS, ease: "pop" },
      });
      return;
    }
    if (m.target === target) {
      out.push(m);
      return;
    }
    out.push({
      index,
      target,
      radius: { from: s.r, to: target, start: now, duration: MOVE_MS, ease: "out" },
      // A pop still in progress carries on.
      scale: m.scale,
    });
  });
  return out;
}
