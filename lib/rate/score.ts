/** Life ratings are whole numbers from 0 to 10 (SPEC §10). */
export const SCORE_MIN = 0;
export const SCORE_MAX = 10;
/** Shown for a category with no score today and none before. */
export const DEFAULT_SCORE = 5;

export function isValidScore(score: unknown): score is number {
  return (
    Number.isInteger(score) && (score as number) >= SCORE_MIN && (score as number) <= SCORE_MAX
  );
}

/** The value a slider shows: today's score, else the most recent earlier one, else 5. */
export function displayedScore(
  categoryId: string,
  scores: Record<string, number>,
  previous: Record<string, number>,
): number {
  return scores[categoryId] ?? previous[categoryId] ?? DEFAULT_SCORE;
}
