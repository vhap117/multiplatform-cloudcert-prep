import { describe, expect, it } from 'vitest';

import type { Question } from '../content/question-types';
import { fisherYatesShuffle, shuffleQuestionOptions, toOriginalAnswer } from './shuffle';

/**
 * Ported from `ionic-requirements/cert-banks/reference/utils.test.ts`.
 *
 * The one behavioural addition is the `explanation.options` remap: the
 * reference shuffles `answer`, `correctOrder`, and the left side of
 * `correctMatches` but leaves the per-option explanations on their original
 * keys, so feedback would explain the wrong option after a shuffle.
 */
const baseQuestion: Question = {
  id: 'q1',
  domainId: 1,
  question: 'Sample question',
  options: { A: 'apple', B: 'banana', C: 'cherry', D: 'date' },
  answer: 'B',
  explanation: {
    summary: 'Banana is the correct answer.',
    options: {
      A: 'Apple is wrong.',
      B: 'Banana is right.',
      C: 'Cherry is wrong.',
      D: 'Date is wrong.',
    },
  },
  isMultiAnswer: false,
};

describe('fisherYatesShuffle', () => {
  it('preserves length', () => {
    const shuffled = fisherYatesShuffle([1, 2, 3, 4, 5]);
    expect(shuffled).toHaveLength(5);
  });

  it('preserves the set of elements (no loss, no duplication)', () => {
    const shuffled = fisherYatesShuffle([1, 2, 3, 4, 5]);
    expect([...shuffled].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('does not mutate the input array', () => {
    const items = [1, 2, 3, 4, 5];
    fisherYatesShuffle(items);
    expect(items).toEqual([1, 2, 3, 4, 5]);
  });

  it('handles empty and single-element arrays', () => {
    expect(fisherYatesShuffle([])).toEqual([]);
    expect(fisherYatesShuffle([42])).toEqual([42]);
  });

  it('is deterministic for an injected random source', () => {
    const first = fisherYatesShuffle([1, 2, 3, 4, 5], () => 0);
    const second = fisherYatesShuffle([1, 2, 3, 4, 5], () => 0);
    expect(first).toEqual(second);
    expect([...first].sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('shuffleQuestionOptions', () => {
  it('keeps the same set of option values, just reordered', () => {
    const { question } = shuffleQuestionOptions(baseQuestion, () => 0);
    expect(Object.values(question.options).sort()).toEqual([
      'apple',
      'banana',
      'cherry',
      'date',
    ]);
  });

  it('keeps display keys A to D contiguous for a four-option question', () => {
    const { question } = shuffleQuestionOptions(baseQuestion, () => 0);
    expect(Object.keys(question.options)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('produces a key map that round-trips the correct answer', () => {
    const { question, keyMap } = shuffleQuestionOptions(baseQuestion, () => 0);
    const displayAnswerKey = question.answer as string;
    expect(baseQuestion.options[keyMap[displayAnswerKey]]).toBe('banana');
  });

  it('handles multi-answer questions', () => {
    const multi: Question = {
      ...baseQuestion,
      answer: ['A', 'C'],
      isMultiAnswer: true,
    };
    const { question, keyMap } = shuffleQuestionOptions(multi, () => 0);
    const displayKeys = question.answer as string[];
    expect(displayKeys).toHaveLength(2);
    expect(displayKeys.map(key => baseQuestion.options[keyMap[key]]).sort()).toEqual([
      'apple',
      'cherry',
    ]);
  });

  it('remaps an ordering correctOrder so the step-text sequence is preserved', () => {
    const ordering: Question = {
      ...baseQuestion,
      answer: undefined,
      type: 'ordering',
      correctOrder: ['A', 'B', 'C', 'D'],
    };
    const { question } = shuffleQuestionOptions(ordering, () => 0);
    const originalTexts = ordering.correctOrder?.map(key => ordering.options[key]);
    const shuffledTexts = question.correctOrder?.map(key => question.options[key]);
    expect(shuffledTexts).toEqual(originalTexts);
  });

  it('remaps matching correctMatches keys so each left keeps its correct target', () => {
    const matching: Question = {
      ...baseQuestion,
      answer: undefined,
      type: 'matching',
      options: { A: 'left-a', B: 'left-b', C: 'left-c' },
      targets: { '1': 'r1', '2': 'r2', '3': 'r3' },
      correctMatches: { A: '2', B: '3', C: '1' },
    };
    const { question } = shuffleQuestionOptions(matching, () => 0);

    expect(question.correctMatches).toBeDefined();
    for (const [originalKey, targetKey] of Object.entries(matching.correctMatches ?? {})) {
      const leftText = matching.options[originalKey];
      const displayKey = Object.keys(question.options).find(
        key => question.options[key] === leftText,
      );
      expect(displayKey).toBeDefined();
      expect(question.correctMatches?.[displayKey ?? '']).toBe(targetKey);
    }
  });

  it('never shuffles the matching targets (the right column keeps its order)', () => {
    const matching: Question = {
      ...baseQuestion,
      answer: undefined,
      type: 'matching',
      options: { A: 'left-a', B: 'left-b', C: 'left-c' },
      targets: { '1': 'r1', '2': 'r2', '3': 'r3' },
      correctMatches: { A: '2', B: '3', C: '1' },
    };
    const { question } = shuffleQuestionOptions(matching, () => 0);
    expect(question.targets).toEqual({ '1': 'r1', '2': 'r2', '3': 'r3' });
  });

  it('remaps the per-option explanations with the option content', () => {
    const { question, keyMap } = shuffleQuestionOptions(baseQuestion, () => 0);

    for (const [displayKey, originalKey] of Object.entries(keyMap)) {
      expect(question.explanation.options[displayKey]).toBe(
        baseQuestion.explanation.options[originalKey],
      );
    }
  });

  it('keeps the explanation summary untouched', () => {
    const { question } = shuffleQuestionOptions(baseQuestion, () => 0);
    expect(question.explanation.summary).toBe('Banana is the correct answer.');
  });

  it('leaves an ordering question without an answer field', () => {
    const ordering: Question = {
      ...baseQuestion,
      answer: undefined,
      type: 'ordering',
      correctOrder: ['A', 'B', 'C', 'D'],
    };
    const { question } = shuffleQuestionOptions(ordering, () => 0);
    expect(question.answer).toBeUndefined();
  });
});

describe('toOriginalAnswer', () => {
  const keyMap = { A: 'C', B: 'A', C: 'B', D: 'D' };

  it('translates a single answer through the key map', () => {
    expect(toOriginalAnswer('A', keyMap)).toBe('C');
  });

  it('translates a multi answer through the key map', () => {
    expect(toOriginalAnswer(['A', 'B'], keyMap)).toEqual(['C', 'A']);
  });

  it('returns an empty string for an empty single answer', () => {
    expect(toOriginalAnswer('', keyMap)).toBe('');
  });

  it('falls through unmapped keys', () => {
    expect(toOriginalAnswer('Z', keyMap)).toBe('Z');
  });
});
