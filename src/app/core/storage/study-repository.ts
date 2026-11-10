import type { StorageDiagnostics } from './diagnostics';
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

/**
 * The single storage contract every feature depends on (IONIC-20).
 *
 * Feature code imports this interface and nothing else from the storage layer.
 * It never touches IndexedDB or Capacitor SQLite directly, so adding the native
 * adapter later is one new class behind this contract.
 *
 * All methods are async and reject with a typed error from `./errors`.
 */
export interface StudyRepository {
  /** Schema version this repository expects. */
  readonly schemaVersion: number;

  open(): Promise<void>;
  close(): Promise<void>;

  /**
   * Inspect the local schema without changing study data.
   *
   * Opens and migrates the database first, then reports the stored schema
   * version and whether every required table is present.
   */
  diagnose(): Promise<StorageDiagnostics>;

  /**
   * Commit one answer batch atomically (DATA-10).
   *
   * Either the attempt, its question results, the derived progress and mastery
   * rows, and the session clear all land, or none of them do.
   */
  commitAnswers(input: CommitAnswersInput): Promise<void>;

  getAttempt(id: string): Promise<AttemptRow | null>;
  listAttempts(filter?: AttemptFilter): Promise<AttemptRow[]>;
  listQuestionResults(attemptId: string): Promise<QuestionResultRow[]>;
  /** Domain practice results, which have no parent attempt (DATA-18). */
  listPracticeResults(cert: CertCode): Promise<QuestionResultRow[]>;
  /** Every question result across certs, for backup export (DATA-24). */
  listAllQuestionResults(): Promise<QuestionResultRow[]>;

  getCertProgress(cert: CertCode): Promise<CertProgressRow[]>;
  getQuestionMastery(cert: CertCode): Promise<QuestionMasteryRow[]>;
  /** Every domain aggregate across certs, for backup export (DATA-24). */
  listAllCertProgress(): Promise<CertProgressRow[]>;
  /** Every mastery row across certs, for backup export (DATA-24). */
  listAllQuestionMastery(): Promise<QuestionMasteryRow[]>;

  getSession(cert: CertCode, kind: SessionKind): Promise<SessionRow | null>;
  listSessions(): Promise<SessionRow[]>;
  putSession(session: SessionRow): Promise<void>;
  deleteSession(cert: CertCode, kind: SessionKind): Promise<void>;

  /**
   * Replace every study row atomically (DATA-28, DATA-29).
   *
   * Rows are validated before anything is touched, and the clear plus all puts
   * commit in one transaction, so a rejected or failed restore leaves the
   * existing database unchanged.
   */
  replaceAll(rows: StudyRows): Promise<void>;

  /** Delete every study row for one cert, leaving other certs untouched. */
  resetCert(cert: CertCode): Promise<void>;
  /** Delete every study row. The bundled question bank is not stored here. */
  resetAll(): Promise<void>;
}
