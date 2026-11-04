import { describe, expect, it } from 'vitest';

import type { Certification } from '../content/certification-types';
import { CERTIFICATIONS } from '../content/cert-registry';
import { loadAllQuestions } from '../content/question-loader';
import {
  availableExamQuestions,
  getExamDomainTargets,
  selectExamQuestions,
} from './selection';

/** Ported from `ionic-requirements/cert-banks/reference/scoring.test.ts`. */

const FLAT_CERT: Certification = {
  code: 'test',
  provider: 'aws',
  level: 'foundational',
  name: 'Test cert',
  shortName: 'TEST',
  status: 'active',
  examQuestionCount: 65,
  examTimeSeconds: 90 * 60,
  passingPercent: 67,
  domains: [
    { id: 1, name: 'D1', examProportion: 0.24, questionCount: 100 },
    { id: 2, name: 'D2', examProportion: 0.3, questionCount: 100 },
    { id: 3, name: 'D3', examProportion: 0.34, questionCount: 100 },
    { id: 4, name: 'D4', examProportion: 0.12, questionCount: 100 },
  ],
};

/** Deterministic uniform source (mulberry32) so selector tests are stable. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('getExamDomainTargets', () => {
  it('respects examProportion and guarantees the exact total', () => {
    const targets = getExamDomainTargets(FLAT_CERT);

    expect(Object.values(targets).reduce((sum, count) => sum + count, 0)).toBe(65);
    expect(targets[1]).toBe(16);
    expect(targets[2]).toBe(20);
    expect(targets[3]).toBe(22);
    // The last domain absorbs the remainder instead of its own rounding
    // (round(65 * 0.12) would be 8 and the exam would hold 66).
    expect(targets[4]).toBe(7);
  });

  it('gives the whole exam to a single-domain cert', () => {
    const single: Certification = {
      ...FLAT_CERT,
      domains: [{ id: 1, name: 'Only', examProportion: 1, questionCount: 100 }],
    };
    expect(getExamDomainTargets(single)).toEqual({ 1: 65 });
  });

  it('sums exactly to examQuestionCount for every active cert in the registry', () => {
    for (const cert of Object.values(CERTIFICATIONS)) {
      const targets = getExamDomainTargets(cert);
      const sum = Object.values(targets).reduce((total, count) => total + count, 0);
      expect(sum, `${cert.code} targets must sum to ${cert.examQuestionCount}`).toBe(
        cert.examQuestionCount,
      );
      expect(Object.keys(targets)).toHaveLength(cert.domains.length);
    }
  });
});

describe('availableExamQuestions', () => {
  it('draws the full exam when the bank is big enough', async () => {
    const cert = CERTIFICATIONS['clf-c02'];
    const bank = await loadAllQuestions('clf-c02');
    expect(availableExamQuestions(bank, cert)).toBe(65);
  });

  it('reports the shortfall for a placeholder bank instead of pretending', async () => {
    // SAA-C03 ships 5 questions per domain against a 65-question exam.
    const cert = CERTIFICATIONS['saa-c03'];
    const bank = await loadAllQuestions('saa-c03');
    expect(availableExamQuestions(bank, cert)).toBe(bank.length);
    expect(availableExamQuestions(bank, cert)).toBeLessThan(cert.examQuestionCount);
  });
});

describe('selectExamQuestions', () => {
  it('draws exactly the per-domain targets from the real bank', async () => {
    const cert = CERTIFICATIONS['clf-c02'];
    const bank = await loadAllQuestions('clf-c02');
    const selected = selectExamQuestions(bank, cert, seededRandom(7));

    expect(selected).toHaveLength(65);
    const perDomain = new Map<number, number>();
    for (const question of selected) {
      perDomain.set(question.domainId, (perDomain.get(question.domainId) ?? 0) + 1);
    }
    expect(Object.fromEntries([...perDomain].sort())).toEqual({
      1: 16,
      2: 20,
      3: 22,
      4: 7,
    });
  });

  it('never repeats a question', async () => {
    const cert = CERTIFICATIONS['clf-c02'];
    const bank = await loadAllQuestions('clf-c02');
    const selected = selectExamQuestions(bank, cert, seededRandom(11));

    expect(new Set(selected.map((question) => question.id)).size).toBe(selected.length);
  });

  it('shuffles the final list so domains are not clustered', async () => {
    const cert = CERTIFICATIONS['clf-c02'];
    const bank = await loadAllQuestions('clf-c02');
    const selected = selectExamQuestions(bank, cert, seededRandom(3));

    const firstHalf = selected.slice(0, 32).map((question) => question.domainId);
    expect(new Set(firstHalf).size).toBeGreaterThan(1);
  });

  it('does not mutate the bank order', async () => {
    const cert = CERTIFICATIONS['clf-c02'];
    const bank = await loadAllQuestions('clf-c02');
    const snapshot = bank.map((question) => question.id);

    selectExamQuestions(bank, cert, seededRandom(5));

    expect(bank.map((question) => question.id)).toEqual(snapshot);
  });

  it('is deterministic for a fixed random source', async () => {
    const cert = CERTIFICATIONS['aif-c01'];
    const bank = await loadAllQuestions('aif-c01');

    const first = selectExamQuestions(bank, cert, seededRandom(1)).map((q) => q.id);
    const second = selectExamQuestions(bank, cert, seededRandom(1)).map((q) => q.id);

    expect(first).toEqual(second);
  });
});
