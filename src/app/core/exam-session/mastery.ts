/**
 * The mastery writer: the single place a mastery row's next state is derived
 * from its facts (issue 007, S10).
 *
 * Two decisions pin the model (issue 007 log L2, a user decision):
 *
 * - a question becomes mastered after MASTERED_STREAK consecutive correct
 *   answers;
 * - a mastered question then rests for EXCLUSION_WINDOW_SESSIONS completed
 *   practice sessions of its domain, carrying a null weight while it rests.
 *   A null weight hides it from the active pool and leaves it eligible only
 *   for backfill (SR-9, SR-16).
 *
 * The window is counted in sessions of the domain, never in days (SR-2,
 * SR-16, SR-17): nothing here reads a calendar, timestamps only move when the
 * question is actually answered, and the counter only advances when a
 * practice session of the domain completes without asking the question.
 *
 * Pure: no Angular, no storage adapter, no clock. Timestamps are inputs.
 */

import { masteryWeight } from '../exam';

/**
 * Consecutive correct answers before a question becomes mastered
 * (issue 007 log L2, SR-17). Changing this changes the docs and the tests
 * together (S10).
 */
export const MASTERED_STREAK = 2;

/**
 * Completed practice sessions of the domain a mastered question rests at a
 * null weight (issue 007 log L2, SR-16, SR-17). Changing this changes the
 * docs and the tests together (S10).
 */
export const EXCLUSION_WINDOW_SESSIONS = 3;

/**
 * The facts a mastery row's next state is derived from. Mirrors the stored
 * row without its identity fields; `sessionsSinceSeen` is always present
 * here because the writer owns it (a missing stored counter reads as 0,
 * issue 007 log L3).
 */
export interface MasteryRowState {
  readonly correctStreak: number;
  readonly lastWasWrong: boolean;
  readonly mastered: boolean;
  readonly sessionsSinceSeen: number;
  readonly weight: number | null;
  readonly lastSeenAt: number;
}

/** One graded answer to fold into the state. `answeredAt` is passed in, never read. */
export interface MasteryAnswer {
  readonly isCorrect: boolean;
  readonly answeredAt: number;
}

/**
 * The weight for one state: an engine band, except that a mastered question
 * inside the exclusion window rests at null (SR-16). The boundary is
 * inclusive on purpose: sessions 1 to EXCLUSION_WINDOW_SESSIONS after mastery
 * rest, and the question returns at the mastered band on the next session.
 */
function windowedWeight(state: Omit<MasteryRowState, 'weight'>): number | null {
  if (state.mastered && state.sessionsSinceSeen <= EXCLUSION_WINDOW_SESSIONS) {
    return null;
  }
  return masteryWeight(state);
}

/**
 * Fold one graded answer into the previous state (undefined for a question
 * with no history).
 *
 * A correct answer extends the streak, clears `lastWasWrong`, marks mastered
 * at MASTERED_STREAK, and restarts the exclusion window. A wrong answer
 * resets the streak, sets `lastWasWrong`, clears `mastered`, and lands on the
 * highest band. Both reset the session counter and record when the question
 * was seen.
 */
export function applyMasteryAnswer(
  previous: MasteryRowState | undefined,
  answer: MasteryAnswer,
): MasteryRowState {
  const correctStreak = answer.isCorrect ? (previous?.correctStreak ?? 0) + 1 : 0;
  const state = {
    correctStreak,
    lastWasWrong: !answer.isCorrect,
    mastered: answer.isCorrect && correctStreak >= MASTERED_STREAK,
    sessionsSinceSeen: 0,
    lastSeenAt: answer.answeredAt,
  };
  return { ...state, weight: windowedWeight(state) };
}

/**
 * Age a question by one completed practice session of its domain that the
 * question was not part of: the counter advances and the weight is
 * recomputed, so a mastered question leaves the exclusion window on the
 * session after the window ends. Nothing else moves; in particular
 * `lastSeenAt` stays, because the question was not seen.
 */
export function ageMasteryForSession(previous: MasteryRowState): MasteryRowState {
  const state = { ...previous, sessionsSinceSeen: previous.sessionsSinceSeen + 1 };
  return { ...state, weight: windowedWeight(state) };
}
