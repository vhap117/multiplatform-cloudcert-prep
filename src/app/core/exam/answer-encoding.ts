/**
 * The canonical persisted answer shapes (EXAM-ENGINE.md, "Shuffling options").
 *
 * A user answer is captured in display space so it can be graded against the
 * shuffled question, then translated back to the original bank keys before it
 * is stored. Keeping the web app's text shapes means an export or import of the
 * existing corpus needs no translation layer, even though the Ionic store is
 * local.
 *
 * - single: one option key, for example `B`
 * - multi: comma-joined option keys, for example `B,E`
 * - ordering: comma-joined keys in sequence, for example `D,B,A,C`
 * - matching: comma-joined `K:T` tokens, for example `A:3,B:2`
 */

import type { QuestionType } from '../content/question-types';
import type { OptionKeyMap } from './exam-types';

/** Encode a matching map as sorted, comparable `K:T` tokens. */
export function matchesToTokens(matches: Record<string, string>): string[] {
  return Object.keys(matches)
    .sort()
    .map((key) => `${key}:${matches[key]}`);
}

/**
 * Translate matching tokens back to original left keys.
 *
 * Only the left side of each token is remapped; a whole-string remap would
 * corrupt the pairing whenever an option key and a target key share a letter or
 * digit.
 */
export function toOriginalMatchTokens(tokens: readonly string[], keyMap: OptionKeyMap): string[] {
  return tokens
    .map((token) => {
      const [optionKey, targetKey] = token.split(':');
      return `${keyMap[optionKey] ?? optionKey}:${targetKey}`;
    })
    .sort();
}

/** Encode an in-memory answer, in display space, to the stored text shape. */
export function encodeAnswerForDb(
  value: string | readonly string[] | null | undefined,
  keyMap: OptionKeyMap,
  type: QuestionType,
): string {
  if (type === 'matching') {
    return toOriginalMatchTokens(Array.isArray(value) ? value : [], keyMap).join(',');
  }
  const original = toOriginalKeys(value, keyMap);
  return Array.isArray(original) ? original.join(',') : original;
}

/**
 * Decode the stored text shape back to the value to compare against.
 *
 * Single answers stay a string. Multi, ordering, and matching produce a key
 * array, which is what `isAnswerCorrect` expects for those types.
 */
export function decodeAnswerForDb(text: string, type: QuestionType): string | string[] {
  if (type === 'single') {
    return text;
  }
  if (text === '') {
    return [];
  }
  return text.split(',');
}

function toOriginalKeys(
  value: string | readonly string[] | null | undefined,
  keyMap: OptionKeyMap,
): string | string[] {
  const toOriginal = (key: string): string => keyMap[key] ?? key;

  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value ? toOriginal(value) : '';
  }
  return value.map(toOriginal);
}
