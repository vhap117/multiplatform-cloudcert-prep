/**
 * Mock and study exam question selection (EXAM-2, EXAM-3).
 *
 * Composition is fixed by the cert registry, never adaptive: this selector is
 * the one the two exam modes share, and domain practice must not reuse it
 * (SR-3, EXAM-ENGINE.md "Porting gotchas").
 */

import type { Certification } from '../content/certification-types';
import type { Question } from '../content/question-types';
import type { RandomSource } from './exam-types';
import { fisherYatesShuffle } from './shuffle';

/**
 * Per-domain question counts for one exam.
 *
 * Every domain except the last is rounded; the last absorbs the remainder so
 * the total is exactly `examQuestionCount`. The last domain therefore does not
 * always get its own rounding: for CLF-C02 the fourth domain takes 7, not the
 * 8 that `round(65 * 0.12)` would give.
 */
export function getExamDomainTargets(cert: Certification): Record<number, number> {
  const targets: Record<number, number> = {};
  let assigned = 0;

  cert.domains.forEach((domain, index) => {
    if (index === cert.domains.length - 1) {
      targets[domain.id] = cert.examQuestionCount - assigned;
      return;
    }
    const count = Math.round(cert.examQuestionCount * domain.examProportion);
    targets[domain.id] = count;
    assigned += count;
  });

  return targets;
}

/**
 * How many questions a bank can actually supply toward the exam composition.
 *
 * A placeholder bank can hold fewer questions than its cert asks for, so this
 * is the honest gate: when it is below `examQuestionCount`, the exam would be
 * silently short and the feature must refuse to start it.
 */
export function availableExamQuestions(
  bank: readonly Question[],
  cert: Certification,
): number {
  const targets = getExamDomainTargets(cert);
  const availableByDomain = new Map<number, number>();
  for (const question of bank) {
    availableByDomain.set(question.domainId, (availableByDomain.get(question.domainId) ?? 0) + 1);
  }

  let total = 0;
  for (const [domainId, target] of Object.entries(targets)) {
    total += Math.min(target, availableByDomain.get(Number(domainId)) ?? 0);
  }
  return total;
}

/**
 * Select the questions for one exam attempt.
 *
 * Each domain contributes its target count drawn at random, then the whole set
 * is shuffled again so the domains interleave instead of arriving in blocks.
 * Option order is a separate concern: call `shuffleQuestionOptions` per
 * question when the attempt starts.
 */
export function selectExamQuestions(
  bank: readonly Question[],
  cert: Certification,
  random: RandomSource = Math.random,
): Question[] {
  const targets = getExamDomainTargets(cert);
  const selected: Question[] = [];

  for (const [domainId, count] of Object.entries(targets)) {
    const domainQuestions = bank.filter(
      (question) => question.domainId === Number(domainId),
    );
    selected.push(...fisherYatesShuffle(domainQuestions, random).slice(0, count));
  }

  return fisherYatesShuffle(selected, random);
}
