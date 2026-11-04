/**
 * Exam scoring (EXAM-28 to EXAM-30).
 *
 * Scores are percentages of correct answers. Pass/fail compares that
 * percentage with the cert's configured passing percentage, so exactly the
 * configured threshold passes.
 */

import type { DomainResult } from './exam-types';

/** Percentage of correct answers, rounded to a whole percent. */
export function calculateScorePercent(correct: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  const percent = Math.round((correct / total) * 100);
  return Math.min(100, Math.max(0, percent));
}

/** Pass or fail against the cert threshold, inclusive (EXAM-30). */
export function isPassed(scorePercent: number, passingPercent: number): boolean {
  return scorePercent >= passingPercent;
}

/** Percentage of correct answers inside one domain (EXAM-38). */
export function getDomainScore(results: readonly DomainResult[], domainId: number): number {
  const domainResults = results.filter((result) => result.domainId === domainId);
  if (domainResults.length === 0) {
    return 0;
  }
  const correct = domainResults.filter((result) => result.isCorrect).length;
  return Math.round((correct / domainResults.length) * 100);
}

/** Format seconds as `MM:SS`, used by the exam toolbar countdown. */
export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const remainder = (seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${remainder}`;
}

/** Format a duration in minutes as compact `Xh Ym`, for history totals. */
export function formatTotalTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}
