import { Injectable, inject, signal } from '@angular/core';

import { STUDY_REPOSITORY } from './repository-provider';

export type StorageStartupState = 'loading' | 'ready' | 'error';

/**
 * Opens the local store during application startup.
 *
 * Runs before the router and screens exist, so schema migrations always
 * complete on a cold start instead of waiting for the first storage read. A
 * failure is kept here so the root screen can block and offer a retry.
 */
@Injectable({ providedIn: 'root' })
export class StorageStartupService {
  private readonly repository = inject(STUDY_REPOSITORY);

  readonly state = signal<StorageStartupState>('loading');
  readonly error = signal('');

  async start(): Promise<void> {
    if (this.state() === 'ready') {
      return;
    }
    this.state.set('loading');
    this.error.set('');
    try {
      await this.repository.open();
      this.state.set('ready');
    } catch (cause) {
      this.error.set(cause instanceof Error ? cause.message : String(cause));
      this.state.set('error');
    }
  }
}
