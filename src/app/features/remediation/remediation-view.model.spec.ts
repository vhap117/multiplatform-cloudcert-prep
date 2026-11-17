import { describe, expect, it } from 'vitest';

import { getCert } from '../../core/content/cert-registry';
import type { Question } from '../../core/content/question-types';
import type { QuestionResultRow, RemediationDismissalRow } from '../../core/storage/types';

import { buildRemediationItems } from './remediation-view.model';

const CERT = getCert('clf-c02')!;

function question(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q1',
    question: 'Which service?',
    options: { A: 'Wrong', B: 'Right' },
    answer: 'B',
    explanation: { summary: 'Because B.', options: { A: 'Not A.', B: 'It is B.' } },
    domainId: 1,
    isMultiAnswer: false,
    type: 'single',
    ...overrides,
  };
}

function result(overrides: Partial<QuestionResultRow> = {}): QuestionResultRow {
  return {
    id: 'r1',
    attemptId: null,
    cert: CERT.code,
    domainId: 1,
    questionId: 'q1',
    userAnswer: 'A',
    correctAnswer: 'B',
    isCorrect: false,
    wasFlagged: false,
    answeredAt: 10,
    ...overrides,
  };
}

function dismissal(overrides: Partial<RemediationDismissalRow> = {}): RemediationDismissalRow {
  return {
    id: `${CERT.code}:q1`,
    cert: CERT.code,
    questionId: 'q1',
    dismissedAt: 20,
    ...overrides,
  };
}

describe('buildRemediationItems', () => {
  it('includes one item per question using the latest wrong practice result', () => {
    const items = buildRemediationItems(
      [
        result({ id: 'older', answeredAt: 5 }),
        result({ id: 'newer', answeredAt: 30, userAnswer: 'A' }),
        result({ id: 'correct', answeredAt: 40, isCorrect: true }),
        result({ id: 'exam', attemptId: 'attempt-1', answeredAt: 50 }),
      ],
      [],
      [question()],
      CERT,
    );

    expect(items).toHaveLength(1);
    expect(items[0]?.result.id).toBe('newer');
    expect(items[0]?.feedback.isCorrect).toBe(false);
    expect(items[0]?.feedback.options.map((entry) => entry.kind)).toEqual([
      'chosen-wrong',
      'missed-correct',
    ]);
    expect(items[0]?.domainName).toBe(CERT.domains[0]!.name);
  });

  it('hides a dismissed question and re-adds it after a newer wrong answer', () => {
    const hidden = buildRemediationItems([result({ answeredAt: 10 })], [dismissal()], [question()], CERT);
    expect(hidden).toHaveLength(0);

    const returned = buildRemediationItems(
      [result({ answeredAt: 30 })],
      [dismissal({ dismissedAt: 20 })],
      [question()],
      CERT,
    );
    expect(returned).toHaveLength(1);
  });

  it('skips questions that are no longer in the bank', () => {
    const items = buildRemediationItems(
      [result({ questionId: 'gone' })],
      [],
      [question()],
      CERT,
    );
    expect(items).toHaveLength(0);
  });
});
