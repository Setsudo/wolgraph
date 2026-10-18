/** Life ratings are whole numbers from 0 to 10 (SPEC §10). */
export const SCORE_MIN = 0;
export const SCORE_MAX = 10;

export function isValidScore(score: unknown): score is number {
  return (
    Number.isInteger(score) && (score as number) >= SCORE_MIN && (score as number) <= SCORE_MAX
  );
}

/**
 * The value a slider shows: the day's saved score, else 0. Earlier days are never
 * carried over, so an untouched slider never records a false trend.
 */
export function displayedScore(categoryId: string, scores: Record<string, number>): number {
  return scores[categoryId] ?? SCORE_MIN;
}
