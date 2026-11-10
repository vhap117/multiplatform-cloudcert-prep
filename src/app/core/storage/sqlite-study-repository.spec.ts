import { describe, expect, it } from 'vitest';

import { SqliteStudyRepository } from './sqlite-study-repository';
import {
  studyRepositoryContract,
  type ContractFactory,
} from './study-repository.contract';
import { SqlJsDriver } from './testing/sqljs-driver';

let databaseCounter = 0;

function uniqueName(): string {
  databaseCounter += 1;
  return `sqlite-contract-${databaseCounter}`;
}

const sqliteHarness: ContractFactory = async (options = {}) => {
  const repository = new SqliteStudyRepository(
    new SqlJsDriver(options.databaseName ?? uniqueName()),
    options.failBeforeCommit
      ? {
          hooks: {
            beforeCommit: () => {
              throw new Error('injected storage failure');
            },
          },
        }
      : undefined,
  );
  await repository.open();
  return {
    repository,
    writeRaw: (table, value) => repository.writeRawForTest(table, value),
  };
};

studyRepositoryContract('SQLite', sqliteHarness);

describe('SqliteStudyRepository diagnostics', () => {
  it('identifies the backend as SQLite', async () => {
    const repository = new SqliteStudyRepository(new SqlJsDriver(uniqueName()));

    const report = await repository.diagnose();

    expect(report.backend).toBe('sqlite');
    await repository.close();
  });
});
