import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

import { BackupTransportError } from './backup-transport';
import { WebBackupTransport } from './web-backup-transport';

/**
 * Native backup transport (CERT-36, DATA-26).
 *
 * Writes the JSON into the app cache, which the configured FileProvider already
 * exposes, then opens the Android share sheet so the student chooses where to
 * keep or send the file. Import reuses the web file input, which Capacitor
 * bridges to the native file chooser.
 */
export class NativeBackupTransport extends WebBackupTransport {
  override async saveBackup(fileName: string, json: string): Promise<void> {
    try {
      const { uri } = await Filesystem.writeFile({
        path: fileName,
        data: json,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });
      await Share.share({
        title: 'CloudCertPrep backup',
        url: uri,
        dialogTitle: 'Save or share your backup',
      });
    } catch (cause) {
      throw new BackupTransportError(
        'The backup file could not be shared on this device. Nothing was changed.',
        cause,
      );
    }
  }
}
