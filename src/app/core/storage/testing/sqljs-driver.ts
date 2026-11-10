import initSqlJs, { type Database, type SqlJsStatic, type SqlValue } from 'sql.js';

import type { SqliteDriver, SqliteRow } from '../sqlite-driver';

/**
 * sql.js-backed driver for the SQLite contract test leg.
 *
 * sql.js is the same SQLite engine jeep-sqlite uses on the web, so SQL and
 * transaction behavior are real. Only the plugin bridge is simulated. Exported
 * databases are kept per name so reopen tests behave like a device file.
 */
let sqlPromise: Promise<SqlJsStatic> | null = null;
const snapshots = new Map<string, Uint8Array>();

function loadSql(): Promise<SqlJsStatic> {
  sqlPromise ??= initSqlJs();
  return sqlPromise;
}

export class SqlJsDriver implements SqliteDriver {
  private database: Database | null = null;

  constructor(private readonly databaseName: string) {}

  async open(): Promise<void> {
    if (this.database) {
      return;
    }
    const SQL = await loadSql();
    const snapshot = snapshots.get(this.databaseName);
    this.database = snapshot ? new SQL.Database(snapshot) : new SQL.Database();
  }

  async close(): Promise<void> {
    if (!this.database) {
      return;
    }
    snapshots.set(this.databaseName, this.database.export());
    this.database.close();
    this.database = null;
  }

  async begin(): Promise<void> {
    this.requireDatabase().exec('BEGIN');
  }

  async commit(): Promise<void> {
    this.requireDatabase().exec('COMMIT');
  }

  async rollback(): Promise<void> {
    this.requireDatabase().exec('ROLLBACK');
  }

  async execute(statement: string): Promise<void> {
    this.requireDatabase().exec(statement);
  }

  async run(statement: string, values: readonly unknown[] = []): Promise<void> {
    this.requireDatabase().run(statement, values as SqlValue[]);
  }

  async query(statement: string, values: readonly unknown[] = []): Promise<SqliteRow[]> {
    const [result] = this.requireDatabase().exec(statement, values as SqlValue[]);
    if (!result) {
      return [];
    }
    // sql.js returns positional values; the driver contract returns rows keyed
    // by column name, matching the Capacitor plugin.
    return result.values.map((row) =>
      Object.fromEntries(result.columns.map((column, index) => [column, row[index]])),
    );
  }

  private requireDatabase(): Database {
    if (!this.database) {
      throw new Error('SQLite test driver is not open');
    }
    return this.database;
  }
}
