import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SETTINGS_KEYS,
  prefersDark,
  prefersReducedMotion,
  readSetting,
  writeSetting,
} from './local-settings';

describe('local settings', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('returns null for a setting that was never written', () => {
    expect(readSetting('ccp.missing')).toBeNull();
  });

  it('round-trips a written value', () => {
    writeSetting(SETTINGS_KEYS.selectedCert, 'aif-c01');
    expect(readSetting(SETTINGS_KEYS.selectedCert)).toBe('aif-c01');
  });

  it('exposes a key for every preference the app stores', () => {
    expect(Object.keys(SETTINGS_KEYS).sort()).toEqual([
      'lastTab',
      'motion',
      'selectedCert',
      'theme',
    ]);
  });

  it('does not throw when reading is blocked by the platform', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(readSetting(SETTINGS_KEYS.theme)).toBeNull();
  });

  it('does not throw when writing fails, for example on a full store', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(() => writeSetting(SETTINGS_KEYS.theme, 'dark')).not.toThrow();
  });

  it('reports no preference when matchMedia is unavailable', () => {
    const original = globalThis.matchMedia;
    // @ts-expect-error deliberately removing the API for this case
    delete globalThis.matchMedia;

    expect(prefersDark()).toBe(false);
    expect(prefersReducedMotion()).toBe(false);

    globalThis.matchMedia = original;
  });
});
