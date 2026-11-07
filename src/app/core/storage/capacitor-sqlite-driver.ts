import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from '@capacitor-community/sqlite';

import { SCHEMA_VERSION } from './schema';
import type { SqliteDriver } from './sqlite-driver';

/**
 * Native SQLite driver backed by `@capacitor-community/sqlite`.
 *
 * The database file lives in the app's private data directory (DATA-9). Import
 * of the plugin is confined to this file so feature code never sees it
 * (IONIC-20). The adapter owns schema and migrations; this driver only maps the
 * connection API.
 *
 * shortcut: this driver is exercised only on a device, run the shared contract
 * suite there once the Android platform is added (issue 002).
 */
export class CapacitorSqliteDriver implements SqliteDriver {
  private connection: SQLiteConnection | null = null;
  private database: SQLiteDBConnection | null = null;

  constructor(private readonly databaseName = 'cloudcertprep') {}

  async open(): Promise<void> {
    if (this.database) {
      return;
    }
    const connection = (this.connection ??= new SQLiteConnection(CapacitorSQLite));
    const exists = (await connection.isConnection(this.databaseName, false)).result;
    this.database = exists
      ? await connection.retrieveConnection(this.databaseName, false)
      : await connection.createConnection(
          this.databaseName,
          false,
          'no-encryption',
          SCHEMA_VERSION,
          false,
        );
    await this.database.open();
  }

  async close(): Promise<void> {
    await this.database?.close();
    this.database = null;
    await this.connection?.closeConnection(this.databaseName, false);
    this.connection = null;
  }

  async begin(): Promise<void> {
    await this.requireDatabase().beginTransaction();
  }

  async commit(): Promise<void> {
    await this.requireDatabase().commitTransaction();
  }

  async rollback(): Promise<void> {
    await this.requireDatabase().rollbackTransaction();
  }

  async run(statement: string, values: readonly unknown[] = []): Promise<void> {
    // transaction=false: the repository controls the transaction boundary.
    await this.requireDatabase().run(statement, [...values], false);
  }

  async query(statement: string, values: readonly unknown[] = []): Promise<unknown[][]> {
    const result = await this.requireDatabase().query(statement, [...values]);
    return result.values ?? [];
  }

  private requireDatabase(): SQLiteDBConnection {
    if (!this.database) {
      throw new Error('The SQLite driver is not open');
    }
    return this.database;
  }
}
