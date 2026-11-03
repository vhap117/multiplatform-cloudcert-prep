import 'fake-indexeddb/auto';

import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Certification } from '../../../core/content/cert-registry';
import { questionType, type Question } from '../../../core/content/question-types';
import { correctAnswerFor } from '../../../core/exam';
import { StorageWriteError } from '../../../core/storage/errors';
import { createStudyRepository } from '../../../core/storage/repository-provider';
import { STUDY_REPOSITORY } from '../../../core/storage/repository-provider';
import type { StudyRepository } from '../../../core/storage/study-repository';
import type { CommitAnswersInput, SessionRow } from '../../../core/storage/types';

import { StudyExamSaveError, StudyExamSessionError } from './study-exam-session.errors';
import { StudyExamSessionService } from './study-exam-session.service';

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
function freshService(repo: StudyRepository = repository): StudyExamSessionService {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: STUDY_REPOSITORY, useValue: repo }],
  });
  return TestBed.inject(StudyExamSessionService);
}

/** Pin the wall clock without freezing the IndexedDB event loop. */
function at(ms: number): void {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(ms);
}

/** Randomness pinned so every shuffle is the identity: display keys equal bank keys. */
const IDENTITY = () => 0.99;

function questionById(service: StudyExamSessionService, id: string): Question {
  const question = service.questions().find((candidate) => candidate.id === id);
  if (!question) {
    throw new Error(`question ${id} is not in the active exam`);
  }
  return question;
}

function correctList(question: Question): string[] {
  const correct = correctAnswerFor(question);
  return Array.isArray(correct) ? correct : [correct];
}

/** The bar invariant: correct plus wrong always equals answered (S7). */
function expectConsistentCounts(service: StudyExamSessionService): void {
  expect(service.correctCount() + service.wrongCount()).toBe(service.answeredCount());
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
async function gradeCorrectly(service: StudyExamSessionService, question: Question): Promise<void> {
  await service.answer(question.id, correctAnswerFor(question));
  if (!isSingle(question)) {
    await service.submitAnswer(question.id);
  }
}

/** Grade a question incorrectly through the public flow for its type. */
async function gradeWrongly(service: StudyExamSessionService, question: Question): Promise<void> {
  await service.answer(question.id, wrongValueFor(question));
  if (!isSingle(question)) {
    await service.submitAnswer(question.id);
  }
}

/** Save an incomplete draft; a single cannot draft because selection grades. */
async function saveDraft(service: StudyExamSessionService, question: Question): Promise<void> {
  if (isSingle(question)) {
    return;
  }
  await service.answer(question.id, correctList(question).slice(0, 1));
}

function explanation(options: Record<string, string>): Question['explanation'] {
  const perOption: Record<string, string> = {};
  for (const key of Object.keys(options)) {
    perOption[key] = `Note on ${key}.`;
  }
  return { summary: 'Summary.', options: perOption };
}

const SINGLE_OPTIONS = { A: 'Alpha', B: 'Beta', C: 'Gamma', D: 'Delta' };
const ORDER_OPTIONS = { A: 'First step', B: 'Second step', C: 'Third step', D: 'Fourth step' };
const MATCH_OPTIONS = { A: 'Left one', B: 'Left two', C: 'Left three', D: 'Left four' };
const MATCH_TARGETS = { 1: 'Right one', 2: 'Right two', 3: 'Right three', 4: 'Right four' };

function singleQuestion(id: string, domainId = 1): Question {
  return {
    id,
    domainId,
    isMultiAnswer: false,
    question: `Pick one for ${id}.`,
    options: { ...SINGLE_OPTIONS },
    answer: 'B',
    explanation: explanation(SINGLE_OPTIONS),
  };
}

/** One question of each response format, all in a single domain. */
const TYPES_BANK: Question[] = [
  singleQuestion('t-single'),
  {
    id: 't-multi',
    domainId: 1,
    isMultiAnswer: true,
    question: 'Pick two.',
    options: { ...SINGLE_OPTIONS },
    answer: ['A', 'C'],
    explanation: explanation(SINGLE_OPTIONS),
  },
  {
    id: 't-order',
    domainId: 1,
    isMultiAnswer: false,
    type: 'ordering',
    question: 'Order the steps.',
    options: { ...ORDER_OPTIONS },
    correctOrder: ['B', 'A', 'D', 'C'],
    explanation: explanation(ORDER_OPTIONS),
  },
  {
    id: 't-match',
    domainId: 1,
    isMultiAnswer: false,
    type: 'matching',
    question: 'Match the pairs.',
    options: { ...MATCH_OPTIONS },
    targets: { ...MATCH_TARGETS },
    correctMatches: { A: '2', B: '1', C: '4', D: '3' },
    explanation: explanation(MATCH_OPTIONS),
  },
];

const TYPES_CERT: Certification = {
  code: 'test-types',
  provider: 'aws',
  level: 'foundational',
  name: 'Types Test Cert',
  shortName: 'TYPES',
  examQuestionCount: 4,
  examTimeSeconds: 3600,
  passingScore: 700,
  status: 'active',
  domains: [{ id: 1, name: 'Everything', questionCount: 4, examProportion: 1 }],
};

/**
 * Three domains where the middle one contributes nothing to the composition:
 * two questions total, one from domain 1 and the remainder from domain 3.
 */
const SPARSE_CERT: Certification = {
  code: 'test-sparse',
  provider: 'aws',
  level: 'foundational',
  name: 'Sparse Test Cert',
  shortName: 'SPARSE',
  examQuestionCount: 2,
  examTimeSeconds: 3600,
  passingScore: 700,
  status: 'active',
  domains: [
    { id: 1, name: 'One', questionCount: 1, examProportion: 0.5 },
    { id: 2, name: 'Two', questionCount: 2, examProportion: 0 },
    { id: 3, name: 'Three', questionCount: 1, examProportion: 0.5 },
  ],
};

const SPARSE_BANK: Question[] = [
  singleQuestion('s-1', 1),
  singleQuestion('s-2a', 2),
  singleQuestion('s-2b', 2),
  singleQuestion('s-3', 3),
];

describe('StudyExamSessionService', () => {
  describe('start (S1, S2)', () => {
    it('persists the session with its option key maps before the first question is exposed', async () => {
      at(5_000_000);
      const service = freshService();
      let exposedDuringPersist: boolean | null = null;
      const original = repository.putSession.bind(repository);
      vi.spyOn(repository, 'putSession').mockImplementation(async (row) => {
        exposedDuringPersist = service.isActive() || service.currentQuestion() !== null;
        await original(row);
      });

      await service.start('test-types', { cert: TYPES_CERT, bank: TYPES_BANK, random: IDENTITY });

      expect(exposedDuringPersist).toBe(false);
      const stored = await repository.getSession('test-types', 'study');
      expect(stored).not.toBeNull();
      expect(stored?.kind).toBe('study');
      // S1: untimed, so there is no deadline anywhere in the mode.
      expect(stored?.deadlineAt).toBeNull();
      expect(stored?.questionOrder).toEqual(['t-single', 't-multi', 't-order', 't-match']);
      expect(Object.keys(stored?.optionKeyMaps ?? {}).sort()).toEqual([
        't-match',
        't-multi',
        't-order',
        't-single',
      ]);
      expect(stored?.currentIndex).toBe(0);
      expect(stored?.answers).toEqual({});
      expect(stored?.feedbackShown).toEqual([]);
      expect(stored?.flagged).toEqual([]);
      expect(stored?.answeredCount).toBe(0);
      expect(stored?.correctCount).toBe(0);
      expect(stored?.wrongCount).toBe(0);
      expect(stored?.startedAt).toBe(5_000_000);
      expect(service.totalQuestions()).toBe(4);
      expect(service.currentQuestion()?.id).toBe('t-single');
    });

    it('refuses an unknown cert or a bank that cannot fill the composition', async () => {
      const service = freshService();

      await expect(service.start('no-such-cert')).rejects.toBeInstanceOf(StudyExamSessionError);
      await expect(
        service.start('test-types', { cert: TYPES_CERT, bank: TYPES_BANK.slice(0, 2) }),
      ).rejects.toBeInstanceOf(StudyExamSessionError);

      expect(await repository.listSessions()).toHaveLength(0);
      expect(service.isActive()).toBe(false);
    });
  });

  describe('immediate grading (S3, S8)', () => {
    it('grades a single answer on selection and persists it in the same write', async () => {
      const service = freshService();
      await service.start('test-types', { cert: TYPES_CERT, bank: TYPES_BANK, random: IDENTITY });
      const single = questionById(service, 't-single');
      expect(service.isGraded(single.id)).toBe(false);

      await service.answer(single.id, correctAnswerFor(single));

      expect(service.isGraded(single.id)).toBe(true);
      expect(service.isCorrect(single.id)).toBe(true);
      expect(service.answeredCount()).toBe(1);
      expect(service.correctCount()).toBe(1);
      expect(service.wrongCount()).toBe(0);
      const stored = await repository.getSession('test-types', 'study');
      expect(stored?.answers[single.id]).toBe('B');
      expect(stored?.feedbackShown).toEqual([single.id]);
      expect(stored?.answeredCount).toBe(1);
      expect(stored?.correctCount).toBe(1);
      expect(stored?.wrongCount).toBe(0);
      expectConsistentCounts(service);
    });

    it('grades multi, ordering, and matching only on explicit submit of a complete response', async () => {
      const service = freshService();
      await service.start('test-types', { cert: TYPES_CERT, bank: TYPES_BANK, random: IDENTITY });
      const multi = questionById(service, 't-multi');

      // A partial response persists as a draft but is neither answered nor graded.
      await service.answer(multi.id, ['A']);
      expect(service.isAnswered(multi.id)).toBe(false);
      expect(service.isGraded(multi.id)).toBe(false);
      await expect(service.submitAnswer(multi.id)).rejects.toBeInstanceOf(StudyExamSessionError);
      expect(service.isGraded(multi.id)).toBe(false);
      const stored = await repository.getSession('test-types', 'study');
      expect(stored?.answers[multi.id]).toBe('A');
      expect(stored?.answeredCount).toBe(0);

      // A complete response alone still does not grade; the explicit submit does.
      await service.answer(multi.id, ['A', 'C']);
      expect(service.isAnswered(multi.id)).toBe(true);
      expect(service.isGraded(multi.id)).toBe(false);
      expect(service.answeredCount()).toBe(0);

      await service.submitAnswer(multi.id);
      expect(service.isGraded(multi.id)).toBe(true);
      expect(service.isCorrect(multi.id)).toBe(true);
      expect(service.answeredCount()).toBe(1);
      expectConsistentCounts(service);

      const ordering = questionById(service, 't-order');
      await service.answer(ordering.id, ['B', 'A', 'D']);
      await expect(service.submitAnswer(ordering.id)).rejects.toBeInstanceOf(StudyExamSessionError);
      await service.answer(ordering.id, ['B', 'A', 'D', 'C']);
      await service.submitAnswer(ordering.id);
      expect(service.isCorrect(ordering.id)).toBe(true);

      const matching = questionById(service, 't-match');
      await service.answer(matching.id, ['A:2', 'B:1', 'C:4']);
      await expect(service.submitAnswer(matching.id)).rejects.toBeInstanceOf(StudyExamSessionError);
      await service.answer(matching.id, ['A:2', 'B:1', 'C:4', 'D:3']);
      await service.submitAnswer(matching.id);
      expect(service.isCorrect(matching.id)).toBe(true);

      expect(service.answeredCount()).toBe(3);
      expect(service.correctCount()).toBe(3);
      expectConsistentCounts(service);
    });

    it('rejects submitting a single-choice question because it grades on selection', async () => {
      const service = freshService();
      await service.start('test-types', { cert: TYPES_CERT, bank: TYPES_BANK, random: IDENTITY });

      await expect(service.submitAnswer('t-single')).rejects.toBeInstanceOf(StudyExamSessionError);
    });
  });

  describe('feedback (S4)', () => {
    it('produces the summary plus the wrong-chosen and missed-correct explanations', async () => {
      const service = freshService();
      await service.start('test-types', { cert: TYPES_CERT, bank: TYPES_BANK, random: IDENTITY });
      const single = questionById(service, 't-single');

      await service.answer(single.id, 'A');

      const feedback = service.feedbackFor(single.id);
      expect(feedback?.questionId).toBe(single.id);
      expect(feedback?.isCorrect).toBe(false);
      expect(feedback?.summary).toBe(single.explanation.summary);
      expect(feedback?.options).toEqual([
        { key: 'A', text: 'Note on A.', kind: 'chosen-wrong' },
        { key: 'B', text: 'Note on B.', kind: 'missed-correct' },
      ]);
    });

    it('covers both sets for a partial multi selection', async () => {
      const service = freshService();
      await service.start('test-types', { cert: TYPES_CERT, bank: TYPES_BANK, random: IDENTITY });
      const multi = questionById(service, 't-multi');

      await service.answer(multi.id, ['A', 'B']);
      await service.submitAnswer(multi.id);

      const feedback = service.feedbackFor(multi.id);
      expect(feedback?.isCorrect).toBe(false);
      expect(feedback?.summary).toBe(multi.explanation.summary);
      expect(feedback?.options).toEqual([
        { key: 'B', text: 'Note on B.', kind: 'chosen-wrong' },
        { key: 'C', text: 'Note on C.', kind: 'missed-correct' },
        { key: 'A', text: 'Note on A.', kind: 'correct-chosen' },
      ]);
    });

    it('returns the summary with correct-chosen explanations for a fully correct answer', async () => {
      const service = freshService();
      await service.start('test-types', { cert: TYPES_CERT, bank: TYPES_BANK, random: IDENTITY });
      const single = questionById(service, 't-single');

      await service.answer(single.id, 'B');

      const feedback = service.feedbackFor(single.id);
      expect(feedback?.isCorrect).toBe(true);
      expect(feedback?.summary).toBe(single.explanation.summary);
      expect(feedback?.options).toEqual([{ key: 'B', text: 'Note on B.', kind: 'correct-chosen' }]);
    });

    it('tags ordering and matching options by position and pairing', async () => {
      const service = freshService();
      await service.start('test-types', { cert: TYPES_CERT, bank: TYPES_BANK, random: IDENTITY });

      const ordering = questionById(service, 't-order');
      await service.answer(ordering.id, ['B', 'A', 'C', 'D']);
      await service.submitAnswer(ordering.id);
      expect(service.feedbackFor(ordering.id)?.options).toEqual([
        { key: 'C', text: 'Note on C.', kind: 'chosen-wrong' },
        { key: 'D', text: 'Note on D.', kind: 'chosen-wrong' },
        { key: 'D', text: 'Note on D.', kind: 'missed-correct' },
        { key: 'C', text: 'Note on C.', kind: 'missed-correct' },
        { key: 'B', text: 'Note on B.', kind: 'correct-chosen' },
        { key: 'A', text: 'Note on A.', kind: 'correct-chosen' },
      ]);

      const matching = questionById(service, 't-match');
      await service.answer(matching.id, ['A:1', 'B:2', 'C:4', 'D:3']);
      await service.submitAnswer(matching.id);
      expect(service.feedbackFor(matching.id)?.options).toEqual([
        { key: 'A', text: 'Note on A.', kind: 'chosen-wrong' },
        { key: 'B', text: 'Note on B.', kind: 'chosen-wrong' },
        { key: 'A', text: 'Note on A.', kind: 'missed-correct' },
        { key: 'B', text: 'Note on B.', kind: 'missed-correct' },
        { key: 'C', text: 'Note on C.', kind: 'correct-chosen' },
        { key: 'D', text: 'Note on D.', kind: 'correct-chosen' },
      ]);
    });

    it('returns null feedback for an ungraded or unknown question', async () => {
      const service = freshService();
      await service.start('test-types', { cert: TYPES_CERT, bank: TYPES_BANK, random: IDENTITY });

      expect(service.feedbackFor('t-single')).toBeNull();
      expect(service.feedbackFor('no-such-question')).toBeNull();
      expect(service.isCorrect('t-single')).toBeNull();
    });
  });

  describe('read-only graded questions (S5)', () => {
    it('refuses to change a graded question and keeps the recorded answer', async () => {
      const service = freshService();
      await service.start('test-types', { cert: TYPES_CERT, bank: TYPES_BANK, random: IDENTITY });
      const single = questionById(service, 't-single');
      await service.answer(single.id, 'A');

      await expect(service.answer(single.id, 'B')).rejects.toBeInstanceOf(StudyExamSessionError);
      await expect(service.submitAnswer(single.id)).rejects.toBeInstanceOf(StudyExamSessionError);

      expect(service.answerFor(single.id)).toBe('A');
      expect(service.isCorrect(single.id)).toBe(false);
      const stored = await repository.getSession('test-types', 'study');
      expect(stored?.answers[single.id]).toBe('A');
    });

    it('refuses to re-submit an already graded multi question', async () => {
      const service = freshService();
      await service.start('test-types', { cert: TYPES_CERT, bank: TYPES_BANK, random: IDENTITY });
      const multi = questionById(service, 't-multi');
      await service.answer(multi.id, ['A', 'C']);
      await service.submitAnswer(multi.id);

      await expect(service.answer(multi.id, ['A', 'B'])).rejects.toBeInstanceOf(
        StudyExamSessionError,
      );
      await expect(service.submitAnswer(multi.id)).rejects.toBeInstanceOf(StudyExamSessionError);

      expect(service.answerFor(multi.id)).toEqual(['A', 'C']);
      expect(service.isCorrect(multi.id)).toBe(true);
    });
  });

  // Resume requires a bundled cert (`getCert`), exactly like the mock exam,
  // so these tests run against the real CLF-C02 bank.
  describe('resume (S7, S9)', () => {
    it('restores order, position, answers, feedback, and all three counts on a fresh instance', async () => {
      const first = freshService();
      await first.start('clf-c02');
      const [correctQuestion, wrongQuestion, draftQuestion] = first.questions();
      if (!correctQuestion || !wrongQuestion || !draftQuestion) {
        throw new Error('expected at least three questions');
      }
      // One correct, one wrong, one ungraded draft, then move position.
      await gradeCorrectly(first, correctQuestion);
      await gradeWrongly(first, wrongQuestion);
      await saveDraft(first, draftQuestion);
      await first.goTo(2);
      const rowBefore = await repository.getSession('clf-c02', 'study');

      const second = freshService();
      expect(await second.resume('clf-c02')).toBe(true);

      // Exact question order and display space, rebuilt from the stored key maps.
      expect(second.questions().map((question) => [question.id, question.options])).toEqual(
        first.questions().map((question) => [question.id, question.options]),
      );
      expect(second.currentIndex()).toBe(2);
      // Resume writes nothing, so nothing can be re-graded or duplicated.
      expect(await repository.getSession('clf-c02', 'study')).toEqual(rowBefore);

      expect(second.isGraded(correctQuestion.id)).toBe(true);
      expect(second.isCorrect(correctQuestion.id)).toBe(true);
      expect(second.answerFor(correctQuestion.id)).toEqual(first.answerFor(correctQuestion.id));
      expect(second.feedbackFor(correctQuestion.id)).toEqual(first.feedbackFor(correctQuestion.id));
      expect(second.isGraded(wrongQuestion.id)).toBe(true);
      expect(second.isCorrect(wrongQuestion.id)).toBe(false);
      expect(second.feedbackFor(wrongQuestion.id)).toEqual(first.feedbackFor(wrongQuestion.id));
      // The draft comes back ungraded and editable.
      expect(second.isGraded(draftQuestion.id)).toBe(false);
      if (isSingle(draftQuestion)) {
        expect(second.answerFor(draftQuestion.id)).toBeNull();
      } else {
        expect(second.answerFor(draftQuestion.id)).toEqual(correctList(draftQuestion).slice(0, 1));
      }

      expect(second.answeredCount()).toBe(2);
      expect(second.correctCount()).toBe(1);
      expect(second.wrongCount()).toBe(1);
      expect(second.domainTallies()).toEqual(first.domainTallies());
      expectConsistentCounts(second);
    });

    it('keeps correct plus wrong equal to answered after every answer and after resume', async () => {
      const first = freshService();
      await first.start('clf-c02');
      const answered = first.questions().slice(0, 6);
      for (const [index, question] of answered.entries()) {
        if (index % 2 === 0) {
          await gradeCorrectly(first, question);
        } else {
          await gradeWrongly(first, question);
        }
        expectConsistentCounts(first);
      }
      const before = {
        answered: first.answeredCount(),
        correct: first.correctCount(),
        wrong: first.wrongCount(),
      };

      const second = freshService();
      expect(await second.resume('clf-c02')).toBe(true);
      expect(second.answeredCount()).toBe(before.answered);
      expect(second.correctCount()).toBe(before.correct);
      expect(second.wrongCount()).toBe(before.wrong);
      expect(second.domainTallies()).toEqual(first.domainTallies());
      expectConsistentCounts(second);
    });

    it('shuffles a new session fresh while a resumed session keeps its saved order', async () => {
      const first = freshService();
      await first.start('clf-c02', { random: IDENTITY });
      const identityOrder = (await repository.getSession('clf-c02', 'study'))?.questionOrder;

      const second = freshService();
      await second.start('clf-c02', { random: () => 0 });
      const shuffledOrder = (await repository.getSession('clf-c02', 'study'))?.questionOrder;
      // Fresh randomness composes a fresh exam; only the length is fixed (S2).
      expect(shuffledOrder).not.toEqual(identityOrder);
      expect(shuffledOrder).toHaveLength(identityOrder?.length ?? 0);

      const resumed = freshService();
      expect(await resumed.resume('clf-c02')).toBe(true);
      expect(resumed.questions().map((question) => question.id)).toEqual(shuffledOrder);
      expect(resumed.questions().map((question) => question.options)).toEqual(
        second.questions().map((question) => question.options),
      );
    });
  });

  describe('failed writes (S8)', () => {
    it('surfaces a typed error and does not advance when an answer write fails', async () => {
      let shouldFail = false;
      const flaky = Object.create(repository) as StudyRepository;
      flaky.putSession = (row: SessionRow) =>
        shouldFail
          ? Promise.reject(new StorageWriteError('injected storage failure'))
          : repository.putSession(row);
      const service = freshService(flaky);
      await service.start('test-types', { cert: TYPES_CERT, bank: TYPES_BANK, random: IDENTITY });
      const single = questionById(service, 't-single');

      shouldFail = true;
      await expect(service.answer(single.id, 'B')).rejects.toBeInstanceOf(StudyExamSaveError);

      // Nothing advanced: not in memory, not in storage.
      expect(service.isGraded(single.id)).toBe(false);
      expect(service.answerFor(single.id)).toBeNull();
      expect(service.answeredCount()).toBe(0);
      const stored = await repository.getSession('test-types', 'study');
      expect(stored?.answers[single.id]).toBeUndefined();
      expect(stored?.feedbackShown).toEqual([]);
      expect(stored?.answeredCount).toBe(0);

      shouldFail = false;
      await service.answer(single.id, 'B');
      expect(service.isGraded(single.id)).toBe(true);
      expect(service.answeredCount()).toBe(1);
      expectConsistentCounts(service);
    });

    it('keeps the session resumable and raises a typed error when the completion commit fails', async () => {
      let shouldFail = true;
      const flaky = Object.create(repository) as StudyRepository;
      flaky.commitAnswers = (input: CommitAnswersInput) =>
        shouldFail
          ? Promise.reject(new StorageWriteError('injected storage failure'))
          : repository.commitAnswers(input);
      const service = freshService(flaky);
      await service.start('test-types', { cert: TYPES_CERT, bank: TYPES_BANK, random: IDENTITY });
      await service.answer('t-single', 'B');

      await expect(service.complete()).rejects.toBeInstanceOf(StudyExamSaveError);

      expect(service.isActive()).toBe(true);
      expect(await repository.listAttempts({ cert: 'test-types' })).toHaveLength(0);
      expect(await repository.getSession('test-types', 'study')).not.toBeNull();

      shouldFail = false;
      const attempt = await service.complete();
      expect(await repository.getAttempt(attempt.id)).not.toBeNull();
      expect(await repository.getSession('test-types', 'study')).toBeNull();
    });
  });

  describe('complete (S10, S11)', () => {
    it('commits one transaction, clears the session, and returns mock-shaped rows', async () => {
      at(4_000_000);
      const service = freshService();
      await service.start('test-types', { cert: TYPES_CERT, bank: TYPES_BANK, random: IDENTITY });
      // Correct single, partial multi draft left ungraded, wrong ordering, correct matching.
      await service.answer('t-single', 'B');
      await service.answer('t-multi', ['A']);
      await service.answer('t-order', ['B', 'A', 'C', 'D']);
      await service.submitAnswer('t-order');
      await service.answer('t-match', ['A:2', 'B:1', 'C:4', 'D:3']);
      await service.submitAnswer('t-match');

      at(4_000_000 + 95_000);
      const commitSpy = vi.spyOn(repository, 'commitAnswers');
      const attempt = await service.complete();

      expect(commitSpy).toHaveBeenCalledTimes(1);
      const input = commitSpy.mock.calls[0]?.[0];
      if (!input) {
        throw new Error('expected one commit call');
      }
      expect(input.clearSession).toEqual({ cert: 'test-types', kind: 'study' });
      expect(input.attempt?.id).toBe(attempt.id);
      expect(input.results).toHaveLength(4);
      expect(input.mastery).toHaveLength(4);
      expect(input.progress).toHaveLength(1);

      expect(attempt).toMatchObject({
        id: 'test-types:study:4000000',
        cert: 'test-types',
        kind: 'study',
        startedAt: 4_000_000,
        finishedAt: 4_095_000,
        totalQuestions: 4,
        correctCount: 2,
        scorePercent: 50,
        scaledScore: 550,
        passed: false,
        timeTakenSeconds: 95,
        domainScores: [{ domainId: 1, correct: 2, total: 4, percent: 50 }],
      });

      const resultsById = new Map(input.results.map((row) => [row.questionId, row]));
      expect(resultsById.get('t-single')).toMatchObject({
        id: 'test-types:study:4000000:t-single',
        attemptId: attempt.id,
        userAnswer: 'B',
        correctAnswer: 'B',
        isCorrect: true,
        wasFlagged: false,
        answeredAt: 4_095_000,
      });
      // The ungraded partial draft completes as incorrect, all-or-nothing.
      expect(resultsById.get('t-multi')).toMatchObject({
        userAnswer: 'A',
        correctAnswer: 'A,C',
        isCorrect: false,
      });
      expect(resultsById.get('t-order')).toMatchObject({
        userAnswer: 'B,A,C,D',
        correctAnswer: 'B,A,D,C',
        isCorrect: false,
      });
      expect(resultsById.get('t-match')).toMatchObject({
        userAnswer: 'A:2,B:1,C:4,D:3',
        correctAnswer: 'A:2,B:1,C:4,D:3',
        isCorrect: true,
      });

      // Mastery rows carry an engine band weight, never null (issue 005 log L2).
      expect(input.mastery.every((row) => row.weight !== null)).toBe(true);
      expect(input.mastery.find((row) => row.questionId === 't-single')).toMatchObject({
        correctStreak: 1,
        lastWasWrong: false,
      });
      expect(input.mastery.find((row) => row.questionId === 't-multi')).toMatchObject({
        correctStreak: 0,
        lastWasWrong: true,
      });

      expect(input.progress[0]).toMatchObject({
        id: 'test-types:1',
        cert: 'test-types',
        domainId: 1,
        attempted: 4,
        correct: 2,
        updatedAt: 4_095_000,
      });

      expect(await repository.getSession('test-types', 'study')).toBeNull();
      expect(await repository.getAttempt(attempt.id)).not.toBeNull();
      const storedResults = await repository.listQuestionResults(attempt.id);
      expect(storedResults).toHaveLength(4);
      expect(service.isActive()).toBe(false);
    });

    it('stops being resumable once completed and stays distinguishable by kind', async () => {
      const service = freshService();
      await service.start('test-types', { cert: TYPES_CERT, bank: TYPES_BANK, random: IDENTITY });
      await service.answer('t-single', 'B');

      await service.complete();

      const fresh = freshService();
      expect(await fresh.resume('test-types')).toBe(false);
      expect(await fresh.hasInProgress('test-types')).toBe(false);
      const attempts = await repository.listAttempts({ cert: 'test-types' });
      expect(attempts).toHaveLength(1);
      expect(attempts[0]?.kind).toBe('study');
    });

    it('never fabricates 0 percent for a domain the session did not ask', async () => {
      const service = freshService();
      await service.start('test-sparse', { cert: SPARSE_CERT, bank: SPARSE_BANK, random: IDENTITY });
      expect(service.totalQuestions()).toBe(2);

      // The unasked domain reports honest zero counts, never a percentage.
      expect(service.domainTallies()).toEqual([
        { domainId: 1, answered: 0, correct: 0, wrong: 0 },
        { domainId: 2, answered: 0, correct: 0, wrong: 0 },
        { domainId: 3, answered: 0, correct: 0, wrong: 0 },
      ]);

      for (const question of service.questions()) {
        await service.answer(question.id, correctAnswerFor(question));
      }
      const attempt = await service.complete();

      expect(attempt.domainScores).toEqual([
        { domainId: 1, correct: 1, total: 1, percent: 100 },
        { domainId: 3, correct: 1, total: 1, percent: 100 },
      ]);
    });
  });

  describe('session kind isolation (S12)', () => {
    it('never touches a mock exam session for the same cert', async () => {
      const mockRow: SessionRow = {
        id: 'test-types:mock',
        cert: 'test-types',
        kind: 'mock',
        questionOrder: ['t-single'],
        currentIndex: 0,
        answers: { 't-single': 'B' },
        feedbackShown: [],
        flagged: ['t-single'],
        optionKeyMaps: {},
        startedAt: 123,
        deadlineAt: 456,
        answeredCount: 1,
        correctCount: 0,
        wrongCount: 0,
        updatedAt: 123,
      };
      await repository.putSession(mockRow);

      const service = freshService();
      await service.start('test-types', { cert: TYPES_CERT, bank: TYPES_BANK, random: IDENTITY });
      await service.answer('t-single', 'B');
      await service.complete();
      await service.start('test-types', { cert: TYPES_CERT, bank: TYPES_BANK, random: IDENTITY });
      await service.discard();

      expect(await repository.getSession('test-types', 'mock')).toEqual(mockRow);
    });
  });

  describe('discard (S10)', () => {
    it('removes the saved session without recording history', async () => {
      const service = freshService();
      expect(await service.hasInProgress('test-types')).toBe(false);
      await service.start('test-types', { cert: TYPES_CERT, bank: TYPES_BANK, random: IDENTITY });
      await service.answer('t-single', 'B');
      expect(await repository.getSession('test-types', 'study')).not.toBeNull();

      await service.discard();

      expect(service.isActive()).toBe(false);
      expect(await repository.getSession('test-types', 'study')).toBeNull();
      expect(await repository.listAttempts({ cert: 'test-types' })).toHaveLength(0);
      const fresh = freshService();
      expect(await fresh.resume('test-types')).toBe(false);
      expect(await fresh.hasInProgress('test-types')).toBe(false);
    });
  });
});
