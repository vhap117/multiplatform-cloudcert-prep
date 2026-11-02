/**
 * Schema definition and migrations.
 *
 * The shape is relational: one object store per table, records mirroring table
 * rows. `id` is the primary key everywhere, and the composed ids are the same
 * natural keys the SQLite schema will use, so the future DDL is a transcription
 * rather than a redesign (DATA-9A, IONIC-19).
 *
 * Migrations are forward only and keyed by the version they produce. A failure
 * leaves the previous version intact (DATA-11, DATA-12).
 */

export const SCHEMA_VERSION = 1;

export const STORES = {
  attempts: 'attempts',
  questionResults: 'question_results',
  certProgress: 'cert_progress',
  questionMastery: 'question_mastery',
  sessions: 'sessions',
  meta: 'meta',
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

export const ALL_STORES: readonly StoreName[] = [
  STORES.attempts,
  STORES.questionResults,
  STORES.certProgress,
  STORES.questionMastery,
  STORES.sessions,
  STORES.meta,
];

/** Study stores reset by `resetCert` and `resetAll`. Meta is not study data. */
export const STUDY_STORES: readonly StoreName[] = [
  STORES.attempts,
  STORES.questionResults,
  STORES.certProgress,
  STORES.questionMastery,
  STORES.sessions,
];

export type Migration = (database: IDBDatabase, transaction: IDBTransaction) => void;
export type MigrationMap = Readonly<Record<number, Migration>>;

/**
 * Version 1: create every store and the indexes the read paths use.
 */
export const MIGRATION_V1: Migration = (database) => {
  database.createObjectStore(STORES.attempts, { keyPath: 'id' });

  const results = database.createObjectStore(STORES.questionResults, { keyPath: 'id' });
  results.createIndex('by_attempt', 'attemptId', { unique: false });
  results.createIndex('by_cert', 'cert', { unique: false });

  database.createObjectStore(STORES.certProgress, { keyPath: 'id' });
  database.createObjectStore(STORES.questionMastery, { keyPath: 'id' });
  database.createObjectStore(STORES.sessions, { keyPath: 'id' });
  database.createObjectStore(STORES.meta, { keyPath: 'key' });
};

export const DEFAULT_MIGRATIONS: MigrationMap = {
  1: MIGRATION_V1,
};
