/**
 * Shared attempt-row builder for completed exam sessions (issue 006 log L2).
 *
 * One pure builder produces the attempt, question result, cert progress, and
 * question mastery rows that `StudyRepository.commitAnswers` writes in a
 * single transaction, so history, mastery, and best score consume one row
 * shape across exam modes (STUDY-44 to STUDY-51). The builder is additive:
 * the mock exam keeps its current inline path until a later issue adopts
 * this, because refactoring the merged mock session service inside the study
 * feature is how issue 005 gets broken.
 *
 * Pure and storage-shape only: no Angular, no storage adapter, no clock, no
 * randomness. The caller owns two policies on purpose:
 *
 * - grading: answers arrive already graded, already encoded in original bank
 *   keys (the display-space shuffle is a feature concern);
 * - timing: `timeTakenSeconds` is passed in. The timed mock exam clamps to
 *   the exam length through `computeExamTiming`; the untimed study exam
 *   records raw elapsed wall-clock seconds, because it has no exam length to
 *   clamp against (STUDY-1).
 *
 * Domains with no questions in the attempt are omitted from `domainScores`
 * instead of being written with an invented 0 percent (STUDY-50): a 0 there
 * would read as "weakest domain" rather than "not asked".
 */

import type { Certification } from '../content/certification-types';
import type { Question } from '../content/question-types';
import {
  calculateDomainMastery,
  calculateScaledScore,
  getDomainScore,
  isPassed,
  type DomainResult,
} from '../exam';
import type {
  AttemptRow,
  CertProgressRow,
  DomainScoreRow,
  QuestionMasteryRow,
  QuestionResultRow,
  SessionKind,
} from '../storage/types';

import {
  ageMasteryForSession,
  applyMasteryAnswer,
  type MasteryRowState,
} from './mastery';

/**
 * One graded question, reduced to what the stored rows need.
 *
 * `userAnswer` and `correctAnswer` are the canonical stored texts in original
 * bank keys (`encodeAnswerForDb` output); an empty user answer means the
 * question was never answered and graded incorrect.
 */
export interface GradedAnswer {
  readonly question: Question;
  readonly isCorrect: boolean;
  readonly userAnswer: string;
  readonly correctAnswer: string;
  readonly wasFlagged: boolean;
}

export interface BuildAttemptRowsInput {
  readonly cert: Certification;
  readonly kind: SessionKind;
  readonly startedAt: number;
  readonly finishedAt: number;
  /** Seconds to persist; the caller owns the timing policy (see file header). */
  readonly timeTakenSeconds: number;
  readonly graded: readonly GradedAnswer[];
  /**
   * Every prior question result for the cert, from earlier attempts and from
   * domain practice, so the progress rows accumulate instead of overwriting.
   */
  readonly priorResults: readonly QuestionResultRow[];
  /** Existing per-question mastery rows for the cert, folded into the new ones. */
  readonly priorMastery: readonly QuestionMasteryRow[];
  /** The full cert bank, used to intersect mastery coverage (SR-31). */
  readonly bank: readonly Question[];
}

/** The four row sets `CommitAnswersInput` persists in one transaction. */
export interface AttemptRows {
  readonly attempt: AttemptRow;
  readonly results: QuestionResultRow[];
  readonly progress: CertProgressRow[];
  readonly mastery: QuestionMasteryRow[];
}

/**
 * Build every row for one completed session.
 *
 * The shapes mirror what the mock exam writes today field for field: composed
 * ids, rounded percents, the AWS scaled band, engine mastery weights, and
 * bank-coverage mastery percentages.
 */
export function buildAttemptRows(input: BuildAttemptRowsInput): AttemptRows {
  const { cert, kind, startedAt, finishedAt, timeTakenSeconds, graded } = input;
  const total = graded.length;
  const correctCount = graded.filter((entry) => entry.isCorrect).length;
  const scaledScore = calculateScaledScore(correctCount, total);

  const attempt: AttemptRow = {
    id: `${cert.code}:${kind}:${startedAt}`,
    cert: cert.code,
    kind,
    startedAt,
    finishedAt,
    totalQuestions: total,
    correctCount,
    scorePercent: total === 0 ? 0 : Math.round((correctCount / total) * 100),
    scaledScore,
    passed: isPassed(scaledScore, cert.passingScore),
    timeTakenSeconds,
    domainScores: domainScores(cert, graded),
  };

  const results: QuestionResultRow[] = graded.map((entry) => ({
    id: `${attempt.id}:${entry.question.id}`,
    attemptId: attempt.id,
    cert: cert.code,
    domainId: entry.question.domainId,
    questionId: entry.question.id,
    userAnswer: entry.userAnswer,
    correctAnswer: entry.correctAnswer,
    isCorrect: entry.isCorrect,
    wasFlagged: entry.wasFlagged,
    answeredAt: finishedAt,
  }));

  return {
    attempt,
    results,
    progress: progressRows(input, results),
    mastery: masteryRows(input),
  };
}

/**
 * Per-domain scores in registry domain order. A domain the attempt did not
 * ask is omitted entirely, because writing it with a computed 0 percent would
 * fabricate a weakest domain out of an unasked one (STUDY-50).
 */
function domainScores(cert: Certification, graded: readonly GradedAnswer[]): DomainScoreRow[] {
  const domainResults: DomainResult[] = graded.map((entry) => ({
    domainId: entry.question.domainId,
    isCorrect: entry.isCorrect,
  }));
  return cert.domains
    .map((domain) => {
      const rows = graded.filter((entry) => entry.question.domainId === domain.id);
      return {
        domainId: domain.id,
        correct: rows.filter((entry) => entry.isCorrect).length,
        total: rows.length,
        percent: getDomainScore(domainResults, domain.id),
      };
    })
    .filter((row) => row.total > 0);
}

/**
 * Recompute the per-domain aggregates from every stored result plus this
 * attempt, so a retake accumulates instead of overwriting. Mastery percent is
 * bank coverage from the engine: distinct correctly answered questions that
 * still exist in the current bank (SR-27, SR-31).
 */
function progressRows(
  input: BuildAttemptRowsInput,
  results: readonly QuestionResultRow[],
): CertProgressRow[] {
  const { cert, bank, finishedAt } = input;
  const all = [...input.priorResults, ...results];

  const bankIdsByDomain = new Map<number, Set<string>>();
  for (const question of bank) {
    const ids = bankIdsByDomain.get(question.domainId) ?? new Set<string>();
    ids.add(question.id);
    bankIdsByDomain.set(question.domainId, ids);
  }

  return cert.domains.map((domain) => {
    const rows = all.filter((row) => row.domainId === domain.id);
    const bankIds = bankIdsByDomain.get(domain.id) ?? new Set<string>();
    const covered = new Set(
      rows.filter((row) => row.isCorrect && bankIds.has(row.questionId)).map((row) => row.questionId),
    );
    return {
      id: `${cert.code}:${domain.id}`,
      cert: cert.code,
      domainId: domain.id,
      attempted: rows.length,
      correct: rows.filter((row) => row.isCorrect).length,
      masteryPercent: calculateDomainMastery(covered.size, domain.id, cert.code),
      updatedAt: finishedAt,
    };
  });
}

/**
 * Fold this attempt into per-question mastery through the mastery writer
 * (issue 007, S10). Every answered question starts or restarts its exclusion
 * window, so a mastered answer rests at a null weight. A completed practice
 * session also ages every prior row of the domains it asked that the session
 * did not answer, so the window advances and expires (SR-16). Only practice
 * sessions age the counter, because the window is counted in practice
 * sessions of the domain (issue 007 log L2); a study or mock session leaves
 * the rows it did not answer untouched.
 */
function masteryRows(input: BuildAttemptRowsInput): QuestionMasteryRow[] {
  const { cert, kind, finishedAt, graded } = input;
  const existing = new Map(input.priorMastery.map((row) => [row.questionId, row]));
  const rows: QuestionMasteryRow[] = graded.map((entry) => {
    const next = applyMasteryAnswer(toMasteryState(existing.get(entry.question.id)), {
      isCorrect: entry.isCorrect,
      answeredAt: finishedAt,
    });
    return {
      id: `${cert.code}:${entry.question.id}`,
      cert: cert.code,
      domainId: entry.question.domainId,
      questionId: entry.question.id,
      correctStreak: next.correctStreak,
      lastWasWrong: next.lastWasWrong,
      lastSeenAt: next.lastSeenAt,
      mastered: next.mastered,
      sessionsSinceSeen: next.sessionsSinceSeen,
      weight: next.weight,
    };
  });

  if (kind !== 'practice') {
    return rows;
  }
  const asked = new Set(graded.map((entry) => entry.question.id));
  const sessionDomains = new Set(graded.map((entry) => entry.question.domainId));
  for (const row of input.priorMastery) {
    if (asked.has(row.questionId) || !sessionDomains.has(row.domainId)) {
      continue;
    }
    const aged = ageMasteryForSession(toMasteryState(row));
    rows.push({ ...row, sessionsSinceSeen: aged.sessionsSinceSeen, weight: aged.weight });
  }
  return rows;
}

/** Map a stored row to the writer state; a missing counter reads as 0 (issue 007 log L3). */
function toMasteryState(row: QuestionMasteryRow): MasteryRowState;
function toMasteryState(row: QuestionMasteryRow | undefined): MasteryRowState | undefined;
function toMasteryState(row: QuestionMasteryRow | undefined): MasteryRowState | undefined {
  if (row === undefined) {
    return undefined;
  }
  return {
    correctStreak: row.correctStreak,
    lastWasWrong: row.lastWasWrong,
    mastered: row.mastered,
    sessionsSinceSeen: row.sessionsSinceSeen ?? 0,
    weight: row.weight,
    lastSeenAt: row.lastSeenAt,
  };
}
