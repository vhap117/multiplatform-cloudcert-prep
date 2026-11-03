import 'fake-indexeddb/auto';

import { TestBed } from '@angular/core/testing';

import { appConfig } from './app.config';
import { STUDY_REPOSITORY } from './core/storage/repository-provider';

/**
 * Guards the wiring the feature specs cannot see.
 *
 * Every feature spec provides `STUDY_REPOSITORY` itself, so a missing provider
 * in the real application stayed invisible until a screen was opened in a
 * browser and rendered blank behind a NullInjectorError. This spec boots the
 * application providers only, so forgetting the storage provider fails here
 * instead of in the user's face.
 */
describe('app configuration', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: appConfig.providers ?? [] });
  });

  it('provides the study repository its screens inject', () => {
    expect(TestBed.inject(STUDY_REPOSITORY)).toBeDefined();
  });
});
