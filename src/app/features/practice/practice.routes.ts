/**
 * Paths of the domain practice flow (issue 007).
 *
 * The Practice tab lists the selected cert's domains, each pointing at the
 * config screen with its domain preselected (PRACT-1 to PRACT-3). The runner
 * runs full screen so the leave guard can make walking away an explicit
 * choice (PRACT-27 to PRACT-30).
 */

export const PRACTICE_SEGMENT = 'practice';

/** The config screen for a cert, optionally with a domain preselected. */
export function practiceConfigPath(certCode: string, domainId?: number): string {
  const base = `/${PRACTICE_SEGMENT}/${certCode}`;
  return domainId === undefined ? base : `${base}?domain=${domainId}`;
}

/** The guarded runner, where answers grade immediately. */
export function practiceRunPath(certCode: string): string {
  return `/${PRACTICE_SEGMENT}/${certCode}/run`;
}
