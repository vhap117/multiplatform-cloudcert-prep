import { APP_VERSION } from '../app-info';
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
  isAttemptRow,
  isCertProgressRow,
  isQuestionMasteryRow,
  isQuestionResultRow,
  isSessionRow,
} from '../storage/validation';

/**
 * The documented backup format, version 1 (DATA-24, DATA-25, OFF-16).
 *
 * The file is plain JSON. Structural problems reject the whole file; a row
 * that fails validation is quarantined and counted so the compatible subset can
 * still be imported (DATA-23, OFF-31). Unknown top-level fields are ignored so
 * a newer minor export stays readable in an older build.
 *
 * See `docs/backup-format.md`.
 */

export const BACKUP_FORMAT = 'cloudcertprep-backup';

/** Settings are small preferences, stored as plain strings (DATA-22). */
export type BackupSettings = Record<string, string>;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  appVersion: string;
  exportedAt: number;
  settings: BackupSettings;
  attempts: AttemptRow[];
  questionResults: QuestionResultRow[];
  certProgress: CertProgressRow[];
  questionMastery: QuestionMasteryRow[];
  sessions: SessionRow[];
}

/** Rows skipped per section because they failed validation (OFF-31). */
export interface BackupSkipped {
  attempts: number;
  questionResults: number;
  certProgress: number;
  questionMastery: number;
  sessions: number;
}

export type BackupErrorReason =
  | 'malformed'
  | 'not-a-backup'
  | 'incompatible-schema'
  | 'invalid-settings';

export interface BackupParseSuccess {
  ok: true;
  backup: BackupFile;
  skipped: BackupSkipped;
}

export interface BackupParseFailure {
  ok: false;
  reason: BackupErrorReason;
  message: string;
}

export type BackupParseResult = BackupParseSuccess | BackupParseFailure;

export interface BuildBackupInput {
  rows: StudyRows;
  settings: BackupSettings;
  exportedAt?: number;
  appVersion?: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(reason: BackupErrorReason, message: string): BackupParseFailure {
  return { ok: false, reason, message };
}

function section<T>(
  value: unknown,
  validate: (row: unknown) => row is T,
): { rows: T[]; skipped: number } | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const rows: T[] = [];
  let skipped = 0;
  for (const row of value) {
    if (validate(row)) {
      rows.push(row);
    } else {
      skipped += 1;
    }
  }
  return { rows, skipped };
}

/** Assemble a v1 backup from repository rows and local settings. */
export function buildBackup(input: BuildBackupInput): BackupFile {
  return {
    format: BACKUP_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    appVersion: input.appVersion ?? APP_VERSION,
    exportedAt: input.exportedAt ?? Date.now(),
    settings: { ...input.settings },
    attempts: [...input.rows.attempts],
    questionResults: [...input.rows.questionResults],
    certProgress: [...input.rows.certProgress],
    questionMastery: [...input.rows.questionMastery],
    sessions: [...input.rows.sessions],
  };
}

/** Pretty-print for a human-readable file (DATA-25). */
export function backupToJson(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2);
}

/**
 * Parse and validate a backup string without touching any storage.
 *
 * Returns a structured failure for structural problems and never throws.
 */
export function parseBackup(raw: string): BackupParseResult {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return fail('malformed', 'That file is not valid JSON, so nothing was imported.');
  }
  if (!isObject(value)) {
    return fail('malformed', 'That file does not contain a backup.');
  }
  if (value['format'] !== BACKUP_FORMAT) {
    return fail(
      'not-a-backup',
      'That file is not a CloudCertPrep backup, so nothing was imported.',
    );
  }

  const schemaVersion = value['schemaVersion'];
  if (typeof schemaVersion !== 'number' || !Number.isFinite(schemaVersion)) {
    return fail('malformed', 'The backup has no usable schema version.');
  }
  if (schemaVersion !== SCHEMA_VERSION) {
    return fail(
      'incompatible-schema',
      `This backup uses schema version ${schemaVersion}, but this app reads version ${SCHEMA_VERSION}. Nothing was imported.`,
    );
  }

  const appVersion = value['appVersion'];
  const exportedAt = value['exportedAt'];
  if (typeof appVersion !== 'string' || typeof exportedAt !== 'number') {
    return fail('malformed', 'The backup is missing its version or export time.');
  }

  const settingsValue = value['settings'];
  if (!isObject(settingsValue)) {
    return fail('malformed', 'The backup settings are not readable.');
  }
  const settings: BackupSettings = {};
  for (const [key, setting] of Object.entries(settingsValue)) {
    if (typeof setting !== 'string') {
      return fail('invalid-settings', 'The backup settings contain an invalid value.');
    }
    settings[key] = setting;
  }

  const attempts = section(value['attempts'], isAttemptRow);
  const questionResults = section(value['questionResults'], isQuestionResultRow);
  const certProgress = section(value['certProgress'], isCertProgressRow);
  const questionMastery = section(value['questionMastery'], isQuestionMasteryRow);
  const sessions = section(value['sessions'], isSessionRow);
  if (!attempts || !questionResults || !certProgress || !questionMastery || !sessions) {
    return fail('malformed', 'The backup is missing one of its data sections.');
  }

  return {
    ok: true,
    backup: {
      format: BACKUP_FORMAT,
      schemaVersion,
      appVersion,
      exportedAt,
      settings,
      attempts: attempts.rows,
      questionResults: questionResults.rows,
      certProgress: certProgress.rows,
      questionMastery: questionMastery.rows,
      sessions: sessions.rows,
    },
    skipped: {
      attempts: attempts.skipped,
      questionResults: questionResults.skipped,
      certProgress: certProgress.skipped,
      questionMastery: questionMastery.skipped,
      sessions: sessions.skipped,
    },
  };
}

/** Split a parsed backup back into the repository row set. */
export function backupToRows(backup: BackupFile): StudyRows {
  return {
    attempts: backup.attempts,
    questionResults: backup.questionResults,
    certProgress: backup.certProgress,
    questionMastery: backup.questionMastery,
    sessions: backup.sessions,
  };
}

export function skippedTotal(skipped: BackupSkipped): number {
  return (
    skipped.attempts +
    skipped.questionResults +
    skipped.certProgress +
    skipped.questionMastery +
    skipped.sessions
  );
}
