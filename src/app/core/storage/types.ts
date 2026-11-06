/**
 * Entity shapes for the local study store.
 *
 * The store is relational in shape even though the current adapter is
 * IndexedDB: one object store per table, records mirroring table rows. The
 * future SQLite adapter transcribes this schema instead of remodelling it
 * (issue 002 task 2, DATA-9A, IONIC-19).
 *
 * A stable `id` is present on every row because IndexedDB needs an explicit
 * key path. The composed ids double as the natural key the relational schema
 * will use.
 */

export type CertCode = string;

/** Session and attempt kinds. Practice rows carry no parent attempt (DATA-18). */
export type SessionKind = 'mock' | 'study' | 'practice';

/** Per-domain result carried by a completed attempt (DATA-16). */
export interface DomainScoreRow {
  domainId: number;
  correct: number;
  total: number;
  percent: number;
}

/** A completed attempt: mock exam, study exam, or practice session (DATA-16). */
export interface AttemptRow {
  id: string;
  cert: CertCode;
  kind: SessionKind;
  startedAt: number;
  finishedAt: number;
  totalQuestions: number;
  correctCount: number;
  scorePercent: number;
  passed: boolean;
  timeTakenSeconds: number;
  domainScores: DomainScoreRow[];
}

/**
 * One answered question (DATA-17).
 *
 * `attemptId` is null for domain practice rows, which have no parent attempt
 * (DATA-18).
 */
export interface QuestionResultRow {
  id: string;
  attemptId: string | null;
  cert: CertCode;
  domainId: number;
  questionId: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  wasFlagged: boolean;
  answeredAt: number;
}

/** Per-domain aggregate (DATA-19). */
export interface CertProgressRow {
  /** `${cert}:${domainId}` */
  id: string;
  cert: CertCode;
  domainId: number;
  attempted: number;
  correct: number;
  masteryPercent: number;
  updatedAt: number;
}

/**
 * Per-question mastery state used by adaptive selection (DATA-20, SR-8).
 *
 * A null `weight` means the question is excluded from the active pool and is
 * eligible only for backfill (SR-9).
 */
export interface QuestionMasteryRow {
  /** `${cert}:${questionId}` */
  id: string;
  cert: CertCode;
  domainId: number;
  questionId: string;
  correctStreak: number;
  lastWasWrong: boolean;
  lastSeenAt: number;
  mastered: boolean;
  /**
   * Completed practice sessions of this domain since the question was last
   * answered (issue 007, S10). Optional on purpose: the merged mock and study
   * completion paths build mastery rows without it, and it reads as 0 when
   * absent (issue 007 log L3). The practice mastery writer always sets it.
   */
  sessionsSinceSeen?: number;
  weight: number | null;
}

/**
 * In-progress session state for resume (DATA-21).
 *
 * `feedbackShown` holds the question ids whose feedback has been displayed, so
 * a resumed study exam repaints the same state without re-grading (STUDY-38).
 */
export interface SessionRow {
  /** `${cert}:${kind}` */
  id: string;
  cert: CertCode;
  kind: SessionKind;
  questionOrder: string[];
  currentIndex: number;
  answers: Record<string, string>;
  feedbackShown: string[];
  /** Question ids flagged for review (EXAM-11). */
  flagged: string[];
  /**
   * Option key maps per question id, display key to original bank key.
   *
   * A resumed attempt rebuilds the exact display space from this, so answers
   * stored in display space keep pointing at the same option content. Deriving
   * the mapping from a seed instead would silently misgrade an attempt as soon
   * as the bank or the shuffle changed.
   */
  optionKeyMaps: Record<string, Record<string, string>>;
  startedAt: number;
  /** Absolute deadline for a timed mock exam. Null for untimed sessions. */
  deadlineAt: number | null;
  answeredCount: number;
  correctCount: number;
  wrongCount: number;
  updatedAt: number;
}

/** Filter accepted by attempt queries. Every field is optional and ANDed. */
export interface AttemptFilter {
  cert?: CertCode;
  kind?: SessionKind;
  passed?: boolean;
}

/**
 * One atomic answer commit (DATA-10).
 *
 * Derived rows are computed by the caller from pure engine functions, so the
 * repository stays a dumb but atomic writer: either every row in this input
 * lands, or none do.
 */
export interface CommitAnswersInput {
  attempt: AttemptRow | null;
  results: QuestionResultRow[];
  progress: CertProgressRow[];
  mastery: QuestionMasteryRow[];
  /** Session to clear once its attempt is committed (DATA-39). */
  clearSession?: { cert: CertCode; kind: SessionKind } | null;
}

/**
 * Every study row, used by backup restore and reset flows (DATA-24, DATA-28).
 *
 * The shape is deliberately flat and row-oriented: the backup module owns the
 * file format, the repository only stores and returns rows (IONIC-20).
 */
export interface StudyRows {
  attempts: AttemptRow[];
  questionResults: QuestionResultRow[];
  certProgress: CertProgressRow[];
  questionMastery: QuestionMasteryRow[];
  sessions: SessionRow[];
}
