import { describe, expect, it } from 'vitest';

import { CERTIFICATIONS } from './cert-registry';
import {
  clearQuestionCache,
  loadAllQuestions,
  loadDomainQuestions,
  validateLoaderCoverage,
} from './question-loader';

describe('question loader', () => {
  it('stamps every question with the domain it was loaded from', async () => {
    const questions = await loadDomainQuestions('clf-c02', 1);

    expect(questions.length).toBeGreaterThan(0);
    expect(questions.every((question) => question.domainId === 1)).toBe(true);
  });

  it('loads every domain of a cert for loadAllQuestions', async () => {
    const questions = await loadAllQuestions('clf-c02');

    expect(questions).toHaveLength(1050);
    expect(new Set(questions.map((question) => question.domainId))).toEqual(
      new Set([1, 2, 3, 4]),
    );
  });

  it('reuses the cached domain on a second load', async () => {
    clearQuestionCache();
    const first = await loadDomainQuestions('aif-c01', 2);
    const second = await loadDomainQuestions('aif-c01', 2);

    expect(second).toBe(first);
  });

  it('yields fresh objects after the cache is cleared', async () => {
    const first = await loadDomainQuestions('aif-c01', 3);
    clearQuestionCache();
    const second = await loadDomainQuestions('aif-c01', 3);

    expect(second).not.toBe(first);
    expect(second).toHaveLength(first.length);
  });

  it('rejects for a cert it does not know', async () => {
    await expect(loadDomainQuestions('nope-99', 1)).rejects.toThrow();
  });

  it('rejects for a domain the cert does not declare', async () => {
    await expect(loadDomainQuestions('clf-c02', 9)).rejects.toThrow();
  });

  it('declares a loader for every domain of every registry cert', () => {
    expect(validateLoaderCoverage(CERTIFICATIONS)).toEqual([]);
  });

  it('ships domain files whose size matches the registry question count', async () => {
    for (const cert of Object.values(CERTIFICATIONS)) {
      for (const domain of cert.domains) {
        const questions = await loadDomainQuestions(cert.code, domain.id);
        expect(
          questions.length,
          `${cert.code} domain ${domain.id} question count`,
        ).toBe(domain.questionCount);
      }
    }
  });
});
