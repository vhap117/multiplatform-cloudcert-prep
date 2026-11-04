/**
 * Mock exam session lifecycle (issue 005, S1 to S7, S14).
 *
 * This service owns the timed mock exam from start to commit. Composition,
 * shuffling, grading, scoring, and timing maths come from the pure engine in
 * `core/exam`; persistence goes through `StudyRepository` and nowhere else;
 * nothing here touches the network (S14, EXAM-47).
 *
 * Design notes:
 *
 * - Wall-clock timing (S4): the session row stores `startedAt` and
 *   `deadlineAt`, and remaining time is recomputed from `Date.now()` on every
 *   read, never from a decremented counter, so backgrounding, screen lock, or
 *   a force close never corrupts the attempt (EXAM-20 to EXAM-23).
 * - Option display space (EXAM-23): answers are captured in display space and
 *   translated back to bank keys at submit, so each question's key map is
 *   persisted with the session in `optionKeyMaps`. A resume re-applies the
 *   stored map instead of rebuilding the shuffle, because deriving it from a
 *   seed would silently misgrade every stored answer as soon as the bank or
 *   the shuffle changed.
 * - Flags: persisted in their own `flagged` list (EXAM-11). `feedbackShown` is
 *   left untouched for study exams (issue 006), which use it for its
 *   documented purpose.
 * - Counters: `answeredCount` is re-derived from the stored answers on every
 *   write, where only complete responses count (S3). `correctCount` and
 *   `wrongCount` stay zero while the exam runs because a mock exam grades
 *   nothing before submit.
 * - Pure assessment for mastery (EXAM-34A, issue 005 log L5): submit writes
 *   no question mastery rows at all. Only study exams and practice sessions
 *   move per-question mastery (SR-7, SR-11), so a mock exam never shifts
 *   the adaptive pool or ends an exclusion window. Domain progress still
 *   updates from every result (EXAM-34).
 */

import { Injectable, computed, inject, signal } from '@angular/core';

import { getCert, type Certification } from '../../../core/content/cert-registry';
import { loadAllQuestions } from '../../../core/content/question-loader';
import { questionType, type Question, type QuestionType } from '../../../core/content/question-types';
import {
  applyOptionKeyMap,
  availableExamQuestions,
  calculateDomainMastery,
  calculateScorePercent,
  computeExamTiming,
  correctAnswerFor,
  deadlineFor,
  decodeAnswerForDb,
  encodeAnswerForDb,
  getDomainScore,
  isAnswerCorrect,
  isPassed,
  remainingSeconds as secondsUntil,
  selectExamQuestions,
  shuffleAndMapQuestions,
  type DomainResult,
  type OptionKeyMap,
} from '../../../core/exam';
import { STUDY_REPOSITORY } from '../../../core/storage/repository-provider';
import type {
  AttemptRow,
  CertProgressRow,
  DomainScoreRow,
  QuestionResultRow,
  SessionRow,
} from '../../../core/storage/types';

import { MockExamCommitError, MockExamSessionError } from './mock-exam-session.errors';
import type { MockExamResult, MockExamStartOptions } from './mock-exam-session.types';

const SESSION_KIND = 'mock';

/** Decode a stored session answer; missing or empty text means no answer. */
function decodeStored(
  text: string | undefined,
  type: QuestionType,
): string | string[] | null {
  if (text === undefined || text === '') {
    return null;
  }
  return decodeAnswerForDb(text, type);
}

/**
 * Encode a display-space answer for the session row. Matching tokens are
 * sorted so the stored shape is canonical. An empty value encodes as empty
 * text, which `answer` treats as clearing the response.
 */
function encodeDisplayValue(value: string | readonly string[], type: QuestionType): string {
  if (type === 'single') {
    if (typeof value !== 'string') {
      throw new MockExamSessionError('A single answer must be one option key.');
    }
    return value;
  }
  if (!Array.isArray(value)) {
    throw new MockExamSessionError(`A ${type} answer must be a list of keys.`);
  }
  const list = [...value];
  if (type === 'matching') {
    list.sort();
  }
  return list.join(',');
}

interface ActiveMockExam {
  readonly cert: Certification;
  readonly bank: readonly Question[];
  /** Shuffled questions in display space, in `questionOrder` order. */
  readonly questions: readonly Question[];
  readonly keyMaps: ReadonlyMap<string, OptionKeyMap>;
  readonly row: SessionRow;
}

interface GradedQuestion {
  readonly question: Question;
  readonly isCorrect: boolean;
  readonly userAnswer: string;
  readonly correctAnswer: string;
}

@Injectable({ providedIn: 'root' })
export class MockExamSessionService {
  private readonly repository = inject(STUDY_REPOSITORY);

  private readonly active = signal<ActiveMockExam | null>(null);

  /** The latest computed result; `committed` is false while a failed save is retryable. */
  readonly result = signal<MockExamResult | null>(null);

  readonly isActive = computed(() => this.active() !== null);
  readonly totalQuestions = computed(() => this.active()?.questions.length ?? 0);
  readonly currentIndex = computed(() => this.active()?.row.currentIndex ?? 0);
  readonly questions = computed<readonly Question[]>(() => this.active()?.questions ?? []);
  readonly currentQuestion = computed<Question | null>(() => {
    const active = this.active();
    return active ? (active.questions[active.row.currentIndex] ?? null) : null;
  });
  readonly answeredCount = computed(() => this.active()?.row.answeredCount ?? 0);
  readonly flaggedIds = computed<readonly string[]>(() => this.active()?.row.flagged ?? []);

  /** True when an in-progress mock exam exists for the cert (the Resume offer). */
  async hasInProgress(certCode: string): Promise<boolean> {
    return (await this.repository.getSession(certCode, SESSION_KIND)) !== null;
  }

  /**
   * Start a fresh attempt (S1).
   *
   * The session row is persisted before any question is exposed. Starting
   * always begins a new attempt and replaces any in-progress mock session for
   * the cert; the resume-or-discard choice belongs to the start screen (S10,
   * DATA-40).
   */
  async start(certCode: string, options: MockExamStartOptions = {}): Promise<void> {
    const cert = options.cert ?? getCert(certCode);
    if (!cert) {
      throw new MockExamSessionError(`Cannot start a mock exam for unknown cert "${certCode}".`);
    }
    const bank = options.bank ?? (await loadAllQuestions(certCode));
    const available = availableExamQuestions(bank, cert);
    if (available < cert.examQuestionCount) {
      throw new MockExamSessionError(
        `Cert "${certCode}" can supply ${available} of ${cert.examQuestionCount} exam questions; a short exam is refused.`,
      );
    }

    const startedAt = Date.now();
    const selected = selectExamQuestions(bank, cert, options.random ?? Math.random);
    const { questions, keyMaps } = shuffleAndMapQuestions(selected);

    const row: SessionRow = {
      id: `${cert.code}:${SESSION_KIND}`,
      cert: cert.code,
      kind: SESSION_KIND,
      questionOrder: questions.map((question) => question.id),
      currentIndex: 0,
      answers: {},
      feedbackShown: [],
      flagged: [],
      optionKeyMaps: Object.fromEntries(keyMaps),
      startedAt,
      deadlineAt: deadlineFor(startedAt, cert.examTimeSeconds),
      answeredCount: 0,
      correctCount: 0,
      wrongCount: 0,
      updatedAt: startedAt,
    };

    // S1: the attempt is durable before the first question is exposed.
    await this.repository.putSession(row);

    this.result.set(null);
    this.active.set({ cert, bank, questions, keyMaps, row });
  }

  /**
   * Restore an in-progress attempt after a fresh app start (EXAM-23).
   *
   * Returns false when no resumable session exists. A session whose questions
   * no longer resolve against the bundled bank, or whose row is inconsistent,
   * is quarantined: it is deleted and reported as not resumable (DATA-23).
   */
  async resume(certCode: string): Promise<boolean> {
    const row = await this.repository.getSession(certCode, SESSION_KIND);
    if (!row) {
      return false;
    }
    const cert = getCert(certCode);
    if (!cert || row.deadlineAt === null) {
      return false;
    }

    const bank = await loadAllQuestions(certCode);
    const byId = new Map(bank.map((question) => [question.id, question]));
    const ordered: Question[] = [];
    for (const id of row.questionOrder) {
      const question = byId.get(id);
      if (!question) {
        await this.repository.deleteSession(certCode, SESSION_KIND);
        return false;
      }
      ordered.push(question);
    }
    if (ordered.length === 0 || row.currentIndex < 0 || row.currentIndex >= ordered.length) {
      await this.repository.deleteSession(certCode, SESSION_KIND);
      return false;
    }

    // The display space is rebuilt from the persisted maps, never re-derived
    // from a seed: a bank or engine change must not move the options under an
    // answer the student already gave.
    const keyMaps = new Map<string, OptionKeyMap>();
    const questions = ordered.map((question) => {
      const keyMap = row.optionKeyMaps[question.id] ?? {};
      keyMaps.set(question.id, keyMap);
      return applyOptionKeyMap(question, keyMap);
    });
    this.result.set(null);
    this.active.set({ cert, bank, questions, keyMaps, row });
    return true;
  }

  /**
   * Record an answer in display space and persist it before returning (S2).
   *
   * Passing an empty value clears the response. Only complete responses count
   * toward `answeredCount` (S3); a partial multi, ordering, or matching
   * response is still persisted so a resume restores it.
   */
  async answer(questionId: string, value: string | readonly string[]): Promise<void> {
    const active = this.requireActive();
    this.requireRunning();
    const question = active.questions.find((candidate) => candidate.id === questionId);
    if (!question) {
      throw new MockExamSessionError(`Question "${questionId}" is not part of the active exam.`);
    }

    const encoded = encodeDisplayValue(value, questionType(question));
    const answers = { ...active.row.answers };
    if (encoded === '') {
      delete answers[questionId];
    } else {
      answers[questionId] = encoded;
    }
    await this.persist(active, { answers });
  }

  /** Flag or unflag a question, persisted immediately (EXAM-11). */
  async setFlag(questionId: string, flagged: boolean): Promise<void> {
    const active = this.requireActive();
    this.requireRunning();
    if (!active.questions.some((candidate) => candidate.id === questionId)) {
      throw new MockExamSessionError(`Question "${questionId}" is not part of the active exam.`);
    }
    const flags = new Set(active.row.flagged);
    if (flagged) {
      flags.add(questionId);
    } else {
      flags.delete(questionId);
    }
    await this.persist(active, { flagged: [...flags].sort() });
  }

  /** Move to a question by index, persisted immediately (EXAM-15). */
  async goTo(index: number): Promise<void> {
    const active = this.requireActive();
    this.requireRunning();
    if (!Number.isInteger(index) || index < 0 || index >= active.questions.length) {
      throw new MockExamSessionError(
        `Cannot navigate to question ${index} of ${active.questions.length}.`,
      );
    }
    await this.persist(active, { currentIndex: index });
  }

  /** The stored display-space answer for one question, or null when unanswered. */
  answerFor(questionId: string): string | string[] | null {
    const active = this.active();
    const question = active?.questions.find((candidate) => candidate.id === questionId);
    if (!active || !question) {
      return null;
    }
    return decodeStored(active.row.answers[questionId], questionType(question));
  }

  /** True when the stored response is complete enough to grade (S3). */
  isAnswered(questionId: string): boolean {
    const active = this.active();
    const question = active?.questions.find((candidate) => candidate.id === questionId);
    if (!active || !question) {
      return false;
    }
    return this.isComplete(question, decodeStored(active.row.answers[questionId], questionType(question)));
  }

  isFlagged(questionId: string): boolean {
    return this.active()?.row.flagged.includes(questionId) ?? false;
  }

  /**
   * Seconds left on the wall clock (S4). Recomputed from `Date.now()` and the
   * stored deadline on every call; returns 0 when no timed exam is running.
   */
  remainingSeconds(): number {
    const active = this.active();
    const deadline = active?.row.deadlineAt;
    if (!active || deadline === null || deadline === undefined || this.result()?.committed) {
      return 0;
    }
    return secondsUntil(deadline, Date.now());
  }

  /** True when the stored deadline is in the past and the attempt is not yet committed (S5). */
  hasExpired(): boolean {
    const active = this.active();
    const deadline = active?.row.deadlineAt;
    if (!active || deadline === null || deadline === undefined || this.result()?.committed) {
      return false;
    }
    return Date.now() >= deadline;
  }

  /**
   * End the attempt because the deadline passed (S5, EXAM-24). Produces and
   * commits the results exactly like a submit. Returns null when the attempt
   * is still running or was already submitted.
   */
  async endIfExpired(): Promise<AttemptRow | null> {
    if (!this.hasExpired()) {
      return null;
    }
    return this.submit();
  }

  /**
   * Grade the exam and commit it in exactly one local transaction (S6):
   * attempt, question rows, derived domain progress, and the session clear.
   * The commit carries no mastery rows: a mock exam is pure assessment for
   * per-question mastery (EXAM-34A, issue 005 log L5). A failed commit
   * raises `MockExamCommitError`, keeps the session row intact, and keeps
   * the computed result available for retry (EXAM-35).
   */
  async submit(): Promise<AttemptRow> {
    const active = this.requireActive();
    const existing = this.result();
    if (existing?.committed) {
      return existing.attempt;
    }

    const now = Date.now();
    const graded = active.questions.map((question) => this.gradeQuestion(active, question));
    const correctCount = graded.filter((entry) => entry.isCorrect).length;
    const total = graded.length;
    const timing = computeExamTiming(active.row.startedAt, now, active.cert.examTimeSeconds);
    const scorePercent = calculateScorePercent(correctCount, total);
    const attempt: AttemptRow = {
      id: `${active.cert.code}:${SESSION_KIND}:${active.row.startedAt}`,
      cert: active.cert.code,
      kind: SESSION_KIND,
      startedAt: active.row.startedAt,
      finishedAt: now,
      totalQuestions: total,
      correctCount,
      scorePercent,
      passed: isPassed(scorePercent, active.cert.passingPercent),
      timeTakenSeconds: timing.timeTaken,
      domainScores: this.domainScores(active.cert, graded),
    };
    const results: QuestionResultRow[] = graded.map((entry) => ({
      id: `${attempt.id}:${entry.question.id}`,
      attemptId: attempt.id,
      cert: active.cert.code,
      domainId: entry.question.domainId,
      questionId: entry.question.id,
      userAnswer: entry.userAnswer,
      correctAnswer: entry.correctAnswer,
      isCorrect: entry.isCorrect,
      wasFlagged: active.row.flagged.includes(entry.question.id),
      answeredAt: now,
    }));

    const progress = await this.deriveProgress(active, results, now);

    try {
      await this.repository.commitAnswers({
        attempt,
        results,
        progress,
        // EXAM-34A: a mock exam never creates or updates question mastery.
        mastery: [],
        clearSession: { cert: active.cert.code, kind: SESSION_KIND },
      });
    } catch (cause) {
      this.result.set({ attempt, isTooShort: timing.isTooShort, committed: false });
      throw new MockExamCommitError(
        'The exam could not be saved locally. The attempt is unchanged and the save can be retried.',
        cause,
      );
    }

    this.result.set({ attempt, isTooShort: timing.isTooShort, committed: true });
    return attempt;
  }

  /** Discard the in-progress attempt without recording any history (DATA-41). */
  async abandon(): Promise<void> {
    const active = this.active();
    if (!active) {
      return;
    }
    await this.repository.deleteSession(active.cert.code, SESSION_KIND);
    this.active.set(null);
    this.result.set(null);
  }

  private requireActive(): ActiveMockExam {
    const active = this.active();
    if (!active) {
      throw new MockExamSessionError('No mock exam is active. Start or resume one first.');
    }
    return active;
  }

  private requireRunning(): void {
    if (this.result()?.committed) {
      throw new MockExamSessionError('The active mock exam has already been submitted.');
    }
  }

  /** Persist a session row mutation, then expose it. A failed write exposes nothing. */
  private async persist(active: ActiveMockExam, patch: Partial<SessionRow>): Promise<void> {
    const row: SessionRow = { ...active.row, ...patch, updatedAt: Date.now() };
    row.answeredCount = active.questions.filter((question) =>
      this.isComplete(question, decodeStored(row.answers[question.id], questionType(question))),
    ).length;
    await this.repository.putSession(row);
    this.active.set({ ...active, row });
  }

  /**
   * A response is complete when it matches the shape the engine grades: a
   * non-empty key for single, and a full-length list for multi, ordering, and
   * matching, where full length is the arity of the correct response (S3).
   */
  private isComplete(question: Question, value: string | string[] | null): boolean {
    if (value === null) {
      return false;
    }
    if (questionType(question) === 'single') {
      return typeof value === 'string' && value !== '';
    }
    const expected = correctAnswerFor(question);
    return Array.isArray(value) && Array.isArray(expected) && value.length === expected.length;
  }

  /**
   * Grade one question in display space, then encode both answers back to
   * original bank keys for storage. An unanswered question grades incorrect
   * (all-or-nothing, EXAM-10) and stores an empty user answer.
   */
  private gradeQuestion(active: ActiveMockExam, question: Question): GradedQuestion {
    const type = questionType(question);
    const value = decodeStored(active.row.answers[question.id], type);
    const correct = correctAnswerFor(question);
    const keyMap = active.keyMaps.get(question.id) ?? {};
    return {
      question,
      isCorrect: value !== null && isAnswerCorrect(value, correct, type),
      userAnswer: encodeAnswerForDb(value, keyMap, type),
      correctAnswer: encodeAnswerForDb(correct, keyMap, type),
    };
  }

  private domainScores(cert: Certification, graded: readonly GradedQuestion[]): DomainScoreRow[] {
    const domainResults: DomainResult[] = graded.map((entry) => ({
      domainId: entry.question.domainId,
      isCorrect: entry.isCorrect,
    }));
    return cert.domains.map((domain) => {
      const rows = graded.filter((entry) => entry.question.domainId === domain.id);
      return {
        domainId: domain.id,
        correct: rows.filter((entry) => entry.isCorrect).length,
        total: rows.length,
        percent: getDomainScore(domainResults, domain.id),
      };
    });
  }

  /**
   * Recompute the per-domain aggregates from every stored result plus this
   * attempt, so a retake accumulates instead of overwriting. Mastery percent
   * is bank coverage from the engine (SR-27, SR-31).
   */
  private async deriveProgress(
    active: ActiveMockExam,
    results: readonly QuestionResultRow[],
    now: number,
  ): Promise<CertProgressRow[]> {
    const priorAttempts = await this.repository.listAttempts({ cert: active.cert.code });
    const priorResults = (
      await Promise.all(priorAttempts.map((row) => this.repository.listQuestionResults(row.id)))
    ).flat();
    const practiceResults = await this.repository.listPracticeResults(active.cert.code);
    const all = [...priorResults, ...practiceResults, ...results];

    const bankIdsByDomain = new Map<number, Set<string>>();
    for (const question of active.bank) {
      const ids = bankIdsByDomain.get(question.domainId) ?? new Set<string>();
      ids.add(question.id);
      bankIdsByDomain.set(question.domainId, ids);
    }

    return active.cert.domains.map((domain) => {
      const rows = all.filter((row) => row.domainId === domain.id);
      const bankIds = bankIdsByDomain.get(domain.id) ?? new Set<string>();
      const covered = new Set(
        rows.filter((row) => row.isCorrect && bankIds.has(row.questionId)).map((row) => row.questionId),
      );
      return {
        id: `${active.cert.code}:${domain.id}`,
        cert: active.cert.code,
        domainId: domain.id,
        attempted: rows.length,
        correct: rows.filter((row) => row.isCorrect).length,
        masteryPercent: calculateDomainMastery(covered.size, domain.id, active.cert.code),
        updatedAt: now,
      };
    });
  }
}
