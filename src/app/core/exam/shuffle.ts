/**
 * Option and question shuffling, with the key-space remap that keeps grading
 * honest (EXAM-3).
 *
 * Two key spaces exist at the same time once a question reaches the screen:
 *
 * - original keys, as they appear in the bundled bank, which is what gets
 *   persisted and what the history view renders from;
 * - display keys, the fixed labels `A` to `E` the student actually sees.
 *
 * Only the content behind a label moves, never the label itself, so every field
 * that is indexed by option key has to be translated. The reference port
 * remapped `answer`, `correctOrder`, and the left side of `correctMatches` but
 * forgot `explanation.options`, which made feedback explain whichever option
 * happened to sit on that key after the shuffle. It is remapped here too.
 */

import type { Question } from '../content/question-types';
import type { OptionKeyMap, RandomSource } from './exam-types';

/**
 * Fisher-Yates shuffle, non-mutating and unbiased.
 *
 * `random` is injectable so tests can pin a permutation; production callers
 * pass nothing and get `Math.random`.
 */
export function fisherYatesShuffle<T>(
  items: readonly T[],
  random: RandomSource = Math.random,
): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const swap = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = swap;
  }
  return shuffled;
}

/** True for an option slot that actually carries content. */
function hasContent(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * Shuffle a question's option content and remap every key-indexed field.
 *
 * Returns the shuffled question (in display space) plus `keyMap`, which maps a
 * display key back to the original bank key. Persist with `encodeAnswerForDb`
 * and `keyMap` so stored answers always live in the original key space.
 */
export function shuffleQuestionOptions(
  question: Question,
  random: RandomSource = Math.random,
): { question: Question; keyMap: OptionKeyMap } {
  // Only slots with content take part. A bank question omits unused keys
  // entirely, and older fixtures carry them as empty strings; either way an
  // empty slot must not end up in the middle of the displayed options.
  const contentKeys = Object.keys(question.options).filter((key) =>
    hasContent(question.options[key]),
  );

  const shuffledSlots = fisherYatesShuffle(
    contentKeys.map((key) => ({ key, value: question.options[key] })),
    random,
  );

  const options: Record<string, string> = { ...question.options };
  const displayToOriginal: OptionKeyMap = {};
  const originalToDisplay: OptionKeyMap = {};

  contentKeys.forEach((displayKey, index) => {
    const source = shuffledSlots[index];
    options[displayKey] = source.value;
    displayToOriginal[displayKey] = source.key;
    originalToDisplay[source.key] = displayKey;
  });

  const remap = (key: string): string => originalToDisplay[key] ?? key;

  const explanationOptions: Record<string, string> = {};
  for (const [originalKey, text] of Object.entries(question.explanation.options)) {
    explanationOptions[remap(originalKey)] = text;
  }

  const remappedAnswer =
    question.answer === undefined
      ? undefined
      : Array.isArray(question.answer)
        ? question.answer.map(remap)
        : remap(question.answer);

  const shuffled: Question = {
    ...question,
    options,
    explanation: {
      summary: question.explanation.summary,
      options: explanationOptions,
    },
    ...(remappedAnswer === undefined ? {} : { answer: remappedAnswer }),
  };

  // Ordering: the correct sequence is a list of option keys, so each one moves.
  if (question.correctOrder) {
    shuffled.correctOrder = question.correctOrder.map(remap);
  }

  // Matching: only the left option key moves. Targets are never shuffled, so
  // the right side of every pairing stays exactly as authored.
  if (question.correctMatches) {
    const remappedMatches: Record<string, string> = {};
    for (const [optionKey, targetKey] of Object.entries(question.correctMatches)) {
      remappedMatches[remap(optionKey)] = targetKey;
    }
    shuffled.correctMatches = remappedMatches;
  }

  return { question: shuffled, keyMap: displayToOriginal };
}

/**
 * Translate a display-space answer back to the original bank keys for storage.
 * Handles single answers and multi answers.
 */
export function toOriginalAnswer(
  answer: string | string[],
  keyMap: OptionKeyMap,
): string | string[] {
  const toOriginal = (key: string): string => keyMap[key] ?? key;

  if (Array.isArray(answer)) {
    return answer.map(toOriginal);
  }
  return answer ? toOriginal(answer) : '';
}

/** Shuffle a whole session and keep each question's key map for the save path. */
export function shuffleAndMapQuestions(
  questions: readonly Question[],
  random: RandomSource = Math.random,
): { questions: Question[]; keyMaps: Map<string, OptionKeyMap> } {
  const keyMaps = new Map<string, OptionKeyMap>();
  const shuffled = questions.map((question) => {
    const result = shuffleQuestionOptions(question, random);
    keyMaps.set(question.id, result.keyMap);
    return result.question;
  });
  return { questions: shuffled, keyMaps };
}
