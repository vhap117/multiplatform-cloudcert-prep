import { describe, expect, it } from 'vitest';

import { describeStorageError, StorageOpenError } from './errors';

describe('describeStorageError', () => {
  it('joins the outer message and every distinct cause', () => {
    const error = new StorageOpenError(
      'Could not open the local database',
      new Error('Open: database not opened'),
    );

    expect(describeStorageError(error)).toBe(
      'Could not open the local database. Caused by: Open: database not opened',
    );
  });

  it('handles a plain string rejection from the plugin bridge', () => {
    expect(describeStorageError('Open: no available connection')).toBe(
      'Open: no available connection',
    );
  });

  it('does not repeat the same message', () => {
    const error = new Error('same', { cause: new Error('same') });

    expect(describeStorageError(error)).toBe('same');
  });

  it('caps a cyclic cause chain', () => {
    const first = new Error('first');
    const second = new Error('second', { cause: first });
    (first as { cause?: unknown }).cause = second;

    expect(describeStorageError(first)).toBe('first. Caused by: second');
  });

  it('falls back when there is no message', () => {
    expect(describeStorageError(undefined)).toBe(
      'Unknown error while preparing the local database',
    );
    expect(describeStorageError(new Error(''))).toBe(
      'Unknown error while preparing the local database',
    );
  });
});
