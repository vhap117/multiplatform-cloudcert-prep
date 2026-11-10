import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StorageOpenError } from './errors';
import { STUDY_REPOSITORY } from './repository-provider';
import { StorageStartupService } from './storage-startup.service';

function create(open: ReturnType<typeof vi.fn>): StorageStartupService {
  TestBed.configureTestingModule({
    providers: [{ provide: STUDY_REPOSITORY, useValue: { open } }],
  });
  return TestBed.inject(StorageStartupService);
}

afterEach(() => {
  TestBed.resetTestingModule();
});

describe('StorageStartupService', () => {
  it('opens the repository and becomes ready', async () => {
    const open = vi.fn().mockResolvedValue(undefined);
    const startup = create(open);

    await startup.start();

    expect(open).toHaveBeenCalledTimes(1);
    expect(startup.state()).toBe('ready');
    expect(startup.error()).toBe('');
  });

  it('keeps a failure and exposes its message', async () => {
    const open = vi
      .fn()
      .mockRejectedValue(new StorageOpenError('Could not open the local database'));
    const startup = create(open);

    await startup.start();

    expect(startup.state()).toBe('error');
    expect(startup.error()).toBe('Could not open the local database');
  });

  it('retries after a failure', async () => {
    const open = vi
      .fn()
      .mockRejectedValueOnce(new StorageOpenError('Could not open the local database'))
      .mockResolvedValueOnce(undefined);
    const startup = create(open);

    await startup.start();
    expect(startup.state()).toBe('error');

    await startup.start();

    expect(open).toHaveBeenCalledTimes(2);
    expect(startup.state()).toBe('ready');
    expect(startup.error()).toBe('');
  });

  it('does not reopen once ready', async () => {
    const open = vi.fn().mockResolvedValue(undefined);
    const startup = create(open);

    await startup.start();
    await startup.start();

    expect(open).toHaveBeenCalledTimes(1);
  });
});
