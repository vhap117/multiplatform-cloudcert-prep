/**
 * Exam timing on wall-clock timestamps only (EXAM-20 to EXAM-24, EXAM-31,
 * EXAM-32).
 *
 * A phone can be backgrounded or locked mid-exam, so an in-memory countdown
 * drifts and a foreground tick cannot be trusted. Store the start instant, keep
 * the deadline derived from it, and recompute the remainder on every read.
 *
 * Two clock pathologies are defended here, because both corrupt a saved result:
 *
 * - a forward jump (device sleep, or the wall clock moving ahead) would inflate
 *   the saved duration past the exam length, so it is clamped;
 * - a backward jump (NTP correction, manual change) would produce a negative
 *   duration and a naive "too short" verdict, which used to discard an attempt
 *   the student had actually completed. A negative raw elapsed is never
 *   classified as too short.
 *
 * EXAM-33 is the reason `isTooShort` is a display hint and nothing more: the
 * Ionic app has no 60-second persistence floor, so a completed attempt is saved
 * whatever its duration.
 */

import { MIN_VALID_EXAM_SECONDS } from './exam-constants';
import type { ExamTiming } from './exam-types';

/** The instant an attempt expires, in epoch milliseconds. */
export function deadlineFor(startedAtMs: number, examTimeSeconds: number): number {
  return startedAtMs + examTimeSeconds * 1000;
}

/** Seconds left until the deadline, never negative. */
export function remainingSeconds(deadlineMs: number, nowMs: number): number {
  return Math.max(0, Math.floor((deadlineMs - nowMs) / 1000));
}

/**
 * Derive the duration to persist and the too-short display hint from two
 * wall-clock instants.
 */
export function computeExamTiming(
  startedAtMs: number,
  nowMs: number,
  examTimeSeconds: number,
): ExamTiming {
  const rawElapsed = Math.floor((nowMs - startedAtMs) / 1000);
  const timeTaken = Math.min(Math.max(0, rawElapsed), examTimeSeconds);
  const isTooShort = rawElapsed >= 0 && rawElapsed < MIN_VALID_EXAM_SECONDS;
  return { timeTaken, isTooShort };
}
