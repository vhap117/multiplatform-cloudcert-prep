/**
 * Public shapes of the practice session service.
 *
 * The service works against the bundled registry and question bank by
 * default. The options below are test seams: they let a spec pin selection
 * randomness, a small synthetic bank, or a synthetic cert so selection,
 * grading, and feedback edges become deterministic. Production callers pass
 * nothing.
 */

import type { Certification } from '../../../core/content/cert-registry';
import type { Question } from '../../../core/content/question-types';
import type { RandomSource } from '../../../core/exam';
import type { AttemptRow, DomainScoreRow } from '../../../core/storage/types';

/** Optional seams accepted by `PracticeSessionService.start`. */
export interface PracticeStartOptions {
  /** Selection and shuffle randomness. Defaults to `Math.random`. */
  random?: RandomSource;
  /** Domain bank override. Defaults to the bundled bank for the domain. */
  bank?: readonly Question[];
  /** Cert override. Defaults to the bundled registry entry. */
  cert?: Certification;
}

/**
 * The outcome of an explicit confirm on a multi, ordering, or matching
 * response (issue 007, S8). An incomplete response reports `incomplete` so
 * the UI can warn instead of silently grading it wrong (PRACT-17); it is
 * never graded and nothing is committed for it.
 */
export type PracticeSubmitResult = 'graded' | 'incomplete';

/**
 * What `complete` returns (issue 007, S11): the stored attempt row of kind
 * `practice`, so history can list the session and distinguish it from exams,
 * plus the per-domain results of the session for the completion summary.
 */
export interface PracticeCompletion {
  readonly attempt: AttemptRow;
  readonly domainScores: readonly DomainScoreRow[];
}
