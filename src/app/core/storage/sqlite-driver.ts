/**
 * Minimal driver seam between the SQLite repository and the platform.
 *
 * The production implementation wraps `@capacitor-community/sqlite`; tests run
 * the repository against a sql.js-backed driver, so the contract suite proves
 * the real adapter code without a native runtime (CONT-43). Keep this surface
 * to what the repository actually calls.
 */
export type SqliteRow = Readonly<Record<string, unknown>>;

export interface SqliteDriver {
  open(): Promise<void>;
  close(): Promise<void>;
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  /** Execute a statement with no result and no bound values, such as DDL. */
  execute(statement: string): Promise<void>;
  /** Execute bound INSERT, UPDATE, or DELETE statements. */
  run(statement: string, values?: readonly unknown[]): Promise<void>;
  /** Read rows keyed by column name. */
  query(statement: string, values?: readonly unknown[]): Promise<SqliteRow[]>;
}
