/**
 * Input and output shapes for the exam engine (issue 004).
 *
 * The engine computes; it never persists and never renders. Persistence shapes
 * live in `core/storage` (issue 002, DATA-20, DATA-21) and content shapes live
 * in `core/content` (issue 003). Keeping the computation shapes here is what
 * lets the storage adapter change from IndexedDB to SQLite without touching a
 * single selector, and it is why this module imports no framework code at all.
 */

import type { QuestionType } from '../content/question-types';

/** Maps a display option key back to the key it came from in the bank. */
export type OptionKeyMap = Record<string, string>;

/** A source of randomness in `[0, 1)`. Injected so selectors are testable. */
export type RandomSource = () => number;

/**
 * The per-question history the adaptive selector needs (SR-8).
 *
 * A camelCase projection of `QuestionMasteryRow` from `core/storage`: the
 * storage layer owns persistence and derives the row, and the feature maps it
 * into this shape. A `null` weight means the question sits in the exclusion
 * window, so it is hidden from the active pool and eligible only for backfill
 * (SR-9, SR-16). `lastSeenAt` is epoch milliseconds, matching the stored row.
 */
export interface PracticeMastery {
  questionId: string;
  correctStreak: number;
  lastWasWrong: boolean;
  lastSeenAt: number;
  mastered: boolean;
  weight: number | null;
}

/** One graded question, reduced to what per-domain scoring needs. */
export interface DomainResult {
  domainId: number;
  isCorrect: boolean;
}

/** One domain's standing, fed to `findNextDomainAction` (SR-35 to SR-40). */
export interface DomainStanding {
  domainId: number;
  /** Display percent for this domain: bank mastery or exam accuracy. */
  percent: number;
  /** False when the student has never answered a question in this domain. */
  practiced: boolean;
}

/**
 * The dashboard "Next up" decision. An unstarted domain must be phrased
 * "you have not practiced X yet" and never "weakest" (SR-36).
 */
export type NextDomainAction =
  | { kind: 'unstarted'; domainId: number }
  | { kind: 'weakest'; domainId: number; percent: number };

/** Wall-clock derived exam duration (EXAM-31, EXAM-32). */
export interface ExamTiming {
  /** Elapsed seconds, clamped to `[0, examTimeSeconds]`. */
  timeTaken: number;
  /**
   * True only for a genuine sub-minute run. EXAM-33 removed the web app's
   * 60-second save floor, so a caller must never discard a completed Ionic
   * attempt on this flag; it survives only as a display hint.
   */
  isTooShort: boolean;
}

/** The four response formats the engine grades (EXAM-8). */
export type { QuestionType };
