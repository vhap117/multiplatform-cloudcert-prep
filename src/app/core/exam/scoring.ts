/**
 * Exam scoring (EXAM-28 to EXAM-30).
 *
 * AWS reports a scaled score on a 100 to 1000 band. The passing threshold is
 * per cert and inclusive, so exactly 700 passes CLF-C02 but fails SAA-C03,
 * which asks for 720.
 */

import type { DomainResult } from './exam-types';

/** Map a raw correct count onto the AWS 100 to 1000 band, clamped. */
export function calculateScaledScore(correct: number, total: number): number {
  if (total <= 0) {
    return 100;
  }
  const rawPercent = correct / total;
  const scaled = Math.round(100 + rawPercent * 900);
  return Math.min(1000, Math.max(100, scaled));
}

/** Pass or fail against the cert threshold, inclusive (EXAM-30). */
export function isPassed(scaledScore: number, passingScore: number): boolean {
  return scaledScore >= passingScore;
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
  const remainder = (seconds % 60).toString().padStart(2, '0');
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
