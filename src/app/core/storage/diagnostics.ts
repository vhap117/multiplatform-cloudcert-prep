import { ALL_STORES } from './schema';

export type StorageBackend = 'indexeddb' | 'sqlite';

export interface StorageTableStatus {
  readonly name: string;
  readonly present: boolean;
}

export interface StorageMigrationStatus {
  readonly version: number;
  readonly applied: boolean;
}

/** Read-only health report for the active local database. */
export interface StorageDiagnostics {
  readonly backend: StorageBackend;
  readonly expectedSchemaVersion: number;
  readonly actualSchemaVersion: number;
  readonly tables: readonly StorageTableStatus[];
  readonly migrations: readonly StorageMigrationStatus[];
}

export function buildStorageDiagnostics(
  backend: StorageBackend,
  expectedSchemaVersion: number,
  actualSchemaVersion: number,
  presentTables: ReadonlySet<string>,
): StorageDiagnostics {
  return {
    backend,
    expectedSchemaVersion,
    actualSchemaVersion,
    tables: ALL_STORES.map((name) => ({
      name,
      present: presentTables.has(name),
    })),
    migrations: Array.from({ length: expectedSchemaVersion }, (_, index) => {
      const version = index + 1;
      return { version, applied: actualSchemaVersion >= version };
    }),
  };
}
