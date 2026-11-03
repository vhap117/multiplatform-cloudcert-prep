import { describe, expect, it } from 'vitest';

import {
  decodeAnswerForDb,
  encodeAnswerForDb,
  matchesToTokens,
  toOriginalMatchTokens,
} from './answer-encoding';

/**
 * Ported from `ionic-requirements/cert-banks/reference/utils.test.ts`.
 *
 * The persisted shapes stay the web app's canonical ones (EXAM-ENGINE.md,
 * "Shuffling options"): comma-joined option keys for single, multi, and
 * ordering, and comma-joined `K:T` tokens for matching.
 */
const keyMap = { A: 'C', B: 'A', C: 'B', D: 'D' };

describe('matchesToTokens', () => {
  it('serialises a match map to sorted K:T tokens', () => {
    expect(matchesToTokens({ B: '2', A: '3', C: '1' })).toEqual(['A:3', 'B:2', 'C:1']);
  });

  it('returns an empty array for an empty map', () => {
    expect(matchesToTokens({})).toEqual([]);
  });
});

describe('toOriginalMatchTokens', () => {
  const matchKeyMap = { A: 'C', B: 'A', C: 'B' };

  it('remaps only the left option key, keeping the target key', () => {
    expect(toOriginalMatchTokens(['A:3', 'B:2', 'C:1'], matchKeyMap)).toEqual([
      'A:2',
      'B:1',
      'C:3',
    ]);
  });

  it('sorts the result by original key for a stable persisted string', () => {
    expect(toOriginalMatchTokens(['C:1', 'A:3'], matchKeyMap)).toEqual(['B:1', 'C:3']);
  });
});

describe('encodeAnswerForDb', () => {
  it('encodes a single answer', () => {
    expect(encodeAnswerForDb('A', keyMap, 'single')).toBe('C');
  });

  it('encodes a multi answer as a comma list', () => {
    expect(encodeAnswerForDb(['A', 'B'], keyMap, 'multi')).toBe('C,A');
  });

  it('encodes an ordering sequence as a comma list', () => {
    expect(encodeAnswerForDb(['A', 'B', 'C', 'D'], keyMap, 'ordering')).toBe('C,A,B,D');
  });

  it('encodes matching tokens, remapping only the left keys', () => {
    expect(encodeAnswerForDb(['A:3', 'B:2'], keyMap, 'matching')).toBe('A:2,C:3');
  });

  it('encodes a null or empty answer to an empty string', () => {
    expect(encodeAnswerForDb(null, keyMap, 'single')).toBe('');
    expect(encodeAnswerForDb(null, keyMap, 'matching')).toBe('');
    expect(encodeAnswerForDb([], keyMap, 'multi')).toBe('');
  });
});

describe('decodeAnswerForDb', () => {
  it('decodes a single answer to a string', () => {
    expect(decodeAnswerForDb('C', 'single')).toBe('C');
  });

  it('decodes an empty single answer to an empty string', () => {
    expect(decodeAnswerForDb('', 'single')).toBe('');
  });

  it('decodes a multi answer to a key array', () => {
    expect(decodeAnswerForDb('C,A', 'multi')).toEqual(['C', 'A']);
  });

  it('decodes an ordering sequence to a positional key array', () => {
    expect(decodeAnswerForDb('C,A,B,D', 'ordering')).toEqual(['C', 'A', 'B', 'D']);
  });

  it('decodes matching tokens without splitting the colon pairs', () => {
    expect(decodeAnswerForDb('A:2,C:3', 'matching')).toEqual(['A:2', 'C:3']);
  });

  it('round-trips every type through encode and decode', () => {
    const identityKeyMap = { A: 'A', B: 'B', C: 'C', D: 'D' };
    for (const value of ['A', ['A', 'B'], ['A', 'B', 'C', 'D']]) {
      const type = typeof value === 'string' ? 'single' : 'multi';
      expect(decodeAnswerForDb(encodeAnswerForDb(value, identityKeyMap, type), type)).toEqual(
        value,
      );
    }
    expect(decodeAnswerForDb(encodeAnswerForDb(['A:2', 'C:3'], identityKeyMap, 'matching'), 'matching'))
      .toEqual(['A:2', 'C:3']);
  });
});
