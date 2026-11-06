import { Injectable, inject, signal } from '@angular/core';

import { SETTINGS_KEYS, readSetting, writeSetting } from '../settings/local-settings';
import { STUDY_REPOSITORY } from '../storage/repository-provider';

import { AppReloader } from './app-reloader';
import {
  backupToJson,
  backupToRows,
  buildBackup,
  parseBackup,
  skippedTotal,
  type BackupErrorReason,
  type BackupFile,
  type BackupSkipped,
  type BackupSettings,
} from './backup-format';
import { BACKUP_TRANSPORT } from './backup-transport';

export interface BackupCounts {
  attempts: number;
  questionResults: number;
  certProgress: number;
  questionMastery: number;
  sessions: number;
}

export interface ExportSummary extends BackupCounts {
  fileName: string;
}

export interface ImportPreview {
  backup: BackupFile;
  counts: BackupCounts;
  skipped: BackupSkipped;
  skippedRows: number;
  certCodes: string[];
  exportedAt: number;
  appVersion: string;
}

/** A visible, local failure. Nothing was changed when this is thrown. */
export class BackupError extends Error {
  constructor(
    message: string,
    readonly reason?: BackupErrorReason,
  ) {
    super(message);
    this.name = 'BackupError';
  }
}

/**
 * Backup export, validation, restore, and destructive resets (issue 011).
 *
 * Export reads everything through the repository and hands the JSON to the
 * transport (DATA-24 to DATA-26). Import parses and validates before any write,
 * then replaces local data atomically and restores settings (DATA-27 to DATA-30).
 * Every destructive path ends in a reload overlay so no in-memory state can
 * outlive the operation (see `AppReloader`).
 */
@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly repository = inject(STUDY_REPOSITORY);
  private readonly transport = inject(BACKUP_TRANSPORT);
  private readonly reloader = inject(AppReloader);

  /** Message for the full-screen recovery overlay while a reload is pending. */
  readonly overlayMessage = signal<string | null>(null);

  async export(): Promise<ExportSummary> {
    const rows = {
      attempts: await this.repository.listAttempts(),
      questionResults: await this.repository.listAllQuestionResults(),
      certProgress: await this.repository.listAllCertProgress(),
      questionMastery: await this.repository.listAllQuestionMastery(),
      sessions: await this.repository.listSessions(),
    };
    const backup = buildBackup({ rows, settings: readAllSettings() });
    const fileName = backupFileName(new Date());
    await this.transport.saveBackup(fileName, backupToJson(backup));
    return { fileName, ...countsOf(backup) };
  }

  /** Pick and validate a file. Returns null when the picker was canceled. */
  async inspectImport(): Promise<ImportPreview | null> {
    const raw = await this.transport.pickBackup();
    if (raw === null) {
      return null;
    }
    const parsed = parseBackup(raw);
    if (!parsed.ok) {
      throw new BackupError(parsed.message, parsed.reason);
    }
    return {
      backup: parsed.backup,
      counts: countsOf(parsed.backup),
      skipped: parsed.skipped,
      skippedRows: skippedTotal(parsed.skipped),
      certCodes: [...new Set(parsed.backup.attempts.map((row) => row.cert))].sort(),
      exportedAt: parsed.backup.exportedAt,
      appVersion: parsed.backup.appVersion,
    };
  }

  /** Replace local data after the caller got explicit confirmation. */
  async applyImport(backup: BackupFile): Promise<void> {
    await this.repository.replaceAll(backupToRows(backup));
    writeAllSettings(backup.settings);
    await this.recover('Restoring your data...');
  }

  async resetCert(cert: string): Promise<void> {
    await this.repository.resetCert(cert);
    await this.recover('Resetting progress...');
  }

  async resetAll(): Promise<void> {
    await this.repository.resetAll();
    await this.recover('Clearing your data...');
  }

  private async recover(message: string): Promise<void> {
    this.overlayMessage.set(message);
    await nextPaint();
    this.reloader.reload();
  }
}

function countsOf(backup: BackupFile): BackupCounts {
  return {
    attempts: backup.attempts.length,
    questionResults: backup.questionResults.length,
    certProgress: backup.certProgress.length,
    questionMastery: backup.questionMastery.length,
    sessions: backup.sessions.length,
  };
}

function readAllSettings(): BackupSettings {
  const settings: BackupSettings = {};
  for (const [name, key] of Object.entries(SETTINGS_KEYS)) {
    const value = readSetting(key);
    if (value !== null) {
      settings[name] = value;
    }
  }
  return settings;
}

function writeAllSettings(settings: BackupSettings): void {
  for (const [name, value] of Object.entries(settings)) {
    const key = (SETTINGS_KEYS as Record<string, string>)[name];
    if (key !== undefined) {
      writeSetting(key, value);
    }
  }
}

function backupFileName(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(
    date.getHours(),
  )}${pad(date.getMinutes())}`;
  return `cloudcertprep-backup-${stamp}.json`;
}

/** Wait for two frames so the overlay has painted before the reload. */
function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    const raf = globalThis.requestAnimationFrame;
    if (!raf) {
      setTimeout(resolve, 0);
      return;
    }
    raf(() => raf(() => resolve()));
  });
}
