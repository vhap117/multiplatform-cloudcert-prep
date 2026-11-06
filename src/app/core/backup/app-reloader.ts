import { Injectable } from '@angular/core';

/**
 * Reload seam after a destructive data operation (issue 011).
 *
 * A full reload is the correctness guarantee: every session service, signal,
 * and screen re-reads storage, so nothing can keep stale in-memory state and
 * re-write deleted rows. Injectable so specs can assert the recovery step
 * without tearing down the test document.
 */
@Injectable({ providedIn: 'root' })
export class AppReloader {
  reload(): void {
    globalThis.location?.reload();
  }
}
