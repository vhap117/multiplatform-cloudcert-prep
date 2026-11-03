import { describe, expect, it } from 'vitest';

import type { Question } from '../content/question-types';
import { correctAnswerFor, isAnswerCorrect } from './grading';

/**
 * Ported from `ionic-requirements/cert-banks/reference/scoring.test.ts`.
 *
 * Grading is all-or-nothing (EXAM-10). The third argument accepts the legacy
 * boolean `isMultiAnswer` or an explicit `QuestionType` so single and multi
 * call sites read the same way as the web app.
 */
const base: Question = {
  id: 'q1',
  domainId: 1,
  question: 'Q',
  options: { A: 'a', B: 'b', C: 'c', D: 'd' },
  answer: '',
  explanation: { summary: 's', options: {} },
  isMultiAnswer: false,
};

describe('isAnswerCorrect', () => {
  describe('single answer', () => {
    it('returns true when the keys match', () => {
      expect(isAnswerCorrect('A', 'A', false)).toBe(true);
    });

    it('returns false when the keys differ', () => {
      expect(isAnswerCorrect('A', 'B', false)).toBe(false);
    });
  });

  describe('multi answer', () => {
    it('returns true regardless of selection order', () => {
      expect(isAnswerCorrect(['A', 'B'], ['B', 'A'], true)).toBe(true);
    });

    it('returns false when a selection is missing', () => {
      expect(isAnswerCorrect(['A'], ['A', 'B'], true)).toBe(false);
    });

    it('returns false when an extra selection is present', () => {
      expect(isAnswerCorrect(['A', 'B', 'C'], ['A', 'B'], true)).toBe(false);
    });

    it('returns false when the value shapes are mismatched', () => {
      expect(isAnswerCorrect('A', ['A'], true)).toBe(false);
      expect(isAnswerCorrect(['A'], 'A', true)).toBe(false);
    });
  });

  describe('ordering (order dependent)', () => {
    it('returns true only when the sequence matches positionally', () => {
      expect(isAnswerCorrect(['B', 'C', 'D', 'A'], ['B', 'C', 'D', 'A'], 'ordering')).toBe(true);
    });

    it('returns false when the same elements are in the wrong order', () => {
      expect(isAnswerCorrect(['C', 'B', 'D', 'A'], ['B', 'C', 'D', 'A'], 'ordering')).toBe(false);
    });

    it('returns false on a length mismatch', () => {
      expect(isAnswerCorrect(['B', 'C'], ['B', 'C', 'D', 'A'], 'ordering')).toBe(false);
    });

    it('returns false when the user value is not an array', () => {
      expect(isAnswerCorrect('', ['B', 'C', 'D', 'A'], 'ordering')).toBe(false);
    });
  });

  describe('matching (token set equality)', () => {
    it('returns true regardless of token order', () => {
      expect(isAnswerCorrect(['C:1', 'A:3', 'B:2'], ['A:3', 'B:2', 'C:1'], 'matching')).toBe(true);
    });

    it('returns false when any pairing is wrong', () => {
      expect(isAnswerCorrect(['A:3', 'B:1', 'C:2'], ['A:3', 'B:2', 'C:1'], 'matching')).toBe(false);
    });

    it('returns false when a pairing is missing', () => {
      expect(isAnswerCorrect(['A:3', 'B:2'], ['A:3', 'B:2', 'C:1'], 'matching')).toBe(false);
    });
  });
});

describe('correctAnswerFor', () => {
  it('returns the answer string for a single question', () => {
    expect(correctAnswerFor({ ...base, answer: 'B' })).toBe('B');
  });

  it('returns the answer array for a multi question', () => {
    expect(correctAnswerFor({ ...base, isMultiAnswer: true, answer: ['A', 'C'] })).toEqual([
      'A',
      'C',
    ]);
  });

  it('returns correctOrder for an ordering question', () => {
    expect(
      correctAnswerFor({ ...base, answer: undefined, type: 'ordering', correctOrder: ['B', 'A', 'C', 'D'] }),
    ).toEqual(['B', 'A', 'C', 'D']);
  });

  it('returns sorted K:T tokens for a matching question', () => {
    expect(
      correctAnswerFor({
        ...base,
        answer: undefined,
        type: 'matching',
        correctMatches: { B: '2', A: '3', C: '1' },
      }),
    ).toEqual(['A:3', 'B:2', 'C:1']);
  });

  it('returns an empty string when a single question carries no answer', () => {
    expect(correctAnswerFor({ ...base, answer: undefined })).toBe('');
  });

  it('grades a shuffled question against its own remapped answer', () => {
    const question: Question = {
      ...base,
      answer: ['A', 'C'],
      isMultiAnswer: true,
    };
    expect(isAnswerCorrect(['C', 'A'], correctAnswerFor(question), 'multi')).toBe(true);
  });
});
