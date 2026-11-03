/**
 * Paths of the mock exam flow.
 *
 * The flow runs full screen instead of inside the tabs shell: an exam in
 * progress must not expose tab navigation, and the leave guard is only
 * meaningful when leaving the screen is an explicit decision (S11).
 */

export const MOCK_EXAM_SEGMENT = 'mock-exam';

/** Start screen for a cert, where an attempt is started or resumed. */
export function mockExamStartPath(certCode: string): string {
  return `/${MOCK_EXAM_SEGMENT}/${certCode}`;
}

/** The runner, guarded by `mockExamLeaveGuard`. */
export function mockExamRunPath(certCode: string): string {
  return `${mockExamStartPath(certCode)}/run`;
}

/** Results and review for a finished attempt, optionally a stored one. */
export function mockExamResultsPath(certCode: string, attemptId?: string): string {
  const base = `${mockExamStartPath(certCode)}/results`;
  return attemptId ? `${base}?attemptId=${encodeURIComponent(attemptId)}` : base;
}
