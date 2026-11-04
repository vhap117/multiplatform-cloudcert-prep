/**
 * Behaviour tests for the feedback builder (issue 007, S6).
 *
 * The builder is pure, so every test pins the observable feedback shape for
 * one graded question: the summary, the correctness verdict, and the
 * per-option entries tagged by kind. A partial multi must cover both sets at
 * once (the correctly chosen option and the missed correct one), because
 * that is the case PRACT-14 calls out.
 */

import { describe, expect, it } from 'vitest';

import type { Question } from '../content/question-types';

import { buildQuestionFeedback } from './feedback';

const OPTIONS = { A: 'Alpha', B: 'Beta', C: 'Gamma', D: 'Delta' };

function explanation(options: Record<string, string>): Question['explanation'] {
  const perOption: Record<string, string> = {};
  for (const key of Object.keys(options)) {
    perOption[key] = `Note on ${key}.`;
  }
  return { summary: 'Summary.', options: perOption };
}

const SINGLE: Question = {
  id: 'q-single',
  domainId: 1,
  isMultiAnswer: false,
  question: 'Pick one.',
  options: { ...OPTIONS },
  answer: 'B',
  explanation: explanation(OPTIONS),
};

const MULTI: Question = {
  id: 'q-multi',
  domainId: 1,
  isMultiAnswer: true,
  question: 'Pick two.',
  options: { ...OPTIONS },
  answer: ['A', 'C'],
  explanation: explanation(OPTIONS),
};

const ORDERING: Question = {
  id: 'q-order',
  domainId: 1,
  isMultiAnswer: false,
  type: 'ordering',
  question: 'Order the steps.',
  options: { ...OPTIONS },
  correctOrder: ['B', 'A', 'D', 'C'],
  explanation: explanation(OPTIONS),
};

const MATCHING: Question = {
  id: 'q-match',
  domainId: 1,
  isMultiAnswer: false,
  type: 'matching',
  question: 'Match the pairs.',
  options: { ...OPTIONS },
  targets: { 1: 'Right one', 2: 'Right two', 3: 'Right three', 4: 'Right four' },
  correctMatches: { A: '2', B: '1', C: '4', D: '3' },
  explanation: explanation(OPTIONS),
};

describe('buildQuestionFeedback', () => {
  it('marks a correct single as correct with only correct-chosen entries', () => {
    const feedback = buildQuestionFeedback(SINGLE, 'B');

    expect(feedback.questionId).toBe('q-single');
    expect(feedback.isCorrect).toBe(true);
    expect(feedback.summary).toBe('Summary.');
    expect(feedback.options).toEqual([{ key: 'B', text: 'Note on B.', kind: 'correct-chosen' }]);
  });

  it('explains a wrong single with the chosen option and the missed correct one', () => {
    const feedback = buildQuestionFeedback(SINGLE, 'D');

    expect(feedback.isCorrect).toBe(false);
    expect(feedback.options).toEqual([
      { key: 'D', text: 'Note on D.', kind: 'chosen-wrong' },
      { key: 'B', text: 'Note on B.', kind: 'missed-correct' },
    ]);
  });

  it('covers both sets at once for a partial multi', () => {
    // Chose A (correct) and D (wrong), missed C (correct).
    const feedback = buildQuestionFeedback(MULTI, ['A', 'D']);

    expect(feedback.isCorrect).toBe(false);
    expect(feedback.options).toEqual([
      { key: 'D', text: 'Note on D.', kind: 'chosen-wrong' },
      { key: 'C', text: 'Note on C.', kind: 'missed-correct' },
      { key: 'A', text: 'Note on A.', kind: 'correct-chosen' },
    ]);
  });

  it('marks a fully correct multi as correct regardless of selection order', () => {
    const feedback = buildQuestionFeedback(MULTI, ['C', 'A']);

    expect(feedback.isCorrect).toBe(true);
    // Correct-chosen entries follow the student's selection order.
    expect(feedback.options).toEqual([
      { key: 'C', text: 'Note on C.', kind: 'correct-chosen' },
      { key: 'A', text: 'Note on A.', kind: 'correct-chosen' },
    ]);
  });

  it('compares ordering by position', () => {
    const feedback = buildQuestionFeedback(ORDERING, ['B', 'A', 'C', 'D']);

    expect(feedback.isCorrect).toBe(false);
    expect(feedback.options).toEqual([
      { key: 'C', text: 'Note on C.', kind: 'chosen-wrong' },
      { key: 'D', text: 'Note on D.', kind: 'chosen-wrong' },
      { key: 'D', text: 'Note on D.', kind: 'missed-correct' },
      { key: 'C', text: 'Note on C.', kind: 'missed-correct' },
      { key: 'B', text: 'Note on B.', kind: 'correct-chosen' },
      { key: 'A', text: 'Note on A.', kind: 'correct-chosen' },
    ]);
  });

  it('compares matching by pairing and flags the wrongly paired left keys', () => {
    // A and B are swapped; C and D are right.
    const feedback = buildQuestionFeedback(MATCHING, ['A:1', 'B:2', 'C:4', 'D:3']);

    expect(feedback.isCorrect).toBe(false);
    expect(feedback.options).toEqual([
      { key: 'A', text: 'Note on A.', kind: 'chosen-wrong' },
      { key: 'B', text: 'Note on B.', kind: 'chosen-wrong' },
      { key: 'A', text: 'Note on A.', kind: 'missed-correct' },
      { key: 'B', text: 'Note on B.', kind: 'missed-correct' },
      { key: 'C', text: 'Note on C.', kind: 'correct-chosen' },
      { key: 'D', text: 'Note on D.', kind: 'correct-chosen' },
    ]);
  });

  it('treats a missing answer as missed, never as correct', () => {
    const feedback = buildQuestionFeedback(SINGLE, null);

    expect(feedback.isCorrect).toBe(false);
    expect(feedback.options).toEqual([
      { key: 'B', text: 'Note on B.', kind: 'missed-correct' },
    ]);
  });

  it('falls back to empty text when an option has no explanation entry', () => {
    const sparse: Question = {
      ...SINGLE,
      explanation: { summary: 'Summary.', options: { B: 'Only B explained.' } },
    };
    const feedback = buildQuestionFeedback(sparse, 'D');

    expect(feedback.options).toEqual([
      { key: 'D', text: '', kind: 'chosen-wrong' },
      { key: 'B', text: 'Only B explained.', kind: 'missed-correct' },
    ]);
  });
});
