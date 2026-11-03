import 'fake-indexeddb/auto';

import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Certification } from '../../../core/content/cert-registry';
import { questionType, type Question } from '../../../core/content/question-types';
import {
  LEARNING_WEIGHT_MAX,
  correctAnswerFor,
  decodeAnswerForDb,
} from '../../../core/exam';
import { StorageWriteError } from '../../../core/storage/errors';
import { createStudyRepository } from '../../../core/storage/repository-provider';
import { STUDY_REPOSITORY } from '../../../core/storage/repository-provider';
import type { StudyRepository } from '../../../core/storage/study-repository';
import type { CommitAnswersInput } from '../../../core/storage/types';

import { MockExamCommitError, MockExamSessionError } from './mock-exam-session.errors';
import { MockExamSessionService } from './mock-exam-session.service';

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
function freshService(repo: StudyRepository = repository): MockExamSessionService {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: STUDY_REPOSITORY, useValue: repo }],
  });
  return TestBed.inject(MockExamSessionService);
}

/** Pin the wall clock without freezing the IndexedDB event loop. */
function at(ms: number): void {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(ms);
}

function questionById(service: MockExamSessionService, id: string): Question {
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

function singleQuestion(id: string): Question {
  return {
    id,
    domainId: 1,
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

/** Three of four singles are drawn, so exactly two correct land a scaled 700. */
const THRESHOLD_BANK: Question[] = [
  singleQuestion('t-1'),
  singleQuestion('t-2'),
  singleQuestion('t-3'),
  singleQuestion('t-4'),
];

const THRESHOLD_CERT: Certification = {
  code: 'test-threshold',
  provider: 'aws',
  level: 'foundational',
  name: 'Threshold Test Cert',
  shortName: 'THRESH',
  examQuestionCount: 3,
  examTimeSeconds: 3600,
  passingScore: 700,
  status: 'active',
  domains: [{ id: 1, name: 'Only', questionCount: 4, examProportion: 1 }],
};

describe('MockExamSessionService', () => {
  describe('start (S1)', () => {
    it('persists the session before the first question is readable', async () => {
      at(5_000_000);
      const service = freshService();
      let exposedDuringPersist: boolean | null = null;
      const original = repository.putSession.bind(repository);
      vi.spyOn(repository, 'putSession').mockImplementation(async (row) => {
        exposedDuringPersist = service.isActive() || service.currentQuestion() !== null;
        await original(row);
      });

      await service.start('clf-c02');

      expect(exposedDuringPersist).toBe(false);
      const stored = await repository.getSession('clf-c02', 'mock');
      expect(stored).not.toBeNull();
      expect(stored?.questionOrder).toHaveLength(65);
      expect(stored?.currentIndex).toBe(0);
      expect(stored?.answeredCount).toBe(0);
      expect(stored?.deadlineAt).toBe(5_000_000 + 5400 * 1000);
      expect(service.totalQuestions()).toBe(65);
      expect(service.currentQuestion()).not.toBeNull();
    });

    it('refuses to start an exam the bundled bank cannot fill', async () => {
      const service = freshService();

      await expect(service.start('saa-c03')).rejects.toBeInstanceOf(MockExamSessionError);

      expect(await repository.getSession('saa-c03', 'mock')).toBeNull();
      expect(service.isActive()).toBe(false);
    });

    it('rejects an unknown cert code without touching storage', async () => {
      const service = freshService();

      await expect(service.start('no-such-cert')).rejects.toBeInstanceOf(MockExamSessionError);

      expect(await repository.listSessions()).toHaveLength(0);
    });
  });

  describe('answer capture (S2, S3)', () => {
    it('saves an answer the moment it is given, before any navigation', async () => {
      const service = freshService();
      await service.start('clf-c02');
      const question = service.currentQuestion();
      if (!question) {
        throw new Error('expected a first question');
      }
      const type = questionType(question);
      const answer = correctAnswerFor(question);

      await service.answer(question.id, answer);

      const stored = await repository.getSession('clf-c02', 'mock');
      expect(stored?.currentIndex).toBe(0);
      const persisted = stored?.answers[question.id];
      expect(persisted).toBeDefined();
      expect(decodeAnswerForDb(persisted ?? '', type)).toEqual(answer);
      expect(stored?.answeredCount).toBe(1);
      expect(service.answeredCount()).toBe(1);
    });

    it('counts multi, ordering, and matching responses as answered only when complete', async () => {
      const service = freshService();
      await service.start('test-types', { cert: TYPES_CERT, bank: TYPES_BANK });
      expect(service.totalQuestions()).toBe(4);

      const multi = questionById(service, 't-multi');
      const ordering = questionById(service, 't-order');
      const matching = questionById(service, 't-match');
      const single = questionById(service, 't-single');

      await service.answer(multi.id, correctList(multi).slice(0, 1));
      expect(service.isAnswered(multi.id)).toBe(false);
      let stored = await repository.getSession('test-types', 'mock');
      expect(stored?.answeredCount).toBe(0);
      // The partial response still persists so a resume restores it (S2).
      expect(stored?.answers[multi.id]).toBeDefined();

      await service.answer(multi.id, correctList(multi));
      expect(service.isAnswered(multi.id)).toBe(true);

      await service.answer(ordering.id, correctList(ordering).slice(0, 3));
      expect(service.isAnswered(ordering.id)).toBe(false);
      await service.answer(ordering.id, correctList(ordering));
      expect(service.isAnswered(ordering.id)).toBe(true);

      await service.answer(matching.id, correctList(matching).slice(0, 3));
      expect(service.isAnswered(matching.id)).toBe(false);
      await service.answer(matching.id, correctList(matching));
      expect(service.isAnswered(matching.id)).toBe(true);

      await service.answer(single.id, correctAnswerFor(single));
      expect(service.isAnswered(single.id)).toBe(true);

      stored = await repository.getSession('test-types', 'mock');
      expect(stored?.answeredCount).toBe(4);
      expect(service.answeredCount()).toBe(4);
    });

    it('grades all four types all-or-nothing and stores original bank keys', async () => {
      at(9_000_000);
      const service = freshService();
      await service.start('test-types', { cert: TYPES_CERT, bank: TYPES_BANK });

      await service.answer('t-single', correctAnswerFor(questionById(service, 't-single')));
      await service.answer('t-multi', correctList(questionById(service, 't-multi')));
      const ordered = correctList(questionById(service, 't-order'));
      await service.answer('t-order', [ordered[1], ordered[0], ordered[2], ordered[3]]);
      await service.answer('t-match', correctList(questionById(service, 't-match')));

      const attempt = await service.submit();
      expect(attempt.correctCount).toBe(3);
      expect(attempt.totalQuestions).toBe(4);

      const results = await repository.listQuestionResults(attempt.id);
      const byId = new Map(results.map((row) => [row.questionId, row]));

      const single = byId.get('t-single');
      expect(single?.isCorrect).toBe(true);
      expect(single?.userAnswer).toBe('B');
      expect(single?.correctAnswer).toBe('B');

      const multi = byId.get('t-multi');
      expect(multi?.isCorrect).toBe(true);
      expect(multi?.userAnswer.split(',').sort()).toEqual(['A', 'C']);
      expect(multi?.correctAnswer.split(',').sort()).toEqual(['A', 'C']);

      const ordering = byId.get('t-order');
      expect(ordering?.isCorrect).toBe(false);
      expect(ordering?.correctAnswer).toBe('B,A,D,C');

      const matching = byId.get('t-match');
      expect(matching?.isCorrect).toBe(true);
      expect(matching?.correctAnswer).toBe('A:2,B:1,C:4,D:3');
    });
  });

  describe('flags and navigation', () => {
    it('persists flag and unflag changes immediately', async () => {
      const service = freshService();
      await service.start('clf-c02');
      const question = service.questions()[0];

      await service.setFlag(question.id, true);
      let stored = await repository.getSession('clf-c02', 'mock');
      expect(stored?.flagged).toContain(question.id);
      expect(service.isFlagged(question.id)).toBe(true);
      expect(service.flaggedIds()).toEqual([question.id]);

      await service.setFlag(question.id, false);
      stored = await repository.getSession('clf-c02', 'mock');
      expect(stored?.flagged).not.toContain(question.id);
      expect(service.isFlagged(question.id)).toBe(false);
      expect(service.flaggedIds()).toEqual([]);
    });
  });

  describe('resume and wall-clock timing (S4)', () => {
    it('restores position, answers, flags, and remaining time on a fresh instance', async () => {
      at(2_000_000);
      const first = freshService();
      await first.start('clf-c02');
      const answered = first.questions()[0];
      const flagged = first.questions()[1];
      await first.answer(answered.id, correctAnswerFor(answered));
      await first.setFlag(flagged.id, true);
      await first.goTo(2);

      at(2_000_000 + 30 * 60 * 1000);
      const second = freshService();
      expect(await second.resume('clf-c02')).toBe(true);

      expect(second.currentIndex()).toBe(2);
      expect(second.questions().map((question) => [question.id, question.options])).toEqual(
        first.questions().map((question) => [question.id, question.options]),
      );
      expect(second.answerFor(answered.id)).toEqual(correctAnswerFor(answered));
      expect(second.isAnswered(answered.id)).toBe(true);
      expect(second.flaggedIds()).toEqual([flagged.id]);
      expect(second.isFlagged(flagged.id)).toBe(true);
      expect(second.answeredCount()).toBe(1);
      expect(second.remainingSeconds()).toBe(5400 - 30 * 60);
      expect(second.hasExpired()).toBe(false);
    });
  });

  describe('deadline expiry (S5)', () => {
    it('reports expiry once the deadline passed and produces results without a submit', async () => {
      at(3_000_000);
      const first = freshService();
      await first.start('clf-c02');
      const answered = first.questions()[0];
      await first.answer(answered.id, correctAnswerFor(answered));

      at(3_000_000 + (5400 + 60) * 1000);
      const second = freshService();
      expect(await second.resume('clf-c02')).toBe(true);
      expect(second.hasExpired()).toBe(true);
      expect(second.remainingSeconds()).toBe(0);

      const attempt = await second.endIfExpired();
      if (!attempt) {
        throw new Error('expected the expired attempt to end');
      }
      expect(attempt.correctCount).toBe(1);
      // Elapsed time is clamped to the exam length (S4, EXAM-31).
      expect(attempt.timeTakenSeconds).toBe(5400);
      expect(await repository.getSession('clf-c02', 'mock')).toBeNull();
      expect(await repository.getAttempt(attempt.id)).not.toBeNull();
      expect(second.hasExpired()).toBe(false);
      expect(await second.endIfExpired()).toBeNull();
    });
  });

  describe('submit (S6)', () => {
    it('commits exactly once and clears the session so resume is no longer offered', async () => {
      at(4_000_000);
      const service = freshService();
      await service.start('clf-c02');
      const flagged = service.questions()[0];
      await service.setFlag(flagged.id, true);
      for (const question of service.questions()) {
        await service.answer(question.id, correctAnswerFor(question));
      }
      const commitSpy = vi.spyOn(repository, 'commitAnswers');

      const attempt = await service.submit();

      expect(commitSpy).toHaveBeenCalledTimes(1);
      const input = commitSpy.mock.calls[0]?.[0];
      if (!input) {
        throw new Error('expected one commit call');
      }
      expect(input.clearSession).toEqual({ cert: 'clf-c02', kind: 'mock' });
      expect(input.attempt?.id).toBe(attempt.id);
      expect(input.results).toHaveLength(65);
      expect(input.mastery).toHaveLength(65);
      expect(input.progress).toHaveLength(4);
      expect(attempt.correctCount).toBe(65);
      expect(attempt.scaledScore).toBe(1000);
      expect(attempt.passed).toBe(true);
      expect(attempt.domainScores.every((domain) => domain.percent === 100)).toBe(true);
      expect(input.results.find((row) => row.questionId === flagged.id)?.wasFlagged).toBe(true);
      // Mastery rows carry an engine band weight, never null (issue 005 log L2).
      expect(input.mastery.every((row) => row.weight !== null)).toBe(true);
      expect(
        input.mastery.every(
          (row) => row.weight === LEARNING_WEIGHT_MAX && row.correctStreak === 1 && !row.lastWasWrong,
        ),
      ).toBe(true);

      expect(await repository.getSession('clf-c02', 'mock')).toBeNull();
      expect(await repository.getAttempt(attempt.id)).not.toBeNull();
      const progress = await repository.getCertProgress('clf-c02');
      expect(progress.map((row) => row.attempted)).toEqual([16, 20, 22, 7]);

      const fresh = freshService();
      expect(await fresh.resume('clf-c02')).toBe(false);
      expect(await fresh.hasInProgress('clf-c02')).toBe(false);
    });

    it('leaves the session intact and raises a typed error when the commit fails', async () => {
      at(6_000_000);
      let shouldFail = true;
      const flaky = Object.create(repository) as StudyRepository;
      flaky.commitAnswers = (input: CommitAnswersInput) =>
        shouldFail
          ? Promise.reject(new StorageWriteError('injected storage failure'))
          : repository.commitAnswers(input);
      const service = freshService(flaky);
      await service.start('clf-c02');
      const answered = service.questions()[0];
      await service.answer(answered.id, correctAnswerFor(answered));

      await expect(service.submit()).rejects.toBeInstanceOf(MockExamCommitError);

      expect(service.result()?.committed).toBe(false);
      expect(service.result()?.attempt.correctCount).toBe(1);
      const stored = await repository.getSession('clf-c02', 'mock');
      expect(stored).not.toBeNull();
      expect(stored?.answers[answered.id]).toBeDefined();
      expect(await repository.listAttempts({ cert: 'clf-c02' })).toHaveLength(0);

      shouldFail = false;
      const attempt = await service.submit();
      expect(service.result()?.committed).toBe(true);
      expect(await repository.getAttempt(attempt.id)).not.toBeNull();
      expect(await repository.getSession('clf-c02', 'mock')).toBeNull();
    });
  });

  describe('scoring edges (S7)', () => {
    it('passes with a scaled score exactly at the passing threshold', async () => {
      const service = freshService();
      await service.start('test-threshold', { cert: THRESHOLD_CERT, bank: THRESHOLD_BANK });
      expect(service.totalQuestions()).toBe(3);

      const [firstQ, secondQ, thirdQ] = service.questions();
      await service.answer(firstQ.id, correctAnswerFor(firstQ));
      await service.answer(secondQ.id, correctAnswerFor(secondQ));
      const correct = correctAnswerFor(thirdQ);
      const wrong = ['A', 'C', 'D'].find((key) => key !== correct) ?? 'E';
      await service.answer(thirdQ.id, wrong);

      const attempt = await service.submit();

      expect(attempt.correctCount).toBe(2);
      expect(attempt.scaledScore).toBe(700);
      expect(attempt.passed).toBe(true);
      const stored = await repository.getAttempt(attempt.id);
      expect(stored?.scaledScore).toBe(700);
      expect(stored?.passed).toBe(true);
    });

    it('saves a completed two-minute attempt', async () => {
      at(7_000_000);
      const service = freshService();
      await service.start('test-threshold', { cert: THRESHOLD_CERT, bank: THRESHOLD_BANK });
      for (const question of service.questions()) {
        await service.answer(question.id, correctAnswerFor(question));
      }

      at(7_000_000 + 120 * 1000);
      const attempt = await service.submit();

      expect(attempt.timeTakenSeconds).toBe(120);
      const stored = await repository.getAttempt(attempt.id);
      expect(stored).not.toBeNull();
      expect(stored?.timeTakenSeconds).toBe(120);
    });
  });

  describe('discard', () => {
    it('deletes the session row without recording history', async () => {
      const service = freshService();
      await service.start('clf-c02');
      const question = service.questions()[0];
      await service.answer(question.id, correctAnswerFor(question));

      await service.abandon();

      expect(service.isActive()).toBe(false);
      expect(await repository.getSession('clf-c02', 'mock')).toBeNull();
      expect(await repository.listAttempts({ cert: 'clf-c02' })).toHaveLength(0);
      const fresh = freshService();
      expect(await fresh.resume('clf-c02')).toBe(false);
    });
  });
});
