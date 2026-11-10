import {
  StorageMigrationError,
  StorageOpenError,
  StorageReadError,
  StorageWriteError,
} from './errors';
import {
  buildStorageDiagnostics,
  type StorageDiagnostics,
} from './diagnostics';
import {
  ALL_STORES,
  DEFAULT_MIGRATIONS,
  SCHEMA_VERSION,
  STORES,
  STUDY_STORES,
  sessionId,
  type MigrationMap,
  type StoreName,
} from './schema';
import type { StudyRepository } from './study-repository';
import type {
  AttemptFilter,
  AttemptRow,
  CertCode,
  CertProgressRow,
  CommitAnswersInput,
  QuestionMasteryRow,
  QuestionResultRow,
  SessionKind,
  SessionRow,
  StudyRows,
} from './types';
import {
  isAttemptRow,
  isCertProgressRow,
  isQuestionMasteryRow,
  isQuestionResultRow,
  isSessionRow,
} from './validation';

const DEFAULT_DATABASE_NAME = 'cloudcertprep';

export interface IndexedDbOptions {
  databaseName?: string;
  /** Target schema version. Defaults to the current schema. */
  version?: number;
  /** Migration per produced version. Defaults to the shipped migrations. */
  migrations?: MigrationMap;
  /**
   * Test seams. They exist so atomicity and failure handling can be proven
   * rather than assumed. Feature code never passes them.
   */
  hooks?: {
    /** Called inside the write transaction, before it commits. Throwing aborts. */
    beforeCommit?: () => void;
  };
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('transaction aborted'));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('transaction failed'));
  });
}

interface MetaRow {
  key: string;
  value: number | string;
}

/**
 * IndexedDB implementation of the study repository.
 *
 * This is the only store in the current web-only scope. The native SQLite
 * adapter will implement the same interface against the same schema (issue 002,
 * deferred task). Nothing outside this file may touch IndexedDB (IONIC-20).
 */
export class IndexedDbStudyRepository implements StudyRepository {
  readonly schemaVersion: number;

  private readonly databaseName: string;
  private readonly migrations: MigrationMap;
  private readonly hooks: IndexedDbOptions['hooks'];
  private database: IDBDatabase | null = null;

  constructor(options: IndexedDbOptions = {}) {
    this.databaseName = options.databaseName ?? DEFAULT_DATABASE_NAME;
    this.schemaVersion = options.version ?? SCHEMA_VERSION;
    this.migrations = options.migrations ?? DEFAULT_MIGRATIONS;
    this.hooks = options.hooks;
  }

  open(): Promise<void> {
    if (this.database) {
      return Promise.resolve();
    }
    const factory = globalThis.indexedDB;
    if (!factory) {
      return Promise.reject(
        new StorageOpenError('IndexedDB is not available in this environment'),
      );
    }

    const targetVersion = this.schemaVersion;
    const request = factory.open(this.databaseName, targetVersion);
    let upgradeFailure: StorageMigrationError | null = null;

    request.onupgradeneeded = (event) => {
      const database = request.result;
      const transaction = request.transaction;
      const fromVersion = event.oldVersion;
      if (!transaction) {
        return;
      }
      try {
        for (let version = fromVersion + 1; version <= targetVersion; version += 1) {
          const migration = this.migrations[version];
          if (!migration) {
            throw new StorageMigrationError(
              `No migration registered for schema version ${version}`,
              fromVersion,
              targetVersion,
            );
          }
          migration(database, transaction);
        }
      } catch (cause) {
        upgradeFailure =
          cause instanceof StorageMigrationError
            ? cause
            : new StorageMigrationError(
                `Schema migration from version ${fromVersion} to ${targetVersion} failed`,
                fromVersion,
                targetVersion,
                cause,
              );
        transaction.abort();
      }
    };

    return new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        if (upgradeFailure) {
          request.result.close();
          reject(upgradeFailure);
          return;
        }
        this.database = request.result;
        this.database.onversionchange = () => this.database?.close();
        this.recordSchemaVersion().then(resolve, () => resolve());
      };
      request.onerror = () => {
        reject(
          upgradeFailure ??
            new StorageOpenError(
              'Could not open the local database',
              request.error ?? undefined,
            ),
        );
      };
      request.onblocked = () => {
        reject(
          new StorageOpenError(
            'The local database is blocked by another open connection',
          ),
        );
      };
    });
  }

  async close(): Promise<void> {
    this.database?.close();
    this.database = null;
  }

  async diagnose(): Promise<StorageDiagnostics> {
    await this.open();
    const database = this.requireDatabase();
    const present = new Set<string>();
    for (let index = 0; index < database.objectStoreNames.length; index += 1) {
      const name = database.objectStoreNames.item(index);
      if (name) {
        present.add(name);
      }
    }
    return buildStorageDiagnostics(
      'indexeddb',
      this.schemaVersion,
      database.version,
      present,
    );
  }

  async commitAnswers(input: CommitAnswersInput): Promise<void> {
    await this.open();
    const database = this.requireDatabase();
    // One transaction across every affected store is what makes the batch
    // atomic: all rows land or none do (DATA-10).
    const transaction = database.transaction(ALL_STORES, 'readwrite');
    const done = transactionDone(transaction);

    try {
      if (input.attempt) {
        transaction.objectStore(STORES.attempts).put(input.attempt);
      }
      const results = transaction.objectStore(STORES.questionResults);
      for (const row of input.results) {
        results.put(row);
      }
      const progress = transaction.objectStore(STORES.certProgress);
      for (const row of input.progress) {
        progress.put(row);
      }
      const mastery = transaction.objectStore(STORES.questionMastery);
      for (const row of input.mastery) {
        mastery.put(row);
      }
      if (input.clearSession) {
        transaction
          .objectStore(STORES.sessions)
          .delete(sessionId(input.clearSession.cert, input.clearSession.kind));
      }

      this.hooks?.beforeCommit?.();
    } catch (cause) {
      try {
        transaction.abort();
      } catch {
        // Already aborting.
      }
      await done.catch(() => undefined);
      throw new StorageWriteError(
        'Could not save the answer batch. The study data is unchanged.',
        cause,
      );
    }

    try {
      await done;
    } catch (cause) {
      throw new StorageWriteError(
        'Could not save the answer batch. The study data is unchanged.',
        cause,
      );
    }
  }

  async getAttempt(id: string): Promise<AttemptRow | null> {
    await this.open();
    const value = await this.readOne(STORES.attempts, id);
    return isAttemptRow(value) ? value : null;
  }

  async listAttempts(filter: AttemptFilter = {}): Promise<AttemptRow[]> {
    await this.open();
    const rows = await this.readAll(STORES.attempts, isAttemptRow);
    return rows
      .filter(
        (row) =>
          (filter.cert === undefined || row.cert === filter.cert) &&
          (filter.kind === undefined || row.kind === filter.kind) &&
          (filter.passed === undefined || row.passed === filter.passed),
      )
      .sort((a, b) => b.finishedAt - a.finishedAt);
  }

  async listQuestionResults(attemptId: string): Promise<QuestionResultRow[]> {
    await this.open();
    const rows = await this.readAll(STORES.questionResults, isQuestionResultRow);
    return rows
      .filter((row) => row.attemptId === attemptId)
      .sort((a, b) => a.answeredAt - b.answeredAt || a.id.localeCompare(b.id));
  }

  async listPracticeResults(cert: CertCode): Promise<QuestionResultRow[]> {
    await this.open();
    const rows = await this.readAll(STORES.questionResults, isQuestionResultRow);
    return rows
      .filter((row) => row.attemptId === null && row.cert === cert)
      .sort((a, b) => a.answeredAt - b.answeredAt || a.id.localeCompare(b.id));
  }

  async listAllQuestionResults(): Promise<QuestionResultRow[]> {
    await this.open();
    const rows = await this.readAll(STORES.questionResults, isQuestionResultRow);
    return rows.sort((a, b) => a.id.localeCompare(b.id));
  }

  async getCertProgress(cert: CertCode): Promise<CertProgressRow[]> {
    await this.open();
    const rows = await this.readAll(STORES.certProgress, isCertProgressRow);
    return rows
      .filter((row) => row.cert === cert)
      .sort((a, b) => a.domainId - b.domainId);
  }

  async getQuestionMastery(cert: CertCode): Promise<QuestionMasteryRow[]> {
    await this.open();
    const rows = await this.readAll(STORES.questionMastery, isQuestionMasteryRow);
    return rows
      .filter((row) => row.cert === cert)
      .sort((a, b) => a.questionId.localeCompare(b.questionId));
  }

  async listAllCertProgress(): Promise<CertProgressRow[]> {
    await this.open();
    const rows = await this.readAll(STORES.certProgress, isCertProgressRow);
    return rows.sort((a, b) => a.id.localeCompare(b.id));
  }

  async listAllQuestionMastery(): Promise<QuestionMasteryRow[]> {
    await this.open();
    const rows = await this.readAll(STORES.questionMastery, isQuestionMasteryRow);
    return rows.sort((a, b) => a.id.localeCompare(b.id));
  }

  async getSession(cert: CertCode, kind: SessionKind): Promise<SessionRow | null> {
    await this.open();
    const value = await this.readOne(STORES.sessions, sessionId(cert, kind));
    return isSessionRow(value) ? value : null;
  }

  async listSessions(): Promise<SessionRow[]> {
    await this.open();
    const rows = await this.readAll(STORES.sessions, isSessionRow);
    return rows.sort((a, b) => a.id.localeCompare(b.id));
  }

  async putSession(session: SessionRow): Promise<void> {
    await this.open();
    await this.write(STORES.sessions, [session]);
  }

  async deleteSession(cert: CertCode, kind: SessionKind): Promise<void> {
    await this.open();
    const database = this.requireDatabase();
    const transaction = database.transaction(STORES.sessions, 'readwrite');
    const done = transactionDone(transaction);
    transaction.objectStore(STORES.sessions).delete(sessionId(cert, kind));
    try {
      await done;
    } catch (cause) {
      throw new StorageWriteError('Could not clear the saved session', cause);
    }
  }

  async replaceAll(rows: StudyRows): Promise<void> {
    if (
      !rows.attempts.every(isAttemptRow) ||
      !rows.questionResults.every(isQuestionResultRow) ||
      !rows.certProgress.every(isCertProgressRow) ||
      !rows.questionMastery.every(isQuestionMasteryRow) ||
      !rows.sessions.every(isSessionRow)
    ) {
      throw new StorageWriteError(
        'Could not restore the backup. The study data is unchanged.',
      );
    }

    await this.open();
    const database = this.requireDatabase();
    const transaction = database.transaction(STUDY_STORES, 'readwrite');
    const done = transactionDone(transaction);

    try {
      for (const store of STUDY_STORES) {
        transaction.objectStore(store).clear();
      }
      const attempts = transaction.objectStore(STORES.attempts);
      for (const row of rows.attempts) {
        attempts.put(row);
      }
      const results = transaction.objectStore(STORES.questionResults);
      for (const row of rows.questionResults) {
        results.put(row);
      }
      const progress = transaction.objectStore(STORES.certProgress);
      for (const row of rows.certProgress) {
        progress.put(row);
      }
      const mastery = transaction.objectStore(STORES.questionMastery);
      for (const row of rows.questionMastery) {
        mastery.put(row);
      }
      const sessions = transaction.objectStore(STORES.sessions);
      for (const row of rows.sessions) {
        sessions.put(row);
      }

      this.hooks?.beforeCommit?.();
    } catch (cause) {
      try {
        transaction.abort();
      } catch {
        // Already aborting.
      }
      await done.catch(() => undefined);
      throw new StorageWriteError(
        'Could not restore the backup. The study data is unchanged.',
        cause,
      );
    }

    try {
      await done;
    } catch (cause) {
      throw new StorageWriteError(
        'Could not restore the backup. The study data is unchanged.',
        cause,
      );
    }
  }

  async resetCert(cert: CertCode): Promise<void> {
    await this.open();
    const database = this.requireDatabase();
    const transaction = database.transaction(STUDY_STORES, 'readwrite');
    const done = transactionDone(transaction);
    try {
      for (const store of STUDY_STORES) {
        const objectStore = transaction.objectStore(store);
        const cursorRequest = objectStore.openCursor();
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor) {
            return;
          }
          const value = cursor.value as { cert?: unknown };
          if (value?.cert === cert) {
            cursor.delete();
          }
          cursor.continue();
        };
      }
      await done;
    } catch (cause) {
      throw new StorageWriteError('Could not reset the selected certification', cause);
    }
  }

  async resetAll(): Promise<void> {
    await this.open();
    const database = this.requireDatabase();
    const transaction = database.transaction(STUDY_STORES, 'readwrite');
    const done = transactionDone(transaction);
    try {
      for (const store of STUDY_STORES) {
        transaction.objectStore(store).clear();
      }
      await done;
    } catch (cause) {
      throw new StorageWriteError('Could not delete the local study data', cause);
    }
  }

  /**
   * Test seam. Writes a record with no validation so read-side quarantine can
   * be proven. Not part of `StudyRepository` and never called by feature code.
   */
  async writeRawForTest(store: StoreName, value: unknown): Promise<void> {
    await this.open();
    const database = this.requireDatabase();
    const transaction = database.transaction(store, 'readwrite');
    const done = transactionDone(transaction);
    transaction.objectStore(store).put(value as never);
    await done;
  }

  private requireDatabase(): IDBDatabase {
    if (!this.database) {
      throw new StorageOpenError('The repository is not open');
    }
    return this.database;
  }

  private async recordSchemaVersion(): Promise<void> {
    const database = this.database;
    if (!database) {
      return;
    }
    try {
      const transaction = database.transaction(STORES.meta, 'readwrite');
      const done = transactionDone(transaction);
      const row: MetaRow = { key: 'schemaVersion', value: this.schemaVersion };
      transaction.objectStore(STORES.meta).put(row);
      await done;
    } catch {
      // Recording the version is diagnostic only. A failure here must not
      // block opening the store.
    }
  }

  private async readOne(store: StoreName, key: IDBValidKey): Promise<unknown> {
    try {
      const database = this.requireDatabase();
      const transaction = database.transaction(store, 'readonly');
      const request = transaction.objectStore(store).get(key);
      const value = await requestResult(request);
      await transactionDone(transaction);
      return value;
    } catch (cause) {
      if (cause instanceof StorageOpenError) {
        throw cause;
      }
      throw new StorageReadError('Could not read from the local store', cause);
    }
  }

  private async readAll<T>(
    store: StoreName,
    isValid: (value: unknown) => value is T,
  ): Promise<T[]> {
    try {
      const database = this.requireDatabase();
      const transaction = database.transaction(store, 'readonly');
      const request = transaction.objectStore(store).getAll();
      const values = await requestResult(request);
      await transactionDone(transaction);
      // Quarantine invalid rows rather than letting one bad record break a
      // screen (DATA-23, ACC-40).
      return values.filter(isValid);
    } catch (cause) {
      if (cause instanceof StorageOpenError) {
        throw cause;
      }
      throw new StorageReadError('Could not read from the local store', cause);
    }
  }

  private async write(store: StoreName, rows: readonly unknown[]): Promise<void> {
    const database = this.requireDatabase();
    const transaction = database.transaction(store, 'readwrite');
    const done = transactionDone(transaction);
    try {
      const objectStore = transaction.objectStore(store);
      for (const row of rows) {
        objectStore.put(row as never);
      }
      await done;
    } catch (cause) {
      throw new StorageWriteError('Could not write to the local store', cause);
    }
  }
}
