import { describe, expect, it } from 'vitest';

import { getCert } from '../../core/content/cert-registry';
import type { AttemptRow } from '../../core/storage/types';

import {
  buildHistoryStatistics,
  filterAttempts,
  isReviewable,
} from './history-view.model';

function attempt(overrides: Partial<AttemptRow>): AttemptRow {
  return {
    id: 'a',
    cert: 'clf-c02',
    kind: 'mock',
    startedAt: 1,
    finishedAt: 2,
    totalQuestions: 10,
    correctCount: 8,
    scorePercent: 80,
    passed: true,
    timeTakenSeconds: 100,
    domainScores: [],
    ...overrides,
  };
}

const cert = getCert('clf-c02')!;

describe('filterAttempts', () => {
  const rows = [
    attempt({ id: 'mock-pass', kind: 'mock', passed: true }),
    attempt({ id: 'study-fail', kind: 'study', passed: false }),
    attempt({ id: 'practice', kind: 'practice', passed: true }),
  ];

  it('keeps every row under all', () => {
    expect(filterAttempts(rows, 'all').map((row) => row.id)).toEqual([
      'mock-pass',
      'study-fail',
      'practice',
    ]);
  });

  it('applies passed and failed only to exam attempts', () => {
    expect(filterAttempts(rows, 'passed').map((row) => row.id)).toEqual(['mock-pass']);
    expect(filterAttempts(rows, 'failed').map((row) => row.id)).toEqual(['study-fail']);
  });

  it('filters by kind', () => {
    expect(filterAttempts(rows, 'mock').map((row) => row.id)).toEqual(['mock-pass']);
    expect(filterAttempts(rows, 'study').map((row) => row.id)).toEqual(['study-fail']);
    expect(filterAttempts(rows, 'practice').map((row) => row.id)).toEqual(['practice']);
  });
});

describe('isReviewable', () => {
  it('allows exams but not practice sessions', () => {
    expect(isReviewable(attempt({ kind: 'mock' }))).toBe(true);
    expect(isReviewable(attempt({ kind: 'study' }))).toBe(true);
    expect(isReviewable(attempt({ kind: 'practice' }))).toBe(false);
  });
});

describe('buildHistoryStatistics', () => {
  it('computes totals, exam metrics, and per-kind splits', () => {
    const attempts = [
      attempt({ kind: 'mock', totalQuestions: 10, correctCount: 8, timeTakenSeconds: 100 }),
      attempt({
        kind: 'study',
        totalQuestions: 10,
        correctCount: 5,
        scorePercent: 50,
        passed: false,
        timeTakenSeconds: 100,
      }),
      attempt({
        kind: 'practice',
        totalQuestions: 20,
        correctCount: 20,
        scorePercent: 100,
        timeTakenSeconds: 50,
      }),
    ];

    const stats = buildHistoryStatistics(attempts, [], [], cert);

    expect(stats.examAttempts).toBe(2);
    expect(stats.practiceSessions).toBe(1);
    expect(stats.questionsAnswered).toBe(40);
    expect(stats.accuracy).toBe(83);
    expect(stats.studyTimeSeconds).toBe(250);
    expect(stats.examMetrics).toEqual({
      attemptCount: 2,
      passRate: 50,
      averageScore: 65,
      bestScore: 80,
    });
    expect(stats.byKind.map((row) => [row.kind, row.sessions, row.accuracy])).toEqual([
      ['mock', 1, 80],
      ['study', 1, 50],
      ['practice', 1, 100],
    ]);
  });
});
