/**
 * Domain practice session lifecycle (issue 007, S3 to S10, S12, S17).
 *
 * This service owns one targeted drill from start to completion: pick one
 * exam domain, answer a short session, grade instantly, and move mastery.
 * Selection, shuffling, grading, and scoring maths come from the pure engine
 * in `core/exam`; persistence goes through `StudyRepository` and nowhere
 * else; nothing here touches the network (S17, PRACT-26, PRACT-39).
 *
 * Design notes and recorded decisions:
 *
 * - Adaptive selection (S3): `start` loads the domain bank locally, reads the
 *   stored mastery rows, maps them to the engine's `PracticeMastery`, and
 *   calls `selectPracticeQuestions` exactly once. With no history that
 *   degenerates to a uniform random draw. The exam selector is never used
 *   here (SR-3, SR-4).
 * - Durable before exposed (S4): the session row, including every question's
 *   option key map, is persisted before the first question is exposed, so a
 *   resume rebuilds the exact display space instead of re-deriving it.
 * - Immediate grading (S5, S6): a single answer grades on the `answer` call
 *   itself. Multi, ordering, and matching responses are saved as drafts and
 *   grade only through an explicit `submitAnswer`; an incomplete response
 *   reports `incomplete` so the UI can warn instead of grading it wrong (S8,
 *   PRACT-17). All four formats grade all-or-nothing.
 * - Graded means read-only (S7): `feedbackShown` on the session row records
 *   which questions have been graded, and a graded question keeps its
 *   recorded answer and feedback for the rest of the session.
 * - One atomic write per answer (S9, PRACT-16): each graded answer commits
 *   through `commitAnswers` with `attempt: null`, carrying that question's
 *   result row (null `attemptId`, which is what `listPracticeResults` reads,
 *   DATA-18), the updated domain progress row, and the question's mastery
 *   row. Result ids are deterministic (`cert:practice:startedAt:questionId`),
 *   and both the progress row and the mastery row are recomputed from the
 *   stored history rather than incremented, so retrying after a failed write
 *   rewrites the same rows instead of duplicating or double-counting (S12).
 *   The history commit lands first and the session row second: a crash
 *   between them leaves the question ungraded in the session, and re-answering
 *   overwrites the same deterministic row.
 * - Completion (S9, S11): `complete` builds one `AttemptRow` of kind
 *   `practice` through the shared builder, so history lists the session and
 *   distinguishes it from exams, recomputes the session domain's progress
 *   row from every stored result, re-commits any answer row missing from
 *   storage, and clears the session. The builder's own result and mastery
 *   rows are not committed on purpose: the per-answer commits already wrote
 *   every result row with a null attemptId and already folded every answer
 *   into mastery, so completion only advances the exclusion window of the
 *   domain questions the session did not ask (SR-16).
 * - Counts derive from the recorded answers: `answeredCount`,
 *   `correctCount`, and `wrongCount` are re-derived from the persisted
 *   session row on every write, never incremented, so a resume can never
 *   disagree with storage. Correct plus wrong always equals answered.
 * - Kind isolation (S14, issue 007 log L4): every storage call uses the
 *   `practice` session kind. The mock and study session rows are never read
 *   or written, and the timed-exam active state does not exist here.
 */

import { Injectable, computed, inject, signal } from '@angular/core';

import { getCert, type Certification } from '../../../core/content/cert-registry';
import { loadAllQuestions, loadDomainQuestions } from '../../../core/content/question-loader';
import { questionType, type Question, type QuestionType } from '../../../core/content/question-types';
import {
  MAX_PRACTICE_QUESTIONS,
  MIN_PRACTICE_QUESTIONS,
  applyOptionKeyMap,
  calculateDomainMastery,
  correctAnswerFor,
  decodeAnswerForDb,
  encodeAnswerForDb,
  isAnswerCorrect,
  selectPracticeQuestions,
  shuffleAndMapQuestions,
  type OptionKeyMap,
  type PracticeMastery,
} from '../../../core/exam';
import {
  agePracticeSessionMastery,
  buildAttemptRows,
  type GradedAnswer,
} from '../../../core/exam-session/attempt-rows';
import { buildQuestionFeedback, type QuestionFeedback } from '../../../core/exam-session/feedback';
import { foldMasteryHistory, type MasteryAnswer } from '../../../core/exam-session/mastery';
import { STUDY_REPOSITORY } from '../../../core/storage/repository-provider';
import type {
  AttemptRow,
  CertProgressRow,
  QuestionMasteryRow,
  QuestionResultRow,
  SessionRow,
} from '../../../core/storage/types';

import {
  PracticeLoadError,
  PracticeSaveError,
  PracticeSessionError,
} from './practice-session.errors';
import type {
  PracticeCompletion,
  PracticeStartOptions,
  PracticeSubmitResult,
} from './practice-session.types';

const SESSION_KIND = 'practice';

/** The deterministic result-row id for one answer of one practice session. */
function practiceResultId(cert: string, startedAt: number, questionId: string): string {
  return `${cert}:${SESSION_KIND}:${startedAt}:${questionId}`;
}

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
 * text, which `answer` treats as clearing the draft response.
 */
function encodeDisplayValue(value: string | readonly string[], type: QuestionType): string {
  if (type === 'single') {
    if (typeof value !== 'string') {
      throw new PracticeSessionError('A single answer must be one option key.');
    }
    return value;
  }
  if (!Array.isArray(value)) {
    throw new PracticeSessionError(`A ${type} answer must be a list of keys.`);
  }
  const list = [...value];
  if (type === 'matching') {
    list.sort();
  }
  return list.join(',');
}

interface ActivePractice {
  readonly cert: Certification;
  /**
   * The loaded bank covering every session question: the domain bank after
   * `start`, the full cert bank after `resume`. Progress coverage intersects
   * stored results with it per domain, so either shape is correct (SR-31).
   */
  readonly bank: readonly Question[];
  /** Shuffled session questions in display space, in `questionOrder` order. */
  readonly questions: readonly Question[];
  readonly keyMaps: ReadonlyMap<string, OptionKeyMap>;
  readonly row: SessionRow;
}

@Injectable({ providedIn: 'root' })
export class PracticeSessionService {
  private readonly repository = inject(STUDY_REPOSITORY);

  private readonly active = signal<ActivePractice | null>(null);

  readonly isActive = computed(() => this.active() !== null);
  /** The session size the config screen asked for (S2), clamped to the bank. */
  readonly totalQuestions = computed(() => this.active()?.questions.length ?? 0);
  readonly currentIndex = computed(() => this.active()?.row.currentIndex ?? 0);
  readonly questions = computed<readonly Question[]>(() => this.active()?.questions ?? []);
  readonly currentQuestion = computed<Question | null>(() => {
    const active = this.active();
    return active ? (active.questions[active.row.currentIndex] ?? null) : null;
  });

  /** Graded questions so far: the progress bar (S5). */
  readonly answeredCount = computed(() => this.active()?.row.answeredCount ?? 0);
  readonly correctCount = computed(() => this.active()?.row.correctCount ?? 0);
  readonly wrongCount = computed(() => this.active()?.row.wrongCount ?? 0);
  /** Answered percentage of the whole session; 0 before anything is graded. */
  readonly answeredPercent = computed(() => {
    const active = this.active();
    if (!active || active.questions.length === 0) {
      return 0;
    }
    return Math.round((active.row.answeredCount / active.questions.length) * 100);
  });

  /** True when an in-progress practice session exists for the cert (S4). */
  async hasInProgress(certCode: string): Promise<boolean> {
    try {
      return (await this.repository.getSession(certCode, SESSION_KIND)) !== null;
    } catch (cause) {
      throw new PracticeLoadError(
        'The saved practice session could not be read. The check can be retried.',
        cause,
      );
    }
  }

  /**
   * Start a fresh practice session for one domain (S2, S3, S4).
   *
   * The size must sit inside the engine bounds (MIN_PRACTICE_QUESTIONS to
   * MAX_PRACTICE_QUESTIONS, SR-41) and is clamped to what the domain bank can
   * supply. Selection happens exactly once, here, through
   * `selectPracticeQuestions`; the exam selector is never used (SR-3, SR-4).
   * The session row, including the option key maps, is persisted before any
   * question is exposed. Starting always begins a new session and replaces
   * any in-progress practice session for the cert; the explicit
   * resume-or-discard choice belongs to the config screen (S4, PRACT-7).
   */
  async start(
    certCode: string,
    domainId: number,
    questionCount: number,
    options: PracticeStartOptions = {},
  ): Promise<void> {
    const cert = options.cert ?? getCert(certCode);
    if (!cert) {
      throw new PracticeSessionError(`Cannot start practice for unknown cert "${certCode}".`);
    }
    if (!cert.domains.some((domain) => domain.id === domainId)) {
      throw new PracticeSessionError(
        `Cert "${cert.code}" declares no domain ${domainId}; practice needs a real domain.`,
      );
    }
    if (
      !Number.isInteger(questionCount) ||
      questionCount < MIN_PRACTICE_QUESTIONS ||
      questionCount > MAX_PRACTICE_QUESTIONS
    ) {
      throw new PracticeSessionError(
        `Practice sessions run ${MIN_PRACTICE_QUESTIONS} to ${MAX_PRACTICE_QUESTIONS} questions; ${questionCount} is outside those bounds.`,
      );
    }

    let bank: readonly Question[];
    try {
      bank = options.bank ?? (await loadDomainQuestions(cert.code, domainId));
    } catch (cause) {
      throw new PracticeLoadError(
        `The domain ${domainId} bank for cert "${cert.code}" could not be loaded. Starting can be retried.`,
        cause,
      );
    }
    if (bank.length === 0) {
      throw new PracticeSessionError(
        `Domain ${domainId} of cert "${cert.code}" has no questions to practice.`,
      );
    }

    let masteryRows: QuestionMasteryRow[];
    try {
      masteryRows = await this.repository.getQuestionMastery(cert.code);
    } catch (cause) {
      throw new PracticeLoadError(
        'The practice history could not be read. Starting can be retried.',
        cause,
      );
    }
    const mastery = new Map<string, PracticeMastery>(
      masteryRows.map((row) => [
        row.questionId,
        {
          questionId: row.questionId,
          correctStreak: row.correctStreak,
          lastWasWrong: row.lastWasWrong,
          lastSeenAt: row.lastSeenAt,
          mastered: row.mastered,
          weight: row.weight,
        },
      ]),
    );

    const startedAt = Date.now();
    const random = options.random ?? Math.random;
    // S3: the adaptive selector runs exactly once, at session start.
    const selected = selectPracticeQuestions(
      bank,
      Math.min(questionCount, bank.length),
      mastery,
      random,
    );
    const { questions, keyMaps } = shuffleAndMapQuestions(selected, random);

    const row: SessionRow = {
      id: `${cert.code}:${SESSION_KIND}`,
      cert: cert.code,
      kind: SESSION_KIND,
      questionOrder: questions.map((question) => question.id),
      currentIndex: 0,
      answers: {},
      feedbackShown: [],
      // Practice has no flags, exactly like the study exam (issue 006 log L4).
      flagged: [],
      optionKeyMaps: Object.fromEntries(keyMaps),
      startedAt,
      // Untimed: there is no deadline to store and nothing ever expires.
      deadlineAt: null,
      answeredCount: 0,
      correctCount: 0,
      wrongCount: 0,
      updatedAt: startedAt,
    };

    // S4: the session is durable before the first question is exposed.
    try {
      await this.repository.putSession(row);
    } catch (cause) {
      throw new PracticeSaveError(
        'The practice session could not be saved locally. Starting can be retried.',
        cause,
      );
    }

    this.active.set({ cert, bank, questions, keyMaps, row });
  }

  /**
   * Restore an in-progress session after a fresh app start (S14).
   *
   * Returns false when no resumable session exists. A session whose questions
   * no longer resolve against the bundled bank, or whose row is inconsistent,
   * is quarantined: it is deleted and reported as not resumable (DATA-23).
   * Resume itself writes nothing, so nothing can be re-graded or duplicated.
   */
  async resume(certCode: string): Promise<boolean> {
    let row: SessionRow | null;
    try {
      row = await this.repository.getSession(certCode, SESSION_KIND);
    } catch (cause) {
      throw new PracticeLoadError(
        'The saved practice session could not be read. The resume can be retried.',
        cause,
      );
    }
    if (!row) {
      return false;
    }
    const cert = getCert(certCode);
    if (!cert) {
      return false;
    }

    // The domain is not stored on the session row, so the full cert bank
    // resolves the recorded question ids; every session question carries its
    // own domain stamp.
    let bank: Question[];
    try {
      bank = await loadAllQuestions(certCode);
    } catch (cause) {
      throw new PracticeLoadError(
        'The question bank could not be loaded. The resume can be retried.',
        cause,
      );
    }
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
    this.active.set({ cert, bank, questions, keyMaps, row });
    return true;
  }

  /**
   * Record an answer in display space (S5).
   *
   * A single answer grades and commits on this call. A multi, ordering, or
   * matching response is saved as a draft so backgrounding and resume work
   * mid-selection (S14), but it grades only through `submitAnswer` once the
   * response is complete (S8). Passing an empty value clears a draft. A
   * graded question is read-only (S7): calling this for one is a
   * `PracticeSessionError`.
   */
  async answer(questionId: string, value: string | readonly string[]): Promise<void> {
    const active = this.requireActive();
    const question = this.requireQuestion(active, questionId);
    if (active.row.feedbackShown.includes(questionId)) {
      throw new PracticeSessionError(
        `Question "${questionId}" is already graded and read-only for the rest of the session.`,
      );
    }

    const type = questionType(question);
    const encoded = encodeDisplayValue(value, type);
    const answers = { ...active.row.answers };
    if (encoded === '') {
      delete answers[questionId];
    } else {
      answers[questionId] = encoded;
    }

    if (type !== 'single' || encoded === '') {
      await this.persist(active, { answers });
      return;
    }

    await this.grade(active, question, answers);
  }

  /**
   * Grade a complete multi, ordering, or matching response on explicit
   * confirm (S5, S8). An incomplete response reports `incomplete` and is
   * neither graded nor committed, so the UI can warn instead of silently
   * grading it wrong (PRACT-17). The draft being graded is the one already
   * persisted, so a failed save can never leave memory and storage
   * disagreeing about what was judged.
   */
  async submitAnswer(questionId: string): Promise<PracticeSubmitResult> {
    const active = this.requireActive();
    const question = this.requireQuestion(active, questionId);
    const type = questionType(question);
    if (type === 'single') {
      throw new PracticeSessionError(
        'A single-choice answer grades on selection; there is nothing to confirm.',
      );
    }
    if (active.row.feedbackShown.includes(questionId)) {
      throw new PracticeSessionError(
        `Question "${questionId}" is already graded and read-only for the rest of the session.`,
      );
    }
    const value = decodeStored(active.row.answers[questionId], type);
    if (!this.isComplete(question, value)) {
      return 'incomplete';
    }
    await this.grade(active, question, active.row.answers);
    return 'graded';
  }

  /** Move to a question by index, persisted immediately (S14). */
  async goTo(index: number): Promise<void> {
    const active = this.requireActive();
    if (!Number.isInteger(index) || index < 0 || index >= active.questions.length) {
      throw new PracticeSessionError(
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

  /** True when the stored response is complete enough to grade (S8). */
  isAnswered(questionId: string): boolean {
    const active = this.active();
    const question = active?.questions.find((candidate) => candidate.id === questionId);
    if (!active || !question) {
      return false;
    }
    return this.isComplete(
      question,
      decodeStored(active.row.answers[questionId], questionType(question)),
    );
  }

  /** True once the question is graded and its feedback is on record (S7). */
  isGraded(questionId: string): boolean {
    return this.active()?.row.feedbackShown.includes(questionId) ?? false;
  }

  /**
   * The recorded correctness of a graded question, derived from the stored
   * answer so a resume can never disagree. Null while ungraded.
   */
  isCorrect(questionId: string): boolean | null {
    const active = this.active();
    const question = active?.questions.find((candidate) => candidate.id === questionId);
    if (!active || !question || !active.row.feedbackShown.includes(questionId)) {
      return null;
    }
    return this.gradeStored(active, question);
  }

  /**
   * The read-only feedback for a graded question (S6, S7): the explanation
   * summary plus the per-option explanations that matter, each tagged by
   * kind so the UI can group them. Null while the question is ungraded.
   */
  feedbackFor(questionId: string): QuestionFeedback | null {
    const active = this.active();
    const question = active?.questions.find((candidate) => candidate.id === questionId);
    if (!active || !question || !active.row.feedbackShown.includes(questionId)) {
      return null;
    }
    return buildQuestionFeedback(
      question,
      decodeStored(active.row.answers[questionId], questionType(question)),
    );
  }

  /**
   * Complete the session (S9, S11): build one attempt row of kind `practice`
   * through the shared builder, recompute the session domain's progress from
   * every stored result, re-commit any answer row missing from storage, age
   * the exclusion window of the unasked domain questions, and clear the
   * session, all in one local transaction. Refuses when nothing was
   * answered. A failed commit raises `PracticeSaveError` and leaves the
   * session resumable for a retry (S12).
   */
  async complete(): Promise<PracticeCompletion> {
    const active = this.requireActive();
    if (active.row.answeredCount === 0) {
      throw new PracticeSessionError(
        'A practice session with no graded answer has nothing to complete.',
      );
    }
    const now = Date.now();
    const gradedQuestions = active.questions.filter((question) =>
      active.row.feedbackShown.includes(question.id),
    );

    let stored: readonly QuestionResultRow[];
    let priorMastery: QuestionMasteryRow[];
    try {
      stored = await this.storedResults(active.cert.code);
      priorMastery = await this.repository.getQuestionMastery(active.cert.code);
    } catch (cause) {
      throw new PracticeLoadError(
        'The practice history could not be read. The completion can be retried.',
        cause,
      );
    }

    const resultIdFor = (question: Question): string =>
      practiceResultId(active.cert.code, active.row.startedAt, question.id);
    const sessionIds = new Set(gradedQuestions.map(resultIdFor));
    const storedIds = new Set(stored.map((row) => row.id));
    // Self-heal: an answer whose session save failed after its history commit
    // (or whose commit never ran) still gets exactly one result row, so
    // completion always leaves one row per answered question (S9, S11).
    const missing = gradedQuestions
      .filter((question) => !storedIds.has(resultIdFor(question)))
      .map((question) => this.buildResultRow(active, question, now));
    const priorResults = stored.filter((row) => !sessionIds.has(row.id));

    const graded: GradedAnswer[] = gradedQuestions.map((question) => {
      const type = questionType(question);
      const value = decodeStored(active.row.answers[question.id], type);
      const correct = correctAnswerFor(question);
      const keyMap = active.keyMaps.get(question.id) ?? {};
      return {
        question,
        isCorrect: value !== null && isAnswerCorrect(value, correct, type),
        userAnswer: encodeAnswerForDb(value, keyMap, type),
        correctAnswer: encodeAnswerForDb(correct, keyMap, type),
        wasFlagged: false,
      };
    });

    const built = buildAttemptRows({
      cert: active.cert,
      kind: SESSION_KIND,
      startedAt: active.row.startedAt,
      finishedAt: now,
      // Untimed timing policy: raw elapsed wall-clock seconds, guarded only
      // against a backward clock jump. There is no deadline to clamp against.
      timeTakenSeconds: Math.max(0, Math.floor((now - active.row.startedAt) / 1000)),
      graded,
      priorResults,
      priorMastery,
      bank: active.bank,
    });

    // The builder's attempt and progress rows are committed; its result and
    // mastery rows are not. The per-answer commits already wrote every result
    // row with a null attemptId (DATA-18) and already folded every answer
    // into mastery, so completion commits only the missing result rows and
    // advances the exclusion window of the domain questions the session did
    // not ask (SR-16). Progress outside the session domains is untouched.
    const sessionDomains = new Set(gradedQuestions.map((question) => question.domainId));
    const progress = built.progress.filter((row) => sessionDomains.has(row.domainId));
    const mastery = agePracticeSessionMastery(
      priorMastery,
      new Set(active.row.questionOrder),
      sessionDomains,
    );

    try {
      await this.repository.commitAnswers({
        attempt: built.attempt,
        results: missing,
        progress,
        mastery,
        clearSession: { cert: active.cert.code, kind: SESSION_KIND },
      });
    } catch (cause) {
      throw new PracticeSaveError(
        'The completed session could not be saved locally. The session is unchanged and the save can be retried.',
        cause,
      );
    }

    this.active.set(null);
    return { attempt: built.attempt, domainScores: built.attempt.domainScores };
  }

  /**
   * Remove the saved session without recording any history (S4).
   *
   * Works from a fresh instance too: the config screen can offer Resume
   * before anything was loaded, and discarding there must delete the stored
   * row even though no session is active in memory yet.
   */
  async discard(certCode?: string): Promise<void> {
    const code = this.active()?.cert.code ?? certCode;
    if (code) {
      await this.repository.deleteSession(code, SESSION_KIND);
    }
    this.active.set(null);
  }

  private requireActive(): ActivePractice {
    const active = this.active();
    if (!active) {
      throw new PracticeSessionError('No practice session is active. Start or resume one first.');
    }
    return active;
  }

  private requireQuestion(active: ActivePractice, questionId: string): Question {
    const question = active.questions.find((candidate) => candidate.id === questionId);
    if (!question) {
      throw new PracticeSessionError(
        `Question "${questionId}" is not part of the active practice session.`,
      );
    }
    return question;
  }

  /**
   * Grade one recorded answer and commit it (S9): one atomic write carrying
   * the result row, the updated domain progress row, and the question's
   * mastery row, then the session row update that marks the question graded.
   * The history write lands first and every row is recomputed from storage
   * under a deterministic id, so a retry after either write fails rewrites
   * the same rows instead of duplicating them (S12).
   */
  private async grade(
    active: ActivePractice,
    question: Question,
    answers: Record<string, string>,
  ): Promise<void> {
    const now = Date.now();
    const gradedActive: ActivePractice = { ...active, row: { ...active.row, answers } };
    const resultRow = this.buildResultRow(gradedActive, question, now);

    let stored: readonly QuestionResultRow[];
    try {
      stored = await this.storedResults(active.cert.code);
    } catch (cause) {
      throw new PracticeLoadError(
        'The practice history could not be read. The answer was not graded and the retry can run.',
        cause,
      );
    }
    // The same deterministic id is excluded before recomputing, so a retry
    // never counts one answer twice.
    const rows = [...stored.filter((row) => row.id !== resultRow.id), resultRow];
    const progress = this.progressRow(gradedActive, rows, question.domainId, now);
    const mastery = this.masteryRowsFor(gradedActive, question, rows);

    try {
      await this.repository.commitAnswers({
        attempt: null,
        results: [resultRow],
        progress: [progress],
        mastery,
      });
    } catch (cause) {
      throw new PracticeSaveError(
        'The answer could not be saved locally. Nothing was recorded and the save can be retried.',
        cause,
      );
    }

    const feedbackShown = [...active.row.feedbackShown, question.id].sort();
    await this.persist(gradedActive, { feedbackShown });
  }

  /** Build the null-attempt result row for one graded session question (DATA-18). */
  private buildResultRow(
    active: ActivePractice,
    question: Question,
    answeredAt: number,
  ): QuestionResultRow {
    const type = questionType(question);
    const value = decodeStored(active.row.answers[question.id], type);
    const correct = correctAnswerFor(question);
    const keyMap = active.keyMaps.get(question.id) ?? {};
    return {
      id: practiceResultId(active.cert.code, active.row.startedAt, question.id),
      attemptId: null,
      cert: active.cert.code,
      domainId: question.domainId,
      questionId: question.id,
      userAnswer: encodeAnswerForDb(value, keyMap, type),
      correctAnswer: encodeAnswerForDb(correct, keyMap, type),
      isCorrect: value !== null && isAnswerCorrect(value, correct, type),
      wasFlagged: false,
      answeredAt,
    };
  }

  /**
   * Recompute one domain's progress row from stored results (SR-27, SR-31):
   * never incremented, so a retry rewrites the same values. Mastery percent
   * is bank coverage: distinct correctly answered questions that still exist
   * in the current bank.
   */
  private progressRow(
    active: ActivePractice,
    rows: readonly QuestionResultRow[],
    domainId: number,
    updatedAt: number,
  ): CertProgressRow {
    const domainRows = rows.filter((row) => row.domainId === domainId);
    const bankIds = new Set(
      active.bank
        .filter((question) => question.domainId === domainId)
        .map((question) => question.id),
    );
    const covered = new Set(
      domainRows
        .filter((row) => row.isCorrect && bankIds.has(row.questionId))
        .map((row) => row.questionId),
    );
    return {
      id: `${active.cert.code}:${domainId}`,
      cert: active.cert.code,
      domainId,
      attempted: domainRows.length,
      correct: domainRows.filter((row) => row.isCorrect).length,
      masteryPercent: calculateDomainMastery(covered.size, domainId, active.cert.code),
      updatedAt,
    };
  }

  /**
   * The mastery row for one freshly answered question, folded from its whole
   * stored result history (S10). Folding the history is the idempotent form
   * of the single-answer fold: a retry replays the same history and lands on
   * the same state, so a retried write never double-counts a streak (S12).
   */
  private masteryRowsFor(
    active: ActivePractice,
    question: Question,
    rows: readonly QuestionResultRow[],
  ): QuestionMasteryRow[] {
    const history: MasteryAnswer[] = rows
      .filter((row) => row.questionId === question.id)
      .map((row) => ({ isCorrect: row.isCorrect, answeredAt: row.answeredAt }))
      .sort((a, b) => a.answeredAt - b.answeredAt);
    const state = foldMasteryHistory(history);
    if (!state) {
      return [];
    }
    return [
      {
        id: `${active.cert.code}:${question.id}`,
        cert: active.cert.code,
        domainId: question.domainId,
        questionId: question.id,
        correctStreak: state.correctStreak,
        lastWasWrong: state.lastWasWrong,
        lastSeenAt: state.lastSeenAt,
        mastered: state.mastered,
        sessionsSinceSeen: state.sessionsSinceSeen,
        weight: state.weight,
      },
    ];
  }

  /** Every stored question result for the cert, from exams and from practice. */
  private async storedResults(cert: string): Promise<QuestionResultRow[]> {
    const attempts = await this.repository.listAttempts({ cert });
    const attemptResults = await Promise.all(
      attempts.map((attempt: AttemptRow) => this.repository.listQuestionResults(attempt.id)),
    );
    return [...attemptResults.flat(), ...(await this.repository.listPracticeResults(cert))];
  }

  /**
   * Persist a session row mutation, then expose it. A failed write exposes
   * nothing and raises a retryable `PracticeSaveError` (S12).
   */
  private async persist(active: ActivePractice, patch: Partial<SessionRow>): Promise<void> {
    const row: SessionRow = { ...active.row, ...patch, updatedAt: Date.now() };
    const counts = this.deriveCounts(row, active.questions);
    row.answeredCount = counts.answered;
    row.correctCount = counts.correct;
    row.wrongCount = counts.wrong;
    try {
      await this.repository.putSession(row);
    } catch (cause) {
      throw new PracticeSaveError(
        'The answer could not be saved locally. Nothing was recorded and the save can be retried.',
        cause,
      );
    }
    this.active.set({ ...active, row });
  }

  /**
   * Re-derive the three counters from the recorded answers. Only graded
   * questions count as answered, so correct plus wrong always equals
   * answered, including after a resume.
   */
  private deriveCounts(
    row: SessionRow,
    questions: readonly Question[],
  ): { answered: number; correct: number; wrong: number } {
    let answered = 0;
    let correct = 0;
    for (const question of questions) {
      if (!row.feedbackShown.includes(question.id)) {
        continue;
      }
      answered += 1;
      const type = questionType(question);
      const value = decodeStored(row.answers[question.id], type);
      if (value !== null && isAnswerCorrect(value, correctAnswerFor(question), type)) {
        correct += 1;
      }
    }
    return { answered, correct, wrong: answered - correct };
  }

  /** Grade one stored answer against its question in display space. */
  private gradeStored(active: ActivePractice, question: Question): boolean {
    const type = questionType(question);
    const value = decodeStored(active.row.answers[question.id], type);
    return value !== null && isAnswerCorrect(value, correctAnswerFor(question), type);
  }

  /**
   * A response is complete when it matches the shape the engine grades: a
   * non-empty key for single, and a full-length list for multi, ordering,
   * and matching, where full length is the arity of the correct response
   * (S8).
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
}
