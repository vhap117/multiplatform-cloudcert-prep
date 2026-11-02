import type {
  AttemptRow,
  CertProgressRow,
  QuestionMasteryRow,
  QuestionResultRow,
  SessionRow,
} from './types';

/**
 * Row validators.
 *
 * Stored rows are re-validated on every read because a row can be stale from an
 * older schema, truncated by a failed write, or corrupted by the platform. A row
 * that fails validation is skipped, never rendered and never allowed to crash a
 * screen (DATA-23, ACC-40).
 */

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isObject(value) && Object.values(value).every((item) => typeof item === 'string');
}

const SESSION_KINDS = new Set(['mock', 'study', 'practice']);

export function isAttemptRow(value: unknown): value is AttemptRow {
  if (!isObject(value)) {
    return false;
  }
  return (
    isNonEmptyString(value['id']) &&
    isNonEmptyString(value['cert']) &&
    SESSION_KINDS.has(value['kind'] as string) &&
    isFiniteNumber(value['startedAt']) &&
    isFiniteNumber(value['finishedAt']) &&
    isFiniteNumber(value['totalQuestions']) &&
    isFiniteNumber(value['correctCount']) &&
    isFiniteNumber(value['scorePercent']) &&
    isFiniteNumber(value['scaledScore']) &&
    typeof value['passed'] === 'boolean' &&
    isFiniteNumber(value['timeTakenSeconds']) &&
    Array.isArray(value['domainScores']) &&
    value['domainScores'].every(
      (score) =>
        isObject(score) &&
        isFiniteNumber(score['domainId']) &&
        isFiniteNumber(score['correct']) &&
        isFiniteNumber(score['total']) &&
        isFiniteNumber(score['percent']),
    )
  );
}

export function isQuestionResultRow(value: unknown): value is QuestionResultRow {
  if (!isObject(value)) {
    return false;
  }
  const attemptId = value['attemptId'];
  return (
    isNonEmptyString(value['id']) &&
    (attemptId === null || isNonEmptyString(attemptId)) &&
    isNonEmptyString(value['cert']) &&
    isFiniteNumber(value['domainId']) &&
    isNonEmptyString(value['questionId']) &&
    typeof value['userAnswer'] === 'string' &&
    typeof value['correctAnswer'] === 'string' &&
    typeof value['isCorrect'] === 'boolean' &&
    typeof value['wasFlagged'] === 'boolean' &&
    isFiniteNumber(value['answeredAt'])
  );
}

export function isCertProgressRow(value: unknown): value is CertProgressRow {
  if (!isObject(value)) {
    return false;
  }
  return (
    isNonEmptyString(value['id']) &&
    isNonEmptyString(value['cert']) &&
    isFiniteNumber(value['domainId']) &&
    isFiniteNumber(value['attempted']) &&
    isFiniteNumber(value['correct']) &&
    isFiniteNumber(value['masteryPercent']) &&
    isFiniteNumber(value['updatedAt'])
  );
}

export function isQuestionMasteryRow(value: unknown): value is QuestionMasteryRow {
  if (!isObject(value)) {
    return false;
  }
  const weight = value['weight'];
  return (
    isNonEmptyString(value['id']) &&
    isNonEmptyString(value['cert']) &&
    isFiniteNumber(value['domainId']) &&
    isNonEmptyString(value['questionId']) &&
    isFiniteNumber(value['correctStreak']) &&
    typeof value['lastWasWrong'] === 'boolean' &&
    isFiniteNumber(value['lastSeenAt']) &&
    typeof value['mastered'] === 'boolean' &&
    (weight === null || isFiniteNumber(weight))
  );
}

export function isSessionRow(value: unknown): value is SessionRow {
  if (!isObject(value)) {
    return false;
  }
  const deadlineAt = value['deadlineAt'];
  return (
    isNonEmptyString(value['id']) &&
    isNonEmptyString(value['cert']) &&
    SESSION_KINDS.has(value['kind'] as string) &&
    isStringArray(value['questionOrder']) &&
    isFiniteNumber(value['currentIndex']) &&
    isStringRecord(value['answers']) &&
    isStringArray(value['feedbackShown']) &&
    isFiniteNumber(value['startedAt']) &&
    (deadlineAt === null || isFiniteNumber(deadlineAt)) &&
    isFiniteNumber(value['answeredCount']) &&
    isFiniteNumber(value['correctCount']) &&
    isFiniteNumber(value['wrongCount']) &&
    isFiniteNumber(value['updatedAt'])
  );
}
