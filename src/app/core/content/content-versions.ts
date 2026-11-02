/**
 * Bundled content versions.
 *
 * Each value is the most recent `lastVerified` date found in that cert's bank,
 * so it states how fresh the content actually is rather than when the app was
 * built. Settings shows it (CONT-30, CONT-36).
 *
 * A cert with no entry has no verified content: SAA-C03 is a 20-question
 * placeholder that ships as coming soon (CERT-4) and none of its questions carry
 * a `lastVerified` date. Inventing a date for it would claim a freshness that
 * does not exist, so the absence is represented honestly and the UI must show
 * "not yet published" rather than a date.
 *
 * `scripts/check-bank-drift.mjs` recomputes these from both the bundled bank and
 * the reference copy, so refreshing the content without bumping the published
 * version is a build failure.
 */
export const CONTENT_VERSIONS: Readonly<Record<string, string>> = {
  'aif-c01': '2026-06-13',
  'clf-c02': '2026-06-15',
};

export function contentVersionFor(certCode: string): string | null {
  return Object.prototype.hasOwnProperty.call(CONTENT_VERSIONS, certCode)
    ? (CONTENT_VERSIONS[certCode] ?? null)
    : null;
}
