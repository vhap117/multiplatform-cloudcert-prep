import { InjectionToken } from '@angular/core';

/**
 * Backup file transport (DATA-26, CERT-36).
 *
 * Two responsibilities only: save a backup file and let the student pick one
 * back. Screens and the backup service depend on this interface, never on a
 * download API or a Capacitor plugin (IONIC-20). The native phase replaces the
 * web implementation with the Filesystem and Share plugins behind this token.
 */
export interface BackupTransport {
  /** Save the backup JSON as a local file the student chooses to keep. */
  saveBackup(fileName: string, json: string): Promise<void>;
  /** Read a picked backup file, or null when the student cancels. */
  pickBackup(): Promise<string | null>;
}

/** A transport failure surfaced to the screen as a local, retryable error (PRIV-19). */
export class BackupTransportError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'BackupTransportError';
  }
}

export const BACKUP_TRANSPORT = new InjectionToken<BackupTransport>('BackupTransport');
