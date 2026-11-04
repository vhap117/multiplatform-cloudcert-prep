/**
 * Public shapes of the mock exam session service.
 *
 * The service works against the bundled registry and question bank by
 * default. The options below are test seams: they let a spec pin selection
 * randomness, a small synthetic bank, or a synthetic cert so scoring edges
 * (such as a score exactly at the passing threshold) become
 * deterministic. Production callers pass nothing.
 */

import type { Certification } from '../../../core/content/cert-registry';
import type { Question } from '../../../core/content/question-types';
import type { RandomSource } from '../../../core/exam';
import type { AttemptRow } from '../../../core/storage/types';

/** Optional seams accepted by `MockExamSessionService.start`. */
export interface MockExamStartOptions {
  /** Selection randomness. Defaults to `Math.random`. */
  random?: RandomSource;
  /** Question bank override. Defaults to the bundled bank for the cert. */
  bank?: readonly Question[];
  /** Cert override. Defaults to the bundled registry entry. */
  cert?: Certification;
}

/**
 * The outcome of a submit or of a deadline expiry.
 *
 * `committed` is false when the local save failed: the results stay on
 * screen, the session row is intact, and the save can be retried (EXAM-35).
 */
export interface MockExamResult {
  /** The attempt row that was (or is about to be) committed. */
  attempt: AttemptRow;
  /**
   * Display hint for a sub-minute run. EXAM-33 removed the old 60-second
   * persistence floor, so this must never be used to discard an attempt.
   */
  isTooShort: boolean;
  /** True once the attempt, its rows, and the session clear have landed. */
  committed: boolean;
}
