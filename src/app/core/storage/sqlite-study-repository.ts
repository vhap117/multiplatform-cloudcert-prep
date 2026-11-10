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
  DEFAULT_SQLITE_MIGRATIONS,
  SCHEMA_VERSION,
  STORES,
  STUDY_STORES,
  sessionId,
  type StoreName,
} from './schema';
import type { SqliteDriver, SqliteRow } from './sqlite-driver';
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

export interface SqliteOptions {
  version?: number;
  migrations?: Readonly<Record<number, readonly string[]>>;
  /** Test seam: called inside the write transaction, before it commits. */
  hooks?: {
    beforeCommit?: () => void;
  };
}

interface TableSpec {
  columns: readonly string[];
  json: readonly string[];
  boolean: readonly string[];
  nullAsUndefined: readonly string[];
}

const TABLE_SPECS: Record<StoreName, TableSpec> = {
  attempts: {
    columns: [
      'id',
      'cert',
      'kind',
      'startedAt',
      'finishedAt',
      'totalQuestions',
      'correctCount',
      'scorePercent',
      'passed',
      'timeTakenSeconds',
      'domainScores',
    ],
    json: ['domainScores'],
    boolean: ['passed'],
    nullAsUndefined: [],
  },
  question_results: {
    columns: [
      'id',
      'attemptId',
      'cert',
      'domainId',
      'questionId',
      'userAnswer',
      'correctAnswer',
      'isCorrect',
      'wasFlagged',
      'answeredAt',
    ],
    json: [],
    boolean: ['isCorrect', 'wasFlagged'],
    nullAsUndefined: [],
  },
  cert_progress: {
    columns: [
      'id',
      'cert',
      'domainId',
      'attempted',
      'correct',
      'masteryPercent',
      'updatedAt',
    ],
    json: [],
    boolean: [],
    nullAsUndefined: [],
  },
  question_mastery: {
    columns: [
      'id',
      'cert',
      'domainId',
      'questionId',
      'correctStreak',
      'lastWasWrong',
      'lastSeenAt',
      'mastered',
      'sessionsSinceSeen',
      'weight',
    ],
    json: [],
    boolean: ['lastWasWrong', 'mastered'],
    nullAsUndefined: ['sessionsSinceSeen'],
  },
  sessions: {
    columns: [
      'id',
      'cert',
      'kind',
      'questionOrder',
      'currentIndex',
      'answers',
      'feedbackShown',
      'flagged',
      'optionKeyMaps',
      'startedAt',
      'deadlineAt',
      'answeredCount',
      'correctCount',
      'wrongCount',
      'updatedAt',
    ],
    json: ['questionOrder', 'answers', 'feedbackShown', 'flagged', 'optionKeyMaps'],
    boolean: [],
    nullAsUndefined: [],
  },
  meta: {
    columns: ['key', 'value'],
    json: [],
    boolean: [],
    nullAsUndefined: [],
  },
};

function toSqlValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return value;
}

function fromDbRow(table: StoreName, values: SqliteRow): Record<string, unknown> | null {
  const spec = TABLE_SPECS[table];
  const row: Record<string, unknown> = {};
  for (const column of spec.columns) {
    let value = values[column];
    if (value === null) {
      if (spec.nullAsUndefined.includes(column)) {
        value = undefined;
      }
    } else if (spec.boolean.includes(column)) {
      value = value === 1 || value === '1';
    } else if (spec.json.includes(column)) {
      try {
        value = JSON.parse(value as string);
      } catch {
        return null;
      }
    }
    row[column] = value;
  }
  return row;
}

/**
 * SQLite implementation of the study repository (DATA-7, IONIC-19).
 *
 * The platform is injected as a `SqliteDriver`: the native phase passes the
 * Capacitor driver, tests pass a sql.js driver, and this class stays the same.
 */
export class SqliteStudyRepository implements StudyRepository {
  readonly schemaVersion: number;

  private readonly driver: SqliteDriver;
  private readonly migrations: Readonly<Record<number, readonly string[]>>;
  private readonly hooks: SqliteOptions['hooks'];
  private opened = false;

  constructor(driver: SqliteDriver, options: SqliteOptions = {}) {
    this.driver = driver;
    this.schemaVersion = options.version ?? SCHEMA_VERSION;
    this.migrations = options.migrations ?? DEFAULT_SQLITE_MIGRATIONS;
    this.hooks = options.hooks;
  }

  async open(): Promise<void> {
    if (this.opened) {
      return;
    }
    try {
      await this.driver.open();
    } catch (cause) {
      throw new StorageOpenError('Could not open the local database', cause);
    }
    await this.migrate();
    this.opened = true;
  }

  async close(): Promise<void> {
    this.opened = false;
    await this.driver.close();
  }

  async diagnose(): Promise<StorageDiagnostics> {
    await this.open();
    const versionRows = await this.driver.query('PRAGMA user_version');
    const tableRows = await this.driver.query(
      "SELECT name FROM sqlite_master WHERE type = 'table'",
    );
    const present = new Set<string>();
    for (const row of tableRows) {
      const name = row['name'];
      if (typeof name === 'string') {
        present.add(name);
      }
    }
    return buildStorageDiagnostics(
      'sqlite',
      this.schemaVersion,
      Number(versionRows[0]?.['user_version'] ?? 0),
      present,
    );
  }

  async commitAnswers(input: CommitAnswersInput): Promise<void> {
    await this.open();
    await this.transact(
      'Could not save the answer batch. The study data is unchanged.',
      async () => {
        if (input.attempt) {
          await this.put(STORES.attempts, input.attempt);
        }
        for (const row of input.results) {
          await this.put(STORES.questionResults, row);
        }
        for (const row of input.progress) {
          await this.put(STORES.certProgress, row);
        }
        for (const row of input.mastery) {
          await this.put(STORES.questionMastery, row);
        }
        if (input.clearSession) {
          // Direct statement: a nested transaction would abort on SQLite.
          await this.driver.run(`DELETE FROM ${STORES.sessions} WHERE id = ?`, [
            sessionId(input.clearSession.cert, input.clearSession.kind),
          ]);
        }
      },
      true,
    );
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
    await this.transact('Could not save the session', async () => {
      await this.put(STORES.sessions, session);
    });
  }

  async deleteSession(cert: CertCode, kind: SessionKind): Promise<void> {
    await this.open();
    await this.transact('Could not clear the saved session', async () => {
      await this.driver.run(`DELETE FROM ${STORES.sessions} WHERE id = ?`, [
        sessionId(cert, kind),
      ]);
    });
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
    await this.transact(
      'Could not restore the backup. The study data is unchanged.',
      async () => {
        for (const store of STUDY_STORES) {
          await this.driver.run(`DELETE FROM ${store}`);
        }
        for (const row of rows.attempts) {
          await this.put(STORES.attempts, row);
        }
        for (const row of rows.questionResults) {
          await this.put(STORES.questionResults, row);
        }
        for (const row of rows.certProgress) {
          await this.put(STORES.certProgress, row);
        }
        for (const row of rows.questionMastery) {
          await this.put(STORES.questionMastery, row);
        }
        for (const row of rows.sessions) {
          await this.put(STORES.sessions, row);
        }
      },
      true,
    );
  }

  async resetCert(cert: CertCode): Promise<void> {
    await this.open();
    await this.transact('Could not reset the selected certification', async () => {
      for (const store of STUDY_STORES) {
        await this.driver.run(`DELETE FROM ${store} WHERE cert = ?`, [cert]);
      }
    });
  }

  async resetAll(): Promise<void> {
    await this.open();
    await this.transact('Could not delete the local study data', async () => {
      for (const store of STUDY_STORES) {
        await this.driver.run(`DELETE FROM ${store}`);
      }
    });
  }

  /**
   * Test seam. Writes a row with no validation so read-side quarantine can be
   * proven. Not part of `StudyRepository` and never called by feature code.
   */
  async writeRawForTest(table: StoreName, value: unknown): Promise<void> {
    await this.open();
    const row = value as Record<string, unknown>;
    const columns = Object.keys(row);
    const placeholders = columns.map(() => '?').join(', ');
    await this.driver.run(
      `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
      columns.map((column) => toSqlValue(row[column])),
    );
  }

  private async migrate(): Promise<void> {
    const versionRows = await this.driver.query('PRAGMA user_version');
    const storedVersion = Number(versionRows[0]?.['user_version'] ?? 0);
    const schemaRows = await this.driver.query(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'meta'",
    );
    // The native plugin may record a version while creating the file, before
    // any of our tables exist. A missing schema always starts from zero.
    const fromVersion = schemaRows.length > 0 ? storedVersion : 0;

    if (fromVersion > this.schemaVersion) {
      throw new StorageMigrationError(
        'The local database was written by a newer app version',
        fromVersion,
        this.schemaVersion,
      );
    }
    if (fromVersion === this.schemaVersion) {
      return;
    }

    try {
      await this.driver.begin();
      for (let version = fromVersion + 1; version <= this.schemaVersion; version += 1) {
        const statements = this.migrations[version];
        if (!statements) {
          throw new StorageMigrationError(
            `No migration registered for schema version ${version}`,
            fromVersion,
            this.schemaVersion,
          );
        }
        for (const statement of statements) {
          await this.driver.execute(statement);
        }
        await this.driver.execute(`PRAGMA user_version = ${version}`);
      }
      await this.driver.commit();
    } catch (cause) {
      await this.driver.rollback().catch(() => undefined);
      if (cause instanceof StorageMigrationError) {
        throw cause;
      }
      throw new StorageMigrationError(
        `Schema migration from version ${fromVersion} to ${this.schemaVersion} failed`,
        fromVersion,
        this.schemaVersion,
        cause,
      );
    }
  }

  private async transact(
    message: string,
    work: () => Promise<void>,
    runCommitHook = false,
  ): Promise<void> {
    try {
      await this.driver.begin();
    } catch (cause) {
      throw new StorageWriteError(message, cause);
    }
    try {
      await work();
      if (runCommitHook) {
        this.hooks?.beforeCommit?.();
      }
      await this.driver.commit();
    } catch (cause) {
      await this.driver.rollback().catch(() => undefined);
      throw new StorageWriteError(message, cause);
    }
  }

  private async put(table: StoreName, row: object): Promise<void> {
    const spec = TABLE_SPECS[table];
    const values = spec.columns.map((column) =>
      toSqlValue((row as Record<string, unknown>)[column]),
    );
    const placeholders = spec.columns.map(() => '?').join(', ');
    await this.driver.run(
      `INSERT OR REPLACE INTO ${table} (${spec.columns.join(', ')}) VALUES (${placeholders})`,
      values,
    );
  }

  private async readOne(table: StoreName, id: string): Promise<unknown> {
    try {
      this.requireOpen();
      const rows = await this.driver.query(`SELECT * FROM ${table} WHERE id = ?`, [id]);
      return rows.length > 0 ? fromDbRow(table, rows[0]) : null;
    } catch (cause) {
      if (cause instanceof StorageOpenError) {
        throw cause;
      }
      throw new StorageReadError('Could not read from the local store', cause);
    }
  }

  private async readAll<T>(
    table: StoreName,
    isValid: (value: unknown) => value is T,
  ): Promise<T[]> {
    try {
      this.requireOpen();
      const rows = await this.driver.query(`SELECT * FROM ${table}`);
      // Quarantine invalid rows rather than letting one bad record break a
      // screen (DATA-23, ACC-40).
      const values: T[] = [];
      for (const row of rows) {
        const value = fromDbRow(table, row);
        if (value !== null && isValid(value)) {
          values.push(value);
        }
      }
      return values;
    } catch (cause) {
      if (cause instanceof StorageOpenError) {
        throw cause;
      }
      throw new StorageReadError('Could not read from the local store', cause);
    }
  }

  private requireOpen(): void {
    if (!this.opened) {
      throw new StorageOpenError('The repository is not open');
    }
  }
}
