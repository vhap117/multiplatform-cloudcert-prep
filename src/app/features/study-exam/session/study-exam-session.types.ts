/**
 * Public shapes of the study exam session service.
 *
 * The service works against the bundled registry and question bank by
 * default. The options below are test seams: they let a spec pin selection
 * randomness, a small synthetic bank, or a synthetic cert so composition and
 * feedback edges become deterministic. Production callers pass nothing.
 */

import type { Certification } from '../../../core/content/cert-registry';
import type { Question } from '../../../core/content/question-types';
import type { RandomSource } from '../../../core/exam';

/** Optional seams accepted by `StudyExamSessionService.start`. */
export interface StudyExamStartOptions {
  /** Selection randomness. Defaults to `Math.random`. */
  random?: RandomSource;
  /** Question bank override. Defaults to the bundled bank for the cert. */
  bank?: readonly Question[];
  /** Cert override. Defaults to the bundled registry entry. */
  cert?: Certification;
}

/**
 * Why one option appears in the feedback panel (STUDY-10 to STUDY-15).
 *
 * - `chosen-wrong`: the student selected it and it is not part of the correct
 *   response (for ordering and matching, placed or paired incorrectly);
 * - `missed-correct`: it is part of the correct response and the student did
 *   not select it (for ordering and matching, the content that belonged in a
 *   position or pairing the student got wrong);
 * - `correct-chosen`: the student selected it and it is correct; this is how
 *   a partial multi covers both sets at once.
 */
export type FeedbackEntryKind = 'chosen-wrong' | 'missed-correct' | 'correct-chosen';

/** One per-option explanation, tagged so the UI can group by kind (S4). */
export interface FeedbackEntry {
  /** Option key in display space, matching the option labels on screen. */
  readonly key: string;
  /** The `explanation.options[key]` text for this option. */
  readonly text: string;
  readonly kind: FeedbackEntryKind;
}

/**
 * The read-only feedback for one graded question (S4, S5).
 *
 * `summary` is the question's `explanation.summary`, shown for every graded
 * question. `options` holds only the explanations that matter, grouped by
 * kind: for a fully correct answer every entry is `correct-chosen`; for an
 * incorrect one the `chosen-wrong` and `missed-correct` sets identify every
 * wrongly selected option and every correct option, and a partial selection
 * also carries `correct-chosen` entries.
 */
export interface QuestionFeedback {
  readonly questionId: string;
  readonly isCorrect: boolean;
  readonly summary: string;
  readonly options: readonly FeedbackEntry[];
}

/**
 * Per-domain counts behind the progress bars (S7, log L5).
 *
 * Derived from the recorded answers on every read, never stored separately,
 * so a resumed session can never disagree with the persisted session row.
 * Counts only: a domain with `answered` zero is reported as zero counts, and
 * no percentage is ever fabricated for it.
 */
export interface DomainTally {
  readonly domainId: number;
  readonly answered: number;
  readonly correct: number;
  readonly wrong: number;
}
