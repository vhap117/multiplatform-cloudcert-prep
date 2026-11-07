import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';

import {
  StorageMigrationError,
  StorageWriteError,
} from './errors';
import { IndexedDbStudyRepository } from './indexeddb-study-repository';
import { DEFAULT_MIGRATIONS } from './schema';
import type { AttemptRow, SessionRow } from './types';

/**
 * Storage failure drills (ACC-38 to ACC-47, OFF-32).
 *
 * Each named drill from issue 013 is reproduced against the real IndexedDB
 * adapter (fake-indexeddb in the test environment), not a mock:
 *
 * 1. Quota exceeded on write.
 * 2. Interrupted write across a reopen.
 * 3. Corrupted or unknown row on read.
 * 4. Migration failure with prior data intact.
 * 5. Failed bank load (asserted on the screen side, see
 *    `practice-config.page.spec.ts`).
 *
 * The screen side of "visible and retryable" is proven by the runner and
 * dashboard specs (a failed save never advances the session and always leaves a
 * retry affordance). These drills prove the storage half: typed errors, no
 * partial writes, and no data loss.
 */

let counter = 0;

function uniqueName(): string {
  counter += 1;
  return `ccp-drill-${Date.now()}-${counter}`;
}

function attempt(id: string): AttemptRow {
  return {
    id,
    cert: 'clf-c02',
    kind: 'mock',
    startedAt: 1_000,
    finishedAt: 2_000,
    totalQuestions: 65,
    correctCount: 52,
    scorePercent: 80,
    passed: true,
    timeTakenSeconds: 1_000,
    domainScores: [{ domainId: 1, correct: 13, total: 16, percent: 81 }],
  };
}

function session(): SessionRow {
  return {
    id: 'clf-c02:study',
    cert: 'clf-c02',
    kind: 'study',
    questionOrder: ['q001'],
    currentIndex: 0,
    answers: {},
    feedbackShown: [],
    flagged: [],
    optionKeyMaps: {},
    startedAt: 1_000,
    deadlineAt: null,
    answeredCount: 0,
    correctCount: 0,
    wrongCount: 0,
    updatedAt: 1_000,
  };
}

describe('storage failure drills', () => {
  it('surfaces a quota-exceeded write as a typed error and keeps prior data (ACC-41)', async () => {
    const name = uniqueName();
    const healthy = new IndexedDbStudyRepository({ databaseName: name });
    await healthy.open();
    await healthy.commitAnswers({
      attempt: attempt('kept'),
      results: [],
      progress: [],
      mastery: [],
    });
    await healthy.close();

    const quota = new Error('The quota has been exceeded.');
    quota.name = 'QuotaExceededError';
    const full = new IndexedDbStudyRepository({
      databaseName: name,
      hooks: {
        beforeCommit: () => {
          throw quota;
        },
      },
    });
    await full.open();

    await expect(
      full.commitAnswers({
        attempt: attempt('rejected'),
        results: [],
        progress: [],
        mastery: [],
      }),
    ).rejects.toBeInstanceOf(StorageWriteError);

    await full.close();

    const reopened = new IndexedDbStudyRepository({ databaseName: name });
    await reopened.open();
    const ids = (await reopened.listAttempts()).map((row) => row.id);
    await reopened.close();

    // The failed batch wrote nothing and did not corrupt the committed row.
    expect(ids).toEqual(['kept']);
  });

  it('discards an interrupted write across a reopen (ACC-38)', async () => {
    const name = uniqueName();
    const first = new IndexedDbStudyRepository({ databaseName: name });
    await first.open();
    await first.putSession(session());
    await first.close();

    const interrupted = new IndexedDbStudyRepository({
      databaseName: name,
      hooks: {
        beforeCommit: () => {
          throw new Error('process killed mid-write');
        },
      },
    });
    await interrupted.open();
    await expect(
      interrupted.commitAnswers({
        attempt: attempt('interrupted'),
        results: [],
        progress: [],
        mastery: [],
        clearSession: { cert: 'clf-c02', kind: 'study' },
      }),
    ).rejects.toBeInstanceOf(StorageWriteError);
    await interrupted.close();

    const reopened = new IndexedDbStudyRepository({ databaseName: name });
    await reopened.open();
    const attempts = await reopened.listAttempts();
    const restoredSession = await reopened.getSession('clf-c02', 'study');
    await reopened.close();

    // Nothing from the interrupted batch landed, and the session it would
    // have cleared is still resumable.
    expect(attempts).toEqual([]);
    expect(restoredSession?.id).toBe('clf-c02:study');
  });

  it('quarantines a corrupted or unknown row without failing the read (ACC-40)', async () => {
    const repository = new IndexedDbStudyRepository({ databaseName: uniqueName() });
    await repository.open();

    await repository.commitAnswers({
      attempt: attempt('valid'),
      results: [],
      progress: [],
      mastery: [],
    });
    await repository.writeRawForTest('attempts', { id: 'truncated' });
    await repository.writeRawForTest('attempts', {
      ...attempt('unknown-kind'),
      kind: 'flashcard',
    });

    const attempts = await repository.listAttempts();
    await repository.close();

    // The valid row survives; every malformed or unknown row is skipped, not
    // rendered and not thrown.
    expect(attempts.map((row) => row.id)).toEqual(['valid']);
  });

  it('leaves prior data readable when a migration fails (ACC-39)', async () => {
    const name = uniqueName();
    const v1 = new IndexedDbStudyRepository({ databaseName: name, version: 1 });
    await v1.open();
    await v1.commitAnswers({
      attempt: attempt('pre-migration'),
      results: [],
      progress: [],
      mastery: [],
    });
    await v1.close();

    const broken = new IndexedDbStudyRepository({
      databaseName: name,
      version: 2,
      migrations: {
        ...DEFAULT_MIGRATIONS,
        2: () => {
          throw new Error('migration exploded');
        },
      },
    });

    await expect(broken.open()).rejects.toBeInstanceOf(StorageMigrationError);

    const stillV1 = new IndexedDbStudyRepository({ databaseName: name, version: 1 });
    await stillV1.open();
    const rows = await stillV1.listAttempts();
    await stillV1.close();

    expect(rows.map((row) => row.id)).toEqual(['pre-migration']);
  });
});
