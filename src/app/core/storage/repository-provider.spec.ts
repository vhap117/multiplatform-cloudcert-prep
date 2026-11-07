import { Capacitor } from '@capacitor/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { IndexedDbStudyRepository } from './indexeddb-study-repository';
import { createStudyRepository } from './repository-provider';
import { SqliteStudyRepository } from './sqlite-study-repository';

describe('createStudyRepository platform gate', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('selects the IndexedDB adapter in the browser', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);

    expect(createStudyRepository()).toBeInstanceOf(IndexedDbStudyRepository);
  });

  it('selects the SQLite adapter on a native platform', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);

    expect(createStudyRepository()).toBeInstanceOf(SqliteStudyRepository);
  });
});
