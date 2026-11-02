import { describe, expect, it } from 'vitest';

import { CERTIFICATIONS } from './cert-registry';
import { CONTENT_VERSIONS, contentVersionFor } from './content-versions';
import { loadAllQuestions } from './question-loader';
import { validateCertContent } from './validate-question';

/**
 * The content gate (CONT-17, CONT-24, CONT-50).
 *
 * This runs inside the normal test command, so a malformed question fails the
 * same pipeline that fails a broken build. It validates the bundled banks, not
 * fixtures.
 */
describe('bundled question banks', () => {
  for (const cert of Object.values(CERTIFICATIONS)) {
    it(`${cert.code} has no content errors`, async () => {
      const perDomain = new Map<number, unknown>();
      for (const domain of cert.domains) {
        const questions = await loadAllQuestionsForDomain(cert.code, domain.id);
        // Drop the stamped domainId so the validator sees the on-disk shape.
        perDomain.set(
          domain.id,
          questions.map((question) => {
            const { domainId, ...rest } = question;
            void domainId;
            return rest;
          }),
        );
      }

      const errors = validateCertContent(cert, perDomain).filter(
        (issue) => issue.severity === 'error',
      );

      expect(
        errors.map((issue) => `${issue.code}: ${issue.message}`),
        `${cert.code} content errors`,
      ).toEqual([]);
    });
  }

  it('declares a verified content version for every active cert', () => {
    for (const cert of Object.values(CERTIFICATIONS)) {
      const version = CONTENT_VERSIONS[cert.code];
      if (cert.status === 'active') {
        expect(version, `${cert.code} content version`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it('claims no freshness for a cert whose bank carries no verified dates', async () => {
    const placeholder = CERTIFICATIONS['saa-c03'];
    expect(placeholder.status).toBe('coming-soon');
    expect(CONTENT_VERSIONS[placeholder.code]).toBeUndefined();

    const questions = await loadAllQuestions(placeholder.code);
    expect(questions.every((question) => question.lastVerified === undefined)).toBe(
      true,
    );
  });

  it('reports the content version through the accessor', () => {
    expect(contentVersionFor('clf-c02')).toBe(CONTENT_VERSIONS['clf-c02']);
    expect(contentVersionFor('saa-c03')).toBeNull();
    expect(contentVersionFor('unknown-cert')).toBeNull();
  });

  it('exposes the full bank for a cert without duplicates', async () => {
    const questions = await loadAllQuestions('aif-c01');
    const ids = questions.map((question) => question.id);

    expect(ids).toHaveLength(419);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

async function loadAllQuestionsForDomain(
  certCode: string,
  domainId: number,
): Promise<readonly { id: string; domainId: number }[]> {
  const { loadDomainQuestions } = await import('./question-loader');
  return loadDomainQuestions(certCode, domainId);
}
