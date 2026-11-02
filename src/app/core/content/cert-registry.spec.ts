import { describe, expect, it } from 'vitest';

import {
  CERTIFICATIONS,
  getCert,
  isActiveCert,
  listCerts,
  validateRegistry,
} from './cert-registry';

describe('certification registry', () => {
  it('bundles the three certifications', () => {
    expect(Object.keys(CERTIFICATIONS).sort()).toEqual([
      'aif-c01',
      'clf-c02',
      'saa-c03',
    ]);
  });

  it('sums every domain proportion to exactly one', () => {
    for (const cert of Object.values(CERTIFICATIONS)) {
      const sum = cert.domains.reduce((total, domain) => total + domain.examProportion, 0);
      expect(sum, `${cert.code} proportions`).toBeCloseTo(1, 10);
    }
  });

  it('keeps the required exam logistics sane for every cert', () => {
    for (const cert of Object.values(CERTIFICATIONS)) {
      expect(cert.examQuestionCount).toBeGreaterThan(0);
      expect(cert.examTimeSeconds).toBeGreaterThan(0);
      expect(cert.passingScore).toBeGreaterThanOrEqual(100);
      expect(cert.passingScore).toBeLessThanOrEqual(1000);
      expect(cert.domains.length).toBeGreaterThan(0);
      expect(new Set(cert.domains.map((domain) => domain.id)).size).toBe(
        cert.domains.length,
      );
    }
  });

  it('marks CLF-C02 and AIF-C01 active and SAA-C03 coming soon', () => {
    expect(getCert('clf-c02')?.status).toBe('active');
    expect(getCert('aif-c01')?.status).toBe('active');
    expect(getCert('saa-c03')?.status).toBe('coming-soon');
  });

  it('reports SAA-C03 as not active so no flow opens against it', () => {
    expect(isActiveCert('saa-c03')).toBe(false);
    expect(isActiveCert('clf-c02')).toBe(true);
  });

  it('returns null for an unknown cert code', () => {
    expect(getCert('nope-99')).toBeNull();
  });

  it('lists only active certs when asked', () => {
    expect(listCerts({ activeOnly: true }).map((cert) => cert.code).sort()).toEqual([
      'aif-c01',
      'clf-c02',
    ]);
  });

  it('lists every cert in a stable order', () => {
    const first = listCerts().map((cert) => cert.code);
    const second = listCerts().map((cert) => cert.code);
    expect(first).toEqual(second);
    expect(first).toHaveLength(3);
  });

  it('declares no registry-level problems', () => {
    expect(validateRegistry()).toEqual([]);
  });

  it('flags a cert whose proportions do not sum to one', () => {
    const broken = {
      ...CERTIFICATIONS['clf-c02'],
      code: 'broken-01',
      domains: CERTIFICATIONS['clf-c02'].domains.map((domain, index) =>
        index === 0 ? { ...domain, examProportion: 0.5 } : domain,
      ),
    };
    const problems = validateRegistry({ 'broken-01': broken });
    expect(problems.some((problem) => problem.includes('proportion'))).toBe(true);
  });
});
