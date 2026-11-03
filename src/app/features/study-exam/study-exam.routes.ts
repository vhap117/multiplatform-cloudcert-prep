/**
 * Paths of the study exam flow (issue 006).
 *
 * Unlike the mock exam, the study exam has no leave guard: progress is saved
 * after every graded answer, so navigating away never discards anything
 * (STUDY-52). The flow still runs full screen so the three progress bars and
 * the feedback panel get the whole viewport.
 */

export const STUDY_EXAM_SEGMENT = 'study-exam';

/** Start screen for a cert, where a session is started or resumed. */
export function studyExamStartPath(certCode: string): string {
  return `/${STUDY_EXAM_SEGMENT}/${certCode}`;
}

/** The runner, where answers grade immediately. */
export function studyExamRunPath(certCode: string): string {
  return `${studyExamStartPath(certCode)}/run`;
}
