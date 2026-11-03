import { describe, expect, it } from 'vitest';

import { MIN_VALID_EXAM_SECONDS } from './exam-constants';
import { computeExamTiming, deadlineFor, remainingSeconds } from './timing';

/**
 * Ported from `ionic-requirements/cert-banks/reference/scoring.test.ts`.
 *
 * The timer is wall-clock only (EXAM-21, EXAM-22): the app can be backgrounded
 * or the screen locked, so a countdown driven by foreground execution would
 * drift.
 */
const EXAM_SECONDS = 90 * 60;
const START = 1_000_000;

describe('computeExamTiming', () => {
  it('reports the real elapsed time for a normal attempt', () => {
    const now = START + 45 * 60 * 1000;
    expect(computeExamTiming(START, now, EXAM_SECONDS)).toEqual({
      timeTaken: 45 * 60,
      isTooShort: false,
    });
  });

  it('ranks a genuine sub-minute attempt as short', () => {
    const now = START + 30 * 1000;
    const { timeTaken, isTooShort } = computeExamTiming(START, now, EXAM_SECONDS);
    expect(timeTaken).toBe(30);
    expect(timeTaken).toBeLessThan(MIN_VALID_EXAM_SECONDS);
    expect(isTooShort).toBe(true);
  });

  it('treats exactly the minimum as long enough', () => {
    const now = START + MIN_VALID_EXAM_SECONDS * 1000;
    expect(computeExamTiming(START, now, EXAM_SECONDS).isTooShort).toBe(false);
  });

  it('clamps a forward clock jump to the exam length', () => {
    const now = START + 3.5 * 60 * 60 * 1000;
    const { timeTaken, isTooShort } = computeExamTiming(START, now, EXAM_SECONDS);
    expect(timeTaken).toBe(EXAM_SECONDS);
    expect(isTooShort).toBe(false);
  });

  it('never discards a completed attempt when the clock moves backward', () => {
    const now = START - 5 * 60 * 1000;
    const { timeTaken, isTooShort } = computeExamTiming(START, now, EXAM_SECONDS);
    expect(timeTaken).toBe(0);
    expect(isTooShort).toBe(false);
  });

  it('floors fractional seconds', () => {
    expect(computeExamTiming(START, START + 1999, EXAM_SECONDS).timeTaken).toBe(1);
  });
});

describe('deadlineFor', () => {
  it('adds the exam length to the start time', () => {
    expect(deadlineFor(START, EXAM_SECONDS)).toBe(START + EXAM_SECONDS * 1000);
  });
});

describe('remainingSeconds', () => {
  it('counts down toward the deadline', () => {
    expect(remainingSeconds(START + 60_000, START)).toBe(60);
  });

  it('returns 0 once the deadline has passed', () => {
    expect(remainingSeconds(START, START + 5_000)).toBe(0);
  });

  it('returns 0 exactly at the deadline', () => {
    expect(remainingSeconds(START, START)).toBe(0);
  });
});
