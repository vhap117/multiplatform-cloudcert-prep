/**
 * Engine constants, carried over from the web app's `reference/constants.ts`
 * and the requirements that fix each value.
 */

/**
 * A run shorter than this is a display hint only.
 *
 * The web app used it as a persistence floor and silently dropped very short
 * attempts. EXAM-33 removed that floor for the Ionic app: a completed local
 * attempt is always saved, so `isTooShort` must never be a discard reason.
 */
export const MIN_VALID_EXAM_SECONDS = 60;

/**
 * Maximum selections on a multi-answer question.
 *
 * Every multi-answer question in the bundled corpus has exactly two correct
 * keys, so a second selection is always enough to be correct.
 */
export const MAX_MULTI_ANSWER = 2;

/** Practice session bounds and stepper step (SR-41). */
export const MIN_PRACTICE_QUESTIONS = 10;
export const MAX_PRACTICE_QUESTIONS = 50;
export const DEFAULT_PRACTICE_QUESTIONS = 20;
export const PRACTICE_QUESTION_STEP = 5;

/** Share of a practice session reserved for unseen questions (SR-19). */
export const UNSEEN_QUOTA = 0.2;

/**
 * Adaptive weight bands (SR-12 to SR-16). The bands are consumed by the
 * selector and derived by the layer that owns the history; a null weight means
 * the question is inside the exclusion window.
 */
export const UNSEEN_WEIGHT = 5;
export const LAST_WRONG_WEIGHT = 6;
export const LEARNING_WEIGHT_MIN = 2;
export const LEARNING_WEIGHT_MAX = 3;
export const MASTERED_WEIGHT = 1;
