import { Capacitor } from '@capacitor/core';
import { type Provider } from '@angular/core';

import { BACKUP_TRANSPORT, type BackupTransport } from './backup-transport';
import { NativeBackupTransport } from './native-backup-transport';
import { WebBackupTransport } from './web-backup-transport';

/**
 * Selects the platform backup transport (CERT-36).
 *
 * Native builds share the JSON through the Android share sheet; the browser
 * keeps the download and file input.
 */
export function createBackupTransport(): BackupTransport {
  return Capacitor.isNativePlatform() ? new NativeBackupTransport() : new WebBackupTransport();
}

/** Binds the platform transport to the shared token. */
export function provideBackupTransport(): Provider {
  return { provide: BACKUP_TRANSPORT, useFactory: createBackupTransport };
}
