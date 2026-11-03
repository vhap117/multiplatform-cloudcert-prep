import { describe, expect, it } from 'vitest';

import type { Question } from '../content/question-types';
import {
  LEARNING_WEIGHT_MAX,
  LEARNING_WEIGHT_MIN,
  MASTERED_WEIGHT,
  UNSEEN_WEIGHT,
} from './exam-constants';
import type { PracticeMastery } from './exam-types';
import { masteryWeight, selectPracticeQuestions } from './practice-selection';

/**
 * Ported from `ionic-requirements/cert-banks/reference/spacedRepetition.test.ts`,
 * with the assertions tightened where the reference had to accept any random
 * result.
 *
 * Deviations from the ported source, both deliberate:
 *
 * - the reference's `userId === null` guest branch is gone. The Ionic app has a
 *   single local user and no login, so "no history" already means every
 *   question is unseen (SR-10) and the normal path produces the same uniform
 *   draw.
 * - the mastery row is the camelCase projection with a numeric `lastSeenAt`,
 *   matching what `core/storage` persists, and `in_exclusion_window` is not a
 *   field: a null weight carries that meaning (SR-9).
 */
const makeQuestion = (id: string): Question => ({
  id,
  domainId: 1,
  question: `Question ${id}`,
  options: { A: 'Option A', B: 'Option B', C: 'Option C', D: 'Option D' },
  answer: 'A',
  explanation: { summary: 'Summary', options: {} },
  isMultiAnswer: false,
});

const makeRow = (
  questionId: string,
  weight: number | null,
  lastSeenAt = 1_700_000_000_000,
): PracticeMastery => ({
  questionId,
  correctStreak: 0,
  lastWasWrong: false,
  lastSeenAt,
  mastered: false,
  weight,
});

/** Deterministic uniform source (mulberry32). */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('masteryWeight', () => {
  it('gives a question whose last answer was wrong the highest band', () => {
    expect(masteryWeight({ mastered: false, lastWasWrong: true, correctStreak: 0 })).toBe(6);
  });

  it('gives a mastered question the lowest band', () => {
    expect(masteryWeight({ mastered: true, lastWasWrong: false, correctStreak: 4 })).toBe(
      MASTERED_WEIGHT,
    );
  });

  it('keeps a learning question inside its band as its streak grows', () => {
    expect(masteryWeight({ mastered: false, lastWasWrong: false, correctStreak: 0 })).toBe(
      LEARNING_WEIGHT_MIN,
    );
    expect(masteryWeight({ mastered: false, lastWasWrong: false, correctStreak: 3 })).toBe(
      LEARNING_WEIGHT_MAX,
    );
  });
});

describe('selectPracticeQuestions', () => {
  it('returns the requested count of distinct questions when there is no history', () => {
    const bank = ['q1', 'q2', 'q3', 'q4', 'q5'].map(makeQuestion);

    const result = selectPracticeQuestions(bank, 3, new Map(), seededRandom(1));

    expect(result).toHaveLength(3);
    expect(new Set(result.map((question) => question.id)).size).toBe(3);
    for (const question of result) {
      expect(bank.map((entry) => entry.id)).toContain(question.id);
    }
  });

  it('caps the result at the bank size when the request is larger', () => {
    const bank = ['q1', 'q2'].map(makeQuestion);
    expect(selectPracticeQuestions(bank, 20, new Map(), seededRandom(2))).toHaveLength(2);
  });

  it('reserves the unseen quota of ceil(count * 0.2)', () => {
    const bank = ['q1', 'q2', 'q3', 'q4', 'q5'].map(makeQuestion);
    const rows = new Map<string, PracticeMastery>([
      ['q1', makeRow('q1', MASTERED_WEIGHT)],
      ['q2', makeRow('q2', MASTERED_WEIGHT)],
      ['q3', makeRow('q3', MASTERED_WEIGHT)],
    ]);

    const result = selectPracticeQuestions(bank, 5, rows, seededRandom(3));

    const unseen = result.filter((question) => !rows.has(question.id));
    expect(unseen.length).toBeGreaterThanOrEqual(1);
  });

  it('fills the session with every question when the request matches the bank', () => {
    const bank = ['q1', 'q2', 'q3', 'q4'].map(makeQuestion);
    const rows = new Map<string, PracticeMastery>([['q1', makeRow('q1', MASTERED_WEIGHT)]]);

    const result = selectPracticeQuestions(bank, 4, rows, seededRandom(4));

    expect(result).toHaveLength(4);
    expect(new Set(result.map((question) => question.id)).size).toBe(4);
  });

  it('uses excluded questions as backfill when the active pool is too small', () => {
    const bank = ['q1', 'q2', 'q3', 'q4'].map(makeQuestion);
    const rows = new Map<string, PracticeMastery>([
      ['q1', makeRow('q1', MASTERED_WEIGHT)],
      ['q2', makeRow('q2', MASTERED_WEIGHT)],
      ['q3', makeRow('q3', null, 1_600_000_000_000)],
      ['q4', makeRow('q4', null, 1_650_000_000_000)],
    ]);

    const result = selectPracticeQuestions(bank, 4, rows, seededRandom(5));
    const ids = result.map((question) => question.id);

    expect(ids).toContain('q3');
    expect(ids).toContain('q4');
    expect(result).toHaveLength(4);
  });

  it('backfills oldest last-seen first', () => {
    const bank = ['q1', 'q3', 'q4', 'q5'].map(makeQuestion);
    const rows = new Map<string, PracticeMastery>([
      ['q3', makeRow('q3', null, 3_000)],
      ['q4', makeRow('q4', null, 1_000)],
      ['q5', makeRow('q5', null, 2_000)],
    ]);

    // Only q1 is unseen, so the single guaranteed slot takes it and the other
    // slot has to come from the excluded pool, oldest last-seen first.
    const result = selectPracticeQuestions(bank, 2, rows, () => 0);

    expect(result.map((question) => question.id).sort()).toEqual(['q1', 'q4']);
  });

  it('never repeats a question', () => {
    const bank = ['q1', 'q2', 'q3', 'q4', 'q5'].map(makeQuestion);
    const rows = new Map<string, PracticeMastery>([
      ['q1', makeRow('q1', MASTERED_WEIGHT)],
      ['q2', makeRow('q2', LEARNING_WEIGHT_MIN)],
      ['q3', makeRow('q3', LEARNING_WEIGHT_MAX)],
    ]);

    const result = selectPracticeQuestions(bank, 5, rows, seededRandom(6));
    const ids = result.map((question) => question.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(5);
  });

  it('favours the heavier weight band in a weighted draw', () => {
    const bank = ['heavy', 'light'].map(makeQuestion);
    const rows = new Map<string, PracticeMastery>([
      ['heavy', makeRow('heavy', 6)],
      ['light', makeRow('light', 1)],
    ]);

    // Total weight 7. A draw below 6 lands on the heavy question; a draw above
    // it lands on the light one.
    expect(
      selectPracticeQuestions(bank, 1, rows, () => 0.5).map((question) => question.id),
    ).toEqual(['heavy']);
    expect(
      selectPracticeQuestions(bank, 1, rows, () => 0.99).map((question) => question.id),
    ).toEqual(['light']);
  });

  it('does not hang when every active weight is zero', () => {
    const bank = ['q1', 'q2', 'q3'].map(makeQuestion);
    const rows = new Map<string, PracticeMastery>([
      ['q1', makeRow('q1', 0)],
      ['q2', makeRow('q2', 0)],
    ]);

    const result = selectPracticeQuestions(bank, 3, rows, () => 0);

    expect(result).toHaveLength(3);
    expect(new Set(result.map((question) => question.id)).size).toBe(3);
  });

  it('reports UNSEEN_WEIGHT as the documented baseline for an unseen question', () => {
    expect(UNSEEN_WEIGHT).toBe(5);
  });
});
