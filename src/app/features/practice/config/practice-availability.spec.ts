import { describe, expect, it } from 'vitest';

import type { Certification } from '../../../core/content/cert-registry';

import { hasAvailableQuestions } from './practice-availability';

function certWithCounts(counts: readonly number[]): Certification {
  return {
    code: 'test-001',
    provider: 'aws',
    level: 'foundational',
    name: 'Test cert',
    shortName: 'TEST',
    examQuestionCount: 5,
    examTimeSeconds: 600,
    passingPercent: 70,
    status: 'active',
    domains: counts.map((questionCount, index) => ({
      id: index + 1,
      name: `Domain ${index + 1}`,
      questionCount,
      examProportion: 1 / counts.length,
    })),
  };
}

describe('hasAvailableQuestions (CERT-30)', () => {
  it('is true when any domain has questions', () => {
    expect(hasAvailableQuestions(certWithCounts([0, 3]))).toBe(true);
  });

  it('is false when every domain is empty', () => {
    expect(hasAvailableQuestions(certWithCounts([0, 0]))).toBe(false);
    expect(hasAvailableQuestions(null)).toBe(false);
  });
});
