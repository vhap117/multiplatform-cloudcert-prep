/**
 * Behaviour tests for the mastery writer (issue 007, S10).
 *
 * The two constants are a user decision (issue 007 log L2): a question is
 * mastered after MASTERED_STREAK consecutive correct answers and then rests
 * for EXCLUSION_WINDOW_SESSIONS completed practice sessions of its domain at
 * a null weight. The window is counted in sessions of the domain, never in
 * days (SR-2, SR-16, SR-17), so every test drives the state through the
 * exported functions with explicit timestamps instead of a calendar.
 */

import { describe, expect, it } from 'vitest';

import {
  LAST_WRONG_WEIGHT,
  LEARNING_WEIGHT_MAX,
  LEARNING_WEIGHT_MIN,
  MASTERED_WEIGHT,
} from '../exam';

import {
  EXCLUSION_WINDOW_SESSIONS,
  MASTERED_STREAK,
  ageMasteryForSession,
  applyMasteryAnswer,
  foldMasteryHistory,
  type MasteryRowState,
} from './mastery';

const SEEN_AT = 96_000;

function state(overrides: Partial<MasteryRowState> = {}): MasteryRowState {
  return {
    correctStreak: 0,
    lastWasWrong: false,
    mastered: false,
    sessionsSinceSeen: 0,
    weight: LEARNING_WEIGHT_MIN,
    lastSeenAt: 500,
    ...overrides,
  };
}

describe('documented constants (SR-17)', () => {
  it('pins the decided values from issue 007 log L2', () => {
    expect(MASTERED_STREAK).toBe(2);
    expect(EXCLUSION_WINDOW_SESSIONS).toBe(3);
  });
});

describe('applyMasteryAnswer', () => {
  it('keeps a first correct answer in the learning band, not mastered yet', () => {
    const next = applyMasteryAnswer(undefined, { isCorrect: true, answeredAt: SEEN_AT });

    expect(next).toEqual({
      correctStreak: 1,
      lastWasWrong: false,
      mastered: false,
      sessionsSinceSeen: 0,
      weight: LEARNING_WEIGHT_MAX,
      lastSeenAt: SEEN_AT,
    });
  });

  it('marks a question mastered at exactly two consecutive correct answers', () => {
    const previous = state({ correctStreak: 1, weight: LEARNING_WEIGHT_MAX });

    const next = applyMasteryAnswer(previous, { isCorrect: true, answeredAt: SEEN_AT });

    expect(next).toEqual({
      correctStreak: 2,
      lastWasWrong: false,
      mastered: true,
      sessionsSinceSeen: 0,
      // The rest starts with the mastering answer: the weight is already null.
      weight: null,
      lastSeenAt: SEEN_AT,
    });
  });

  it('resets mastery on a wrong answer and lands on the highest band', () => {
    const previous = state({
      correctStreak: 3,
      mastered: true,
      sessionsSinceSeen: 1,
      weight: null,
    });

    const next = applyMasteryAnswer(previous, { isCorrect: false, answeredAt: SEEN_AT });

    expect(next).toEqual({
      correctStreak: 0,
      lastWasWrong: true,
      mastered: false,
      sessionsSinceSeen: 0,
      weight: LAST_WRONG_WEIGHT,
      lastSeenAt: SEEN_AT,
    });
  });

  it('restarts the exclusion window when a resting question is answered', () => {
    const previous = state({
      correctStreak: 2,
      mastered: true,
      sessionsSinceSeen: 2,
      weight: null,
      lastSeenAt: 500,
    });

    const next = applyMasteryAnswer(previous, { isCorrect: true, answeredAt: SEEN_AT });

    expect(next.correctStreak).toBe(3);
    expect(next.mastered).toBe(true);
    expect(next.sessionsSinceSeen).toBe(0);
    expect(next.weight).toBeNull();
    expect(next.lastSeenAt).toBe(SEEN_AT);
  });
});

describe('foldMasteryHistory (issue 007, S10)', () => {
  it('reports no state for an empty history', () => {
    expect(foldMasteryHistory([])).toBeNull();
  });

  it('folds one correct answer into the learning band', () => {
    const state = foldMasteryHistory([{ isCorrect: true, answeredAt: SEEN_AT }]);

    expect(state).toEqual({
      correctStreak: 1,
      lastWasWrong: false,
      mastered: false,
      sessionsSinceSeen: 0,
      weight: LEARNING_WEIGHT_MAX,
      lastSeenAt: SEEN_AT,
    });
  });

  it('reaches mastery at two consecutive correct answers through the fold', () => {
    const state = foldMasteryHistory([
      { isCorrect: false, answeredAt: 1_000 },
      { isCorrect: true, answeredAt: 2_000 },
      { isCorrect: true, answeredAt: 3_000 },
    ]);

    expect(state).toEqual({
      correctStreak: 2,
      lastWasWrong: false,
      mastered: true,
      sessionsSinceSeen: 0,
      // The mastering answer starts the rest, so the weight is already null.
      weight: null,
      lastSeenAt: 3_000,
    });
  });

  it('is order safe and idempotent: any replay of the same history agrees', () => {
    const history = [
      { isCorrect: true, answeredAt: 2_000 },
      { isCorrect: true, answeredAt: 1_000 },
      { isCorrect: false, answeredAt: 3_000 },
    ];

    const once = foldMasteryHistory(history);
    const replay = foldMasteryHistory([...history].reverse());

    expect(replay).toEqual(once);
    expect(once).toEqual({
      correctStreak: 0,
      lastWasWrong: true,
      mastered: false,
      sessionsSinceSeen: 0,
      weight: LAST_WRONG_WEIGHT,
      lastSeenAt: 3_000,
    });
  });
});

describe('ageMasteryForSession', () => {
  it('increments the counter of a domain question the session did not ask', () => {
    const previous = state({
      correctStreak: 1,
      weight: LEARNING_WEIGHT_MAX,
      lastSeenAt: 700,
    });

    const next = ageMasteryForSession(previous);

    // Not answered: only the counter and the derived weight move.
    expect(next).toEqual({ ...previous, sessionsSinceSeen: 1, weight: LEARNING_WEIGHT_MAX });
    expect(next.lastSeenAt).toBe(700);
  });

  it('rests a mastered question for exactly the window and returns it at the mastered band', () => {
    let current = applyMasteryAnswer(state({ correctStreak: 1 }), {
      isCorrect: true,
      answeredAt: SEEN_AT,
    });
    expect(current.mastered).toBe(true);
    expect(current.weight).toBeNull();

    // Sessions 1, 2 and 3 after mastery: still inside the window, null weight.
    for (let session = 1; session <= EXCLUSION_WINDOW_SESSIONS; session += 1) {
      current = ageMasteryForSession(current);
      expect(current.sessionsSinceSeen).toBe(session);
      expect(current.weight).toBeNull();
    }

    // Session 4 after mastery: the window has ended, the boundary is explicit.
    current = ageMasteryForSession(current);
    expect(current.sessionsSinceSeen).toBe(EXCLUSION_WINDOW_SESSIONS + 1);
    expect(current.mastered).toBe(true);
    expect(current.weight).toBe(MASTERED_WEIGHT);
    expect(MASTERED_WEIGHT).toBe(1);
  });
});
