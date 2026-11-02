/**
 * Storage errors.
 *
 * These exist so a failed write is never a silent no-op and never a raw
 * DOMException reaching a screen. The UI layer turns them into a visible,
 * retryable state (DATA-13, ACC-41, ACC-42).
 */

/** A write failed. The data is unchanged and the call may be retried. */
export class StorageWriteError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'StorageWriteError';
  }
}

/** A read failed. Callers must not fabricate data in response (SR-32). */
export class StorageReadError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'StorageReadError';
  }
}

/**
 * A migration failed. Previously stored data is left intact and the error is
 * recoverable (DATA-12, ACC-39).
 */
export class StorageMigrationError extends Error {
  constructor(
    message: string,
    readonly fromVersion: number,
    readonly toVersion: number,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'StorageMigrationError';
  }
}

/** The store could not be opened at all. */
export class StorageOpenError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'StorageOpenError';
  }
}
