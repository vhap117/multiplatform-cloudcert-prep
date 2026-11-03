/**
 * Study exam session errors.
 *
 * A typed error lets the exam screens react without parsing messages: a
 * session error is a usage or availability problem (unknown cert, short bank,
 * no active exam, a question that is not ready to grade), while a save error
 * is a failed local write that leaves the recorded state untouched and may be
 * retried (STUDY-32, STUDY-33).
 */

/** The exam cannot start, resume, or mutate in the requested way. */
export class StudyExamSessionError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'StudyExamSessionError';
  }
}

/**
 * A local write failed. Nothing was recorded: the in-memory and persisted
 * session stay exactly as they were, so the UI can show the failure and let
 * the student retry (STUDY-20, STUDY-21).
 */
export class StudyExamSaveError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'StudyExamSaveError';
  }
}
