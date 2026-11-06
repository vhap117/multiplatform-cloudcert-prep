import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BackupTransportError } from './backup-transport';
import { WebBackupTransport } from './web-backup-transport';

interface UrlStatics {
  createObjectURL?: (blob: Blob) => string;
  revokeObjectURL?: (url: string) => void;
}

const urlStatics = URL as unknown as UrlStatics;
const originalCreate = urlStatics.createObjectURL;
const originalRevoke = urlStatics.revokeObjectURL;

function setObjectUrls(
  create: UrlStatics['createObjectURL'],
  revoke: UrlStatics['revokeObjectURL'],
): void {
  urlStatics.createObjectURL = create;
  urlStatics.revokeObjectURL = revoke;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  setObjectUrls(originalCreate, originalRevoke);
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('WebBackupTransport.saveBackup (DATA-26, PRIV-19)', () => {
  it('downloads the JSON through an object URL and cleans up', async () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:backup');
    const revokeObjectURL = vi.fn();
    setObjectUrls(createObjectURL, revokeObjectURL);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    await new WebBackupTransport().saveBackup('backup.json', '{"a":1}');

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(createObjectURL.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:backup');
  });

  it('raises a clear transport error when saving is not possible', async () => {
    setObjectUrls(() => {
      throw new Error('blocked');
    }, undefined);

    await expect(
      new WebBackupTransport().saveBackup('backup.json', '{}'),
    ).rejects.toBeInstanceOf(BackupTransportError);
  });
});

describe('WebBackupTransport.pickBackup (DATA-27)', () => {
  it('resolves the picked file contents', async () => {
    const transport = new WebBackupTransport();
    const pending = transport.pickBackup();

    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    Object.defineProperty(input, 'files', {
      value: [{ text: () => Promise.resolve('{"format":"x"}') }],
    });
    input!.dispatchEvent(new Event('change'));

    await expect(pending).resolves.toBe('{"format":"x"}');
  });

  it('resolves null when the picker is canceled', async () => {
    const transport = new WebBackupTransport();
    const pending = transport.pickBackup();

    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    input!.dispatchEvent(new Event('cancel'));

    await expect(pending).resolves.toBeNull();
  });
});
