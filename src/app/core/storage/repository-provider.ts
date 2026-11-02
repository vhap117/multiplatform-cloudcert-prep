import { InjectionToken, type Provider } from '@angular/core';

import { IndexedDbStudyRepository } from './indexeddb-study-repository';
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
 * Selects the platform adapter.
 *
 * Current scope is web only, so IndexedDB is the only implementation. When the
 * native phase starts, this function gains a Capacitor check and returns the
 * SQLite adapter instead. No other file changes.
 */
export function createStudyRepository(): StudyRepository {
  return new IndexedDbStudyRepository();
}

export function provideStudyRepository(): Provider {
  return {
    provide: STUDY_REPOSITORY,
    useFactory: createStudyRepository,
  };
}
