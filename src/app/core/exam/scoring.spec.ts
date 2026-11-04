import { describe, expect, it } from 'vitest';

import {
  calculateScorePercent,
  formatTime,
  formatTotalTime,
  getDomainScore,
  isPassed,
} from './scoring';

describe('calculateScorePercent', () => {
  it('returns 0 when nothing is correct', () => {
    expect(calculateScorePercent(0, 65)).toBe(0);
  });

  it('returns 100 when everything is correct', () => {
    expect(calculateScorePercent(65, 65)).toBe(100);
  });

  it('rounds the correct fraction to a whole percent', () => {
    expect(calculateScorePercent(33, 65)).toBe(51);
  });

  it('clamps to zero with negative input', () => {
    expect(calculateScorePercent(-5, 65)).toBe(0);
  });

  it('caps at 100 with overflowing input', () => {
    expect(calculateScorePercent(70, 65)).toBe(100);
  });

  it('returns 0 for an empty exam instead of NaN', () => {
    expect(calculateScorePercent(0, 0)).toBe(0);
  });
});

describe('isPassed', () => {
  it('passes exactly at the CLF-C02 threshold', () => {
    expect(isPassed(67, 67)).toBe(true);
  });

  it('fails one percent below the threshold', () => {
    expect(isPassed(66, 67)).toBe(false);
  });

  it('respects cert-specific thresholds', () => {
    expect(isPassed(67, 69)).toBe(false);
    expect(isPassed(69, 69)).toBe(true);
    expect(isPassed(70, 69)).toBe(true);
  });
});

describe('getDomainScore', () => {
  it('returns 0 when the domain has no questions', () => {
    expect(getDomainScore([], 1)).toBe(0);
    expect(getDomainScore([{ domainId: 2, isCorrect: true }], 1)).toBe(0);
  });

  it('returns the percentage of correct answers within the domain', () => {
    const results = [
      { domainId: 1, isCorrect: true },
      { domainId: 1, isCorrect: false },
      { domainId: 1, isCorrect: true },
      { domainId: 1, isCorrect: true },
      { domainId: 2, isCorrect: false },
    ];
    expect(getDomainScore(results, 1)).toBe(75);
  });

  it('returns 100 when every domain answer is correct', () => {
    const results = [
      { domainId: 3, isCorrect: true },
      { domainId: 3, isCorrect: true },
    ];
    expect(getDomainScore(results, 3)).toBe(100);
  });
});

describe('formatTime', () => {
  it('pads minutes and seconds to two digits', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(5)).toBe('00:05');
    expect(formatTime(65)).toBe('01:05');
    expect(formatTime(3599)).toBe('59:59');
  });

  it('keeps counting minutes past an hour', () => {
    expect(formatTime(3600)).toBe('60:00');
    expect(formatTime(5400)).toBe('90:00');
  });
});

describe('formatTotalTime', () => {
  it('shows minutes only under an hour', () => {
    expect(formatTotalTime(0)).toBe('0m');
    expect(formatTotalTime(45)).toBe('45m');
    expect(formatTotalTime(59)).toBe('59m');
  });

  it('shows hours only on exact-hour values', () => {
    expect(formatTotalTime(60)).toBe('1h');
    expect(formatTotalTime(120)).toBe('2h');
  });

  it('combines hours and minutes', () => {
    expect(formatTotalTime(75)).toBe('1h 15m');
    expect(formatTotalTime(135)).toBe('2h 15m');
  });
});
