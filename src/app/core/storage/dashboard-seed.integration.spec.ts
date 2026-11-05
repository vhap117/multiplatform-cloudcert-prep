import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getCert } from '../content/cert-registry';
import { loadAllQuestions } from '../content/question-loader';
import { SETTINGS_KEYS, readSetting } from '../settings/local-settings';
import { IndexedDbStudyRepository } from './indexeddb-study-repository';
import {
  buildDomainPerformance,
  buildExamMetrics,
  buildNextUp,
  buildResumeCards,
  recentExamAttempts,
} from '../../features/home/dashboard-view.model';

import { clearDashboardSeed, seedDashboard } from '../../dev/seed/dashboard-seed';

const NOW = Date.UTC(2026, 0, 15, 12);
let counter = 0;
let repository: IndexedDbStudyRepository;

function databaseName(): string {
  counter += 1;
  return `ccp-seed-${Date.now()}-${counter}`;
}

beforeEach(async () => {
  repository = new IndexedDbStudyRepository({ databaseName: databaseName() });
  await repository.open();
  localStorage.removeItem(SETTINGS_KEYS.selectedCert);
});

afterEach(async () => {
  await repository.close();
  localStorage.removeItem(SETTINGS_KEYS.selectedCert);
});

describe('seedDashboard', () => {
  it('seeds enough dashboard data and is repeatable', async () => {
    const first = await seedDashboard(repository, NOW);
    const second = await seedDashboard(repository, NOW);

    expect(second).toEqual(first);
    expect(readSetting(SETTINGS_KEYS.selectedCert)).toBe('clf-c02');

    const attempts = await repository.listAttempts({ cert: 'clf-c02' });
    const practiceResults = await repository.listPracticeResults('clf-c02');
    const sessions = await repository.listSessions();

    expect(first.attempts).toBe(7);
    expect(first.examResults).toBe(72);
    expect(first.sessions).toBe(4);
    expect(attempts).toHaveLength(6);
    expect(practiceResults).toHaveLength(first.practiceResults);
    expect(sessions.filter((session) => session.cert === 'clf-c02')).toHaveLength(3);

    const metrics = buildExamMetrics(attempts);
    expect(metrics).toEqual({
      attemptCount: 5,
      passRate: 60,
      averageScore: 74,
      bestScore: 91,
    });

    const recent = recentExamAttempts(attempts);
    expect(recent).toHaveLength(3);
    expect(recent.map((attempt) => attempt.kind)).toEqual(['mock', 'study', 'mock']);

    const examResults = await repository.listQuestionResults(attempts.find((row) => row.kind === 'mock')!.id);
    expect(examResults.length).toBeGreaterThan(0);
  });

  it('produces the combined domain states and the intended Next up domain', async () => {
    await seedDashboard(repository, NOW);
    const cert = getCert('clf-c02')!;
    const bank = await loadAllQuestions('clf-c02');
    const attempts = await repository.listAttempts({ cert: 'clf-c02' });
    const practiceResults = await repository.listPracticeResults('clf-c02');
    const rows = buildDomainPerformance(cert, practiceResults, bank, attempts);

    expect(rows.map((row) => row.domainId)).toEqual([4, 1, 3, 2]);
    expect(rows[0]).toMatchObject({
      domainId: 4,
      practiced: false,
      practicePercent: 0,
      examPercent: null,
    });
    expect(rows[1]).toMatchObject({ domainId: 1, practicePercent: 25 });
    expect(rows[2]).toMatchObject({ domainId: 3, practicePercent: 40 });
    expect(rows[3]).toMatchObject({ domainId: 2, practicePercent: 65 });

    expect(buildNextUp(cert, rows)?.text).toBe(
      'You have not practiced Billing, Pricing & Support yet.',
    );
  });

  it('seeds one resume card per kind for the selected cert only', async () => {
    await seedDashboard(repository, NOW);
    const cert = getCert('clf-c02')!;
    const sessions = await repository.listSessions();
    const cards = buildResumeCards(sessions, cert);

    expect(cards.map((card) => card.kind).sort()).toEqual(['mock', 'practice', 'study']);
    expect(cards.every((card) => card.certCode === 'clf-c02')).toBe(true);
    expect(sessions.some((session) => session.cert === 'aif-c01')).toBe(true);
  });

  it('clears only seeded study data and leaves the bundled bank intact', async () => {
    await seedDashboard(repository, NOW);
    await clearDashboardSeed(repository);

    expect(await repository.listAttempts({ cert: 'clf-c02' })).toEqual([]);
    expect(await repository.listPracticeResults('clf-c02')).toEqual([]);
    expect((await repository.listSessions()).filter((row) => row.cert === 'clf-c02')).toEqual([]);
    expect(await loadAllQuestions('clf-c02')).not.toHaveLength(0);
  });
});
