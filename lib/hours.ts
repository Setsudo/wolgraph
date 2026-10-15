/** Hour values for entries (SPEC §5): 0..24 in 0.25 h steps; 0 means no entry. Pure. */

export const HOURS_STEP = 0.25;
export const HOURS_MAX = 24;
export const QUICK_ADD = [0.5, 1, 2, 4, 8] as const;

/** True for a number in [0, 24] that is a whole multiple of 0.25. */
export function isValidHours(hours: unknown): hours is number {
  return (
    typeof hours === "number" &&
    Number.isFinite(hours) &&
    hours >= 0 &&
    hours <= HOURS_MAX &&
    Number.isInteger(hours * 4)
  );
}

/** Rounds to the nearest 0.25 and clamps to [0, 24]. */
export function clampHours(hours: number): number {
  if (!Number.isFinite(hours)) return 0;
  const rounded = Math.round(hours / HOURS_STEP) * HOURS_STEP;
  return Math.min(HOURS_MAX, Math.max(0, rounded));
}

/** hours + delta, rounded to the step and clamped (stepper buttons and quick-add chips). */
export function addHours(hours: number, delta: number): number {
  return clampHours(hours + delta);
}

/** Drops trailing zeros: 6.5 -> "6.5", 8 -> "8", 19.25 -> "19.25". */
export function formatHours(hours: number): string {
  const v = Math.round(hours * 100) / 100;
  return String(Object.is(v, -0) ? 0 : v);
}

/** Always two decimals: 4 -> "4.00". */
export function formatHoursFixed(hours: number): string {
  return hours.toFixed(2);
}
