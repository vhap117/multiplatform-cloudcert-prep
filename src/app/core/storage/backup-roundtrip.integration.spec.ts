import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SETTINGS_KEYS, readSetting } from '../settings/local-settings';
import { IndexedDbStudyRepository } from './indexeddb-study-repository';
import { STUDY_REPOSITORY } from './repository-provider';
import type {
  AttemptRow,
  CertProgressRow,
  QuestionMasteryRow,
  QuestionResultRow,
  SessionRow,
  StudyRows,
} from './types';

import { AppReloader } from '../backup/app-reloader';
import { BACKUP_TRANSPORT } from '../backup/backup-transport';
import { BackupService } from '../backup/backup.service';

let counter = 0;

function uniqueName(): string {
  counter += 1;
  return `ccp-backup-${Date.now()}-${counter}`;
}

function attempt(overrides: Partial<AttemptRow> = {}): AttemptRow {
  return {
    id: 'clf-c02:mock:1',
    cert: 'clf-c02',
    kind: 'mock',
    startedAt: 1_000,
    finishedAt: 61_000,
    totalQuestions: 4,
    correctCount: 3,
    scorePercent: 75,
    passed: true,
    timeTakenSeconds: 60,
    domainScores: [{ domainId: 1, correct: 3, total: 4, percent: 75 }],
    ...overrides,
  };
}

function result(overrides: Partial<QuestionResultRow> = {}): QuestionResultRow {
  return {
    id: 'result-1',
    attemptId: 'clf-c02:mock:1',
    cert: 'clf-c02',
    domainId: 1,
    questionId: 'q001',
    userAnswer: 'B',
    correctAnswer: 'B',
    isCorrect: true,
    wasFlagged: false,
    answeredAt: 2_000,
    ...overrides,
  };
}

function progress(overrides: Partial<CertProgressRow> = {}): CertProgressRow {
  return {
    id: 'clf-c02:1',
    cert: 'clf-c02',
    domainId: 1,
    attempted: 4,
    correct: 3,
    masteryPercent: 75,
    updatedAt: 3_000,
    ...overrides,
  };
}

function mastery(overrides: Partial<QuestionMasteryRow> = {}): QuestionMasteryRow {
  return {
    id: 'clf-c02:q001',
    cert: 'clf-c02',
    domainId: 1,
    questionId: 'q001',
    correctStreak: 2,
    lastWasWrong: false,
    lastSeenAt: 2_000,
    mastered: false,
    weight: 1,
    ...overrides,
  };
}

function session(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: 'clf-c02:mock',
    cert: 'clf-c02',
    kind: 'mock',
    questionOrder: ['q001', 'q002'],
    currentIndex: 1,
    answers: { q001: 'B' },
    feedbackShown: [],
    flagged: ['q002'],
    optionKeyMaps: { q001: { A: 'C', B: 'D' } },
    startedAt: 1_000,
    deadlineAt: 5_400_000,
    answeredCount: 1,
    correctCount: 1,
    wrongCount: 0,
    updatedAt: 4_000,
    ...overrides,
  };
}

async function seed(repository: IndexedDbStudyRepository): Promise<void> {
  await repository.open();
  await repository.commitAnswers({
    attempt: attempt(),
    results: [result()],
    progress: [progress()],
    mastery: [mastery()],
  });
  await repository.commitAnswers({
    attempt: null,
    results: [
      result({ id: 'practice-1', attemptId: null, questionId: 'q900', cert: 'clf-c02' }),
    ],
    progress: [progress({ id: 'clf-c02:2', domainId: 2, attempted: 1, correct: 1 })],
    mastery: [mastery({ id: 'clf-c02:q900', questionId: 'q900', weight: null })],
  });
  await repository.commitAnswers({
    attempt: attempt({ id: 'aif-c01:study:1', cert: 'aif-c01', kind: 'study' }),
    results: [result({ id: 'aif-result', attemptId: 'aif-c01:study:1', cert: 'aif-c01' })],
    progress: [progress({ id: 'aif-c01:1', cert: 'aif-c01' })],
    mastery: [mastery({ id: 'aif-c01:q001', cert: 'aif-c01' })],
  });
  await repository.putSession(session());
}

async function snapshot(repository: IndexedDbStudyRepository): Promise<StudyRows> {
  return {
    attempts: await repository.listAttempts(),
    questionResults: await repository.listAllQuestionResults(),
    certProgress: await repository.listAllCertProgress(),
    questionMastery: await repository.listAllQuestionMastery(),
    sessions: await repository.listSessions(),
  };
}

function configure(
  repository: IndexedDbStudyRepository,
  transport: { saveBackup: ReturnType<typeof vi.fn>; pickBackup: ReturnType<typeof vi.fn> },
  reloader: { reload: ReturnType<typeof vi.fn> },
): BackupService {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: STUDY_REPOSITORY, useValue: repository },
      { provide: BACKUP_TRANSPORT, useValue: transport },
      { provide: AppReloader, useValue: reloader },
    ],
  });
  return TestBed.inject(BackupService);
}

afterEach(() => {
  localStorage.clear();
  TestBed.resetTestingModule();
});

describe('backup round trip between profiles (DATA-9D, DATA-30, OFF-17, CONT-49)', () => {
  it('rebuilds history, practice, mastery, settings, and a resumable session', async () => {
    localStorage.setItem(SETTINGS_KEYS.theme, 'dark');
    localStorage.setItem(SETTINGS_KEYS.selectedCert, 'aif-c01');
    localStorage.setItem(SETTINGS_KEYS.lastTab, 'history');

    const source = new IndexedDbStudyRepository({ databaseName: uniqueName() });
    await seed(source);
    const original = await snapshot(source);

    let exportedJson = '';
    const exporter = {
      saveBackup: vi.fn((_name: string, json: string) => {
        exportedJson = json;
        return Promise.resolve();
      }),
      pickBackup: vi.fn().mockResolvedValue(null),
    };
    const exporterService = configure(source, exporter, { reload: vi.fn() });
    await exporterService.export();
    await source.close();
    expect(exportedJson.length).toBeGreaterThan(0);

    localStorage.clear();

    const target = new IndexedDbStudyRepository({ databaseName: uniqueName() });
    await target.open();
    const importer = {
      saveBackup: vi.fn(),
      pickBackup: vi.fn().mockResolvedValue(exportedJson),
    };
    const reloader = { reload: vi.fn() };
    const importerService = configure(target, importer, reloader);

    const preview = await importerService.inspectImport();
    expect(preview?.certCodes).toEqual(['aif-c01', 'clf-c02']);
    await importerService.applyImport(preview!.backup);

    expect(await snapshot(target)).toEqual(original);
    expect(readSetting(SETTINGS_KEYS.theme)).toBe('dark');
    expect(readSetting(SETTINGS_KEYS.selectedCert)).toBe('aif-c01');
    expect(readSetting(SETTINGS_KEYS.lastTab)).toBe('history');

    const restoredSession = await target.getSession('clf-c02', 'mock');
    expect(restoredSession?.deadlineAt).toBe(5_400_000);
    expect(restoredSession?.optionKeyMaps).toEqual({ q001: { A: 'C', B: 'D' } });
    expect(restoredSession?.flagged).toEqual(['q002']);
    expect(reloader.reload).toHaveBeenCalledTimes(1);

    await target.close();
  });

  it('rejects a malformed file and leaves the target database unchanged', async () => {
    const target = new IndexedDbStudyRepository({ databaseName: uniqueName() });
    await seed(target);
    const before = await snapshot(target);

    const service = configure(
      target,
      { saveBackup: vi.fn(), pickBackup: vi.fn().mockResolvedValue('{ not json') },
      { reload: vi.fn() },
    );

    await expect(service.inspectImport()).rejects.toThrow(/not valid JSON/);
    expect(await snapshot(target)).toEqual(before);
    await target.close();
  });

  it('rejects a newer schema version and leaves the target database unchanged', async () => {
    const target = new IndexedDbStudyRepository({ databaseName: uniqueName() });
    await seed(target);
    const before = await snapshot(target);

    const source = new IndexedDbStudyRepository({ databaseName: uniqueName() });
    await seed(source);
    let exportedJson = '';
    await configure(
      source,
      {
        saveBackup: vi.fn((_name: string, json: string) => {
          exportedJson = json;
          return Promise.resolve();
        }),
        pickBackup: vi.fn(),
      },
      { reload: vi.fn() },
    ).export();
    await source.close();

    const tampered = JSON.stringify({
      ...JSON.parse(exportedJson),
      schemaVersion: 99,
    });
    const service = configure(
      target,
      { saveBackup: vi.fn(), pickBackup: vi.fn().mockResolvedValue(tampered) },
      { reload: vi.fn() },
    );

    await expect(service.inspectImport()).rejects.toThrow(/schema version 99/);
    expect(await snapshot(target)).toEqual(before);
    await target.close();
  });
});
