/**
 * Study exam session lifecycle (issue 006, S1 to S5, S8 to S13).
 *
 * This service owns the untimed study exam from start to commit. Composition,
 * shuffling, grading, and scoring maths come from the pure engine in
 * `core/exam`; persistence goes through `StudyRepository` and nowhere else;
 * nothing here touches the network (S13, EXAM-47).
 *
 * Design notes:
 *
 * - Untimed (S1): the session row stores `deadlineAt: null`, and this service
 *   exposes no countdown, no deadline, and no auto-submit. There is no timer
 *   API to consume, so no screen can accidentally show one.
 * - Same composition as the mock exam (S2): `selectExamQuestions` plus
 *   `shuffleAndMapQuestions`, with each question's option key map persisted
 *   on the session row before the first question is exposed, so a resume
 *   rebuilds the exact display space instead of re-deriving it from a seed.
 * - Immediate grading (S3): a single answer grades on the `answer` call
 *   itself. Multi, ordering, and matching responses are saved as drafts and
 *   grade only through an explicit `submitAnswer` once the response is
 *   complete (STUDY-9), so selecting an option never commits the student
 *   before they ask for the verdict.
 * - Graded means feedback shown (S4, S5, log L3): `feedbackShown` on the
 *   session row records which questions have been graded and shown, which
 *   makes a graded question read-only and lets a resumed session repaint the
 *   exact same state without ever re-grading. The study exam does not use
 *   flags (log L4).
 * - Counts derive from the recorded answers (S7, log L5): `answeredCount`,
 *   `correctCount`, `wrongCount`, and the per-domain tallies are re-derived
 *   from the persisted answers on every write and every read, never
 *   incremented, so a resume can never disagree with storage. Correct plus
 *   wrong always equals answered.
 * - One write per graded answer (S8): the answer, its correctness, the
 *   current position, and the feedback state persist in a single
 *   `putSession`. A failed write exposes nothing and raises
 *   `StudyExamSaveError`, which the UI can surface and retry.
 * - Completion (S11) builds the attempt, question result, progress, and
 *   mastery rows through the shared pure builder in `core/exam-session`
 *   (log L2), so history, mastery, and best score consume study and mock
 *   rows uniformly.
 * - Kind isolation (S12): every storage call uses the `study` session kind.
 *   The mock session kind is never read or written, and there is no leave
 *   guard because progress is saved continuously.
 */

import { Injectable, computed, inject, signal } from '@angular/core';

import { getCert, type Certification } from '../../../core/content/cert-registry';
import { loadAllQuestions } from '../../../core/content/question-loader';
import { questionType, type Question, type QuestionType } from '../../../core/content/question-types';
import {
  applyOptionKeyMap,
  availableExamQuestions,
  correctAnswerFor,
  decodeAnswerForDb,
  encodeAnswerForDb,
  isAnswerCorrect,
  selectExamQuestions,
  shuffleAndMapQuestions,
  type OptionKeyMap,
} from '../../../core/exam';
import { buildAttemptRows, type GradedAnswer } from '../../../core/exam-session/attempt-rows';
import { STUDY_REPOSITORY } from '../../../core/storage/repository-provider';
import type { AttemptRow, SessionRow } from '../../../core/storage/types';

import { StudyExamSaveError, StudyExamSessionError } from './study-exam-session.errors';
import type {
  DomainTally,
  FeedbackEntry,
  QuestionFeedback,
  StudyExamStartOptions,
} from './study-exam-session.types';

const SESSION_KIND = 'study';

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
      throw new StudyExamSessionError('A single answer must be one option key.');
    }
    return value;
  }
  if (!Array.isArray(value)) {
    throw new StudyExamSessionError(`A ${type} answer must be a list of keys.`);
  }
  const list = [...value];
  if (type === 'matching') {
    list.sort();
  }
  return list.join(',');
}

/**
 * Build the per-option feedback entries for one graded question, in display
 * space, grouped by kind: chosen-wrong first, then missed-correct, then
 * correct-chosen, so the UI can render the groups without re-sorting (S4).
 *
 * Selection formats compare sets. Ordering compares positions: an option in
 * its correct position is correct-chosen, a misplaced one is chosen-wrong,
 * and the option that belonged in each wrong position is missed-correct.
 * Matching compares pairings by left key, which plays the same double role.
 */
function feedbackEntries(
  question: Question,
  type: QuestionType,
  value: string | string[] | null,
  correct: string | string[],
): FeedbackEntry[] {
  const chosenWrong: string[] = [];
  const missedCorrect: string[] = [];
  const correctChosen: string[] = [];

  if (type === 'ordering') {
    const chosen = Array.isArray(value) ? value : [];
    const correctSequence = Array.isArray(correct) ? correct : [];
    chosen.forEach((key, index) => {
      if (key === correctSequence[index]) {
        correctChosen.push(key);
      } else {
        chosenWrong.push(key);
      }
    });
    correctSequence.forEach((key, index) => {
      if (chosen[index] !== key) {
        missedCorrect.push(key);
      }
    });
  } else if (type === 'matching') {
    const userPairs = new Map(
      (Array.isArray(value) ? value : []).map((token) => token.split(':') as [string, string]),
    );
    for (const token of Array.isArray(correct) ? correct : []) {
      const [key, target] = token.split(':');
      if (userPairs.get(key) === target) {
        correctChosen.push(key);
      } else {
        chosenWrong.push(key);
        missedCorrect.push(key);
      }
    }
  } else {
    const chosen =
      type === 'single'
        ? typeof value === 'string' && value !== ''
          ? [value]
          : []
        : Array.isArray(value)
          ? [...value]
          : [];
    const correctKeys = Array.isArray(correct) ? correct : [correct];
    for (const key of chosen) {
      if (correctKeys.includes(key)) {
        correctChosen.push(key);
      } else {
        chosenWrong.push(key);
      }
    }
    for (const key of correctKeys) {
      if (!chosen.includes(key)) {
        missedCorrect.push(key);
      }
    }
  }

  const textFor = (key: string): string => question.explanation.options[key] ?? '';
  return [
    ...chosenWrong.map((key): FeedbackEntry => ({ key, text: textFor(key), kind: 'chosen-wrong' })),
    ...missedCorrect.map(
      (key): FeedbackEntry => ({ key, text: textFor(key), kind: 'missed-correct' }),
    ),
    ...correctChosen.map(
      (key): FeedbackEntry => ({ key, text: textFor(key), kind: 'correct-chosen' }),
    ),
  ];
}

interface ActiveStudyExam {
  readonly cert: Certification;
  readonly bank: readonly Question[];
  /** Shuffled questions in display space, in `questionOrder` order. */
  readonly questions: readonly Question[];
  readonly keyMaps: ReadonlyMap<string, OptionKeyMap>;
  readonly row: SessionRow;
}

@Injectable({ providedIn: 'root' })
export class StudyExamSessionService {
  private readonly repository = inject(STUDY_REPOSITORY);

  private readonly active = signal<ActiveStudyExam | null>(null);

  readonly isActive = computed(() => this.active() !== null);
  readonly totalQuestions = computed(() => this.active()?.questions.length ?? 0);
  readonly currentIndex = computed(() => this.active()?.row.currentIndex ?? 0);
  readonly questions = computed<readonly Question[]>(() => this.active()?.questions ?? []);
  readonly currentQuestion = computed<Question | null>(() => {
    const active = this.active();
    return active ? (active.questions[active.row.currentIndex] ?? null) : null;
  });

  /** Graded questions so far: the "answered" bar (S7). */
  readonly answeredCount = computed(() => this.active()?.row.answeredCount ?? 0);
  readonly correctCount = computed(() => this.active()?.row.correctCount ?? 0);
  readonly wrongCount = computed(() => this.active()?.row.wrongCount ?? 0);
  /** Answered percentage of the whole exam; 0 before anything is graded. */
  readonly answeredPercent = computed(() => {
    const active = this.active();
    if (!active || active.questions.length === 0) {
      return 0;
    }
    return Math.round((active.row.answeredCount / active.questions.length) * 100);
  });

  /**
   * Per-domain counts behind the bars (S7, log L5), derived from the recorded
   * answers on every read. A domain nobody has answered reports zero counts;
   * no percentage is fabricated for it.
   */
  readonly domainTallies = computed<readonly DomainTally[]>(() => {
    const active = this.active();
    if (!active) {
      return [];
    }
    return active.cert.domains.map((domain) => {
      let answered = 0;
      let correct = 0;
      for (const question of active.questions) {
        if (question.domainId !== domain.id || !active.row.feedbackShown.includes(question.id)) {
          continue;
        }
        answered += 1;
        if (this.gradeStored(active, question)) {
          correct += 1;
        }
      }
      return { domainId: domain.id, answered, correct, wrong: answered - correct };
    });
  });

  /** True when an in-progress study exam exists for the cert (S10). */
  async hasInProgress(certCode: string): Promise<boolean> {
    return (await this.repository.getSession(certCode, SESSION_KIND)) !== null;
  }

  /**
   * Start a fresh attempt (S2).
   *
   * Composition is exactly the mock exam's: cert question count, domain
   * proportions with the last-domain remainder, shuffled question and option
   * order. The session row, including the option key maps, is persisted
   * before any question is exposed. Starting always begins a new attempt and
   * replaces any in-progress study session for the cert; the resume-or-
   * discard choice belongs to the start screen (S10).
   */
  async start(certCode: string, options: StudyExamStartOptions = {}): Promise<void> {
    const cert = options.cert ?? getCert(certCode);
    if (!cert) {
      throw new StudyExamSessionError(`Cannot start a study exam for unknown cert "${certCode}".`);
    }
    const bank = options.bank ?? (await loadAllQuestions(certCode));
    const available = availableExamQuestions(bank, cert);
    if (available < cert.examQuestionCount) {
      throw new StudyExamSessionError(
        `Cert "${certCode}" can supply ${available} of ${cert.examQuestionCount} exam questions; a short exam is refused.`,
      );
    }

    const startedAt = Date.now();
    const random = options.random ?? Math.random;
    const selected = selectExamQuestions(bank, cert, random);
    // The same seam pins the option shuffle, so a spec can make the display
    // space deterministic. Production passes nothing and gets Math.random
    // for both, exactly like the mock exam.
    const { questions, keyMaps } = shuffleAndMapQuestions(selected, random);

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
      // S1: untimed. There is no deadline to store and nothing ever expires.
      deadlineAt: null,
      answeredCount: 0,
      correctCount: 0,
      wrongCount: 0,
      updatedAt: startedAt,
    };

    // S2: the attempt is durable before the first question is exposed.
    await this.repository.putSession(row);

    this.active.set({ cert, bank, questions, keyMaps, row });
  }

  /**
   * Restore an in-progress attempt after a fresh app start (S9).
   *
   * Returns false when no resumable session exists. A session whose questions
   * no longer resolve against the bundled bank, or whose row is inconsistent,
   * is quarantined: it is deleted and reported as not resumable (DATA-23).
   * Resume itself writes nothing, so nothing can be re-graded or duplicated.
   */
  async resume(certCode: string): Promise<boolean> {
    const row = await this.repository.getSession(certCode, SESSION_KIND);
    if (!row) {
      return false;
    }
    const cert = getCert(certCode);
    if (!cert) {
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
    this.active.set({ cert, bank, questions, keyMaps, row });
    return true;
  }

  /**
   * Record an answer in display space and persist it before returning (S3,
   * S8).
   *
   * A single answer grades on this call. A multi, ordering, or matching
   * response is saved as a draft so auto-save and resume work mid-selection,
   * but it grades only through `submitAnswer` once complete (STUDY-9).
   * Passing an empty value clears a draft. A graded question is read-only
   * (S5): calling this for one is a `StudyExamSessionError`.
   */
  async answer(questionId: string, value: string | readonly string[]): Promise<void> {
    const active = this.requireActive();
    const question = this.requireQuestion(active, questionId);
    if (active.row.feedbackShown.includes(questionId)) {
      throw new StudyExamSessionError(
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

    // Single grades on selection: the answer and the feedback state land in
    // the same write, so storage never holds a graded answer without its
    // feedback marker or vice versa.
    const feedbackShown = [...active.row.feedbackShown, questionId].sort();
    await this.persist(active, { answers, feedbackShown });
  }

  /**
   * Grade a complete multi, ordering, or matching response on explicit
   * submit (S3, STUDY-9). The draft being graded is the one already
   * persisted, so a failed save can never leave memory and storage
   * disagreeing about what was judged.
   */
  async submitAnswer(questionId: string): Promise<void> {
    const active = this.requireActive();
    const question = this.requireQuestion(active, questionId);
    const type = questionType(question);
    if (type === 'single') {
      throw new StudyExamSessionError(
        'A single-choice answer grades on selection; there is nothing to submit.',
      );
    }
    if (active.row.feedbackShown.includes(questionId)) {
      throw new StudyExamSessionError(
        `Question "${questionId}" is already graded and read-only for the rest of the session.`,
      );
    }
    const value = decodeStored(active.row.answers[questionId], type);
    if (!this.isComplete(question, value)) {
      throw new StudyExamSessionError(
        `Question "${questionId}" needs a complete response before it can be graded.`,
      );
    }
    const feedbackShown = [...active.row.feedbackShown, questionId].sort();
    await this.persist(active, { feedbackShown });
  }

  /** Move to a question by index, persisted immediately (S8). */
  async goTo(index: number): Promise<void> {
    const active = this.requireActive();
    if (!Number.isInteger(index) || index < 0 || index >= active.questions.length) {
      throw new StudyExamSessionError(
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
    return this.isComplete(
      question,
      decodeStored(active.row.answers[questionId], questionType(question)),
    );
  }

  /** True once the question is graded and its feedback is on record (S5). */
  isGraded(questionId: string): boolean {
    return this.active()?.row.feedbackShown.includes(questionId) ?? false;
  }

  /**
   * The recorded correctness of a graded question, derived from the stored
   * answer so a resume can never disagree (log L5). Null while ungraded.
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
   * The read-only feedback for a graded question (S4, S5): the explanation
   * summary plus the per-option explanations that matter, each tagged by
   * kind so the UI can group them. Null while the question is ungraded.
   */
  feedbackFor(questionId: string): QuestionFeedback | null {
    const active = this.active();
    const question = active?.questions.find((candidate) => candidate.id === questionId);
    if (!active || !question || !active.row.feedbackShown.includes(questionId)) {
      return null;
    }
    const type = questionType(question);
    const value = decodeStored(active.row.answers[questionId], type);
    const correct = correctAnswerFor(question);
    return {
      questionId,
      isCorrect: value !== null && isAnswerCorrect(value, correct, type),
      summary: question.explanation.summary,
      options: feedbackEntries(question, type, value, correct),
    };
  }

  /**
   * Complete the exam (S11): build the attempt, question result, progress,
   * and mastery rows through the shared pure builder (log L2), commit them
   * with the session clear in exactly one local transaction, and return the
   * attempt. Questions left ungraded complete as incorrect, all-or-nothing,
   * exactly like the mock exam. A failed commit raises `StudyExamSaveError`
   * and leaves the session resumable for a retry (S8).
   */
  async complete(): Promise<AttemptRow> {
    const active = this.requireActive();
    const now = Date.now();

    const graded: GradedAnswer[] = active.questions.map((question) => {
      const type = questionType(question);
      const value = decodeStored(active.row.answers[question.id], type);
      const correct = correctAnswerFor(question);
      const keyMap = active.keyMaps.get(question.id) ?? {};
      return {
        question,
        isCorrect: value !== null && isAnswerCorrect(value, correct, type),
        userAnswer: encodeAnswerForDb(value, keyMap, type),
        correctAnswer: encodeAnswerForDb(correct, keyMap, type),
        // The study exam has no flags (log L4).
        wasFlagged: false,
      };
    });

    const priorAttempts = await this.repository.listAttempts({ cert: active.cert.code });
    const priorResults = [
      ...(
        await Promise.all(priorAttempts.map((row) => this.repository.listQuestionResults(row.id)))
      ).flat(),
      ...(await this.repository.listPracticeResults(active.cert.code)),
    ];
    const priorMastery = await this.repository.getQuestionMastery(active.cert.code);

    const rows = buildAttemptRows({
      cert: active.cert,
      kind: SESSION_KIND,
      startedAt: active.row.startedAt,
      finishedAt: now,
      // Untimed timing policy: raw elapsed wall-clock seconds, guarded only
      // against a backward clock jump. There is no exam length to clamp
      // against because there is no deadline (S1).
      timeTakenSeconds: Math.max(0, Math.floor((now - active.row.startedAt) / 1000)),
      graded,
      priorResults,
      priorMastery,
      bank: active.bank,
    });

    try {
      await this.repository.commitAnswers({
        attempt: rows.attempt,
        results: rows.results,
        progress: rows.progress,
        mastery: rows.mastery,
        clearSession: { cert: active.cert.code, kind: SESSION_KIND },
      });
    } catch (cause) {
      throw new StudyExamSaveError(
        'The completed exam could not be saved locally. The session is unchanged and the save can be retried.',
        cause,
      );
    }

    this.active.set(null);
    return rows.attempt;
  }

  /**
   * Discard the in-progress attempt without recording any history (S10). The
   * confirmation step belongs to the start screen; this only removes the row.
   */
  async discard(): Promise<void> {
    const active = this.active();
    if (!active) {
      return;
    }
    await this.repository.deleteSession(active.cert.code, SESSION_KIND);
    this.active.set(null);
  }

  private requireActive(): ActiveStudyExam {
    const active = this.active();
    if (!active) {
      throw new StudyExamSessionError('No study exam is active. Start or resume one first.');
    }
    return active;
  }

  private requireQuestion(active: ActiveStudyExam, questionId: string): Question {
    const question = active.questions.find((candidate) => candidate.id === questionId);
    if (!question) {
      throw new StudyExamSessionError(`Question "${questionId}" is not part of the active exam.`);
    }
    return question;
  }

  /**
   * Persist a session row mutation, then expose it. A failed write exposes
   * nothing and raises a retryable `StudyExamSaveError` (S8).
   */
  private async persist(active: ActiveStudyExam, patch: Partial<SessionRow>): Promise<void> {
    const row: SessionRow = { ...active.row, ...patch, updatedAt: Date.now() };
    const counts = this.deriveCounts(row, active.questions);
    row.answeredCount = counts.answered;
    row.correctCount = counts.correct;
    row.wrongCount = counts.wrong;
    try {
      await this.repository.putSession(row);
    } catch (cause) {
      throw new StudyExamSaveError(
        'The answer could not be saved locally. Nothing was recorded and the save can be retried.',
        cause,
      );
    }
    this.active.set({ ...active, row });
  }

  /**
   * Re-derive the three bar counts from the recorded answers (log L5). Only
   * graded questions count as answered, so correct plus wrong always equals
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
  private gradeStored(active: ActiveStudyExam, question: Question): boolean {
    const type = questionType(question);
    const value = decodeStored(active.row.answers[question.id], type);
    return value !== null && isAnswerCorrect(value, correctAnswerFor(question), type);
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
}
