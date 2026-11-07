import { describe, expect, it } from 'vitest';

import {
  StorageMigrationError,
  StorageOpenError,
  StorageReadError,
} from './errors';
import { DEFAULT_SQLITE_MIGRATIONS } from './schema';
import { SqliteStudyRepository } from './sqlite-study-repository';
import { SqlJsDriver } from './testing/sqljs-driver';
import { attempt } from './study-repository.contract';

class FlakyDriver extends SqlJsDriver {
  failQuery = false;
  failRun = false;

  override async query(statement: string, values: readonly unknown[] = []) {
    if (this.failQuery) {
      throw new Error('disk read failed');
    }
    return super.query(statement, values);
  }

  override async run(statement: string, values: readonly unknown[] = []) {
    if (this.failRun) {
      throw new Error('disk write failed');
    }
    return super.run(statement, values);
  }
}

class BrokenOpenDriver extends SqlJsDriver {
  override async open(): Promise<void> {
    throw new Error('no storage available');
  }
}

describe('SQLite adapter failure semantics', () => {
  it('reports a read failure as a typed error', async () => {
    const driver = new FlakyDriver('read-error');
    const repository = new SqliteStudyRepository(driver);
    await repository.open();
    driver.failQuery = true;

    await expect(repository.listAttempts()).rejects.toBeInstanceOf(StorageReadError);
  });

  it('reports an open failure as StorageOpenError', async () => {
    const repository = new SqliteStudyRepository(new BrokenOpenDriver('open-error'));

    await expect(repository.open()).rejects.toBeInstanceOf(StorageOpenError);
  });

  it('reports a failed migration and leaves prior data intact (ACC-39)', async () => {
    const name = 'migration-failure';
    const version1 = new SqliteStudyRepository(new SqlJsDriver(name), { version: 1 });
    await version1.open();
    await version1.commitAnswers({
      attempt: attempt(),
      results: [],
      progress: [],
      mastery: [],
    });
    await version1.close();

    const broken = new SqliteStudyRepository(new SqlJsDriver(name), {
      version: 2,
      migrations: { ...DEFAULT_SQLITE_MIGRATIONS, 2: ['THIS IS NOT SQL'] },
    });

    await expect(broken.open()).rejects.toBeInstanceOf(StorageMigrationError);

    const reopened = new SqliteStudyRepository(new SqlJsDriver(name), { version: 1 });
    await reopened.open();
    expect((await reopened.listAttempts()).map((row) => row.id)).toEqual(['attempt-1']);
    await reopened.close();
  });

  it('reports a missing migration for the target version', async () => {
    const repository = new SqliteStudyRepository(new SqlJsDriver('missing-migration'), {
      version: 2,
      migrations: DEFAULT_SQLITE_MIGRATIONS,
    });

    await expect(repository.open()).rejects.toBeInstanceOf(StorageMigrationError);
  });
});
