import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SETTINGS_KEYS, readSetting } from '../settings/local-settings';
import { STUDY_REPOSITORY } from '../storage/repository-provider';
import type {
  AttemptRow,
  CertProgressRow,
  QuestionMasteryRow,
  QuestionResultRow,
  SessionRow,
  StudyRows,
} from '../storage/types';

import { AppReloader } from './app-reloader';
import { BACKUP_TRANSPORT } from './backup-transport';
import { buildBackup, parseBackup } from './backup-format';
import { BackupError, BackupService } from './backup.service';

function attempt(overrides: Partial<AttemptRow> = {}): AttemptRow {
  return {
    id: 'clf-c02:mock:1',
    cert: 'clf-c02',
    kind: 'mock',
    startedAt: 1,
    finishedAt: 2,
    totalQuestions: 10,
    correctCount: 8,
    scorePercent: 80,
    passed: true,
    timeTakenSeconds: 60,
    domainScores: [],
    ...overrides,
  };
}

function result(): QuestionResultRow {
  return {
    id: 'r1',
    attemptId: 'clf-c02:mock:1',
    cert: 'clf-c02',
    domainId: 1,
    questionId: 'q1',
    userAnswer: 'A',
    correctAnswer: 'A',
    isCorrect: true,
    wasFlagged: false,
    answeredAt: 3,
  };
}

function progress(): CertProgressRow {
  return {
    id: 'clf-c02:1',
    cert: 'clf-c02',
    domainId: 1,
    attempted: 1,
    correct: 1,
    masteryPercent: 100,
    updatedAt: 4,
  };
}

function mastery(): QuestionMasteryRow {
  return {
    id: 'clf-c02:q1',
    cert: 'clf-c02',
    domainId: 1,
    questionId: 'q1',
    correctStreak: 1,
    lastWasWrong: false,
    lastSeenAt: 5,
    mastered: false,
    weight: 1,
  };
}

function session(): SessionRow {
  return {
    id: 'clf-c02:mock',
    cert: 'clf-c02',
    kind: 'mock',
    questionOrder: ['q1'],
    currentIndex: 0,
    answers: {},
    feedbackShown: [],
    flagged: [],
    optionKeyMaps: {},
    startedAt: 1,
    deadlineAt: 100,
    answeredCount: 0,
    correctCount: 0,
    wrongCount: 0,
    updatedAt: 6,
  };
}

function rows(): StudyRows {
  return {
    attempts: [attempt()],
    questionResults: [result()],
    certProgress: [progress()],
    questionMastery: [mastery()],
    sessions: [session()],
  };
}

class FakeRepository {
  stored: StudyRows = rows();
  readonly replaceAll = vi.fn<(input: StudyRows) => Promise<void>>(() => Promise.resolve());
  readonly resetCert = vi.fn<(cert: string) => Promise<void>>(() => Promise.resolve());
  readonly resetAll = vi.fn<() => Promise<void>>(() => Promise.resolve());

  async listAttempts(): Promise<AttemptRow[]> {
    return this.stored.attempts;
  }
  async listAllQuestionResults(): Promise<QuestionResultRow[]> {
    return this.stored.questionResults;
  }
  async listAllCertProgress(): Promise<CertProgressRow[]> {
    return this.stored.certProgress;
  }
  async listAllQuestionMastery(): Promise<QuestionMasteryRow[]> {
    return this.stored.questionMastery;
  }
  async listSessions(): Promise<SessionRow[]> {
    return this.stored.sessions;
  }
}

let repository: FakeRepository;
let transport: {
  saveBackup: ReturnType<typeof vi.fn>;
  pickBackup: ReturnType<typeof vi.fn>;
};
let reloader: { reload: ReturnType<typeof vi.fn> };

function create(): BackupService {
  TestBed.configureTestingModule({
    providers: [
      { provide: STUDY_REPOSITORY, useValue: repository },
      { provide: BACKUP_TRANSPORT, useValue: transport },
      { provide: AppReloader, useValue: reloader },
    ],
  });
  return TestBed.inject(BackupService);
}

beforeEach(() => {
  localStorage.clear();
  repository = new FakeRepository();
  transport = {
    saveBackup: vi.fn().mockResolvedValue(undefined),
    pickBackup: vi.fn().mockResolvedValue(null),
  };
  reloader = { reload: vi.fn() };
});

afterEach(() => {
  localStorage.clear();
  TestBed.resetTestingModule();
});

describe('BackupService.export (DATA-24 to DATA-26, PRIV-22)', () => {
  it('writes every section and the local settings as pretty JSON', async () => {
    localStorage.setItem(SETTINGS_KEYS.theme, 'dark');
    localStorage.setItem(SETTINGS_KEYS.selectedCert, 'clf-c02');
    const service = create();

    const summary = await service.export();

    expect(summary.fileName).toMatch(/^cloudcertprep-backup-\d{4}-\d{2}-\d{2}-\d{4}\.json$/);
    expect(summary).toMatchObject({
      attempts: 1,
      questionResults: 1,
      certProgress: 1,
      questionMastery: 1,
      sessions: 1,
    });

    const [fileName, json] = transport.saveBackup.mock.calls[0];
    expect(fileName).toBe(summary.fileName);
    expect(json).toContain('\n  "format"');
    const parsed = parseBackup(json as string);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.backup.settings).toEqual({ theme: 'dark', selectedCert: 'clf-c02' });
      expect(parsed.backup.attempts).toEqual(rows().attempts);
    }
  });
});

describe('BackupService.inspectImport (DATA-27, DATA-29)', () => {
  it('returns null when the picker is canceled', async () => {
    const service = create();

    await expect(service.inspectImport()).resolves.toBeNull();
    expect(repository.replaceAll).not.toHaveBeenCalled();
  });

  it('rejects an invalid file before any write happens', async () => {
    transport.pickBackup.mockResolvedValue('not a backup');
    const service = create();

    await expect(service.inspectImport()).rejects.toBeInstanceOf(BackupError);
    expect(repository.replaceAll).not.toHaveBeenCalled();
  });

  it('previews the counts and the certs a valid backup would restore', async () => {
    transport.pickBackup.mockResolvedValue(
      JSON.stringify(buildBackup({ rows: rows(), settings: { theme: 'dark' } })),
    );
    const service = create();

    const preview = await service.inspectImport();

    expect(preview?.counts.attempts).toBe(1);
    expect(preview?.certCodes).toEqual(['clf-c02']);
    expect(preview?.skippedRows).toBe(0);
    expect(repository.replaceAll).not.toHaveBeenCalled();
  });
});

describe('BackupService destructive operations (DATA-28 to DATA-32)', () => {
  it('replaces rows and settings, shows the overlay, then reloads', async () => {
    const backup = buildBackup({
      rows: rows(),
      settings: { theme: 'light', selectedCert: 'aif-c01', unknown: 'ignored' },
    });
    const service = create();

    const pending = service.applyImport(backup);
    await pending;

    expect(service.overlayMessage()).toBe('Restoring your data...');
    expect(repository.replaceAll).toHaveBeenCalledWith(rows());
    expect(readSetting(SETTINGS_KEYS.theme)).toBe('light');
    expect(readSetting(SETTINGS_KEYS.selectedCert)).toBe('aif-c01');
    expect(readSetting('unknown')).toBeNull();
    expect(reloader.reload).toHaveBeenCalledTimes(1);
  });

  it('resets one cert through the repository and reloads', async () => {
    const service = create();

    await service.resetCert('aif-c01');

    expect(repository.resetCert).toHaveBeenCalledWith('aif-c01');
    expect(reloader.reload).toHaveBeenCalledTimes(1);
  });

  it('deletes all study data through the repository and reloads', async () => {
    const service = create();

    await service.resetAll();

    expect(repository.resetAll).toHaveBeenCalledTimes(1);
    expect(reloader.reload).toHaveBeenCalledTimes(1);
  });
});
