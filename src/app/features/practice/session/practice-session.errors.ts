/**
 * Practice session errors (issue 007, S12).
 *
 * A typed error lets the practice screens react without parsing messages: a
 * session error is a usage or availability problem (unknown cert or domain,
 * an out-of-bounds session size, no active session, a question that is not
 * ready to grade, completing with nothing answered), while the two retryable
 * errors below map to the two failure modes the spec separates:
 *
 * - `PracticeSaveError`: a failed local write (PRACT-24). Nothing was
 *   recorded and the session never advances as if saved, so the UI can show
 *   the failure and let the student retry.
 * - `PracticeLoadError`: a failed bank, history, or session read (PRACT-25).
 *   No state changed, so the UI can show the failure and re-enable Start.
 */

/** The session cannot start, resume, or mutate in the requested way. */
export class PracticeSessionError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'PracticeSessionError';
  }
}

/** A local write failed. The recorded state is unchanged and the call may be retried. */
export class PracticeSaveError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'PracticeSaveError';
  }
}

/** A local read failed. The UI must not fabricate data; it may retry the load. */
export class PracticeLoadError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'PracticeLoadError';
  }
}
