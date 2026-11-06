import type { Certification } from '../../../core/content/cert-registry';

/**
 * True when a cert has at least one question to practice (CERT-30). A cert
 * with no bundled questions gets an explicit empty state instead of a Start
 * button that cannot work.
 */
export function hasAvailableQuestions(cert: Certification | null): boolean {
  return !!cert && cert.domains.some((domain) => domain.questionCount > 0);
}
