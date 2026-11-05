import { describe, expect, it } from 'vitest';

import { getCert } from '../../core/content/cert-registry';
import type { Question } from '../../core/content/question-types';
import type { AttemptRow, QuestionResultRow, SessionRow } from '../../core/storage/types';

import {
  buildDomainPerformance,
  buildExamMetrics,
  buildNextUp,
  buildResumeCards,
  recentExamAttempts,
} from './dashboard-view.model';

const cert = getCert('clf-c02')!;
const smallCert = {
  ...cert,
  domains: [
    { id: 1, name: 'Domain one', questionCount: 2, examProportion: 0.5 },
    { id: 2, name: 'Domain two', questionCount: 1, examProportion: 0.3 },
    { id: 3, name: 'Domain three', questionCount: 1, examProportion: 0.2 },
  ],
};

function attempt(overrides: Partial<AttemptRow>): AttemptRow {
  return {
    id: 'a',
    cert: 'clf-c02',
    kind: 'mock',
    startedAt: 1,
    finishedAt: 2,
    totalQuestions: 10,
    correctCount: 5,
    scorePercent: 50,
    passed: false,
    timeTakenSeconds: 10,
    domainScores: [],
    ...overrides,
  };
}

function practiceResult(overrides: Partial<QuestionResultRow>): QuestionResultRow {
  return {
    id: 'r',
    attemptId: null,
    cert: 'clf-c02',
    domainId: 1,
    questionId: 'q1',
    userAnswer: 'A',
    correctAnswer: 'A',
    isCorrect: true,
    wasFlagged: false,
    answeredAt: 1,
    ...overrides,
  };
}

function bankQuestion(id: string, domainId: number): Question {
  return {
    id,
    domainId,
    isMultiAnswer: false,
    question: id,
    options: { A: 'A', B: 'B', C: 'C', D: 'D' },
    answer: 'A',
    explanation: { summary: '', options: {} },
  };
}

function session(overrides: Partial<SessionRow>): SessionRow {
  return {
    id: 'clf-c02:mock',
    cert: 'clf-c02',
    kind: 'mock',
    questionOrder: [],
    currentIndex: 0,
    answers: {},
    feedbackShown: [],
    flagged: [],
    optionKeyMaps: {},
    startedAt: 1,
    deadlineAt: null,
    answeredCount: 3,
    correctCount: 1,
    wrongCount: 2,
    updatedAt: 10,
    ...overrides,
  };
}

describe('buildExamMetrics', () => {
  it('returns null when no mock or study exam exists', () => {
    expect(buildExamMetrics([attempt({ kind: 'practice' })])).toBeNull();
  });

  it('computes all-time pass rate, average score, and best score from exams only', () => {
    const metrics = buildExamMetrics([
      attempt({ id: '1', kind: 'mock', passed: true, scorePercent: 80 }),
      attempt({ id: '2', kind: 'study', passed: false, scorePercent: 40 }),
      attempt({ id: '3', kind: 'practice', passed: true, scorePercent: 100 }),
    ]);

    expect(metrics).toEqual({
      attemptCount: 2,
      passRate: 50,
      averageScore: 60,
      bestScore: 80,
    });
  });
});

describe('recentExamAttempts', () => {
  it('returns the latest three exams newest first and excludes practice', () => {
    const rows = recentExamAttempts([
      attempt({ id: 'old', kind: 'mock', finishedAt: 10 }),
      attempt({ id: 'practice', kind: 'practice', finishedAt: 100 }),
      attempt({ id: 'new', kind: 'study', finishedAt: 50 }),
      attempt({ id: 'mid', kind: 'mock', finishedAt: 30 }),
      attempt({ id: 'older', kind: 'study', finishedAt: 5 }),
    ]);

    expect(rows.map((row) => row.id)).toEqual(['new', 'mid', 'old']);
  });
});

describe('buildDomainPerformance', () => {
  it('combines practice coverage and exam accuracy in study-priority order', () => {
    const bank = [
      bankQuestion('q1', 1),
      bankQuestion('q2', 1),
      bankQuestion('q3', 2),
    ];
    const rows = buildDomainPerformance(
      smallCert,
      [
        practiceResult({ domainId: 1, questionId: 'q1', isCorrect: true }),
        practiceResult({ domainId: 2, questionId: 'q3', isCorrect: true }),
      ],
      bank,
      [
        attempt({
          kind: 'mock',
          domainScores: [
            { domainId: 1, correct: 1, total: 1, percent: 100 },
            { domainId: 2, correct: 0, total: 1, percent: 0 },
          ],
        }),
      ],
    );

    // Domain 3 is unpracticed, then domain 1 at 50 percent coverage, then
    // domain 2 at 100 percent coverage.
    expect(rows.map((row) => row.domainId)).toEqual([3, 1, 2]);
    expect(rows[0]).toMatchObject({ practicePercent: 0, examPercent: null });
    expect(rows[1]).toMatchObject({ practicePercent: 50, examPercent: 100 });
    expect(rows[2]).toMatchObject({ practicePercent: 100, examPercent: 0 });
  });

  it('does not fabricate exam accuracy for a domain with no exam data', () => {
    const rows = buildDomainPerformance(smallCert, [], [bankQuestion('q1', 1)], []);
    expect(rows.every((row) => row.examPercent === null)).toBe(true);
  });
});

describe('buildNextUp', () => {
  it('phrases an unstarted domain without calling it weakest', () => {
    const rows = buildDomainPerformance(smallCert, [], [], []);
    const next = buildNextUp(smallCert, rows);

    expect(next?.domainId).toBe(1);
    expect(next?.text).toBe('You have not practiced Domain one yet.');
  });

  it('keeps first-unstarted order in cert order even after exam sorting', () => {
    const rows = buildDomainPerformance(smallCert, [], [], []).map((row) => ({
      ...row,
      practiced: row.domainId === 1,
      practicePercent: row.domainId === 1 ? 80 : 0,
      examPercent: row.domainId === 2 ? 100 : null,
    }));
    const next = buildNextUp(smallCert, rows);

    expect(next?.domainId).toBe(2);
    expect(next?.text).toBe('You have not practiced Domain two yet.');
  });

  it('labels the lowest practiced domain as weakest once all are practiced', () => {
    const rows = buildDomainPerformance(smallCert, [], [], []).map((row, index) => ({
      ...row,
      practiced: true,
      practicePercent: index === 2 ? 25 : 80,
    }));
    const next = buildNextUp(smallCert, rows);

    expect(next?.domainId).toBe(3);
    expect(next?.text).toContain('Weakest domain');
  });
});

describe('buildResumeCards', () => {
  it('returns only the selected cert, newest activity first', () => {
    const cards = buildResumeCards(
      [
        session({ id: 'clf-c02:mock', kind: 'mock', updatedAt: 10 }),
        session({ id: 'clf-c02:study', kind: 'study', updatedAt: 30 }),
        session({ id: 'aif-c01:practice', cert: 'aif-c01', kind: 'practice', updatedAt: 40 }),
      ],
      cert,
    );

    expect(cards.map((card) => card.kind)).toEqual(['study', 'mock']);
    expect(cards.every((card) => card.certCode === 'clf-c02')).toBe(true);
  });
});
