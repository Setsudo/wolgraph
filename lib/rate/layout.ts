/**
 * Which main categories (by index in sort order) sit in each side column of
 * the rate screen, top to bottom, so each slider sits beside its sector of the
 * wheel (sector 0 starts at 12 o'clock, clockwise). With k = floor(n / 2):
 * right = k, k-1, ..., 1; left = k+1, ..., n-1, then 0.
 * For the eight defaults: right Career, Family, Finance, Personal Growth;
 * left Relaxation, Relationships, Spirituality, Health.
 */
export function sideOrder(n: number): { left: number[]; right: number[] } {
  if (!Number.isInteger(n) || n <= 0) return { left: [], right: [] };
  const k = Math.floor(n / 2);
  const right = Array.from({ length: k }, (_, i) => k - i);
  const left = [...Array.from({ length: n - 1 - k }, (_, i) => k + 1 + i), 0];
  return { left, right };
}
