import { beforeEach, describe, expect, it, vi } from 'vitest';

const filesystem = vi.hoisted(() => ({ writeFile: vi.fn() }));
const share = vi.hoisted(() => ({ share: vi.fn() }));

vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { writeFile: filesystem.writeFile },
  Directory: { Cache: 'CACHE' },
  Encoding: { UTF8: 'utf8' },
}));

vi.mock('@capacitor/share', () => ({
  Share: { share: share.share },
}));

import { BackupTransportError } from './backup-transport';
import { NativeBackupTransport } from './native-backup-transport';

beforeEach(() => {
  filesystem.writeFile.mockReset();
  share.share.mockReset();
});

describe('NativeBackupTransport.saveBackup (CERT-36, DATA-26)', () => {
  it('writes the JSON to the cache and opens the share sheet', async () => {
    filesystem.writeFile.mockResolvedValue({ uri: 'file:///cache/backup.json' });
    share.share.mockResolvedValue({});

    await new NativeBackupTransport().saveBackup('backup.json', '{"a":1}');

    expect(filesystem.writeFile).toHaveBeenCalledWith({
      path: 'backup.json',
      data: '{"a":1}',
      directory: 'CACHE',
      encoding: 'utf8',
    });
    expect(share.share).toHaveBeenCalledWith({
      title: 'CloudCertPrep backup',
      url: 'file:///cache/backup.json',
      dialogTitle: 'Save or share your backup',
    });
  });

  it('surfaces a typed error when the file cannot be shared', async () => {
    filesystem.writeFile.mockRejectedValue(new Error('no space'));

    await expect(
      new NativeBackupTransport().saveBackup('backup.json', '{}'),
    ).rejects.toBeInstanceOf(BackupTransportError);
    expect(share.share).not.toHaveBeenCalled();
  });
});
