/**
 * Behaviour tests for the practice session service (issue 007, S3 to S10,
 * S12, S17).
 *
 * Every test drives the public API against a real IndexedDB (fake-indexeddb)
 * and asserts observable outcomes: stored rows, exposed counters, typed
 * errors, and deterministic selection through the injected random source.
 * Synthetic cert and bank seams keep grading and selection edges small; the
 * real CLF-C02 domain bank backs the resume, completion, and mastery tests
 * so the registry-derived mastery percentages stay honest.
 */

import 'fake-indexeddb/auto';

import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Certification } from '../../../core/content/cert-registry';
import { loadDomainQuestions } from '../../../core/content/question-loader';
import { questionType, type Question } from '../../../core/content/question-types';
import {
  LAST_WRONG_WEIGHT,
  LEARNING_WEIGHT_MAX,
  MASTERED_WEIGHT,
  correctAnswerFor,
} from '../../../core/exam';
import { StorageWriteError } from '../../../core/storage/errors';
import { createStudyRepository } from '../../../core/storage/repository-provider';
import { STUDY_REPOSITORY } from '../../../core/storage/repository-provider';
import type { StudyRepository } from '../../../core/storage/study-repository';
import type {
  CommitAnswersInput,
  QuestionMasteryRow,
  SessionRow,
} from '../../../core/storage/types';

import {
  PracticeLoadError,
  PracticeSaveError,
  PracticeSessionError,
} from './practice-session.errors';
import { PracticeSessionService } from './practice-session.service';

let repository: StudyRepository;

beforeEach(async () => {
  repository = createStudyRepository();
  await repository.open();
  await repository.resetAll();
});

afterEach(async () => {
  vi.useRealTimers();
  TestBed.resetTestingModule();
  await repository.close();
});

/** A genuinely fresh service instance over the same repository (force close simulation). */
function freshService(repo: StudyRepository = repository): PracticeSessionService {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: STUDY_REPOSITORY, useValue: repo }],
  });
  return TestBed.inject(PracticeSessionService);
}

/** Pin the wall clock without freezing the IndexedDB event loop. */
function at(ms: number): void {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(ms);
}

/** Randomness pinned so every shuffle is the identity: display keys equal bank keys. */
const IDENTITY = () => 0.99;

function questionById(service: PracticeSessionService, id: string): Question {
  const question = service.questions().find((candidate) => candidate.id === id);
  if (!question) {
    throw new Error(`question ${id} is not in the active session`);
  }
  return question;
}

function isSingle(question: Question): boolean {
  return questionType(question) === 'single';
}

/** A complete but incorrect response for any question type, in display space. */
function wrongValueFor(question: Question): string | string[] {
  const type = questionType(question);
  const correct = correctAnswerFor(question);
  if (type === 'single') {
    return Object.keys(question.options).find((key) => key !== correct) ?? 'E';
  }
  const correctKeys = correct as string[];
  if (type === 'ordering') {
    return [...correctKeys].reverse();
  }
  if (type === 'matching') {
    const pairs = correctKeys.map((token) => token.split(':'));
    const firstTarget = pairs[0]?.[1];
    pairs[0][1] = pairs[1]?.[1] ?? firstTarget;
    pairs[1][1] = firstTarget ?? '';
    return pairs.map(([key, target]) => `${key}:${target}`);
  }
  const wrongKey = Object.keys(question.options).find((key) => !correctKeys.includes(key)) ?? 'E';
  return [correctKeys[0] ?? 'A', wrongKey];
}

/** Grade a question correctly through the public flow for its type. */
async function answerCorrectly(service: PracticeSessionService, question: Question): Promise<void> {
  await service.answer(question.id, correctAnswerFor(question));
  if (!isSingle(question)) {
    expect(await service.submitAnswer(question.id)).toBe('graded');
  }
}

/** Grade a question incorrectly through the public flow for its type. */
async function answerWrongly(service: PracticeSessionService, question: Question): Promise<void> {
  await service.answer(question.id, wrongValueFor(question));
  if (!isSingle(question)) {
    expect(await service.submitAnswer(question.id)).toBe('graded');
  }
}

/** The bar invariant: correct plus wrong always equals answered (S5). */
function expectConsistentCounts(service: PracticeSessionService): void {
  expect(service.correctCount() + service.wrongCount()).toBe(service.answeredCount());
}

function explanation(options: Record<string, string>): Question['explanation'] {
  const perOption: Record<string, string> = {};
  for (const key of Object.keys(options)) {
    perOption[key] = `Note on ${key}.`;
  }
  return { summary: 'Summary.', options: perOption };
}

const OPTIONS = { A: 'Alpha', B: 'Beta', C: 'Gamma', D: 'Delta' };

function singleQuestion(id: string): Question {
  return {
    id,
    domainId: 1,
    isMultiAnswer: false,
    question: `Pick one for ${id}.`,
    options: { ...OPTIONS },
    answer: 'B',
    explanation: explanation(OPTIONS),
  };
}

/** Twelve single questions, enough for the minimum session size. */
const PRACTICE_BANK: Question[] = Array.from({ length: 12 }, (_, index) =>
  singleQuestion(`p-${String(index + 1).padStart(2, '0')}`),
);

/** Nine singles plus one of each other format, all in a single domain. */
const TYPES_BANK: Question[] = [
  ...Array.from({ length: 9 }, (_, index) => singleQuestion(`t-single-${index + 1}`)),
  {
    id: 't-multi',
    domainId: 1,
    isMultiAnswer: true,
    question: 'Pick two.',
    options: { ...OPTIONS },
    answer: ['A', 'C'],
    explanation: explanation(OPTIONS),
  },
  {
    id: 't-order',
    domainId: 1,
    isMultiAnswer: false,
    type: 'ordering',
    question: 'Order the steps.',
    options: { ...OPTIONS },
    correctOrder: ['B', 'A', 'D', 'C'],
    explanation: explanation(OPTIONS),
  },
  {
    id: 't-match',
    domainId: 1,
    isMultiAnswer: false,
    type: 'matching',
    question: 'Match the pairs.',
    options: { ...OPTIONS },
    targets: { 1: 'Right one', 2: 'Right two', 3: 'Right three', 4: 'Right four' },
    correctMatches: { A: '2', B: '1', C: '4', D: '3' },
    explanation: explanation(OPTIONS),
  },
];

const PRACTICE_CERT: Certification = {
  code: 'test-practice',
  provider: 'aws',
  level: 'foundational',
  name: 'Practice Test Cert',
  shortName: 'PRACT',
  examQuestionCount: 12,
  examTimeSeconds: 3600,
  passingScore: 700,
  status: 'active',
  domains: [{ id: 1, name: 'Everything', questionCount: 12, examProportion: 1 }],
};

function startTypes(service: PracticeSessionService, random: () => number = IDENTITY): Promise<void> {
  return service.start('test-practice', 1, 12, {
    cert: PRACTICE_CERT,
    bank: TYPES_BANK,
    random,
  });
}

function masteryRow(
  cert: string,
  questionId: string,
  overrides: Partial<QuestionMasteryRow> = {},
): QuestionMasteryRow {
  return {
    id: `${cert}:${questionId}`,
    cert,
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

describe('start bounds (S2)', () => {
  it('rejects a session size below the engine minimum', async () => {
    const service = freshService();
    await expect(
      service.start('test-practice', 1, 9, { cert: PRACTICE_CERT, bank: PRACTICE_BANK }),
    ).rejects.toBeInstanceOf(PracticeSessionError);
    expect(service.isActive()).toBe(false);
    expect(await repository.getSession('test-practice', 'practice')).toBeNull();
  });

  it('rejects a session size above the engine maximum', async () => {
    const service = freshService();
    await expect(
      service.start('test-practice', 1, 51, { cert: PRACTICE_CERT, bank: PRACTICE_BANK }),
    ).rejects.toBeInstanceOf(PracticeSessionError);
    expect(service.isActive()).toBe(false);
  });

  it('rejects a non-integer size and an unknown cert or domain', async () => {
    const service = freshService();
    await expect(
      service.start('test-practice', 1, 15.5, { cert: PRACTICE_CERT, bank: PRACTICE_BANK }),
    ).rejects.toBeInstanceOf(PracticeSessionError);
    await expect(service.start('nope-c00', 1, 10)).rejects.toBeInstanceOf(PracticeSessionError);
    await expect(
      service.start('test-practice', 7, 10, { cert: PRACTICE_CERT, bank: PRACTICE_BANK }),
    ).rejects.toBeInstanceOf(PracticeSessionError);
  });

  it('accepts the bounds and clamps the size to what the bank can supply', async () => {
    const service = freshService();
    await service.start('test-practice', 1, 10, {
      cert: PRACTICE_CERT,
      bank: PRACTICE_BANK,
      random: IDENTITY,
    });
    expect(service.totalQuestions()).toBe(10);

    const wide = freshService();
    await wide.start('test-practice', 1, 50, {
      cert: PRACTICE_CERT,
      bank: PRACTICE_BANK,
      random: IDENTITY,
    });
    expect(wide.totalQuestions()).toBe(12);
  });
});

describe('selection (S3)', () => {
  it('is a uniform draw of distinct questions when there is no history', async () => {
    const service = freshService();
    await service.start('test-practice', 1, 10, {
      cert: PRACTICE_CERT,
      bank: PRACTICE_BANK,
      random: IDENTITY,
    });

    const ids = service.questions().map((question) => question.id);
    expect(new Set(ids).size).toBe(10);
    const bankIds = new Set(PRACTICE_BANK.map((question) => question.id));
    expect(ids.every((id) => bankIds.has(id))).toBe(true);
  });

  it('selects every question once when the session size matches the bank', async () => {
    const service = freshService();
    await service.start('test-practice', 1, 12, {
      cert: PRACTICE_CERT,
      bank: PRACTICE_BANK,
      random: IDENTITY,
    });

    expect(new Set(service.questions().map((question) => question.id))).toEqual(
      new Set(PRACTICE_BANK.map((question) => question.id)),
    );
  });

  it('draws a high-weight question when the pinned random lands in its band', async () => {
    // Eleven questions with history: ten sit at the mastered band (weight 1),
    // one was last answered wrong (weight LAST_WRONG_WEIGHT). A random source
    // pinned inside the wrong-answered band must pick it.
    const bank = PRACTICE_BANK.slice(0, 11);
    const high = bank[5];
    for (const question of bank) {
      const mastered = question.id !== high.id;
      await repository.commitAnswers({
        attempt: null,
        results: [],
        progress: [],
        mastery: [
          masteryRow('test-practice', question.id, {
            mastered,
            correctStreak: mastered ? 2 : 0,
            lastWasWrong: !mastered,
            weight: mastered ? MASTERED_WEIGHT : LAST_WRONG_WEIGHT,
          }),
        ],
      });
    }
    const service = freshService();
    await service.start('test-practice', 1, 10, {
      cert: PRACTICE_CERT,
      bank,
      // Total weight is 10 * 1 + 6 = 16; the wrong-answered band starts after
      // five single-weight questions, and 0.5 * 16 = 8 lands inside it.
      random: () => 0.5,
    });

    expect(service.questions().map((question) => question.id)).toContain(high.id);
  });

  it('leaves a high-weight question out only when every draw lands on the low band', async () => {
    // Ten mastered questions at weight 1 and one last-wrong heavy at
    // LAST_WRONG_WEIGHT, with the heavy question placed last in the pool. A
    // random source pinned to zero always draws the first remaining
    // candidate, so ten draws exhaust the low band and never reach the heavy
    // one: weight, not luck, decides the same selector's outcome.
    const lows = PRACTICE_BANK.slice(0, 10);
    const high = PRACTICE_BANK[10];
    const bank = [...lows, high];
    for (const question of bank) {
      const mastered = question.id !== high.id;
      await repository.commitAnswers({
        attempt: null,
        results: [],
        progress: [],
        mastery: [
          masteryRow('test-practice', question.id, {
            mastered,
            correctStreak: mastered ? 2 : 0,
            lastWasWrong: !mastered,
            weight: mastered ? MASTERED_WEIGHT : LAST_WRONG_WEIGHT,
          }),
        ],
      });
    }
    const service = freshService();
    await service.start('test-practice', 1, 10, {
      cert: PRACTICE_CERT,
      bank,
      random: () => 0,
    });

    const ids = service.questions().map((question) => question.id);
    expect(ids).not.toContain(high.id);
    expect(new Set(ids).size).toBe(10);
  });
});

describe('start persistence (S4)', () => {
  it('saves the session with its option key maps before the first question is exposed', async () => {
    const service = freshService();
    await service.start('test-practice', 1, 10, {
      cert: PRACTICE_CERT,
      bank: PRACTICE_BANK,
      random: IDENTITY,
    });

    const stored = await repository.getSession('test-practice', 'practice');
    expect(stored).not.toBeNull();
    expect(stored?.kind).toBe('practice');
    expect(stored?.questionOrder).toEqual(service.questions().map((question) => question.id));
    expect(Object.keys(stored?.optionKeyMaps ?? {}).sort()).toEqual(
      [...(stored?.questionOrder ?? [])].sort(),
    );
    expect(stored?.deadlineAt).toBeNull();
    expect(stored?.answeredCount).toBe(0);
    expect(await service.hasInProgress('test-practice')).toBe(true);
  });
});

describe('per-answer atomic commit (S9)', () => {
  it('commits exactly one write with a null attempt id and updated counters per answer', async () => {
    at(4_000_000);
    const service = freshService();
    await startTypes(service);
    const single = questionById(service, 't-single-1');
    const commitSpy = vi.spyOn(repository, 'commitAnswers');

    await service.answer(single.id, 'B');

    expect(commitSpy).toHaveBeenCalledTimes(1);
    const input = commitSpy.mock.calls[0]?.[0];
    if (!input) {
      throw new Error('expected one commit call');
    }
    expect(input.attempt).toBeNull();
    expect(input.results).toHaveLength(1);
    expect(input.results[0]).toMatchObject({
      id: 'test-practice:practice:4000000:t-single-1',
      attemptId: null,
      cert: 'test-practice',
      domainId: 1,
      questionId: 't-single-1',
      userAnswer: 'B',
      correctAnswer: 'B',
      isCorrect: true,
      wasFlagged: false,
    });
    expect(input.progress).toHaveLength(1);
    expect(input.progress[0]).toMatchObject({
      id: 'test-practice:1',
      domainId: 1,
      attempted: 1,
      correct: 1,
    });
    expect(input.mastery).toHaveLength(1);
    expect(input.mastery[0]).toMatchObject({
      id: 'test-practice:t-single-1',
      questionId: 't-single-1',
      correctStreak: 1,
      lastWasWrong: false,
      mastered: false,
      sessionsSinceSeen: 0,
      weight: LEARNING_WEIGHT_MAX,
    });

    // The same graded state is on the session row for resume, and the
    // counters moved with it.
    const stored = await repository.getSession('test-practice', 'practice');
    expect(stored?.feedbackShown).toEqual(['t-single-1']);
    expect(stored?.answers['t-single-1']).toBe('B');
    expect(stored?.answeredCount).toBe(1);
    expect(stored?.correctCount).toBe(1);
    expect(service.answeredCount()).toBe(1);
    expectConsistentCounts(service);

    // What listPracticeResults reads is exactly the null-attempt row (DATA-18).
    const practiceResults = await repository.listPracticeResults('test-practice');
    expect(practiceResults).toHaveLength(1);
    expect(practiceResults[0]?.attemptId).toBeNull();
  });

  it('grades all four formats all-or-nothing, singles inline and the rest on confirm', async () => {
    const service = freshService();
    await startTypes(service);

    await service.answer('t-single-1', 'B');
    expect(service.isGraded('t-single-1')).toBe(true);

    const multi = questionById(service, 't-multi');
    await service.answer(multi.id, correctAnswerFor(multi));
    expect(service.isGraded(multi.id)).toBe(false);
    expect(await service.submitAnswer(multi.id)).toBe('graded');
    expect(service.isCorrect(multi.id)).toBe(true);

    const order = questionById(service, 't-order');
    await service.answer(order.id, wrongValueFor(order));
    expect(await service.submitAnswer(order.id)).toBe('graded');
    expect(service.isCorrect(order.id)).toBe(false);

    const match = questionById(service, 't-match');
    await service.answer(match.id, correctAnswerFor(match));
    expect(await service.submitAnswer(match.id)).toBe('graded');
    expect(service.isCorrect(match.id)).toBe(true);

    expect(service.answeredCount()).toBe(4);
    expect(service.correctCount()).toBe(3);
    expectConsistentCounts(service);
  });
});

describe('read-only graded questions (S7)', () => {
  it('refuses to change a graded answer and keeps the recorded feedback', async () => {
    const service = freshService();
    await startTypes(service);
    const single = questionById(service, 't-single-1');
    await service.answer(single.id, 'B');

    const feedback = service.feedbackFor(single.id);
    expect(feedback?.isCorrect).toBe(true);
    await expect(service.answer(single.id, 'A')).rejects.toBeInstanceOf(PracticeSessionError);
    await expect(service.submitAnswer(single.id)).rejects.toBeInstanceOf(PracticeSessionError);

    expect(service.answerFor(single.id)).toBe('B');
    expect(service.isCorrect(single.id)).toBe(true);
    expect(service.feedbackFor(single.id)).toEqual(feedback);
    expect(service.answeredCount()).toBe(1);
  });

  it('exposes the summary and the tagged per-option explanations (S6)', async () => {
    const service = freshService();
    await startTypes(service);
    const single = questionById(service, 't-single-2');
    await service.answer(single.id, 'A');

    const feedback = service.feedbackFor(single.id);
    expect(feedback?.questionId).toBe('t-single-2');
    expect(feedback?.isCorrect).toBe(false);
    expect(feedback?.summary).toBe('Summary.');
    expect(feedback?.options).toEqual([
      { key: 'A', text: 'Note on A.', kind: 'chosen-wrong' },
      { key: 'B', text: 'Note on B.', kind: 'missed-correct' },
    ]);
  });
});

describe('incomplete multi guard (S8, PRACT-17)', () => {
  it('reports incomplete instead of grading a partial multi wrong', async () => {
    const service = freshService();
    await startTypes(service);
    const multi = questionById(service, 't-multi');
    const commitSpy = vi.spyOn(repository, 'commitAnswers');

    await service.answer(multi.id, ['A']);
    expect(service.isAnswered(multi.id)).toBe(false);
    expect(await service.submitAnswer(multi.id)).toBe('incomplete');

    // Nothing was graded, committed, or exposed as feedback.
    expect(commitSpy).not.toHaveBeenCalled();
    expect(service.isGraded(multi.id)).toBe(false);
    expect(service.isCorrect(multi.id)).toBeNull();
    expect(service.feedbackFor(multi.id)).toBeNull();
    expect(service.answeredCount()).toBe(0);
    expect(await repository.listPracticeResults('test-practice')).toHaveLength(0);

    // Completing the response grades it normally.
    await service.answer(multi.id, ['A', 'C']);
    expect(service.isAnswered(multi.id)).toBe(true);
    expect(await service.submitAnswer(multi.id)).toBe('graded');
    expect(service.isCorrect(multi.id)).toBe(true);
    expectConsistentCounts(service);
  });
});

describe('navigation and counters (S5)', () => {
  it('tracks position and counts, and persists navigation', async () => {
    const service = freshService();
    await startTypes(service);
    expect(service.totalQuestions()).toBe(12);
    expect(service.currentIndex()).toBe(0);
    expect(service.currentQuestion()?.id).toBe(service.questions()[0]?.id);

    await service.goTo(4);
    expect(service.currentIndex()).toBe(4);
    const stored = await repository.getSession('test-practice', 'practice');
    expect(stored?.currentIndex).toBe(4);

    await answerCorrectly(service, questionById(service, 't-single-1'));
    await answerWrongly(service, questionById(service, 't-single-2'));
    expect(service.answeredCount()).toBe(2);
    expect(service.correctCount()).toBe(1);
    expect(service.wrongCount()).toBe(1);
    expect(service.answeredPercent()).toBe(17);
    expectConsistentCounts(service);

    await expect(service.goTo(12)).rejects.toBeInstanceOf(PracticeSessionError);
    await expect(service.goTo(-1)).rejects.toBeInstanceOf(PracticeSessionError);
  });
});

describe('resume (S14)', () => {
  it('restores position, answers, feedback, and counters on a fresh instance', async () => {
    at(4_000_000);
    const first = freshService();
    await first.start('clf-c02', 1, 10, { random: IDENTITY });
    const order = first.questions().map((question) => question.id);
    const [one, two, three, four, five] = first.questions();
    await answerCorrectly(first, one);
    await answerWrongly(first, two);
    await answerCorrectly(first, three);
    await answerWrongly(first, four);
    await answerCorrectly(first, five);
    await first.goTo(3);
    const feedbackBefore = first.feedbackFor(one.id);

    const resumed = freshService();
    expect(await resumed.resume('clf-c02')).toBe(true);

    expect(resumed.questions().map((question) => question.id)).toEqual(order);
    expect(resumed.currentIndex()).toBe(3);
    expect(resumed.totalQuestions()).toBe(10);
    expect(resumed.answeredCount()).toBe(5);
    expect(resumed.correctCount()).toBe(3);
    expect(resumed.wrongCount()).toBe(2);
    expectConsistentCounts(resumed);
    for (const question of [one, two, three, four, five]) {
      expect(resumed.isGraded(question.id)).toBe(true);
      expect(resumed.answerFor(question.id)).toEqual(first.answerFor(question.id));
      // A graded question stays read-only after the resume (S7).
      await expect(resumed.answer(question.id, 'A')).rejects.toBeInstanceOf(
        PracticeSessionError,
      );
    }
    expect(resumed.isCorrect(one.id)).toBe(true);
    expect(resumed.isCorrect(two.id)).toBe(false);
    expect(resumed.feedbackFor(one.id)).toEqual(feedbackBefore);
    expect(resumed.isActive()).toBe(true);
  });

  it('returns false with nothing stored and quarantines an inconsistent session row', async () => {
    const service = freshService();
    expect(await service.resume('clf-c02')).toBe(false);

    const stale: SessionRow = {
      id: 'clf-c02:practice',
      cert: 'clf-c02',
      kind: 'practice',
      questionOrder: ['gone-from-the-bank'],
      currentIndex: 0,
      answers: {},
      feedbackShown: [],
      flagged: [],
      optionKeyMaps: {},
      startedAt: 123,
      deadlineAt: null,
      answeredCount: 0,
      correctCount: 0,
      wrongCount: 0,
      updatedAt: 123,
    };
    await repository.putSession(stale);

    expect(await service.resume('clf-c02')).toBe(false);
    expect(await repository.getSession('clf-c02', 'practice')).toBeNull();
  });
});

describe('complete (S9, S11)', () => {
  it('refuses when nothing was answered', async () => {
    const service = freshService();
    await service.start('clf-c02', 1, 10, { random: IDENTITY });

    await expect(service.complete()).rejects.toBeInstanceOf(PracticeSessionError);
    expect(service.isActive()).toBe(true);
    expect(await repository.listAttempts({ cert: 'clf-c02' })).toHaveLength(0);
  });

  it('writes one practice attempt, updates the domain rows, and stops being resumable', async () => {
    at(4_000_000);
    const service = freshService();
    await service.start('clf-c02', 1, 10, { random: IDENTITY });
    const questions = [...service.questions()];

    // A resting mastered question of the domain that this session did not
    // ask: completion must advance its exclusion window exactly once (SR-16).
    const bank = await loadDomainQuestions('clf-c02', 1);
    const asked = new Set(questions.map((question) => question.id));
    const resting = bank.find((question) => !asked.has(question.id));
    if (!resting) {
      throw new Error('expected an unasked domain question');
    }
    await repository.commitAnswers({
      attempt: null,
      results: [],
      progress: [],
      mastery: [
        masteryRow('clf-c02', resting.id, {
          correctStreak: 2,
          mastered: true,
          sessionsSinceSeen: 3,
          weight: null,
        }),
      ],
    });

    const [first, second, ...rest] = questions;
    await answerCorrectly(service, first);
    await answerWrongly(service, second);
    for (const question of rest) {
      await answerCorrectly(service, question);
    }

    at(4_000_000 + 95_000);
    const commitSpy = vi.spyOn(repository, 'commitAnswers');
    const completion = await service.complete();

    expect(commitSpy).toHaveBeenCalledTimes(1);
    const input = commitSpy.mock.calls[0]?.[0];
    if (!input) {
      throw new Error('expected one commit call');
    }
    expect(input.clearSession).toEqual({ cert: 'clf-c02', kind: 'practice' });
    expect(input.attempt?.id).toBe(completion.attempt.id);
    // Every answer was already committed per answer; nothing is missing.
    expect(input.results).toEqual([]);
    expect(input.progress).toHaveLength(1);
    // Only the unasked resting row ages; asked rows were folded per answer.
    expect(input.mastery.map((row) => row.questionId)).toEqual([resting.id]);

    expect(completion.attempt).toMatchObject({
      id: 'clf-c02:practice:4000000',
      cert: 'clf-c02',
      kind: 'practice',
      startedAt: 4_000_000,
      finishedAt: 4_095_000,
      totalQuestions: 10,
      correctCount: 9,
      scorePercent: 90,
      timeTakenSeconds: 95,
    });
    expect(completion.domainScores).toEqual([
      { domainId: 1, correct: 9, total: 10, percent: 90 },
    ]);
    expect(completion.attempt.domainScores).toEqual(completion.domainScores);

    // One result row per answered question, each with a null attempt id.
    const practiceResults = await repository.listPracticeResults('clf-c02');
    expect(practiceResults).toHaveLength(10);
    expect(practiceResults.every((row) => row.attemptId === null)).toBe(true);
    expect(practiceResults.filter((row) => row.isCorrect)).toHaveLength(9);

    // The domain aggregate reflects the whole session (SR-42).
    const progress = await repository.getCertProgress('clf-c02');
    const domainRow = progress.find((row) => row.domainId === 1);
    expect(domainRow).toMatchObject({ attempted: 10, correct: 9 });

    // Mastery: the wrong answer landed on the last-wrong band, the correct
    // ones on the learning band, and the resting question left its window.
    const masteryRows = await repository.getQuestionMastery('clf-c02');
    const byId = new Map(masteryRows.map((row) => [row.questionId, row]));
    expect(byId.get(second.id)).toMatchObject({
      correctStreak: 0,
      lastWasWrong: true,
      mastered: false,
      weight: LAST_WRONG_WEIGHT,
    });
    expect(byId.get(first.id)).toMatchObject({
      correctStreak: 1,
      lastWasWrong: false,
      mastered: false,
      weight: LEARNING_WEIGHT_MAX,
    });
    expect(byId.get(resting.id)).toMatchObject({
      sessionsSinceSeen: 4,
      weight: MASTERED_WEIGHT,
      mastered: true,
    });

    // The session is cleared: history lists the attempt as practice, and
    // nothing is resumable anymore (S11).
    expect(await repository.getSession('clf-c02', 'practice')).toBeNull();
    expect(service.isActive()).toBe(false);
    const fresh = freshService();
    expect(await fresh.resume('clf-c02')).toBe(false);
    expect(await fresh.hasInProgress('clf-c02')).toBe(false);
    const attempts = await repository.listAttempts({ cert: 'clf-c02' });
    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.kind).toBe('practice');
  });

  it('re-commits an answer row that is missing from storage so history stays complete', async () => {
    at(4_000_000);
    const first = freshService();
    await first.start('clf-c02', 1, 10, { random: IDENTITY });
    const [one, two] = first.questions();
    await answerCorrectly(first, one);

    // Simulate the crash window: the session row says the second question is
    // graded, but its history commit never landed.
    const stored = await repository.getSession('clf-c02', 'practice');
    if (!stored) {
      throw new Error('expected a stored session');
    }
    const crashed: SessionRow = {
      ...stored,
      answers: { ...stored.answers, [two.id]: stored.answers[one.id] ?? '' },
      feedbackShown: [...stored.feedbackShown, two.id].sort(),
    };
    await repository.putSession(crashed);
    expect(await repository.listPracticeResults('clf-c02')).toHaveLength(1);

    const resumed = freshService();
    expect(await resumed.resume('clf-c02')).toBe(true);
    expect(resumed.isGraded(two.id)).toBe(true);
    await resumed.complete();

    const practiceResults = await repository.listPracticeResults('clf-c02');
    expect(practiceResults).toHaveLength(2);
    expect(new Set(practiceResults.map((row) => row.questionId))).toEqual(
      new Set([one.id, two.id]),
    );
    const progress = await repository.getCertProgress('clf-c02');
    expect(progress.find((row) => row.domainId === 1)).toMatchObject({ attempted: 2 });
  });

  it('marks a question mastered after two consecutive correct answers (S10)', async () => {
    const first = freshService();
    await first.start('test-practice', 1, 12, {
      cert: PRACTICE_CERT,
      bank: PRACTICE_BANK,
      random: IDENTITY,
    });
    for (const question of first.questions()) {
      await answerCorrectly(first, question);
    }
    await first.complete();
    let mastery = await repository.getQuestionMastery('test-practice');
    expect(mastery).toHaveLength(12);
    expect(
      mastery.every((row) => row.correctStreak === 1 && !row.mastered && row.weight !== null),
    ).toBe(true);

    // The session size equals the bank, so every question returns and the
    // second consecutive correct answer lands through the public flow.
    const second = freshService();
    await second.start('test-practice', 1, 12, {
      cert: PRACTICE_CERT,
      bank: PRACTICE_BANK,
      random: IDENTITY,
    });
    for (const question of second.questions()) {
      await answerCorrectly(second, question);
    }
    await second.complete();

    mastery = await repository.getQuestionMastery('test-practice');
    expect(mastery).toHaveLength(12);
    expect(
      mastery.every(
        (row) => row.correctStreak === 2 && row.mastered && row.weight === null,
      ),
    ).toBe(true);
  });
});

describe('failed writes and loads (S12)', () => {
  it('surfaces a retryable error and does not advance when the history commit fails', async () => {
    let shouldFail = false;
    const flaky = Object.create(repository) as StudyRepository;
    flaky.commitAnswers = (input: CommitAnswersInput) =>
      shouldFail
        ? Promise.reject(new StorageWriteError('injected storage failure'))
        : repository.commitAnswers(input);
    const service = freshService(flaky);
    await startTypes(service);
    const single = questionById(service, 't-single-1');

    shouldFail = true;
    await expect(service.answer(single.id, 'B')).rejects.toBeInstanceOf(PracticeSaveError);

    // Nothing advanced: not in memory, not in storage.
    expect(service.isGraded(single.id)).toBe(false);
    expect(service.answerFor(single.id)).toBeNull();
    expect(service.answeredCount()).toBe(0);
    const stored = await repository.getSession('test-practice', 'practice');
    expect(stored?.answers[single.id]).toBeUndefined();
    expect(stored?.feedbackShown).toEqual([]);
    expect(await repository.listPracticeResults('test-practice')).toHaveLength(0);

    shouldFail = false;
    await service.answer(single.id, 'B');
    expect(service.isGraded(single.id)).toBe(true);
    expect(service.answeredCount()).toBe(1);
    expect(await repository.listPracticeResults('test-practice')).toHaveLength(1);
    expectConsistentCounts(service);
  });

  it('retries idempotently when the session save fails after the history commit', async () => {
    // The real cert backs this resume, matching the file header: only a
    // registry cert resolves on a fresh instance.
    let shouldFail = false;
    const flaky = Object.create(repository) as StudyRepository;
    flaky.putSession = (row: SessionRow) =>
      shouldFail
        ? Promise.reject(new StorageWriteError('injected storage failure'))
        : repository.putSession(row);
    const service = freshService(flaky);
    await service.start('clf-c02', 1, 10, { random: IDENTITY });
    const single = service.questions().find(isSingle);
    if (!single) {
      throw new Error('expected a single-choice question in the session');
    }

    shouldFail = true;
    await expect(service.answer(single.id, correctAnswerFor(single))).rejects.toBeInstanceOf(
      PracticeSaveError,
    );

    // The commit landed; the session save did not, so the question is still
    // ungraded in memory and in the stored session.
    expect(service.isGraded(single.id)).toBe(false);
    expect(service.answeredCount()).toBe(0);
    expect(await repository.listPracticeResults('clf-c02')).toHaveLength(1);

    // A crash plus resume here must not duplicate the row: the retry
    // rewrites the same deterministic id.
    const resumed = freshService(flaky);
    expect(await resumed.resume('clf-c02')).toBe(true);
    expect(resumed.isGraded(single.id)).toBe(false);

    shouldFail = false;
    await resumed.answer(single.id, correctAnswerFor(single));
    expect(resumed.isGraded(single.id)).toBe(true);
    const results = await repository.listPracticeResults('clf-c02');
    expect(results).toHaveLength(1);
    expect(results[0]?.questionId).toBe(single.id);
    const progress = await repository.getCertProgress('clf-c02');
    expect(progress.find((row) => row.domainId === 1)).toMatchObject({
      attempted: 1,
      correct: 1,
    });
    const mastery = await repository.getQuestionMastery('clf-c02');
    expect(mastery.find((row) => row.questionId === single.id)).toMatchObject({
      correctStreak: 1,
    });
  });

  it('keeps the session resumable and raises a typed error when the completion commit fails', async () => {
    let shouldFail = false;
    const flaky = Object.create(repository) as StudyRepository;
    flaky.commitAnswers = (input: CommitAnswersInput) =>
      shouldFail
        ? Promise.reject(new StorageWriteError('injected storage failure'))
        : repository.commitAnswers(input);
    const service = freshService(flaky);
    await service.start('clf-c02', 1, 10, { random: IDENTITY });
    // Answers must land, so only the completion commit is failed: answer
    // first, then arm the failure.
    const first = service.questions()[0];
    if (!first) {
      throw new Error('expected a session question');
    }
    await answerCorrectly(service, first);
    shouldFail = true;

    await expect(service.complete()).rejects.toBeInstanceOf(PracticeSaveError);

    expect(service.isActive()).toBe(true);
    expect(await repository.listAttempts({ cert: 'clf-c02', kind: 'practice' })).toHaveLength(0);
    expect(await repository.getSession('clf-c02', 'practice')).not.toBeNull();

    shouldFail = false;
    const completion = await service.complete();
    expect(await repository.getAttempt(completion.attempt.id)).not.toBeNull();
    expect(await repository.getSession('clf-c02', 'practice')).toBeNull();
  });

  it('surfaces a retryable load error when the history cannot be read at start', async () => {
    let shouldFail = true;
    const flaky = Object.create(repository) as StudyRepository;
    flaky.getQuestionMastery = (cert: string) =>
      shouldFail
        ? Promise.reject(new StorageWriteError('injected storage failure'))
        : repository.getQuestionMastery(cert);
    const service = freshService(flaky);

    await expect(
      service.start('test-practice', 1, 10, { cert: PRACTICE_CERT, bank: PRACTICE_BANK }),
    ).rejects.toBeInstanceOf(PracticeLoadError);
    expect(service.isActive()).toBe(false);

    shouldFail = false;
    await service.start('test-practice', 1, 10, { cert: PRACTICE_CERT, bank: PRACTICE_BANK });
    expect(service.isActive()).toBe(true);
  });

  it('surfaces a retryable load error when the domain bank cannot be loaded', async () => {
    const service = freshService();
    // The synthetic cert has no bundled bank, so the loader itself fails.
    await expect(service.start('test-practice', 1, 10, { cert: PRACTICE_CERT })).rejects.toBeInstanceOf(
      PracticeLoadError,
    );
    expect(service.isActive()).toBe(false);
    expect(await repository.getSession('test-practice', 'practice')).toBeNull();
  });
});

describe('session kind isolation (S14, log L4)', () => {
  it('never reads or writes a mock or study session row for the same cert', async () => {
    const siblingRow = (kind: 'mock' | 'study'): SessionRow => ({
      id: `test-practice:${kind}`,
      cert: 'test-practice',
      kind,
      questionOrder: ['p-01'],
      currentIndex: 0,
      answers: { 'p-01': 'B' },
      feedbackShown: [],
      flagged: ['p-01'],
      optionKeyMaps: {},
      startedAt: 123,
      deadlineAt: kind === 'mock' ? 456 : null,
      answeredCount: 1,
      correctCount: 0,
      wrongCount: 0,
      updatedAt: 123,
    });
    const mockRow = siblingRow('mock');
    const studyRow = siblingRow('study');
    await repository.putSession(mockRow);
    await repository.putSession(studyRow);

    const service = freshService();
    await service.start('test-practice', 1, 10, {
      cert: PRACTICE_CERT,
      bank: PRACTICE_BANK,
      random: IDENTITY,
    });
    await answerCorrectly(service, service.questions()[0]);
    await service.complete();
    await service.start('test-practice', 1, 10, {
      cert: PRACTICE_CERT,
      bank: PRACTICE_BANK,
      random: IDENTITY,
    });
    await service.discard();

    expect(await repository.getSession('test-practice', 'mock')).toEqual(mockRow);
    expect(await repository.getSession('test-practice', 'study')).toEqual(studyRow);
  });
});

describe('discard (S4)', () => {
  it('removes the saved session without recording history, including from a fresh instance', async () => {
    const first = freshService();
    expect(await first.hasInProgress('test-practice')).toBe(false);
    await first.start('test-practice', 1, 10, {
      cert: PRACTICE_CERT,
      bank: PRACTICE_BANK,
      random: IDENTITY,
    });
    await first.answer(first.questions()[0].id, 'B');
    expect(await repository.getSession('test-practice', 'practice')).not.toBeNull();

    const fresh = freshService();
    await fresh.discard('test-practice');

    expect(fresh.isActive()).toBe(false);
    expect(await repository.getSession('test-practice', 'practice')).toBeNull();
    expect(await repository.listAttempts({ cert: 'test-practice' })).toHaveLength(0);
    expect(await repository.listPracticeResults('test-practice')).toHaveLength(1);
    expect(await fresh.resume('test-practice')).toBe(false);
  });
});
