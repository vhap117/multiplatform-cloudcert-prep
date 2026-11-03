/**
 * Pure view-model tests for the results and review screens (S8, S9).
 *
 * Synthetic questions cover all four response formats without touching the
 * bundled bank, and answers are stored through the engine encoders so the
 * decode path under test is the real one the session service writes.
 */

import { describe, expect, it } from 'vitest';

import type { Certification } from '../../../core/content/certification-types';
import {
  questionType,
  type Question,
  type RawQuestion,
} from '../../../core/content/question-types';
import {
  correctAnswerFor,
  encodeAnswerForDb,
  getDomainScore,
  formatTime,
} from '../../../core/exam';
import type {
  AttemptRow,
  DomainScoreRow,
  QuestionResultRow,
} from '../../../core/storage/types';

import {
  applyReviewFilter,
  answerViewFor,
  buildDomainBreakdown,
  buildReviewCards,
  buildScoreFacts,
  domainFilters,
  relevantExplanationKeys,
  weakestDomain,
} from './results-view.model';

const CERT: Certification = {
  code: 'test-cert',
  provider: 'aws',
  level: 'foundational',
  name: 'Test Certification',
  shortName: 'TEST',
  examQuestionCount: 6,
  examTimeSeconds: 3600,
  passingScore: 700,
  status: 'active',
  domains: [
    { id: 1, name: 'Alpha', questionCount: 3, examProportion: 0.5 },
    { id: 2, name: 'Beta', questionCount: 3, examProportion: 0.5 },
  ],
};

const SINGLE_OPTIONS = { A: 'First choice', B: 'Second choice', C: 'Third choice' };
const MATCH_OPTIONS = { A: 'Left one', B: 'Left two' };
const MATCH_TARGETS = { '1': 'Right one', '2': 'Right two' };

function makeQuestion(raw: RawQuestion, domainId: number): Question {
  return { ...raw, domainId, isMultiAnswer: raw.isMultiAnswer ?? questionType(raw) === 'multi' };
}

function singleQuestion(id: string): Question {
  return makeQuestion(
    {
      id,
      question: `Pick one for ${id}.`,
      options: { ...SINGLE_OPTIONS },
      answer: 'B',
      explanation: {
        summary: `Summary for ${id}.`,
        options: { A: 'Why A.', B: 'Why B.', C: 'Why C.' },
      },
    },
    1,
  );
}

function multiQuestion(id: string): Question {
  return makeQuestion(
    {
      id,
      question: `Pick two for ${id}.`,
      options: { ...SINGLE_OPTIONS },
      answer: ['A', 'C'],
      isMultiAnswer: true,
      explanation: {
        summary: `Summary for ${id}.`,
        options: { A: 'Why A.', B: 'Why B.', C: 'Why C.' },
      },
    },
    1,
  );
}

function orderingQuestion(id: string): Question {
  return makeQuestion(
    {
      id,
      type: 'ordering',
      question: `Order ${id}.`,
      options: { ...SINGLE_OPTIONS },
      correctOrder: ['A', 'B', 'C'],
      explanation: {
        summary: `Summary for ${id}.`,
        options: { A: 'Why A.', B: 'Why B.', C: 'Why C.' },
      },
    },
    2,
  );
}

function matchingQuestion(id: string): Question {
  return makeQuestion(
    {
      id,
      type: 'matching',
      question: `Match ${id}.`,
      options: { ...MATCH_OPTIONS },
      targets: { ...MATCH_TARGETS },
      correctMatches: { A: '2', B: '1' },
      explanation: {
        summary: `Summary for ${id}.`,
        options: { A: 'Why left one.', B: 'Why left two.' },
      },
    },
    2,
  );
}

/** Store an answer through the real encoder so decode is under test too. */
function storedAnswer(question: Question, value: string | readonly string[] | null): string {
  return encodeAnswerForDb(value ?? null, {}, questionType(question));
}

function storedCorrect(question: Question): string {
  return storedAnswer(question, correctAnswerFor(question));
}

function wrongSingleAnswer(question: Question): string {
  const correct = correctAnswerFor(question);
  if (typeof correct !== 'string') {
    throw new Error('expected a single correct answer');
  }
  const wrong = Object.keys(question.options).find((key) => key !== correct);
  if (!wrong) {
    throw new Error('no wrong key available');
  }
  return storedAnswer(question, wrong);
}

function resultRow(question: Question, overrides: Partial<QuestionResultRow>): QuestionResultRow {
  return {
    id: `attempt-1:${question.id}`,
    attemptId: 'attempt-1',
    cert: CERT.code,
    domainId: question.domainId,
    questionId: question.id,
    userAnswer: storedCorrect(question),
    correctAnswer: storedCorrect(question),
    isCorrect: true,
    wasFlagged: false,
    answeredAt: 2000,
    ...overrides,
  };
}

function makeAttempt(overrides: Partial<AttemptRow> = {}): AttemptRow {
  const graded = [
    { domainId: 1, isCorrect: true },
    { domainId: 1, isCorrect: false },
    { domainId: 2, isCorrect: true },
    { domainId: 2, isCorrect: true },
  ];
  const domainScores: DomainScoreRow[] = CERT.domains.map((domain) => ({
    domainId: domain.id,
    correct: graded.filter((entry) => entry.isCorrect && entry.domainId === domain.id).length,
    total: graded.filter((entry) => entry.domainId === domain.id).length,
    percent: getDomainScore(graded, domain.id),
  }));
  return {
    id: `${CERT.code}:mock:1000`,
    cert: CERT.code,
    kind: 'mock',
    startedAt: 1000,
    finishedAt: 1000 + 3123_000,
    totalQuestions: 4,
    correctCount: 3,
    scorePercent: 75,
    scaledScore: 775,
    passed: true,
    timeTakenSeconds: 3123,
    domainScores,
    ...overrides,
  };
}

describe('buildScoreFacts (S8, EXAM-37)', () => {
  it('reports pass, scaled score, threshold, percentage, counts and elapsed time', () => {
    const facts = buildScoreFacts(makeAttempt(), CERT);

    expect(facts.passed).toBe(true);
    expect(facts.outcomeText).toBe('You passed');
    expect(facts.scaledScore).toBe(775);
    expect(facts.passingScore).toBe(700);
    expect(facts.scorePercent).toBe(75);
    expect(facts.correctCount).toBe(3);
    expect(facts.totalQuestions).toBe(4);
    expect(facts.elapsedText).toBe(formatTime(3123));
  });

  it('uses the fail wording and drops the threshold for an unknown cert', () => {
    const facts = buildScoreFacts(makeAttempt({ passed: false }), null);

    expect(facts.outcomeText).toBe('You did not pass');
    expect(facts.passingScore).toBeNull();
  });
});

describe('buildDomainBreakdown (S8, EXAM-38)', () => {
  it('keeps registry order and names with per-domain numbers', () => {
    const rows = buildDomainBreakdown(makeAttempt(), CERT);

    expect(rows.map((row) => row.domainId)).toEqual([1, 2]);
    expect(rows.map((row) => row.name)).toEqual(['Alpha', 'Beta']);
    expect(rows[0]).toMatchObject({ correct: 1, total: 2, percent: 50 });
    expect(rows[1]).toMatchObject({ correct: 2, total: 2, percent: 100 });
  });

  it('falls back to Domain N names without a cert', () => {
    const rows = buildDomainBreakdown(makeAttempt(), null);

    expect(rows.map((row) => row.name)).toEqual(['Domain 1', 'Domain 2']);
  });
});

describe('weakestDomain (EXAM-44)', () => {
  it('picks the lowest percent among covered domains', () => {
    const attempt = makeAttempt();
    const row = weakestDomain(attempt);

    expect(row?.domainId).toBe(1);
    expect(row?.percent).toBe(50);
  });

  it('skips uncovered domains and breaks ties by lowest domain id', () => {
    const attempt = makeAttempt({
      domainScores: [
        { domainId: 1, correct: 0, total: 0, percent: 0 },
        { domainId: 2, correct: 1, total: 2, percent: 50 },
        { domainId: 3, correct: 2, total: 4, percent: 50 },
      ],
    });

    expect(weakestDomain(attempt)?.domainId).toBe(2);
  });

  it('returns null when nothing was covered', () => {
    const attempt = makeAttempt({ domainScores: [] });

    expect(weakestDomain(attempt)).toBeNull();
  });
});

describe('answerViewFor (EXAM-41, reader terms)', () => {
  it('renders a single answer as its display key with option text', () => {
    const question = singleQuestion('q-single');
    const view = answerViewFor(storedAnswer(question, 'A'), question);

    expect(view.kind).toBe('keys');
    expect(view.lines).toEqual([{ key: 'A', text: 'First choice' }]);
  });

  it('renders a multi answer as every display key', () => {
    const question = multiQuestion('q-multi');
    const view = answerViewFor(storedAnswer(question, ['C', 'A']), question);

    expect(view.kind).toBe('keys');
    expect(view.lines.map((line) => line.key)).toEqual(['C', 'A']);
  });

  it('renders an ordering answer as the stored sequence with positions', () => {
    const question = orderingQuestion('q-order');
    const view = answerViewFor(storedAnswer(question, ['B', 'A', 'C']), question);

    expect(view.kind).toBe('sequence');
    expect(view.steps).toEqual([
      { position: 1, key: 'B', text: 'Second choice' },
      { position: 2, key: 'A', text: 'First choice' },
      { position: 3, key: 'C', text: 'Third choice' },
    ]);
  });

  it('renders a matching answer as left and right pairs with both texts', () => {
    const question = matchingQuestion('q-match');
    const view = answerViewFor(storedAnswer(question, ['A:2', 'B:1']), question);

    expect(view.kind).toBe('pairs');
    expect(view.pairs).toEqual([
      { left: 'A', leftText: 'Left one', right: '2', rightText: 'Right two' },
      { left: 'B', leftText: 'Left two', right: '1', rightText: 'Right one' },
    ]);
  });

  it('renders an empty stored answer as none', () => {
    const question = singleQuestion('q-empty');

    expect(answerViewFor('', question).kind).toBe('none');
    expect(answerViewFor('', multiQuestion('q-empty-2')).kind).toBe('none');
  });
});

describe('relevantExplanationKeys (EXAM-41, options that matter)', () => {
  it('shows the wrong and correct keys for a wrong single answer', () => {
    const question = singleQuestion('q-single');
    const row = resultRow(question, { userAnswer: wrongSingleAnswer(question), isCorrect: false });

    expect(relevantExplanationKeys(question, row)).toEqual(['A', 'B']);
  });

  it('shows only the correct key for a correct single answer', () => {
    const question = singleQuestion('q-single');
    const row = resultRow(question, {});

    expect(relevantExplanationKeys(question, row)).toEqual(['B']);
  });

  it('shows chosen-but-wrong keys plus the full correct set for multi', () => {
    const question = multiQuestion('q-multi');
    const row = resultRow(question, { userAnswer: storedAnswer(question, ['A', 'B']), isCorrect: false });

    expect(relevantExplanationKeys(question, row)).toEqual(['A', 'B', 'C']);
  });

  it('shows misplaced keys and their expected keys for a wrong ordering', () => {
    const question = orderingQuestion('q-order');
    const row = resultRow(question, {
      userAnswer: storedAnswer(question, ['A', 'C', 'B']),
      isCorrect: false,
    });

    // Positions 2 and 3 hold C and B against the expected B and C.
    expect(relevantExplanationKeys(question, row)).toEqual(['B', 'C']);
  });

  it('shows the full sequence for a correct ordering', () => {
    const question = orderingQuestion('q-order');
    const row = resultRow(question, {});

    expect(relevantExplanationKeys(question, row)).toEqual(['A', 'B', 'C']);
  });

  it('shows only the wrongly paired left keys for a wrong matching', () => {
    const question = matchingQuestion('q-match');
    const row = resultRow(question, {
      userAnswer: storedAnswer(question, ['A:1', 'B:2']),
      isCorrect: false,
    });

    expect(relevantExplanationKeys(question, row)).toEqual(['A', 'B']);
  });

  it('falls back to the correct pairs for an unanswered matching', () => {
    const question = matchingQuestion('q-match');
    const row = resultRow(question, { userAnswer: '', isCorrect: false });

    expect(relevantExplanationKeys(question, row)).toEqual(['A', 'B']);
  });
});

describe('buildReviewCards (S9, EXAM-39 to EXAM-41)', () => {
  it('builds a card per resolvable row and skips rows whose question left the bank', () => {
    const single = singleQuestion('q-1');
    const gone = resultRow(singleQuestion('q-gone'), { questionId: 'q-gone', id: 'attempt-1:q-gone' });
    const rows = [resultRow(single, {}), gone];

    const cards = buildReviewCards(rows, [single], CERT);

    expect(cards).toHaveLength(1);
    expect(cards[0].questionId).toBe('q-1');
    expect(cards[0].number).toBe(1);
    expect(cards[0].domainName).toBe('Alpha');
    expect(cards[0].questionText).toBe('Pick one for q-1.');
    expect(cards[0].isCorrect).toBe(true);
    expect(cards[0].wasFlagged).toBe(false);
    expect(cards[0].userAnswer.kind).toBe('keys');
    expect(cards[0].summary).toBe('Summary for q-1.');
    expect(cards[0].optionExplanations).toEqual([
      { key: 'B', optionText: 'Second choice', explanation: 'Why B.' },
    ]);
  });
});

describe('applyReviewFilter (EXAM-40)', () => {
  const single = singleQuestion('q-1');
  const multi = multiQuestion('q-2');
  const ordering = orderingQuestion('q-3');
  const matching = matchingQuestion('q-4');
  const cards = buildReviewCards(
    [
      resultRow(single, {}),
      resultRow(multi, { isCorrect: false, wasFlagged: true }),
      resultRow(ordering, { isCorrect: false }),
      resultRow(matching, { wasFlagged: true }),
    ],
    [single, multi, ordering, matching],
    CERT,
  );

  it('keeps everything under all', () => {
    expect(applyReviewFilter(cards, 'all')).toHaveLength(4);
  });

  it('narrows to incorrect', () => {
    const filtered = applyReviewFilter(cards, 'incorrect');

    expect(filtered.map((card) => card.questionId)).toEqual(['q-2', 'q-3']);
  });

  it('narrows to flagged', () => {
    const filtered = applyReviewFilter(cards, 'flagged');

    expect(filtered.map((card) => card.questionId)).toEqual(['q-2', 'q-4']);
  });

  it('narrows to one domain', () => {
    const filtered = applyReviewFilter(cards, 2);

    expect(filtered.map((card) => card.questionId)).toEqual(['q-3', 'q-4']);
  });
});

describe('domainFilters (EXAM-40)', () => {
  it('lists cert domains with names', () => {
    const cards = buildReviewCards([], [], CERT);

    expect(domainFilters(cards, CERT)).toEqual([
      { id: 1, name: 'Alpha' },
      { id: 2, name: 'Beta' },
    ]);
  });

  it('derives domains from the cards without a cert', () => {
    const single = singleQuestion('q-1');
    const cards = buildReviewCards([resultRow(single, {})], [single], null);

    expect(domainFilters(cards, null)).toEqual([{ id: 1, name: 'Domain 1' }]);
  });
});
