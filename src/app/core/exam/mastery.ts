/**
 * Mastery and the next-domain recommendation (SR-27 to SR-40).
 *
 * Mastery is bank coverage, not retention (SR-27, SR-30): the share of the
 * domain's current bank the student has answered correctly at least once. That
 * definition is what makes the next-domain rule subtle, because every untouched
 * domain also scores 0, so a naive "lowest percent" would keep calling an
 * unstarted domain the weakest one.
 */

import { getCert } from '../content/cert-registry';
import type { DomainStanding, NextDomainAction } from './exam-types';

/**
 * Coverage percentage for one domain.
 *
 * Rounded and clamped to 100: history rows can reference questions that were
 * later removed from the bank, so a stale numerator must never render above
 * 100 (SR-28, SR-34). Callers still deduplicate by question id and intersect
 * with the current bank before counting (SR-31).
 */
export function calculateDomainMastery(
  questionsCorrect: number,
  domainId: number,
  certCode: string,
): number {
  const cert = getCert(certCode);
  const total = cert?.domains.find((domain) => domain.id === domainId)?.questionCount;
  if (!total) {
    return 0;
  }
  return Math.min(100, Math.round((questionsCorrect / total) * 100));
}

/**
 * Pick the single domain the dashboard should send the student to.
 *
 * An unstarted domain wins and must be phrased "you have not practiced X yet",
 * never "weakest" (SR-36). Once every domain has been practiced, the lowest
 * percent is the honest weakest, and ties break toward the first domain in cert
 * order (SR-37, SR-38).
 */
export function findNextDomainAction(
  standings: readonly DomainStanding[],
): NextDomainAction | null {
  if (standings.length === 0) {
    return null;
  }

  const unstarted = standings.find((standing) => !standing.practiced);
  if (unstarted) {
    return { kind: 'unstarted', domainId: unstarted.domainId };
  }

  let weakest = standings[0];
  for (const standing of standings) {
    if (standing.percent < weakest.percent) {
      weakest = standing;
    }
  }
  return { kind: 'weakest', domainId: weakest.domainId, percent: weakest.percent };
}
