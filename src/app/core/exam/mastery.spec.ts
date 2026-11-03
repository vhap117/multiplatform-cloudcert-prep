import { describe, expect, it } from 'vitest';

import { getCert } from '../content/cert-registry';
import { calculateDomainMastery, findNextDomainAction } from './mastery';

/** Ported from `ionic-requirements/cert-banks/reference/domainStats.test.ts`. */

function domainTotal(certCode: string, domainId: number): number {
  const cert = getCert(certCode);
  const domain = cert?.domains.find((entry) => entry.id === domainId);
  if (!domain) {
    throw new Error(`Unknown domain ${certCode}/${domainId} in the registry`);
  }
  return domain.questionCount;
}

describe('calculateDomainMastery', () => {
  const clfDomain1Total = domainTotal('clf-c02', 1);

  it('returns 0 when nothing is correct', () => {
    expect(calculateDomainMastery(0, 1, 'clf-c02')).toBe(0);
  });

  it('returns 100 when the whole domain is correct', () => {
    expect(calculateDomainMastery(clfDomain1Total, 1, 'clf-c02')).toBe(100);
  });

  it('rounds intermediate coverage', () => {
    const half = Math.round(clfDomain1Total / 2);
    expect(calculateDomainMastery(half, 1, 'clf-c02')).toBe(
      Math.round((half / clfDomain1Total) * 100),
    );
  });

  it('clamps to 100 when stale rows push correct past the current bank', () => {
    expect(calculateDomainMastery(clfDomain1Total + 40, 1, 'clf-c02')).toBe(100);
    expect(calculateDomainMastery(clfDomain1Total * 10, 1, 'clf-c02')).toBe(100);
  });

  it('returns 0 for an unknown domain', () => {
    expect(calculateDomainMastery(10, 99, 'clf-c02')).toBe(0);
  });

  it('returns 0 for an unknown certification', () => {
    expect(calculateDomainMastery(10, 1, 'nope-c00')).toBe(0);
  });
});

describe('findNextDomainAction', () => {
  it('returns null for an empty list', () => {
    expect(findNextDomainAction([])).toBeNull();
  });

  it('points at the first unstarted domain, in input order', () => {
    expect(
      findNextDomainAction([
        { domainId: 1, percent: 40, practiced: true },
        { domainId: 2, percent: 0, practiced: false },
        { domainId: 3, percent: 0, practiced: false },
      ]),
    ).toEqual({ kind: 'unstarted', domainId: 2 });
  });

  it('never calls an unstarted domain weakest, even when a practiced one scores lower', () => {
    expect(
      findNextDomainAction([
        { domainId: 1, percent: 5, practiced: true },
        { domainId: 4, percent: 0, practiced: false },
      ]),
    ).toEqual({ kind: 'unstarted', domainId: 4 });
  });

  it('picks the lowest-percent domain once everything is practiced', () => {
    expect(
      findNextDomainAction([
        { domainId: 1, percent: 62, practiced: true },
        { domainId: 2, percent: 41, practiced: true },
        { domainId: 3, percent: 80, practiced: true },
        { domainId: 4, percent: 55, practiced: true },
        { domainId: 5, percent: 47, practiced: true },
      ]),
    ).toEqual({ kind: 'weakest', domainId: 2, percent: 41 });
  });

  it('breaks ties toward the first domain in input order', () => {
    expect(
      findNextDomainAction([
        { domainId: 1, percent: 50, practiced: true },
        { domainId: 2, percent: 50, practiced: true },
      ]),
    ).toEqual({ kind: 'weakest', domainId: 1, percent: 50 });
  });

  it('handles a fully-new user by pointing at the first domain', () => {
    expect(
      findNextDomainAction([
        { domainId: 1, percent: 0, practiced: false },
        { domainId: 2, percent: 0, practiced: false },
      ]),
    ).toEqual({ kind: 'unstarted', domainId: 1 });
  });
});
