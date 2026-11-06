import { describe, expect, it } from 'vitest';

import { SCHEMA_VERSION } from '../storage/schema';
import type {
  AttemptRow,
  CertProgressRow,
  QuestionMasteryRow,
  QuestionResultRow,
  SessionRow,
  StudyRows,
} from '../storage/types';

import {
  BACKUP_FORMAT,
  backupToJson,
  backupToRows,
  buildBackup,
  parseBackup,
} from './backup-format';

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
    domainScores: [{ domainId: 1, correct: 8, total: 10, percent: 80 }],
    ...overrides,
  };
}

function result(overrides: Partial<QuestionResultRow> = {}): QuestionResultRow {
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
    ...overrides,
  };
}

function progress(overrides: Partial<CertProgressRow> = {}): CertProgressRow {
  return {
    id: 'clf-c02:1',
    cert: 'clf-c02',
    domainId: 1,
    attempted: 10,
    correct: 8,
    masteryPercent: 80,
    updatedAt: 4,
    ...overrides,
  };
}

function mastery(overrides: Partial<QuestionMasteryRow> = {}): QuestionMasteryRow {
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
    ...overrides,
  };
}

function session(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: 'clf-c02:mock',
    cert: 'clf-c02',
    kind: 'mock',
    questionOrder: ['q1'],
    currentIndex: 0,
    answers: { q1: 'A' },
    feedbackShown: [],
    flagged: [],
    optionKeyMaps: { q1: { A: 'B' } },
    startedAt: 1,
    deadlineAt: 100,
    answeredCount: 1,
    correctCount: 1,
    wrongCount: 0,
    updatedAt: 6,
    ...overrides,
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

describe('backup format (DATA-24, DATA-25)', () => {
  it('round-trips every section and its settings', () => {
    const backup = buildBackup({
      rows: rows(),
      settings: { theme: 'dark', selectedCert: 'clf-c02' },
      exportedAt: 42,
      appVersion: '9.9.9',
    });

    const parsed = parseBackup(backupToJson(backup));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.backup.schemaVersion).toBe(SCHEMA_VERSION);
    expect(parsed.backup.exportedAt).toBe(42);
    expect(parsed.backup.appVersion).toBe('9.9.9');
    expect(parsed.backup.settings).toEqual({ theme: 'dark', selectedCert: 'clf-c02' });
    expect(backupToRows(parsed.backup)).toEqual(rows());
    expect(parsed.skipped).toEqual({
      attempts: 0,
      questionResults: 0,
      certProgress: 0,
      questionMastery: 0,
      sessions: 0,
    });
  });

  it('contains only the documented keys, no device or ad identifiers (PRIV-22)', () => {
    const backup = buildBackup({ rows: rows(), settings: { theme: 'dark' } });

    expect(Object.keys(JSON.parse(backupToJson(backup))).sort()).toEqual([
      'appVersion',
      'attempts',
      'certProgress',
      'exportedAt',
      'format',
      'questionMastery',
      'questionResults',
      'schemaVersion',
      'sessions',
      'settings',
    ]);
  });
});

describe('backup validation (DATA-27, DATA-29, OFF-31)', () => {
  it('rejects text that is not JSON', () => {
    const parsed = parseBackup('not json');

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.reason).toBe('malformed');
    }
  });

  it('rejects a JSON file that is not a CloudCertPrep backup', () => {
    const parsed = parseBackup(JSON.stringify({ hello: 'world' }));

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.reason).toBe('not-a-backup');
    }
  });

  it('rejects a newer schema version without importing anything', () => {
    const backup = buildBackup({ rows: rows(), settings: {} });
    const parsed = parseBackup(
      JSON.stringify({ ...backup, schemaVersion: SCHEMA_VERSION + 1 }),
    );

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.reason).toBe('incompatible-schema');
    }
  });

  it('rejects a backup missing one of its sections', () => {
    const backup = buildBackup({ rows: rows(), settings: {} });
    const withoutSessions: Record<string, unknown> = { ...backup };
    delete withoutSessions['sessions'];

    const parsed = parseBackup(JSON.stringify(withoutSessions));

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.reason).toBe('malformed');
    }
  });

  it('rejects non-string settings values', () => {
    const backup = buildBackup({ rows: rows(), settings: {} });
    const parsed = parseBackup(
      JSON.stringify({ ...backup, settings: { theme: 7 } }),
    );

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.reason).toBe('invalid-settings');
    }
  });

  it('quarantines unknown rows and imports the compatible subset', () => {
    const backup = buildBackup({ rows: rows(), settings: {} });
    const withUnknown = {
      ...backup,
      attempts: [attempt(), { id: 'future-shape', extra: true }],
      sessions: [{ nope: true }],
    };

    const parsed = parseBackup(JSON.stringify(withUnknown));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.backup.attempts).toHaveLength(1);
    expect(parsed.backup.sessions).toHaveLength(0);
    expect(parsed.skipped.attempts).toBe(1);
    expect(parsed.skipped.sessions).toBe(1);
  });

  it('ignores unknown top-level fields from a newer minor export', () => {
    const backup = buildBackup({ rows: rows(), settings: {} });
    const parsed = parseBackup(
      JSON.stringify({ ...backup, futureField: { anything: true } }),
    );

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.backup.format).toBe(BACKUP_FORMAT);
      expect('futureField' in parsed.backup).toBe(false);
    }
  });
});
