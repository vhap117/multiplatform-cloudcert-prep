import { Capacitor } from '@capacitor/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBackupTransport } from './backup-transport.provider';
import { NativeBackupTransport } from './native-backup-transport';
import { WebBackupTransport } from './web-backup-transport';

describe('createBackupTransport platform gate', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('selects the web transport in the browser', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);

    expect(createBackupTransport()).toBeInstanceOf(WebBackupTransport);
  });

  it('selects the native transport on a native platform', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);

    expect(createBackupTransport()).toBeInstanceOf(NativeBackupTransport);
  });
});
