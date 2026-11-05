/**
 * Pure view-model builders for the cert dashboard (issue 008).
 *
 * The dashboard has three independent data sections: exam performance,
 * combined domain performance, and in-progress sessions. These functions keep
 * the calculations out of the component so the page can focus on loading and
 * section-level errors.
 */

import type { Certification } from '../../core/content/cert-registry';
import type { Question } from '../../core/content/question-types';
import { findNextDomainAction } from '../../core/exam';
import type { AttemptRow, QuestionResultRow, SessionKind, SessionRow } from '../../core/storage/types';

export interface ExamMetrics {
  readonly attemptCount: number;
  readonly passRate: number;
  readonly averageScore: number;
  readonly bestScore: number;
}

export interface RecentExamAttempt {
  readonly id: string;
  readonly kind: 'mock' | 'study';
  readonly passed: boolean;
  readonly scorePercent: number;
  readonly finishedAt: number;
}

export interface DomainPerformanceRow {
  readonly domainId: number;
  readonly name: string;
  readonly practiced: boolean;
  readonly practicePercent: number;
  /** Null means no mock or study exam has covered this domain yet. */
  readonly examPercent: number | null;
}

export interface NextUpView {
  readonly domainId: number;
  readonly domainName: string;
  readonly text: string;
  readonly percent: number | null;
}

export interface ResumeCardView {
  readonly kind: SessionKind;
  readonly certCode: string;
  readonly certName: string;
  readonly answeredCount: number;
  readonly updatedAt: number;
}

export function isExamAttempt(attempt: AttemptRow): attempt is AttemptRow & {
  kind: 'mock' | 'study';
} {
  return attempt.kind === 'mock' || attempt.kind === 'study';
}

/** All-time exam metrics for the selected cert. Practice rows are excluded. */
export function buildExamMetrics(attempts: readonly AttemptRow[]): ExamMetrics | null {
  const exams = attempts.filter(isExamAttempt);
  if (exams.length === 0) {
    return null;
  }
  const passed = exams.filter((attempt) => attempt.passed).length;
  const totalScore = exams.reduce((sum, attempt) => sum + attempt.scorePercent, 0);
  return {
    attemptCount: exams.length,
    passRate: Math.round((passed / exams.length) * 100),
    averageScore: Math.round(totalScore / exams.length),
    bestScore: Math.max(...exams.map((attempt) => attempt.scorePercent)),
  };
}

/** Newest completed mock or study exams, capped for the dashboard list. */
export function recentExamAttempts(
  attempts: readonly AttemptRow[],
  limit = 3,
): RecentExamAttempt[] {
  return attempts
    .filter(isExamAttempt)
    .sort((a, b) => b.finishedAt - a.finishedAt)
    .slice(0, limit)
    .map((attempt) => ({
      id: attempt.id,
      kind: attempt.kind,
      passed: attempt.passed,
      scorePercent: attempt.scorePercent,
      finishedAt: attempt.finishedAt,
    }));
}

/**
 * One combined row per domain: practice coverage first, then exam accuracy.
 * Rows are ordered by lowest practice coverage, then lowest exam accuracy,
 * with cert order as the final tie-break. Domains with no exam data come after
 * domains that do when coverage is equal.
 */
export function buildDomainPerformance(
  cert: Certification,
  practiceResults: readonly QuestionResultRow[],
  bank: readonly Question[],
  examAttempts: readonly AttemptRow[],
): DomainPerformanceRow[] {
  const bankIdsByDomain = new Map<number, Set<string>>();
  for (const question of bank) {
    const ids = bankIdsByDomain.get(question.domainId) ?? new Set<string>();
    ids.add(question.id);
    bankIdsByDomain.set(question.domainId, ids);
  }

  const practiceByDomain = new Map<number, QuestionResultRow[]>();
  for (const row of practiceResults) {
    const rows = practiceByDomain.get(row.domainId) ?? [];
    rows.push(row);
    practiceByDomain.set(row.domainId, rows);
  }

  const examTotals = new Map<number, { correct: number; total: number }>();
  for (const attempt of examAttempts.filter(isExamAttempt)) {
    for (const score of attempt.domainScores) {
      const current = examTotals.get(score.domainId) ?? { correct: 0, total: 0 };
      current.correct += score.correct;
      current.total += score.total;
      examTotals.set(score.domainId, current);
    }
  }

  const rows = cert.domains.map((domain): DomainPerformanceRow => {
    const practiceRows = practiceByDomain.get(domain.id) ?? [];
    const bankIds = bankIdsByDomain.get(domain.id) ?? new Set<string>();
    const covered = new Set(
      practiceRows
        .filter((row) => row.isCorrect && bankIds.has(row.questionId))
        .map((row) => row.questionId),
    );
    const exam = examTotals.get(domain.id);
    const bankTotal = bankIds.size > 0 ? bankIds.size : domain.questionCount;
    return {
      domainId: domain.id,
      name: domain.name,
      practiced: practiceRows.length > 0,
      practicePercent:
        bankTotal > 0 ? Math.min(100, Math.round((covered.size / bankTotal) * 100)) : 0,
      examPercent: exam && exam.total > 0 ? Math.round((exam.correct / exam.total) * 100) : null,
    };
  });

  return rows.sort(
    (a, b) =>
      a.practicePercent - b.practicePercent ||
      examSortValue(a.examPercent) - examSortValue(b.examPercent) ||
      a.domainId - b.domainId,
  );
}

function examSortValue(percent: number | null): number {
  return percent === null ? 101 : percent;
}

/** The issue 004 recommendation over the combined practice coverage rows. */
export function buildNextUp(
  cert: Certification,
  rows: readonly DomainPerformanceRow[],
): NextUpView | null {
  const byDomain = new Map(rows.map((row) => [row.domainId, row]));
  const action = findNextDomainAction(
    cert.domains.map((domain) => {
      const row = byDomain.get(domain.id);
      return {
        domainId: domain.id,
        percent: row?.practicePercent ?? 0,
        practiced: row?.practiced ?? false,
      };
    }),
  );
  if (!action) {
    return null;
  }
  const row = rows.find((candidate) => candidate.domainId === action.domainId);
  if (!row) {
    return null;
  }
  if (action.kind === 'unstarted') {
    return {
      domainId: row.domainId,
      domainName: row.name,
      text: `You have not practiced ${row.name} yet.`,
      percent: null,
    };
  }
  return {
    domainId: row.domainId,
    domainName: row.name,
    text: `Weakest domain: ${row.name} (${row.practicePercent}%).`,
    percent: row.practicePercent,
  };
}

/** One card per in-progress session kind for the selected cert. */
export function buildResumeCards(
  sessions: readonly SessionRow[],
  cert: Certification,
): ResumeCardView[] {
  return sessions
    .filter((session) => session.cert === cert.code)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((session) => ({
      kind: session.kind,
      certCode: cert.code,
      certName: cert.name,
      answeredCount: session.answeredCount,
      updatedAt: session.updatedAt,
    }));
}
