import { describe, expect, it } from 'vitest';

import aifDomain1 from '../content/banks/aif-c01/domain1.json';
import aifDomain2 from '../content/banks/aif-c01/domain2.json';
import { questionType, type Question } from '../content/question-types';
import { encodeAnswerForDb, matchesToTokens } from './answer-encoding';
import { correctAnswerFor, isAnswerCorrect } from './grading';
import { shuffleQuestionOptions } from './shuffle';

/**
 * Ported from
 * `ionic-requirements/cert-banks/reference/questionTypes.integration.test.ts`.
 *
 * Round-trips the real bundled AIF-C01 ordering and matching questions through
 * the whole pipeline: shuffle into display space, answer there, grade there,
 * encode back to original keys, and prove the stored string equals the bank's
 * own encoding. A unit test per function cannot catch a key-space bug that only
 * shows up when the two halves are composed.
 */

const AIF_DOMAIN_1 = 1;
const AIF_DOMAIN_2 = 2;

function stamp(raw: unknown, domainId: number): Question[] {
  return (raw as Question[]).map((question) => ({ ...question, domainId }));
}

function findQuestion(bank: Question[], id: string): Question {
  const question = bank.find((entry) => entry.id === id);
  if (!question) {
    throw new Error(`Fixture question ${id} is missing from the bundled AIF-C01 bank`);
  }
  return question;
}

const ordering = findQuestion(stamp(aifDomain1, AIF_DOMAIN_1), 'aif-q457');
const matching = findQuestion(stamp(aifDomain2, AIF_DOMAIN_2), 'aif-q460');

describe('ordering round-trip (real seed aif-q457)', () => {
  it('is well-formed seed data', () => {
    expect(questionType(ordering)).toBe('ordering');
    expect(ordering.correctOrder).toBeDefined();
    expect(ordering.answer).toBeUndefined();
  });

  it('grades a correct display-space answer and encodes to the original DB string', () => {
    const { question: shuffled, keyMap } = shuffleQuestionOptions(ordering);
    const type = questionType(shuffled);
    const userDisplay = [...(shuffled.correctOrder ?? [])];

    expect(isAnswerCorrect(userDisplay, correctAnswerFor(shuffled), type)).toBe(true);

    const encodedUser = encodeAnswerForDb(userDisplay, keyMap, type);
    const encodedCorrect = encodeAnswerForDb(correctAnswerFor(shuffled), keyMap, type);
    expect(encodedUser).toBe(encodedCorrect);
    expect(encodedUser).toBe((ordering.correctOrder ?? []).join(','));
  });

  it('grades a wrong order as incorrect (all-or-nothing)', () => {
    const { question: shuffled } = shuffleQuestionOptions(ordering);
    const wrong = [...(shuffled.correctOrder ?? [])];
    [wrong[0], wrong[1]] = [wrong[1], wrong[0]];

    expect(isAnswerCorrect(wrong, correctAnswerFor(shuffled), 'ordering')).toBe(false);
  });
});

describe('matching round-trip (real seed aif-q460)', () => {
  it('is well-formed seed data', () => {
    expect(questionType(matching)).toBe('matching');
    expect(matching.correctMatches).toBeDefined();
    expect(matching.targets).toBeDefined();
  });

  it('grades correct display-space matches and encodes to the original token string', () => {
    const { question: shuffled, keyMap } = shuffleQuestionOptions(matching);
    const type = questionType(shuffled);
    const userTokens = matchesToTokens(shuffled.correctMatches ?? {});

    expect(isAnswerCorrect(userTokens, correctAnswerFor(shuffled), type)).toBe(true);

    const encodedUser = encodeAnswerForDb(userTokens, keyMap, type);
    const encodedCorrect = encodeAnswerForDb(correctAnswerFor(shuffled), keyMap, type);
    expect(encodedUser).toBe(encodedCorrect);
    expect(encodedUser).toBe(matchesToTokens(matching.correctMatches ?? {}).join(','));
  });

  it('grades a wrong pairing as incorrect (all-or-nothing)', () => {
    const { question: shuffled } = shuffleQuestionOptions(matching);
    const matches = shuffled.correctMatches ?? {};
    const tokens = matchesToTokens(matches);
    const firstKey = Object.keys(matches).sort()[0];
    const wrongTarget = Object.keys(shuffled.targets ?? {}).find(
      (target) => target !== matches[firstKey],
    );
    const wrongTokens = tokens.map((token) =>
      token.startsWith(`${firstKey}:`) ? `${firstKey}:${wrongTarget}` : token,
    );

    expect(isAnswerCorrect(wrongTokens, correctAnswerFor(shuffled), 'matching')).toBe(false);
  });

  it('grades an incomplete matching as incorrect', () => {
    const { question: shuffled } = shuffleQuestionOptions(matching);
    const tokens = matchesToTokens(shuffled.correctMatches ?? {}).slice(0, -1);

    expect(isAnswerCorrect(tokens, correctAnswerFor(shuffled), 'matching')).toBe(false);
  });

  it('never shuffles the target column', () => {
    const { question: shuffled } = shuffleQuestionOptions(matching);
    expect(shuffled.targets).toEqual(matching.targets);
  });
});

describe('per-option explanations survive a shuffle on real data', () => {
  it('keeps every explanation attached to its own option text', () => {
    const { question: shuffled, keyMap } = shuffleQuestionOptions(matching);

    for (const [displayKey, originalKey] of Object.entries(keyMap)) {
      expect(shuffled.options[displayKey]).toBe(matching.options[originalKey]);
      expect(shuffled.explanation.options[displayKey]).toBe(
        matching.explanation.options[originalKey],
      );
    }
  });

  it('covers exactly the options that carried content', () => {
    const { question: shuffled } = shuffleQuestionOptions(ordering);
    const optionKeys = Object.keys(shuffled.options).sort();

    expect(Object.keys(shuffled.explanation.options).sort()).toEqual(optionKeys);
  });
});
