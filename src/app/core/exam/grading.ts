/**
 * All-or-nothing grading for the four response formats (EXAM-8, EXAM-9,
 * EXAM-10).
 *
 * AWS grades these formats with no partial credit, which is why the persisted
 * model is a single `isCorrect` boolean that the scaled score and domain
 * mastery both derive from. Each type compares differently:
 *
 * - single: strict key equality
 * - multi: set equality, order independent
 * - matching: set equality over `K:T` tokens, order independent
 * - ordering: positional equality, order dependent
 */

import { questionType, type Question, type QuestionType } from '../content/question-types';
import { matchesToTokens } from './answer-encoding';

/**
 * The value a user answer is compared against, in whichever key space the
 * question currently lives in: original keys, or display keys after
 * `shuffleQuestionOptions`. Pair it with `questionType(question)`.
 */
export function correctAnswerFor(question: Question): string | string[] {
  switch (questionType(question)) {
    case 'ordering':
      return question.correctOrder ?? [];
    case 'matching':
      return matchesToTokens(question.correctMatches ?? {});
    default:
      return question.answer ?? '';
  }
}

/**
 * Grade one answer.
 *
 * The third argument accepts a `boolean` (the legacy `isMultiAnswer` flag, kept
 * so single and multi call sites read naturally) or an explicit
 * `QuestionType`. Value shapes must match: a string compared against an array
 * is incorrect for every type rather than coerced.
 */
export function isAnswerCorrect(
  userAnswer: string | readonly string[],
  correctAnswer: string | readonly string[],
  typeOrMultiAnswer: boolean | QuestionType,
): boolean {
  const type: QuestionType =
    typeof typeOrMultiAnswer === 'boolean'
      ? (typeOrMultiAnswer ? 'multi' : 'single')
      : typeOrMultiAnswer;

  if (type === 'ordering') {
    // Order dependent: same elements in the same positions.
    if (!Array.isArray(userAnswer) || !Array.isArray(correctAnswer)) {
      return false;
    }
    if (userAnswer.length !== correctAnswer.length) {
      return false;
    }
    return userAnswer.every((answer, index) => answer === correctAnswer[index]);
  }

  if (type === 'multi' || type === 'matching') {
    // Set equality. A matching token binds a left key to a right key, so the
    // order of the tokens carries no meaning, exactly like a multi selection.
    if (!Array.isArray(userAnswer) || !Array.isArray(correctAnswer)) {
      return false;
    }
    if (userAnswer.length !== correctAnswer.length) {
      return false;
    }
    const sortedUser = [...userAnswer].sort();
    const sortedCorrect = [...correctAnswer].sort();
    return sortedUser.every((answer, index) => answer === sortedCorrect[index]);
  }

  return userAnswer === correctAnswer;
}
