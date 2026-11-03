/**
 * View models for the mock exam results and review screens (issue 005, S8 and S9).
 *
 * Everything here is a pure function over the attempt row, the stored question
 * result rows, and the bundled bank, so the page stays thin and the rendering
 * rules are unit testable without TestBed.
 *
 * Answer rendering contract (EXAM-41): stored answers are original bank keys,
 * because the session service translates display keys back before persisting.
 * Decoding them with the engine `decodeAnswerForDb` against the bundled
 * question therefore renders each answer in the reader's terms:
 *
 * - single and multi: the option keys with their option text;
 * - ordering: the sequence with a position per key;
 * - matching: the pairs with the left and right text.
 *
 * Per-option explanations are limited to the options that matter (EXAM-41):
 * the chosen wrong ones and the correct ones. The exact rule per type lives in
 * `relevantExplanationKeys`.
 */

import type { Certification } from '../../../core/content/certification-types';
import {
  questionType,
  type Question,
  type QuestionType,
} from '../../../core/content/question-types';
import { decodeAnswerForDb, formatTime } from '../../../core/exam';
import type {
  AttemptRow,
  DomainScoreRow,
  QuestionResultRow,
} from '../../../core/storage/types';

/** The score facts block of the results screen (EXAM-37). */
export interface ScoreFacts {
  passed: boolean;
  /** Screen reader friendly outcome phrase, never colour alone (ACC-6). */
  outcomeText: string;
  scaledScore: number;
  /** Cert passing threshold, null when the cert is unknown. */
  passingScore: number | null;
  scorePercent: number;
  correctCount: number;
  totalQuestions: number;
  /** Elapsed time in the engine MM:SS shape. */
  elapsedText: string;
}

/** One row of the per-domain breakdown (EXAM-38). */
export interface DomainBreakdownRow {
  domainId: number;
  name: string;
  correct: number;
  total: number;
  percent: number;
}

export interface AnswerLine {
  key: string;
  text: string;
}

export interface SequenceStep {
  position: number;
  key: string;
  text: string;
}

export interface MatchPair {
  left: string;
  leftText: string;
  right: string;
  rightText: string;
}

export type AnswerKind = 'none' | 'keys' | 'sequence' | 'pairs';

/**
 * One rendered answer in reader's terms. Exactly one of lines, steps and pairs
 * is populated, selected by `kind`, which keeps the template type narrowing
 * simple under strictTemplates.
 */
export interface AnswerView {
  kind: AnswerKind;
  /** Populated for `keys` (single and multi). */
  lines: AnswerLine[];
  /** Populated for `sequence` (ordering). */
  steps: SequenceStep[];
  /** Populated for `pairs` (matching). */
  pairs: MatchPair[];
}

/** One per-option explanation entry (EXAM-41). */
export interface OptionExplanationView {
  key: string;
  optionText: string;
  explanation: string;
}

/** One review card (EXAM-41). */
export interface ReviewCardView {
  /** Stable list key: the stored question result row id. */
  resultId: string;
  questionId: string;
  /** Position in the review list, starting at 1. */
  number: number;
  domainId: number;
  domainName: string;
  type: QuestionType;
  questionText: string;
  isCorrect: boolean;
  wasFlagged: boolean;
  userAnswer: AnswerView;
  correctAnswer: AnswerView;
  summary: string;
  optionExplanations: OptionExplanationView[];
}

/** Review filter: a status filter or one domain id (EXAM-40). */
export type ReviewFilter = 'all' | 'incorrect' | 'flagged' | number;

export interface DomainFilterOption {
  id: number;
  name: string;
}

/** Display name for a domain id, with a stable fallback for unknown certs. */
export function domainName(cert: Certification | null, domainId: number): string {
  return cert?.domains.find((domain) => domain.id === domainId)?.name ?? `Domain ${domainId}`;
}

/** The headline score facts (EXAM-37). */
export function buildScoreFacts(attempt: AttemptRow, cert: Certification | null): ScoreFacts {
  return {
    passed: attempt.passed,
    outcomeText: attempt.passed ? 'You passed' : 'You did not pass',
    scaledScore: attempt.scaledScore,
    passingScore: cert?.passingScore ?? null,
    scorePercent: attempt.scorePercent,
    correctCount: attempt.correctCount,
    totalQuestions: attempt.totalQuestions,
    elapsedText: formatTime(attempt.timeTakenSeconds),
  };
}

/** The per-domain breakdown in registry domain order (EXAM-38). */
export function buildDomainBreakdown(
  attempt: AttemptRow,
  cert: Certification | null,
): DomainBreakdownRow[] {
  return attempt.domainScores.map((row) => ({
    domainId: row.domainId,
    name: domainName(cert, row.domainId),
    correct: row.correct,
    total: row.total,
    percent: row.percent,
  }));
}

/**
 * The domain the student should practice next (EXAM-44): the lowest exam
 * percentage among the domains the attempt actually covered. Ties resolve to
 * the lowest domain id so the choice is stable. Domains with zero questions
 * in this exam are excluded, because their zero percent means unasked, not
 * weakest. Null when nothing was covered.
 */
export function weakestDomain(attempt: AttemptRow): DomainScoreRow | null {
  const covered = attempt.domainScores.filter((row) => row.total > 0);
  if (covered.length === 0) {
    return null;
  }
  return covered.reduce((weakest, row) => {
    if (row.percent < weakest.percent) {
      return row;
    }
    if (row.percent === weakest.percent && row.domainId < weakest.domainId) {
      return row;
    }
    return weakest;
  });
}

/**
 * Render one stored answer text in the reader's terms (EXAM-41). Empty text
 * (unanswered) renders as `none`.
 */
export function answerViewFor(text: string, question: Question): AnswerView {
  const type = questionType(question);
  const values = decodedValues(text, type);
  if (values.length === 0) {
    return { kind: 'none', lines: [], steps: [], pairs: [] };
  }
  switch (type) {
    case 'single':
    case 'multi':
      return {
        kind: 'keys',
        lines: values.map((key) => ({ key, text: optionText(question, key) })),
        steps: [],
        pairs: [],
      };
    case 'ordering':
      return {
        kind: 'sequence',
        steps: values.map((key, index) => ({
          position: index + 1,
          key,
          text: optionText(question, key),
        })),
        lines: [],
        pairs: [],
      };
    case 'matching':
      return {
        kind: 'pairs',
        pairs: values.map((token) => {
          const { left, right } = splitToken(token);
          return {
            left,
            leftText: optionText(question, left),
            right,
            rightText: question.targets?.[right] ?? '',
          };
        }),
        lines: [],
        steps: [],
      };
  }
}

/**
 * The option keys whose per-option explanations matter for this result
 * (EXAM-41): the chosen wrong ones and the correct ones.
 *
 * - single: a correct answer shows the correct key; a wrong one also shows
 *   the chosen wrong key;
 * - multi: the chosen-but-wrong keys plus the full correct set;
 * - ordering: a correct answer shows the full sequence; a wrong one shows the
 *   misplaced keys and the keys that belong in their positions;
 * - matching: a correct answer shows every pair; a wrong one shows the left
 *   keys that were paired wrong, because each pair's explanation is keyed by
 *   its left key and covers the right pairing. An unanswered matching
 *   question has no wrong tokens, so it falls back to the full correct set.
 *
 * Keys come back in the question's option order and only when the bank ships
 * an explanation for that key.
 */
export function relevantExplanationKeys(question: Question, row: QuestionResultRow): string[] {
  const type = questionType(question);
  const userValues = decodedValues(row.userAnswer, type);
  const correctValues = decodedValues(row.correctAnswer, type);

  let keys: string[];
  switch (type) {
    case 'single':
      keys = row.isCorrect ? [...correctValues] : unique([...userValues, ...correctValues]);
      break;
    case 'multi':
      keys = unique([
        ...userValues.filter((key) => !correctValues.includes(key)),
        ...correctValues,
      ]);
      break;
    case 'ordering': {
      if (row.isCorrect) {
        keys = [...correctValues];
        break;
      }
      const misplaced: string[] = [];
      const length = Math.max(userValues.length, correctValues.length);
      for (let index = 0; index < length; index += 1) {
        const userKey = userValues[index];
        const correctKey = correctValues[index];
        if (userKey !== correctKey) {
          if (userKey !== undefined) {
            misplaced.push(userKey);
          }
          if (correctKey !== undefined) {
            misplaced.push(correctKey);
          }
        }
      }
      keys = unique(misplaced);
      break;
    }
    case 'matching': {
      const correctLeftKeys = correctValues.map((token) => splitToken(token).left);
      if (row.isCorrect) {
        keys = correctLeftKeys;
        break;
      }
      const correctTargets = new Map(
        correctValues.map((token) => {
          const { left, right } = splitToken(token);
          return [left, right];
        }),
      );
      const wrongLefts = userValues
        .map((token) => splitToken(token))
        .filter(({ left, right }) => correctTargets.get(left) !== right)
        .map(({ left }) => left);
      keys = wrongLefts.length > 0 ? unique(wrongLefts) : correctLeftKeys;
      break;
    }
  }

  const optionOrder = Object.keys(question.options);
  return keys
    .filter((key) => key in question.explanation.options)
    .sort((a, b) => optionOrder.indexOf(a) - optionOrder.indexOf(b));
}

/**
 * Build one review card per stored question result row (S9, EXAM-39 to
 * EXAM-41). Rows whose question no longer resolves against the bundled bank
 * are skipped instead of crashing the screen (ACC-40), because the attempt's
 * own totals still agree with the bank the attempt ran against.
 */
export function buildReviewCards(
  rows: readonly QuestionResultRow[],
  bank: readonly Question[],
  cert: Certification | null,
): ReviewCardView[] {
  const byId = new Map(bank.map((question) => [question.id, question]));
  const cards: ReviewCardView[] = [];
  for (const row of rows) {
    const question = byId.get(row.questionId);
    if (!question) {
      continue;
    }
    cards.push({
      resultId: row.id,
      questionId: row.questionId,
      number: cards.length + 1,
      domainId: row.domainId,
      domainName: domainName(cert, row.domainId),
      type: questionType(question),
      questionText: question.question,
      isCorrect: row.isCorrect,
      wasFlagged: row.wasFlagged,
      userAnswer: answerViewFor(row.userAnswer, question),
      correctAnswer: answerViewFor(row.correctAnswer, question),
      summary: question.explanation.summary,
      optionExplanations: relevantExplanationKeys(question, row).map((key) => ({
        key,
        optionText: optionText(question, key),
        explanation: question.explanation.options[key] ?? '',
      })),
    });
  }
  return cards;
}

/** Apply one review filter (EXAM-40). */
export function applyReviewFilter(
  cards: readonly ReviewCardView[],
  filter: ReviewFilter,
): ReviewCardView[] {
  if (typeof filter === 'number') {
    return cards.filter((card) => card.domainId === filter);
  }
  if (filter === 'incorrect') {
    return cards.filter((card) => !card.isCorrect);
  }
  if (filter === 'flagged') {
    return cards.filter((card) => card.wasFlagged);
  }
  return [...cards];
}

/**
 * The per-domain filter options (EXAM-40): every cert domain, or the domains
 * present in the cards when the cert is unknown.
 */
export function domainFilters(
  cards: readonly ReviewCardView[],
  cert: Certification | null,
): DomainFilterOption[] {
  if (cert) {
    return cert.domains.map((domain) => ({ id: domain.id, name: domain.name }));
  }
  const ids = [...new Set(cards.map((card) => card.domainId))].sort((a, b) => a - b);
  return ids.map((id) => ({ id, name: `Domain ${id}` }));
}

/** Decode a stored answer text into the engine comparison shape. */
function decodedValues(text: string, type: QuestionType): string[] {
  const decoded = decodeAnswerForDb(text, type);
  if (typeof decoded === 'string') {
    return decoded === '' ? [] : [decoded];
  }
  return decoded;
}

/** Split one stored matching token `K:T` into its left and right keys. */
function splitToken(token: string): { left: string; right: string } {
  const separator = token.indexOf(':');
  if (separator === -1) {
    return { left: token, right: '' };
  }
  return { left: token.slice(0, separator), right: token.slice(separator + 1) };
}

function optionText(question: Question, key: string): string {
  return question.options[key] ?? '';
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
