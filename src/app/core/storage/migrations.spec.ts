import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';

import { StorageMigrationError } from './errors';
import { IndexedDbStudyRepository } from './indexeddb-study-repository';
import { DEFAULT_MIGRATIONS, MIGRATION_V1, SCHEMA_VERSION } from './schema';
import type { AttemptRow } from './types';

let counter = 0;

function uniqueName(): string {
  counter += 1;
  return `ccp-migration-${Date.now()}-${counter}`;
}

function attempt(): AttemptRow {
  return {
    id: 'attempt-1',
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

describe('Schema migrations', () => {
  it('creates the current schema from an empty database', async () => {
    const repository = new IndexedDbStudyRepository({ databaseName: uniqueName() });

    await repository.open();

    expect(repository.schemaVersion).toBe(SCHEMA_VERSION);
    expect(await repository.listAttempts()).toEqual([]);
  });

  it('runs a forward migration and keeps existing data readable', async () => {
    const name = uniqueName();

    const v1 = new IndexedDbStudyRepository({ databaseName: name, version: 1 });
    await v1.open();
    await v1.commitAnswers({
      attempt: attempt(),
      results: [],
      progress: [],
      mastery: [],
    });
    await v1.close();

    const v2 = new IndexedDbStudyRepository({
      databaseName: name,
      version: 2,
      migrations: {
        ...DEFAULT_MIGRATIONS,
        2: () => {
          // A real forward migration would add a store or an index here.
        },
      },
    });
    await v2.open();

    expect(v2.schemaVersion).toBe(2);
    expect(await v2.getAttempt('attempt-1')).not.toBeNull();
    await v2.close();
  });

  it('reports a typed error when no migration is registered for a version', async () => {
    const name = uniqueName();
    const v1 = new IndexedDbStudyRepository({ databaseName: name, version: 1 });
    await v1.open();
    await v1.close();

    const v3 = new IndexedDbStudyRepository({
      databaseName: name,
      version: 3,
      migrations: { 1: MIGRATION_V1 },
    });

    await expect(v3.open()).rejects.toBeInstanceOf(StorageMigrationError);
  });

  it('leaves the previous version intact when a migration fails', async () => {
    const name = uniqueName();

    const v1 = new IndexedDbStudyRepository({ databaseName: name, version: 1 });
    await v1.open();
    await v1.commitAnswers({
      attempt: attempt(),
      results: [],
      progress: [],
      mastery: [],
    });
    await v1.close();

    const failing = new IndexedDbStudyRepository({
      databaseName: name,
      version: 2,
      migrations: {
        ...DEFAULT_MIGRATIONS,
        2: () => {
          throw new Error('migration exploded');
        },
      },
    });

    const error = await failing.open().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(StorageMigrationError);
    expect((error as StorageMigrationError).fromVersion).toBe(1);
    expect((error as StorageMigrationError).toVersion).toBe(2);

    // The pre-migration data must still be readable at the old version
    // (DATA-12, ACC-39).
    const reopened = new IndexedDbStudyRepository({ databaseName: name, version: 1 });
    await reopened.open();
    expect(await reopened.getAttempt('attempt-1')).not.toBeNull();
    await reopened.close();
  });

  it('exposes the configured version through the repository contract', async () => {
    const repository = new IndexedDbStudyRepository({
      databaseName: uniqueName(),
      version: 2,
      migrations: { ...DEFAULT_MIGRATIONS, 2: () => undefined },
    });

    expect(repository.schemaVersion).toBe(2);
  });
});
