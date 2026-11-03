/**
 * Mock exam session errors.
 *
 * A typed error lets the exam screens react without parsing messages: a
 * session error is a usage or availability problem (unknown cert, short bank,
 * no active exam), while a commit error is a failed local save that keeps the
 * attempt intact and retryable (EXAM-35).
 */

/** The exam cannot start, resume, or mutate in the requested way. */
export class MockExamSessionError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'MockExamSessionError';
  }
}

/**
 * The scoring commit failed. The session row is untouched, the computed
 * result stays available for display, and the save may be retried (S6,
 * EXAM-35).
 */
export class MockExamCommitError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'MockExamCommitError';
  }
}
