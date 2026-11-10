import { beforeEach, describe, expect, it } from 'vitest';

import { StorageWriteError } from './errors';
import { ALL_STORES, type StoreName } from './schema';
import type { StudyRepository } from './study-repository';
import type {
  AttemptRow,
  CertProgressRow,
  QuestionMasteryRow,
  QuestionResultRow,
  SessionRow,
  StudyRows,
} from './types';

/**
 * Shared StudyRepository contract (CONT-43, IONIC-19).
 *
 * Every case runs through the public interface only, so the same suite proves
 * the IndexedDB and the SQLite adapter behave identically. The harness supplies
 * the two platform seams the contract needs: a fresh database per test and a
 * raw-write hook so read-side quarantine can be proven.
 */
export interface ContractOptions {
  failBeforeCommit?: boolean;
  /** Reuse an existing database instead of a fresh one (lifecycle tests). */
  databaseName?: string;
}

export interface ContractHarness {
  repository: StudyRepository;
  /** Test seam: writes a row with no validation so quarantine can be proven. */
  writeRaw(table: StoreName, value: unknown): Promise<void>;
}

export type ContractFactory = (options?: ContractOptions) => Promise<ContractHarness>;

export function attempt(overrides: Partial<AttemptRow> = {}): AttemptRow {
  return {
    id: 'attempt-1',
    cert: 'clf-c02',
    kind: 'mock',
    startedAt: 1_000,
    finishedAt: 2_000,
    totalQuestions: 65,
    correctCount: 52,
    scorePercent: 80,
    passed: true,
    timeTakenSeconds: 1_000,
    domainScores: [
      { domainId: 1, correct: 13, total: 16, percent: 81 },
      { domainId: 2, correct: 16, total: 20, percent: 80 },
    ],
    ...overrides,
  };
}

export function result(overrides: Partial<QuestionResultRow> = {}): QuestionResultRow {
  return {
    id: 'result-1',
    attemptId: 'attempt-1',
    cert: 'clf-c02',
    domainId: 1,
    questionId: 'q001',
    userAnswer: 'B',
    correctAnswer: 'B',
    isCorrect: true,
    wasFlagged: false,
    answeredAt: 1_500,
    ...overrides,
  };
}

export function progress(overrides: Partial<CertProgressRow> = {}): CertProgressRow {
  return {
    id: 'clf-c02:1',
    cert: 'clf-c02',
    domainId: 1,
    attempted: 16,
    correct: 13,
    masteryPercent: 81,
    updatedAt: 2_000,
    ...overrides,
  };
}

export function mastery(overrides: Partial<QuestionMasteryRow> = {}): QuestionMasteryRow {
  return {
    id: 'clf-c02:q001',
    cert: 'clf-c02',
    domainId: 1,
    questionId: 'q001',
    correctStreak: 3,
    lastWasWrong: false,
    lastSeenAt: 2_000,
    mastered: true,
    weight: 1,
    ...overrides,
  };
}

export function session(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: 'clf-c02:study',
    cert: 'clf-c02',
    kind: 'study',
    questionOrder: ['q001', 'q002', 'q003'],
    currentIndex: 1,
    answers: { q001: 'B' },
    feedbackShown: ['q001'],
    flagged: [],
    optionKeyMaps: {},
    startedAt: 1_000,
    deadlineAt: null,
    answeredCount: 1,
    correctCount: 1,
    wrongCount: 0,
    updatedAt: 1_200,
    ...overrides,
  };
}

export function studyRepositoryContract(label: string, makeHarness: ContractFactory): void {
  describe(`StudyRepository contract (${label})`, () => {
    let repository: StudyRepository;
    let harness: ContractHarness;

    beforeEach(async () => {
      harness = await makeHarness();
      repository = harness.repository;
    });

    describe('attempts and question results', () => {
      it('persists an attempt and reads it back with its domain scores', async () => {
        await repository.commitAnswers({
          attempt: attempt(),
          results: [result()],
          progress: [],
          mastery: [],
        });

        const stored = await repository.getAttempt('attempt-1');

        expect(stored).not.toBeNull();
        expect(stored?.scorePercent).toBe(80);
        expect(stored?.domainScores).toHaveLength(2);
        expect(stored?.domainScores[1].percent).toBe(80);
      });

      it('returns null for an unknown attempt instead of throwing', async () => {
        expect(await repository.getAttempt('missing')).toBeNull();
      });

      it('links question results to their attempt', async () => {
        await repository.commitAnswers({
          attempt: attempt(),
          results: [result(), result({ id: 'result-2', questionId: 'q002' })],
          progress: [],
          mastery: [],
        });

        const results = await repository.listQuestionResults('attempt-1');

        expect(results.map((row) => row.questionId)).toEqual(['q001', 'q002']);
      });

      it('stores practice results without a parent attempt', async () => {
        await repository.commitAnswers({
          attempt: null,
          results: [result({ id: 'practice-1', attemptId: null })],
          progress: [progress()],
          mastery: [mastery()],
        });

        const practice = await repository.listPracticeResults('clf-c02');

        expect(practice).toHaveLength(1);
        expect(practice[0].attemptId).toBeNull();
      });

      it('filters attempts by cert, kind and pass state', async () => {
        await repository.commitAnswers({
          attempt: attempt({ id: 'a-mock-pass', kind: 'mock', passed: true }),
          results: [],
          progress: [],
          mastery: [],
        });
        await repository.commitAnswers({
          attempt: attempt({ id: 'a-mock-fail', kind: 'mock', passed: false }),
          results: [],
          progress: [],
          mastery: [],
        });
        await repository.commitAnswers({
          attempt: attempt({ id: 'a-study-pass', kind: 'study', passed: true }),
          results: [],
          progress: [],
          mastery: [],
        });
        await repository.commitAnswers({
          attempt: attempt({ id: 'a-other', cert: 'aif-c01', passed: true }),
          results: [],
          progress: [],
          mastery: [],
        });

        expect((await repository.listAttempts()).length).toBe(4);
        expect((await repository.listAttempts({ cert: 'clf-c02' })).length).toBe(3);
        expect((await repository.listAttempts({ kind: 'study' })).length).toBe(1);
        expect((await repository.listAttempts({ passed: false })).length).toBe(1);
        expect(
          (await repository.listAttempts({ cert: 'clf-c02', kind: 'mock' })).length,
        ).toBe(2);
      });
    });

    describe('progress and mastery', () => {
      it('round-trips cert progress per domain', async () => {
        await repository.commitAnswers({
          attempt: null,
          results: [],
          progress: [progress(), progress({ id: 'clf-c02:2', domainId: 2, correct: 16 })],
          mastery: [],
        });

        const rows = await repository.getCertProgress('clf-c02');

        expect(rows).toHaveLength(2);
        expect(rows.find((row) => row.domainId === 2)?.correct).toBe(16);
      });

      it('replaces a progress row on re-commit rather than duplicating it', async () => {
        await repository.commitAnswers({
          attempt: null,
          results: [],
          progress: [progress()],
          mastery: [],
        });
        await repository.commitAnswers({
          attempt: null,
          results: [],
          progress: [progress({ attempted: 20, correct: 18, masteryPercent: 90 })],
          mastery: [],
        });

        const rows = await repository.getCertProgress('clf-c02');

        expect(rows).toHaveLength(1);
        expect(rows[0].masteryPercent).toBe(90);
      });

      it('keeps a null weight for excluded questions', async () => {
        await repository.commitAnswers({
          attempt: null,
          results: [],
          progress: [],
          mastery: [mastery({ id: 'clf-c02:q009', questionId: 'q009', weight: null })],
        });

        const rows = await repository.getQuestionMastery('clf-c02');

        expect(rows[0].weight).toBeNull();
      });

      it('round-trips the optional sessionsSinceSeen counter and skips a negative one', async () => {
        await repository.commitAnswers({
          attempt: null,
          results: [],
          progress: [],
          mastery: [mastery({ sessionsSinceSeen: 2 })],
        });
        // A corrupted counter must not crash or render; the row is skipped.
        await harness.writeRaw('question_mastery', {
          ...mastery({ id: 'clf-c02:q-bad', questionId: 'q-bad' }),
          sessionsSinceSeen: -1,
        });

        const rows = await repository.getQuestionMastery('clf-c02');

        expect(rows).toHaveLength(1);
        expect(rows[0].questionId).toBe('q001');
        expect(rows[0].sessionsSinceSeen).toBe(2);
      });
    });

    describe('sessions', () => {
      it('saves, restores and deletes a session', async () => {
        await repository.putSession(session());

        const restored = await repository.getSession('clf-c02', 'study');

        expect(restored?.currentIndex).toBe(1);
        expect(restored?.questionOrder).toEqual(['q001', 'q002', 'q003']);
        expect(restored?.answers).toEqual({ q001: 'B' });
        expect(restored?.feedbackShown).toEqual(['q001']);

        await repository.deleteSession('clf-c02', 'study');
        expect(await repository.getSession('clf-c02', 'study')).toBeNull();
      });

      it('keeps one session per cert and kind', async () => {
        await repository.putSession(session());
        await repository.putSession(session({ currentIndex: 2 }));

        const all = await repository.listSessions();

        expect(all).toHaveLength(1);
        expect(all[0].currentIndex).toBe(2);
      });

      it('keeps a mock and a study session for the same cert separate', async () => {
        await repository.putSession(session());
        await repository.putSession(
          session({ id: 'clf-c02:mock', kind: 'mock', deadlineAt: 5_000 }),
        );

        expect((await repository.listSessions()).length).toBe(2);
        expect((await repository.getSession('clf-c02', 'mock'))?.deadlineAt).toBe(5_000);
        expect((await repository.getSession('clf-c02', 'study'))?.deadlineAt).toBeNull();
      });

      it('never replaces another cert session when a different cert starts (CERT-23)', async () => {
        await repository.putSession(session({ id: 'clf-c02:mock', kind: 'mock' }));

        await repository.putSession(
          session({ id: 'aif-c01:mock', cert: 'aif-c01', kind: 'mock' }),
        );
        await repository.deleteSession('aif-c01', 'mock');

        expect(await repository.getSession('clf-c02', 'mock')).not.toBeNull();
        expect(await repository.getSession('aif-c01', 'mock')).toBeNull();
      });

      it('clears the session as part of the same commit', async () => {
        await repository.putSession(session());

        await repository.commitAnswers({
          attempt: attempt(),
          results: [result()],
          progress: [],
          mastery: [],
          clearSession: { cert: 'clf-c02', kind: 'study' },
        });

        expect(await repository.getSession('clf-c02', 'study')).toBeNull();
      });
    });

    describe('atomicity', () => {
      it('writes nothing when the commit fails part way through', async () => {
        await repository.close();
        harness = await makeHarness({ failBeforeCommit: true });
        repository = harness.repository;

        await expect(
          repository.commitAnswers({
            attempt: attempt(),
            results: [result()],
            progress: [progress()],
            mastery: [mastery()],
            clearSession: { cert: 'clf-c02', kind: 'study' },
          }),
        ).rejects.toBeInstanceOf(StorageWriteError);

        expect(await repository.getAttempt('attempt-1')).toBeNull();
        expect(await repository.getCertProgress('clf-c02')).toHaveLength(0);
        expect(await repository.getQuestionMastery('clf-c02')).toHaveLength(0);
      });

      it('leaves an existing session in place when the commit fails', async () => {
        await repository.close();
        harness = await makeHarness({ failBeforeCommit: true });
        repository = harness.repository;
        await repository.putSession(session());

        await expect(
          repository.commitAnswers({
            attempt: attempt(),
            results: [],
            progress: [],
            mastery: [],
            clearSession: { cert: 'clf-c02', kind: 'study' },
          }),
        ).rejects.toBeInstanceOf(StorageWriteError);

        expect(await repository.getSession('clf-c02', 'study')).not.toBeNull();
      });

      it('reports a write failure as a typed error, not a raw DOMException', async () => {
        await repository.close();
        harness = await makeHarness({ failBeforeCommit: true });
        repository = harness.repository;

        const error = await repository
          .commitAnswers({ attempt: attempt(), results: [], progress: [], mastery: [] })
          .catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(StorageWriteError);
        expect((error as StorageWriteError).name).toBe('StorageWriteError');
      });
    });

    describe('row validation', () => {
      it('ignores a malformed attempt row instead of returning it', async () => {
        await repository.commitAnswers({
          attempt: attempt(),
          results: [],
          progress: [],
          mastery: [],
        });
        await harness.writeRaw('attempts', {
          id: 'broken',
          cert: 'clf-c02',
          kind: 'mock',
          scorePercent: 'not a number',
        });

        const rows = await repository.listAttempts();

        expect(rows.map((row) => row.id)).toEqual(['attempt-1']);
      });

      it('survives a malformed row without throwing', async () => {
        await harness.writeRaw('sessions', { id: 'bad', cert: 42 });

        await expect(repository.listSessions()).resolves.toEqual([]);
      });
    });

    describe('reset', () => {
      beforeEach(async () => {
        await repository.commitAnswers({
          attempt: attempt(),
          results: [result()],
          progress: [progress()],
          mastery: [mastery()],
        });
        await repository.commitAnswers({
          attempt: attempt({ id: 'aif-1', cert: 'aif-c01' }),
          results: [result({ id: 'aif-r1', attemptId: 'aif-1', cert: 'aif-c01' })],
          progress: [progress({ id: 'aif-c01:1', cert: 'aif-c01' })],
          mastery: [mastery({ id: 'aif-c01:q001', cert: 'aif-c01' })],
        });
        await repository.putSession(session());
        await repository.putSession(session({ id: 'aif-c01:study', cert: 'aif-c01' }));
      });

      it('removes only the selected cert', async () => {
        await repository.resetCert('clf-c02');

        expect(await repository.getAttempt('attempt-1')).toBeNull();
        expect(await repository.getCertProgress('clf-c02')).toHaveLength(0);
        expect(await repository.getQuestionMastery('clf-c02')).toHaveLength(0);
        expect(await repository.getSession('clf-c02', 'study')).toBeNull();

        expect(await repository.getAttempt('aif-1')).not.toBeNull();
        expect(await repository.getCertProgress('aif-c01')).toHaveLength(1);
        expect(await repository.getSession('aif-c01', 'study')).not.toBeNull();
      });

      it('removes everything on resetAll', async () => {
        await repository.resetAll();

        expect(await repository.listAttempts()).toHaveLength(0);
        expect(await repository.listSessions()).toHaveLength(0);
        expect(await repository.getCertProgress('clf-c02')).toHaveLength(0);
        expect(await repository.getQuestionMastery('aif-c01')).toHaveLength(0);
      });
    });

    describe('lifecycle', () => {
      it('reopens an existing database without losing data', async () => {
        const name = 'shared-lifecycle';
        await repository.close();
        const first = await makeHarness({ databaseName: name });
        await first.repository.commitAnswers({
          attempt: attempt(),
          results: [result()],
          progress: [],
          mastery: [],
        });
        await first.repository.close();

        const second = await makeHarness({ databaseName: name });
        await second.repository.open();

        expect(await second.repository.getAttempt('attempt-1')).not.toBeNull();
        await second.repository.close();
      });

      it('reports the schema version it expects', async () => {
        expect(repository.schemaVersion).toBe(1);
      });

      it('reports every required table and migration as applied', async () => {
        const report = await repository.diagnose();

        expect(report.expectedSchemaVersion).toBe(repository.schemaVersion);
        expect(report.actualSchemaVersion).toBe(repository.schemaVersion);
        expect(report.tables.map((table) => table.name)).toEqual(ALL_STORES);
        expect(report.tables.every((table) => table.present)).toBe(true);
        expect(report.migrations.every((migration) => migration.applied)).toBe(true);
      });
    });
  });

  describe(`StudyRepository bulk reads and restore (${label})`, () => {
    it('lists every question result, progress row, and mastery row across certs', async () => {
      const { repository } = await makeHarness();
      await repository.commitAnswers({
        attempt: attempt(),
        results: [
          result(),
          result({ id: 'practice-1', attemptId: null, cert: 'aif-c01', questionId: 'q900' }),
        ],
        progress: [progress(), progress({ id: 'aif-c01:1', cert: 'aif-c01' })],
        mastery: [mastery(), mastery({ id: 'aif-c01:q900', cert: 'aif-c01' })],
      });

      const results = await repository.listAllQuestionResults();
      const progressRows = await repository.listAllCertProgress();
      const masteryRows = await repository.listAllQuestionMastery();

      expect(results.map((row) => row.id).sort()).toEqual(['practice-1', 'result-1']);
      expect(progressRows.map((row) => row.id).sort()).toEqual(['aif-c01:1', 'clf-c02:1']);
      expect(masteryRows.map((row) => row.id).sort()).toEqual([
        'aif-c01:q900',
        'clf-c02:q001',
      ]);
      await repository.close();
    });

    it('replaces every study store in one transaction', async () => {
      const { repository } = await makeHarness();
      await repository.commitAnswers({
        attempt: attempt(),
        results: [result()],
        progress: [progress()],
        mastery: [mastery()],
      });
      await repository.putSession(session());

      const replacement: StudyRows = {
        attempts: [attempt({ id: 'aif-attempt', cert: 'aif-c01' })],
        questionResults: [
          result({ id: 'aif-result', attemptId: 'aif-attempt', cert: 'aif-c01' }),
        ],
        certProgress: [progress({ id: 'aif-c01:1', cert: 'aif-c01' })],
        questionMastery: [mastery({ id: 'aif-c01:q001', cert: 'aif-c01' })],
        sessions: [session({ id: 'aif-c01:study', cert: 'aif-c01' })],
      };

      await repository.replaceAll(replacement);

      expect(await repository.getAttempt('attempt-1')).toBeNull();
      expect(await repository.getAttempt('aif-attempt')).not.toBeNull();
      expect((await repository.listAllQuestionResults()).map((row) => row.id)).toEqual([
        'aif-result',
      ]);
      expect((await repository.listAllCertProgress()).map((row) => row.id)).toEqual([
        'aif-c01:1',
      ]);
      expect((await repository.listAllQuestionMastery()).map((row) => row.id)).toEqual([
        'aif-c01:q001',
      ]);
      expect((await repository.listSessions()).map((row) => row.id)).toEqual([
        'aif-c01:study',
      ]);
      await repository.close();
    });

    it('rejects invalid rows before clearing anything', async () => {
      const { repository } = await makeHarness();
      await repository.commitAnswers({
        attempt: attempt(),
        results: [result()],
        progress: [progress()],
        mastery: [mastery()],
      });
      await repository.putSession(session());

      const invalid: StudyRows = {
        attempts: [attempt()],
        questionResults: [{ id: 'bad' } as QuestionResultRow],
        certProgress: [],
        questionMastery: [],
        sessions: [],
      };

      await expect(repository.replaceAll(invalid)).rejects.toBeInstanceOf(StorageWriteError);
      expect(await repository.getAttempt('attempt-1')).not.toBeNull();
      expect(await repository.getSession('clf-c02', 'study')).not.toBeNull();
      await repository.close();
    });

    it('leaves the previous database intact when the restore transaction aborts', async () => {
      const name = 'shared-restore-abort';
      const seeded = await makeHarness({ databaseName: name });
      await seeded.repository.commitAnswers({
        attempt: attempt(),
        results: [result()],
        progress: [progress()],
        mastery: [mastery()],
      });
      await seeded.repository.close();

      const failing = await makeHarness({ databaseName: name, failBeforeCommit: true });
      await expect(
        failing.repository.replaceAll({
          attempts: [attempt({ id: 'replacement' })],
          questionResults: [],
          certProgress: [],
          questionMastery: [],
          sessions: [],
        }),
      ).rejects.toBeInstanceOf(StorageWriteError);
      await failing.repository.close();

      const verified = await makeHarness({ databaseName: name });
      expect(await verified.repository.getAttempt('attempt-1')).not.toBeNull();
      expect(await verified.repository.getAttempt('replacement')).toBeNull();
      await verified.repository.close();
    });
  });
}
