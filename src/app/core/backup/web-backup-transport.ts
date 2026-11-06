import { type Provider } from '@angular/core';

import { BACKUP_TRANSPORT, BackupTransport, BackupTransportError } from './backup-transport';

/**
 * Web backup transport (DATA-26, CERT-36).
 *
 * Saving triggers a browser download; importing opens a file input. Both are
 * explicit user actions, fully offline, and leave no copy behind (PRIV-21).
 * The native phase swaps in the share sheet and Filesystem plugins behind the
 * same interface.
 */
export class WebBackupTransport implements BackupTransport {
  async saveBackup(fileName: string, json: string): Promise<void> {
    try {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (cause) {
      throw new BackupTransportError(
        'The backup file could not be saved on this device. Nothing was changed.',
        cause,
      );
    }
  }

  pickBackup(): Promise<string | null> {
    return new Promise((resolve, reject) => {
      if (typeof document === 'undefined') {
        reject(new BackupTransportError('No file picker is available on this device.'));
        return;
      }
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';
      input.style.display = 'none';

      const cleanup = (): void => {
        input.remove();
      };

      input.addEventListener('change', () => {
        const file = input.files?.[0];
        cleanup();
        if (!file) {
          resolve(null);
          return;
        }
        file.text().then(resolve, (cause) => {
          reject(
            new BackupTransportError('The backup file could not be read.', cause),
          );
        });
      });
      input.addEventListener('cancel', () => {
        cleanup();
        resolve(null);
      });

      document.body.appendChild(input);
      input.click();
    });
  }
}

/** Binds the web transport to the shared token. */
export function provideBackupTransport(): Provider {
  return { provide: BACKUP_TRANSPORT, useClass: WebBackupTransport };
}
