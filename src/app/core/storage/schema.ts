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

/** Composed session key: one session per cert and kind (DATA-21). */
export function sessionId(cert: string, kind: string): string {
  return `${cert}:${kind}`;
}

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

/**
 * SQLite transcription of version 1 (IONIC-19).
 *
 * Same tables, keys, and read-path indexes as the IndexedDB stores above.
 * Row-level constraints are deliberately absent: IndexedDB enforces none, and
 * `validation.ts` is the single trust boundary for stored rows (DATA-23).
 */
export const SQLITE_MIGRATION_V1: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS attempts (
    id TEXT PRIMARY KEY,
    cert TEXT,
    kind TEXT,
    startedAt INTEGER,
    finishedAt INTEGER,
    totalQuestions INTEGER,
    correctCount INTEGER,
    scorePercent REAL,
    passed INTEGER,
    timeTakenSeconds INTEGER,
    domainScores TEXT
  )`,
  'CREATE INDEX IF NOT EXISTS attempts_by_cert ON attempts(cert)',
  `CREATE TABLE IF NOT EXISTS question_results (
    id TEXT PRIMARY KEY,
    attemptId TEXT,
    cert TEXT,
    domainId INTEGER,
    questionId TEXT,
    userAnswer TEXT,
    correctAnswer TEXT,
    isCorrect INTEGER,
    wasFlagged INTEGER,
    answeredAt INTEGER
  )`,
  'CREATE INDEX IF NOT EXISTS question_results_by_attempt ON question_results(attemptId)',
  'CREATE INDEX IF NOT EXISTS question_results_by_cert ON question_results(cert)',
  `CREATE TABLE IF NOT EXISTS cert_progress (
    id TEXT PRIMARY KEY,
    cert TEXT,
    domainId INTEGER,
    attempted INTEGER,
    correct INTEGER,
    masteryPercent REAL,
    updatedAt INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS question_mastery (
    id TEXT PRIMARY KEY,
    cert TEXT,
    domainId INTEGER,
    questionId TEXT,
    correctStreak INTEGER,
    lastWasWrong INTEGER,
    lastSeenAt INTEGER,
    mastered INTEGER,
    sessionsSinceSeen INTEGER,
    weight REAL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    cert TEXT,
    kind TEXT,
    questionOrder TEXT,
    currentIndex INTEGER,
    answers TEXT,
    feedbackShown TEXT,
    flagged TEXT,
    optionKeyMaps TEXT,
    startedAt INTEGER,
    deadlineAt INTEGER,
    answeredCount INTEGER,
    correctCount INTEGER,
    wrongCount INTEGER,
    updatedAt INTEGER
  )`,
  'CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value)',
];

export const DEFAULT_SQLITE_MIGRATIONS: Readonly<Record<number, readonly string[]>> = {
  1: SQLITE_MIGRATION_V1,
};
