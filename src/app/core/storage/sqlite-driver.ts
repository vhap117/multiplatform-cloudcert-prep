/**
 * Minimal driver seam between the SQLite repository and the platform.
 *
 * The production implementation wraps `@capacitor-community/sqlite`; tests run
 * the repository against a sql.js-backed driver, so the contract suite proves
 * the real adapter code without a native runtime (CONT-43). Keep this surface
 * to what the repository actually calls.
 */
export interface SqliteDriver {
  open(): Promise<void>;
  close(): Promise<void>;
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  run(statement: string, values?: readonly unknown[]): Promise<void>;
  query(statement: string, values?: readonly unknown[]): Promise<unknown[][]>;
}
