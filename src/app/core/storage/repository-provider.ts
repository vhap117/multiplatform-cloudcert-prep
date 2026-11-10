import { Capacitor } from '@capacitor/core';
import { InjectionToken, type Provider } from '@angular/core';

import { CapacitorSqliteDriver } from './capacitor-sqlite-driver';
import { IndexedDbStudyRepository } from './indexeddb-study-repository';
import { SqliteStudyRepository } from './sqlite-study-repository';
import type { StudyRepository } from './study-repository';

/**
 * Injection token for the study store.
 *
 * Screens and feature services inject this token and see only `StudyRepository`
 * (IONIC-20). They never import IndexedDbStudyRepository, IndexedDB, or a
 * Capacitor plugin.
 */
export const STUDY_REPOSITORY = new InjectionToken<StudyRepository>('StudyRepository');

/**
 * Whether the app is running on a native platform with the SQLite adapter.
 *
 * Feature code uses this instead of importing `@capacitor/core`, keeping the
 * plugin confined to the storage layer (IONIC-20).
 */
export const IS_NATIVE_STORAGE = new InjectionToken<boolean>('IsNativeStorage', {
  providedIn: 'root',
  factory: () => Capacitor.isNativePlatform(),
});

/**
 * Selects the platform adapter (DATA-7).
 *
 * Native devices use Capacitor SQLite in the app's private directory; the
 * browser, including `ionic serve` and tests, uses IndexedDB. Both implement
 * the same contract and schema (IONIC-19).
 */
export function createStudyRepository(): StudyRepository {
  return Capacitor.isNativePlatform()
    ? new SqliteStudyRepository(new CapacitorSqliteDriver())
    : new IndexedDbStudyRepository();
}

export function provideStudyRepository(): Provider {
  return {
    provide: STUDY_REPOSITORY,
    useFactory: createStudyRepository,
  };
}
