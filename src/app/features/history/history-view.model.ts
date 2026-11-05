/** Pure view-model helpers for the History and Statistics segments (issue 009). */

import type { Certification } from '../../core/content/cert-registry';
import type { Question } from '../../core/content/question-types';
import type {
  AttemptRow,
  QuestionResultRow,
  SessionKind,
} from '../../core/storage/types';
import {
  buildDomainPerformance,
  buildExamMetrics,
  type DomainPerformanceRow,
  type ExamMetrics,
} from '../home/dashboard-view.model';

export type HistoryFilter =
  | 'all'
  | 'passed'
  | 'failed'
  | 'mock'
  | 'study'
  | 'practice';

export interface KindStatistics {
  readonly kind: SessionKind;
  readonly sessions: number;
  readonly questionsAnswered: number;
  readonly correctAnswers: number;
  readonly accuracy: number;
  readonly studyTimeSeconds: number;
}

export interface HistoryStatistics {
  readonly examAttempts: number;
  readonly practiceSessions: number;
  readonly questionsAnswered: number;
  readonly accuracy: number;
  readonly studyTimeSeconds: number;
  readonly examMetrics: ExamMetrics | null;
  readonly byKind: readonly KindStatistics[];
  readonly domains: readonly DomainPerformanceRow[];
}

export function isReviewable(attempt: AttemptRow): boolean {
  return attempt.kind !== 'practice';
}

export function filterAttempts(
  attempts: readonly AttemptRow[],
  filter: HistoryFilter,
): AttemptRow[] {
  if (filter === 'all') {
    return [...attempts];
  }
  if (filter === 'passed' || filter === 'failed') {
    const passed = filter === 'passed';
    return attempts.filter(
      (attempt) => attempt.kind !== 'practice' && attempt.passed === passed,
    );
  }
  return attempts.filter((attempt) => attempt.kind === filter);
}

export function buildHistoryStatistics(
  attempts: readonly AttemptRow[],
  practiceResults: readonly QuestionResultRow[],
  bank: readonly Question[],
  cert: Certification,
): HistoryStatistics {
  const questionsAnswered = attempts.reduce(
    (sum, attempt) => sum + attempt.totalQuestions,
    0,
  );
  const correctAnswers = attempts.reduce(
    (sum, attempt) => sum + attempt.correctCount,
    0,
  );
  const studyTimeSeconds = attempts.reduce(
    (sum, attempt) => sum + attempt.timeTakenSeconds,
    0,
  );

  const kinds: SessionKind[] = ['mock', 'study', 'practice'];
  const byKind = kinds.map((kind): KindStatistics => {
    const rows = attempts.filter((attempt) => attempt.kind === kind);
    const questions = rows.reduce((sum, attempt) => sum + attempt.totalQuestions, 0);
    const correct = rows.reduce((sum, attempt) => sum + attempt.correctCount, 0);
    return {
      kind,
      sessions: rows.length,
      questionsAnswered: questions,
      correctAnswers: correct,
      accuracy: questions === 0 ? 0 : Math.round((correct / questions) * 100),
      studyTimeSeconds: rows.reduce((sum, attempt) => sum + attempt.timeTakenSeconds, 0),
    };
  });

  return {
    examAttempts: attempts.filter((attempt) => attempt.kind !== 'practice').length,
    practiceSessions: attempts.filter((attempt) => attempt.kind === 'practice').length,
    questionsAnswered,
    accuracy:
      questionsAnswered === 0
        ? 0
        : Math.round((correctAnswers / questionsAnswered) * 100),
    studyTimeSeconds,
    examMetrics: buildExamMetrics(attempts),
    byKind,
    domains: buildDomainPerformance(cert, practiceResults, bank, attempts),
  };
}
