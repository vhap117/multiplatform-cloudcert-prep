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

  getCertProgress(cert: CertCode): Promise<CertProgressRow[]>;
  getQuestionMastery(cert: CertCode): Promise<QuestionMasteryRow[]>;

  getSession(cert: CertCode, kind: SessionKind): Promise<SessionRow | null>;
  listSessions(): Promise<SessionRow[]>;
  putSession(session: SessionRow): Promise<void>;
  deleteSession(cert: CertCode, kind: SessionKind): Promise<void>;

  /** Delete every study row for one cert, leaving other certs untouched. */
  resetCert(cert: CertCode): Promise<void>;
  /** Delete every study row. The bundled question bank is not stored here. */
  resetAll(): Promise<void>;
}
