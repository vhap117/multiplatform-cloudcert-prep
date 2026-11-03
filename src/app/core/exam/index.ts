/**
 * The pure exam engine (issue 004).
 *
 * Everything here is framework independent: no Angular, no Ionic, no
 * Capacitor, and no storage. Features call these functions for selection,
 * shuffling, grading, scoring, timing, adaptive practice, and mastery, and the
 * persistence layer stays behind `StudyRepository`.
 *
 * The boundary is enforced by lint, not by convention; see the
 * `src/app/core/exam/**` block in `eslint.config.js`.
 */

export * from './exam-types';
export * from './exam-constants';
export * from './answer-encoding';
export * from './grading';
export * from './mastery';
export * from './practice-selection';
export * from './scoring';
export * from './selection';
export * from './shuffle';
export * from './timing';
