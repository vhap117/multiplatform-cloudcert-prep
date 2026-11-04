/**
 * Unit tests for the shared attempt-row builder (issue 006 log L2, S11).
 *
 * The builder is pure, so these tests pin the exact storage shapes the mock
 * exam writes today: attempt, question result, cert progress, and question
 * mastery rows. History, mastery, and best score consume both modes
 * uniformly, which is why every assertion here is on the documented row
 * shape rather than on builder internals.
 */

import { describe, expect, it } from 'vitest';

import type { Certification } from '../content/certification-types';
import type { Question } from '../content/question-types';
import { LAST_WRONG_WEIGHT, LEARNING_WEIGHT_MAX, MASTERED_WEIGHT } from '../exam';
import type { QuestionMasteryRow, QuestionResultRow } from '../storage/types';

import { EXCLUSION_WINDOW_SESSIONS, foldMasteryHistory } from './mastery';

import {
  agePracticeSessionMastery,
  buildAttemptRows,
  type BuildAttemptRowsInput,
  type GradedAnswer,
} from './attempt-rows';

const OPTIONS = { A: 'Alpha', B: 'Beta', C: 'Gamma', D: 'Delta' };

function question(id: string, domainId: number): Question {
  return {
    id,
    domainId,
    isMultiAnswer: false,
    question: `Pick one for ${id}.`,
    options: { ...OPTIONS },
    answer: 'B',
    explanation: {
      summary: 'Summary.',
      options: { A: 'Note on A.', B: 'Note on B.', C: 'Note on C.', D: 'Note on D.' },
    },
  };
}

/**
 * Two domains on the real CLF-C02 code, so `calculateDomainMastery` reads the
 * real registry bank sizes and the coverage percentages are honest.
 */
const CERT: Certification = {
  code: 'clf-c02',
  provider: 'aws',
  level: 'foundational',
  name: 'Builder Test Cert',
  shortName: 'BUILD',
  examQuestionCount: 3,
  examTimeSeconds: 3600,
  passingScore: 700,
  status: 'active',
  domains: [
    { id: 1, name: 'One', questionCount: 3, examProportion: 0.5 },
    { id: 2, name: 'Two', questionCount: 1, examProportion: 0.5 },
  ],
};

const BANK: Question[] = [question('q-a', 1), question('q-b', 1), question('q-c', 1), question('q-d', 2)];

function graded(id: string, domainId: number, isCorrect: boolean, userAnswer = 'B'): GradedAnswer {
  return {
    question: question(id, domainId),
    isCorrect,
    userAnswer,
    correctAnswer: 'B',
    wasFlagged: false,
  };
}

function masteryRow(questionId: string, overrides: Partial<QuestionMasteryRow> = {}): QuestionMasteryRow {
  return {
    id: `clf-c02:${questionId}`,
    cert: 'clf-c02',
    domainId: 1,
    questionId,
    correctStreak: 0,
    lastWasWrong: false,
    lastSeenAt: 500,
    mastered: false,
    sessionsSinceSeen: 0,
    weight: LEARNING_WEIGHT_MAX,
    ...overrides,
  };
}

function priorResult(
  questionId: string,
  domainId: number,
  isCorrect: boolean,
  attemptId = 'clf-c02:mock:1',
): QuestionResultRow {
  return {
    id: `${attemptId}:${questionId}`,
    attemptId,
    cert: 'clf-c02',
    domainId,
    questionId,
    userAnswer: isCorrect ? 'B' : 'A',
    correctAnswer: 'B',
    isCorrect,
    wasFlagged: false,
    answeredAt: 500,
  };
}

function baseInput(overrides: Partial<BuildAttemptRowsInput> = {}): BuildAttemptRowsInput {
  return {
    cert: CERT,
    kind: 'study',
    startedAt: 1_000,
    finishedAt: 1_000 + 95_000,
    timeTakenSeconds: 95,
    graded: [graded('q-a', 1, true), graded('q-b', 1, true), graded('q-d', 2, false, 'A')],
    priorResults: [],
    priorMastery: [],
    bank: BANK,
    ...overrides,
  };
}

describe('buildAttemptRows', () => {
  it('builds the attempt row in the exact shape the mock exam writes', () => {
    const { attempt } = buildAttemptRows(baseInput());

    expect(attempt).toEqual({
      id: 'clf-c02:study:1000',
      cert: 'clf-c02',
      kind: 'study',
      startedAt: 1_000,
      finishedAt: 96_000,
      totalQuestions: 3,
      correctCount: 2,
      scorePercent: 67,
      scaledScore: 700,
      passed: true,
      timeTakenSeconds: 95,
      domainScores: [
        { domainId: 1, correct: 2, total: 2, percent: 100 },
        { domainId: 2, correct: 0, total: 1, percent: 0 },
      ],
    });
  });

  it('passes the caller timing policy through untouched', () => {
    // The mock exam clamps to the exam length; the untimed study exam records
    // raw elapsed. The builder stores whichever seconds it is given.
    const { attempt } = buildAttemptRows(baseInput({ timeTakenSeconds: 60 * 60 * 30 }));

    expect(attempt.timeTakenSeconds).toBe(60 * 60 * 30);
  });

  it('writes one question result row per graded answer in the mock shape', () => {
    const flagged = { ...graded('q-b', 1, true), wasFlagged: true };
    const { attempt, results } = buildAttemptRows(
      baseInput({ graded: [graded('q-a', 1, true), flagged, graded('q-d', 2, false, 'A')] }),
    );

    expect(results).toEqual([
      {
        id: `${attempt.id}:q-a`,
        attemptId: attempt.id,
        cert: 'clf-c02',
        domainId: 1,
        questionId: 'q-a',
        userAnswer: 'B',
        correctAnswer: 'B',
        isCorrect: true,
        wasFlagged: false,
        answeredAt: 96_000,
      },
      {
        id: `${attempt.id}:q-b`,
        attemptId: attempt.id,
        cert: 'clf-c02',
        domainId: 1,
        questionId: 'q-b',
        userAnswer: 'B',
        correctAnswer: 'B',
        isCorrect: true,
        wasFlagged: true,
        answeredAt: 96_000,
      },
      {
        id: `${attempt.id}:q-d`,
        attemptId: attempt.id,
        cert: 'clf-c02',
        domainId: 2,
        questionId: 'q-d',
        userAnswer: 'A',
        correctAnswer: 'B',
        isCorrect: false,
        wasFlagged: false,
        answeredAt: 96_000,
      },
    ]);
  });

  it('omits a domain the attempt did not ask instead of fabricating 0 percent', () => {
    const sparseCert: Certification = {
      ...CERT,
      domains: [
        { id: 1, name: 'One', questionCount: 3, examProportion: 0.5 },
        { id: 2, name: 'Two', questionCount: 1, examProportion: 0 },
        { id: 3, name: 'Three', questionCount: 1, examProportion: 0.5 },
      ],
    };
    const { attempt } = buildAttemptRows(
      baseInput({ cert: sparseCert, graded: [graded('q-a', 1, true), graded('q-d', 3, false, 'A')] }),
    );

    // Domain 2 contributed no questions: no row, and no invented 0 percent.
    expect(attempt.domainScores).toEqual([
      { domainId: 1, correct: 1, total: 1, percent: 100 },
      { domainId: 3, correct: 0, total: 1, percent: 0 },
    ]);
    expect(attempt.domainScores.every((row) => row.total > 0)).toBe(true);
  });

  it('accumulates progress over prior results and derives mastery from bank coverage', () => {
    const priorResults: QuestionResultRow[] = [
      priorResult('q-a', 1, true),
      priorResult('q-a', 1, true, 'clf-c02:study:2'),
      priorResult('q-b', 1, false),
      // A stale row for a question no longer in the bank must not count as covered.
      priorResult('q-removed', 1, true),
      priorResult('q-d', 2, true),
    ];
    const { progress } = buildAttemptRows(
      baseInput({
        graded: [graded('q-b', 1, true), graded('q-c', 1, true)],
        priorResults,
      }),
    );

    expect(progress).toEqual([
      {
        id: 'clf-c02:1',
        cert: 'clf-c02',
        domainId: 1,
        attempted: 6,
        correct: 5,
        // Coverage dedupes by question id and intersects with the bank:
        // q-a, q-b, q-c are covered, the stale q-removed is not.
        // round(3 / 187 * 100) = 2 with the real CLF-C02 bank size.
        masteryPercent: 2,
        updatedAt: 96_000,
      },
      {
        id: 'clf-c02:2',
        cert: 'clf-c02',
        domainId: 2,
        attempted: 1,
        correct: 1,
        // round(1 / 247 * 100) = 0 with the real CLF-C02 bank size.
        masteryPercent: 0,
        updatedAt: 96_000,
      },
    ]);
  });

  it('folds prior mastery: correct extends the streak, wrong resets it and clears mastered', () => {
    const priorMastery: QuestionMasteryRow[] = [
      {
        id: 'clf-c02:q-a',
        cert: 'clf-c02',
        domainId: 1,
        questionId: 'q-a',
        correctStreak: 2,
        lastWasWrong: false,
        lastSeenAt: 500,
        mastered: true,
        weight: MASTERED_WEIGHT,
      },
      {
        id: 'clf-c02:q-b',
        cert: 'clf-c02',
        domainId: 1,
        questionId: 'q-b',
        correctStreak: 3,
        lastWasWrong: false,
        lastSeenAt: 500,
        mastered: true,
        weight: MASTERED_WEIGHT,
      },
    ];
    const { mastery } = buildAttemptRows(
      baseInput({
        graded: [graded('q-a', 1, true), graded('q-b', 1, false, 'A'), graded('q-c', 1, true)],
        priorMastery,
      }),
    );

    expect(mastery).toEqual([
      {
        id: 'clf-c02:q-a',
        cert: 'clf-c02',
        domainId: 1,
        questionId: 'q-a',
        correctStreak: 3,
        lastWasWrong: false,
        lastSeenAt: 96_000,
        mastered: true,
        sessionsSinceSeen: 0,
        // Answered while mastered: the exclusion window restarts at null
        // (issue 007 log L2, SR-16).
        weight: null,
      },
      {
        id: 'clf-c02:q-b',
        cert: 'clf-c02',
        domainId: 1,
        questionId: 'q-b',
        correctStreak: 0,
        lastWasWrong: true,
        lastSeenAt: 96_000,
        mastered: false,
        sessionsSinceSeen: 0,
        weight: LAST_WRONG_WEIGHT,
      },
      {
        id: 'clf-c02:q-c',
        cert: 'clf-c02',
        domainId: 1,
        questionId: 'q-c',
        correctStreak: 1,
        lastWasWrong: false,
        lastSeenAt: 96_000,
        mastered: false,
        sessionsSinceSeen: 0,
        weight: LEARNING_WEIGHT_MAX,
      },
    ]);
    // The weight comes from the engine bands, except that a mastered
    // question inside the exclusion window rests at null (issue 007 log L2).
    expect(mastery.find((row) => row.questionId === 'q-a')?.weight).toBeNull();
    expect(mastery.find((row) => row.questionId === 'q-b')?.weight).toBe(LAST_WRONG_WEIGHT);
    expect(mastery.find((row) => row.questionId === 'q-c')?.weight).toBe(LEARNING_WEIGHT_MAX);
  });

  it('writes sessionsSinceSeen and null weights for resting mastered questions (S10)', () => {
    const priorMastery: QuestionMasteryRow[] = [
      // One correct away from mastery.
      masteryRow('q-a', { correctStreak: 1 }),
      // Already mastered and resting on session 1 of its window.
      masteryRow('q-b', { correctStreak: 2, mastered: true, sessionsSinceSeen: 1, weight: null }),
    ];
    const { mastery } = buildAttemptRows(
      baseInput({
        graded: [graded('q-a', 1, true), graded('q-b', 1, true)],
        priorMastery,
      }),
    );

    expect(mastery).toEqual([
      {
        id: 'clf-c02:q-a',
        cert: 'clf-c02',
        domainId: 1,
        questionId: 'q-a',
        correctStreak: 2,
        lastWasWrong: false,
        lastSeenAt: 96_000,
        mastered: true,
        sessionsSinceSeen: 0,
        weight: null,
      },
      {
        id: 'clf-c02:q-b',
        cert: 'clf-c02',
        domainId: 1,
        questionId: 'q-b',
        correctStreak: 3,
        lastWasWrong: false,
        lastSeenAt: 96_000,
        mastered: true,
        sessionsSinceSeen: 0,
        weight: null,
      },
    ]);
  });

  it('ages the unasked rows of a completed practice session domain (S10, SR-16)', () => {
    const priorMastery: QuestionMasteryRow[] = [
      // Asked this session: answered by the writer, never aged twice.
      masteryRow('q-a', { correctStreak: 1 }),
      // Same domain, not asked: ages inside the window, still resting.
      masteryRow('q-b', { correctStreak: 2, mastered: true, sessionsSinceSeen: 2, weight: null }),
      // Same domain, not asked, on the last resting session: the window ends.
      masteryRow('q-c', { correctStreak: 4, mastered: true, sessionsSinceSeen: 3, weight: null }),
      // Another domain: the session did not touch it, so it is left alone.
      masteryRow('q-d', { domainId: 2, correctStreak: 1, weight: LEARNING_WEIGHT_MAX }),
    ];
    const { mastery } = buildAttemptRows(
      baseInput({
        kind: 'practice',
        graded: [graded('q-a', 1, true)],
        priorMastery,
      }),
    );

    expect(mastery).toEqual([
      {
        id: 'clf-c02:q-a',
        cert: 'clf-c02',
        domainId: 1,
        questionId: 'q-a',
        correctStreak: 2,
        lastWasWrong: false,
        lastSeenAt: 96_000,
        mastered: true,
        sessionsSinceSeen: 0,
        weight: null,
      },
      {
        id: 'clf-c02:q-b',
        cert: 'clf-c02',
        domainId: 1,
        questionId: 'q-b',
        correctStreak: 2,
        lastWasWrong: false,
        lastSeenAt: 500,
        mastered: true,
        sessionsSinceSeen: 3,
        weight: null,
      },
      {
        id: 'clf-c02:q-c',
        cert: 'clf-c02',
        domainId: 1,
        questionId: 'q-c',
        correctStreak: 4,
        lastWasWrong: false,
        lastSeenAt: 500,
        mastered: true,
        sessionsSinceSeen: 4,
        weight: MASTERED_WEIGHT,
      },
    ]);
  });

  it('leaves unasked rows of a study session alone: the window counts practice sessions only', () => {
    const priorMastery: QuestionMasteryRow[] = [
      masteryRow('q-b', { correctStreak: 2, mastered: true, sessionsSinceSeen: 2, weight: null }),
    ];
    const { mastery } = buildAttemptRows(
      baseInput({ graded: [graded('q-a', 1, true)], priorMastery }),
    );

    expect(mastery.map((row) => row.questionId)).toEqual(['q-a']);
  });
});

describe('agePracticeSessionMastery (issue 007, S10, SR-16)', () => {
  it('ages only the unasked rows of the session domains and preserves identity', () => {
    const prior: QuestionMasteryRow[] = [
      // Asked by the session: excluded, the answer path owns it.
      masteryRow('q-asked', { correctStreak: 1 }),
      // Same domain, not asked, still resting: the counter advances inside the window.
      masteryRow('q-resting', { correctStreak: 2, mastered: true, sessionsSinceSeen: 2, weight: null }),
      // Same domain, not asked, on the window boundary: the rest ends here.
      masteryRow('q-ending', { correctStreak: 4, mastered: true, sessionsSinceSeen: 3, weight: null }),
      // Another domain: the session did not touch it, so it is excluded.
      masteryRow('q-other-domain', { domainId: 2, correctStreak: 1, weight: LEARNING_WEIGHT_MAX }),
    ];

    const aged = agePracticeSessionMastery(prior, new Set(['q-asked']), new Set([1]));

    expect(aged.map((row) => row.questionId)).toEqual(['q-resting', 'q-ending']);
    expect(aged[0]).toEqual({ ...prior[1], sessionsSinceSeen: 3, weight: null });
    expect(aged[1]).toEqual({
      ...prior[2],
      sessionsSinceSeen: EXCLUSION_WINDOW_SESSIONS + 1,
      weight: MASTERED_WEIGHT,
    });
  });

  it('is the same aging the practice builder applies to its own unasked rows', () => {
    const priorMastery: QuestionMasteryRow[] = [
      masteryRow('q-b', { correctStreak: 2, mastered: true, sessionsSinceSeen: 2, weight: null }),
    ];

    const { mastery } = buildAttemptRows(
      baseInput({ kind: 'practice', graded: [graded('q-a', 1, true)], priorMastery }),
    );
    const direct = agePracticeSessionMastery(priorMastery, new Set(['q-a']), new Set([1]));

    expect(mastery.filter((row) => row.questionId === 'q-b')).toEqual(direct);
  });
});

describe('the mastery folds agree (issue 007, S10)', () => {
  it('foldMasteryHistory and the builder land on the same state for the same answers', () => {
    // Two consecutive correct answers: reached through the full-history fold,
    // and through the builder folding a prior streak of one plus one answer.
    const folded = foldMasteryHistory([
      { isCorrect: true, answeredAt: 1_000 },
      { isCorrect: true, answeredAt: 96_000 },
    ]);
    const { mastery } = buildAttemptRows(
      baseInput({
        graded: [graded('q-a', 1, true)],
        priorMastery: [masteryRow('q-a', { correctStreak: 1 })],
      }),
    );

    const expected = {
      correctStreak: 2,
      lastWasWrong: false,
      mastered: true,
      sessionsSinceSeen: 0,
      weight: null,
      lastSeenAt: 96_000,
    };
    expect(folded).toEqual(expected);
    expect(mastery[0]).toMatchObject(expected);
  });
});
