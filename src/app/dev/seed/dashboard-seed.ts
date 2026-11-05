/**
 * Development-only dashboard seed (issue 008).
 *
 * The seeder writes a deterministic, repeatable data set through the
 * `StudyRepository` interface, never through IndexedDB directly (IONIC-20).
 * It is destructive for the two seeded certs: each run resets them first so
 * the same ids and counts land every time.
 */

import { getCert } from '../../core/content/cert-registry';
import { loadAllQuestions } from '../../core/content/question-loader';
import {
  questionType,
  type Question,
} from '../../core/content/question-types';
import {
  correctAnswerFor,
  encodeAnswerForDb,
  type OptionKeyMap,
} from '../../core/exam';
import { foldMasteryHistory } from '../../core/exam-session/mastery';
import { SETTINGS_KEYS, writeSetting } from '../../core/settings/local-settings';
import type {
  AttemptRow,
  CertProgressRow,
  DomainScoreRow,
  QuestionMasteryRow,
  QuestionResultRow,
  SessionKind,
  SessionRow,
} from '../../core/storage/types';
import type { StudyRepository } from '../../core/storage/study-repository';

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const SEEDED_CERTS = ['clf-c02', 'aif-c01'] as const;

interface ExamSpec {
  readonly kind: 'mock' | 'study';
  readonly daysAgo: number;
  readonly scorePercent: number;
  readonly passed: boolean;
  readonly timeTakenSeconds: number;
}

const CLF_EXAMS: readonly ExamSpec[] = [
  { kind: 'mock', daysAgo: 1, scorePercent: 86, passed: true, timeTakenSeconds: 3_120 },
  { kind: 'study', daysAgo: 3, scorePercent: 74, passed: true, timeTakenSeconds: 2_640 },
  { kind: 'mock', daysAgo: 5, scorePercent: 62, passed: false, timeTakenSeconds: 3_300 },
  { kind: 'study', daysAgo: 8, scorePercent: 91, passed: true, timeTakenSeconds: 2_100 },
  { kind: 'mock', daysAgo: 12, scorePercent: 55, passed: false, timeTakenSeconds: 3_420 },
];

const AIF_EXAMS: readonly ExamSpec[] = [
  { kind: 'mock', daysAgo: 2, scorePercent: 70, passed: true, timeTakenSeconds: 3_000 },
];

/** Practice coverage targets for CLF-C02: domain 4 is deliberately untouched. */
const PRACTICE_COVERAGE: Readonly<Record<number, number>> = {
  1: 25,
  2: 65,
  3: 40,
};

export interface SeedResult {
  readonly certs: readonly string[];
  readonly attempts: number;
  readonly examResults: number;
  readonly practiceResults: number;
  readonly sessions: number;
  readonly progressRows: number;
  readonly masteryRows: number;
}

export async function seedDashboard(
  repository: StudyRepository,
  now: number = Date.now(),
): Promise<SeedResult> {
  for (const cert of SEEDED_CERTS) {
    await repository.resetCert(cert);
  }

  const clfBank = await loadAllQuestions('clf-c02');
  const aifBank = await loadAllQuestions('aif-c01');

  const examSeeds = [
    ...buildExams('clf-c02', CLF_EXAMS, now, 3, clfBank),
    ...buildExams('aif-c01', AIF_EXAMS, now, 5, aifBank),
  ];
  const attempts = [...examSeeds.map((seed) => seed.attempt), buildPracticeAttempt('clf-c02', now)];
  for (const seed of examSeeds) {
    await repository.commitAnswers({
      attempt: seed.attempt,
      results: seed.results,
      progress: [],
      mastery: [],
    });
  }
  await repository.commitAnswers({
    attempt: attempts[attempts.length - 1] ?? null,
    results: [],
    progress: [],
    mastery: [],
  });

  const practiceResults = buildPracticeResults('clf-c02', clfBank, now);
  const progress = buildProgressRows('clf-c02', clfBank, attempts, practiceResults, now);
  const mastery = buildMasteryRows('clf-c02', practiceResults);
  await repository.commitAnswers({
    attempt: null,
    results: practiceResults,
    progress,
    mastery,
  });

  const sessions = buildSessions(now, clfBank, aifBank);
  for (const session of sessions) {
    await repository.putSession(session);
  }

  writeSetting(SETTINGS_KEYS.selectedCert, 'clf-c02');

  return {
    certs: SEEDED_CERTS,
    attempts: attempts.length,
    examResults: examSeeds.reduce((sum, seed) => sum + seed.results.length, 0),
    practiceResults: practiceResults.length,
    sessions: sessions.length,
    progressRows: progress.length,
    masteryRows: mastery.length,
  };
}

/** Reset only the seeded certs, leaving any other local cert data untouched. */
export async function clearDashboardSeed(repository: StudyRepository): Promise<void> {
  for (const cert of SEEDED_CERTS) {
    await repository.resetCert(cert);
  }
}

function buildExams(
  certCode: string,
  specs: readonly ExamSpec[],
  now: number,
  domainCount: number,
  bank: readonly Question[],
): { attempt: AttemptRow; results: QuestionResultRow[] }[] {
  return specs.map((spec, index) => {
    const finishedAt = now - spec.daysAgo * DAY;
    const startedAt = finishedAt - spec.timeTakenSeconds * 1000;
    const totalQuestions = 65;
    const correctCount = Math.round((spec.scorePercent / 100) * totalQuestions);
    const attempt: AttemptRow = {
      id: `${certCode}:seed:${spec.kind}:${startedAt}`,
      cert: certCode,
      kind: spec.kind,
      startedAt,
      finishedAt,
      totalQuestions,
      correctCount,
      scorePercent: spec.scorePercent,
      passed: spec.passed,
      timeTakenSeconds: spec.timeTakenSeconds,
      domainScores: buildDomainScores(certCode, spec.scorePercent, domainCount, index),
    };
    const questions = bank
      .filter((question) => question.domainId <= domainCount)
      .slice(0, 12);
    const results = questions.map((question, questionIndex): QuestionResultRow => {
      const isCorrect = questionIndex < Math.round((spec.scorePercent / 100) * questions.length);
      const answer = correctAnswerFor(question);
      const encoded = encodeAnswerForDb(answer, identityMap(question), questionType(question));
      return {
        id: `${attempt.id}:${question.id}`,
        attemptId: attempt.id,
        cert: certCode,
        domainId: question.domainId,
        questionId: question.id,
        userAnswer: isCorrect ? encoded : '',
        correctAnswer: encoded,
        isCorrect,
        wasFlagged: questionIndex % 4 === 0,
        answeredAt: finishedAt,
      };
    });
    return { attempt, results };
  });
}

function buildPracticeAttempt(certCode: string, now: number): AttemptRow {
  const finishedAt = now - 4 * HOUR;
  return {
    id: `${certCode}:seed:practice:${finishedAt}`,
    cert: certCode,
    kind: 'practice',
    startedAt: finishedAt - 600_000,
    finishedAt,
    totalQuestions: 20,
    correctCount: 20,
    scorePercent: 100,
    passed: true,
    timeTakenSeconds: 600,
    domainScores: [{ domainId: 1, correct: 20, total: 20, percent: 100 }],
  };
}

function buildDomainScores(
  certCode: string,
  scorePercent: number,
  domainCount: number,
  attemptIndex: number,
): DomainScoreRow[] {
  const domains = getCert(certCode)?.domains ?? [];
  return domains.slice(0, domainCount).map((domain, index) => {
    const total = Math.max(5, Math.round(65 / domainCount));
    const offset = (index - 1) * 4 + (attemptIndex % 3) - 1;
    const percent = Math.min(100, Math.max(0, scorePercent + offset));
    const correct = Math.round((percent / 100) * total);
    return {
      domainId: domain.id,
      correct,
      total,
      percent: total > 0 ? Math.round((correct / total) * 100) : 0,
    };
  });
}

function buildPracticeResults(
  certCode: string,
  bank: readonly Question[],
  now: number,
): QuestionResultRow[] {
  const byDomain = new Map<number, Question[]>();
  for (const question of bank) {
    const rows = byDomain.get(question.domainId) ?? [];
    rows.push(question);
    byDomain.set(question.domainId, rows);
  }

  const results: QuestionResultRow[] = [];
  let index = 0;
  for (const [domainId, percent] of Object.entries(PRACTICE_COVERAGE)) {
    const questions = byDomain.get(Number(domainId)) ?? [];
    const count = Math.round((percent / 100) * questions.length);
    for (const question of questions.slice(0, count)) {
      const answer = correctAnswerFor(question);
      const type = questionType(question);
      const encoded = encodeAnswerForDb(answer, identityMap(question), type);
      results.push({
        id: `seed:${certCode}:practice:${question.id}`,
        attemptId: null,
        cert: certCode,
        domainId: question.domainId,
        questionId: question.id,
        userAnswer: encoded,
        correctAnswer: encoded,
        isCorrect: true,
        wasFlagged: false,
        answeredAt: now - 2 * DAY + index,
      });
      index += 1;
    }
  }
  return results;
}

function buildProgressRows(
  certCode: string,
  bank: readonly Question[],
  attempts: readonly AttemptRow[],
  practiceResults: readonly QuestionResultRow[],
  now: number,
): CertProgressRow[] {
  const examAttempts = attempts.filter(
    (attempt) => attempt.cert === certCode && attempt.kind !== 'practice',
  );
  const totalByDomain = new Map<number, number>();
  for (const question of bank) {
    totalByDomain.set(question.domainId, (totalByDomain.get(question.domainId) ?? 0) + 1);
  }

  return (getCert(certCode)?.domains ?? []).map((domain) => {
    const examRows = examAttempts.flatMap((attempt) =>
      attempt.domainScores.filter((row) => row.domainId === domain.id),
    );
    const practiceRows = practiceResults.filter((row) => row.domainId === domain.id);
    const attempted =
      examRows.reduce((sum, row) => sum + row.total, 0) + practiceRows.length;
    const correct =
      examRows.reduce((sum, row) => sum + row.correct, 0) +
      practiceRows.filter((row) => row.isCorrect).length;
    const covered = new Set(
      practiceRows.filter((row) => row.isCorrect).map((row) => row.questionId),
    ).size;
    const bankTotal = totalByDomain.get(domain.id) ?? domain.questionCount;
    return {
      id: `${certCode}:${domain.id}`,
      cert: certCode,
      domainId: domain.id,
      attempted,
      correct,
      masteryPercent: bankTotal > 0 ? Math.min(100, Math.round((covered / bankTotal) * 100)) : 0,
      updatedAt: now,
    };
  });
}

function buildMasteryRows(
  certCode: string,
  results: readonly QuestionResultRow[],
): QuestionMasteryRow[] {
  return results.flatMap((result) => {
    const state = foldMasteryHistory([
      { isCorrect: result.isCorrect, answeredAt: result.answeredAt },
    ]);
    if (!state) {
      return [];
    }
    return [
      {
        id: `${certCode}:${result.questionId}`,
        cert: certCode,
        domainId: result.domainId,
        questionId: result.questionId,
        correctStreak: state.correctStreak,
        lastWasWrong: state.lastWasWrong,
        lastSeenAt: state.lastSeenAt,
        mastered: state.mastered,
        sessionsSinceSeen: state.sessionsSinceSeen,
        weight: state.weight,
      },
    ];
  });
}

function buildSessions(now: number, clfBank: Question[], aifBank: Question[]): SessionRow[] {
  return [
    makeSession('clf-c02', 'mock', clfBank.slice(0, 10), 3, 3, now - HOUR, now + 30 * 60 * 1000),
    makeSession('clf-c02', 'study', clfBank.slice(10, 20), 2, 2, now - 2 * HOUR, null),
    makeSession('clf-c02', 'practice', clfBank.slice(20, 28), 1, 1, now - 3 * HOUR, null),
    makeSession('aif-c01', 'practice', aifBank.slice(0, 6), 1, 1, now - 4 * HOUR, null),
  ];
}

function makeSession(
  certCode: string,
  kind: SessionKind,
  questions: readonly Question[],
  currentIndex: number,
  answeredCount: number,
  updatedAt: number,
  deadlineAt: number | null,
): SessionRow {
  const keyMaps: Record<string, OptionKeyMap> = {};
  const answers: Record<string, string> = {};
  for (const question of questions) {
    const map = identityMap(question);
    keyMaps[question.id] = map;
  }
  for (const question of questions.slice(0, answeredCount)) {
    const answer = correctAnswerFor(question);
    answers[question.id] = encodeAnswerForDb(answer, keyMaps[question.id] ?? {}, questionType(question));
  }
  const feedbackShown = kind === 'mock' ? [] : questions.slice(0, answeredCount).map((q) => q.id);
  const correctCount = kind === 'mock' ? 0 : answeredCount;
  return {
    id: `${certCode}:${kind}`,
    cert: certCode,
    kind,
    questionOrder: questions.map((question) => question.id),
    currentIndex,
    answers,
    feedbackShown,
    flagged: kind === 'mock' && questions[0] ? [questions[0].id] : [],
    optionKeyMaps: keyMaps,
    startedAt: updatedAt - 600_000,
    deadlineAt,
    answeredCount,
    correctCount,
    wrongCount: kind === 'mock' ? 0 : answeredCount - correctCount,
    updatedAt,
  };
}

function identityMap(question: Question): OptionKeyMap {
  return Object.fromEntries(Object.keys(question.options).map((key) => [key, key]));
}

/** Exposed for the dev screen's status copy; not part of the dashboard flow. */
export function seededCertCodes(): readonly string[] {
  return SEEDED_CERTS;
}
