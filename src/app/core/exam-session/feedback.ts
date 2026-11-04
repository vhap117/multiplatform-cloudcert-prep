/**
 * Feedback builder for one graded question (issue 007, S6).
 *
 * Given the display-space question and the recorded display-space answer,
 * this produces the summary plus the per-option explanations that matter for
 * the student's answer, each tagged by kind so the UI can group them without
 * re-deriving anything (PRACT-13, PRACT-14):
 *
 * - `chosen-wrong`: the student selected it and it is not part of the correct
 *   response (for ordering and matching, placed or paired incorrectly);
 * - `missed-correct`: it is part of the correct response and the student did
 *   not select it (for ordering and matching, the content that belonged in a
 *   position or pairing the student got wrong);
 * - `correct-chosen`: the student selected it and it is correct; this is how
 *   a partial multi covers both sets at once.
 *
 * Entries are grouped by kind in that order so the panel renders the mistake
 * first. Selection formats compare sets; ordering compares positions;
 * matching compares pairings by left key.
 *
 * Pure: no Angular, no storage, no clock. The question and the value must
 * live in the same key space (the display space the student answered in),
 * because both the answer keys and the explanation option keys are remapped
 * by the option shuffle.
 */

import { questionType, type Question, type QuestionType } from '../content/question-types';
import { correctAnswerFor, isAnswerCorrect } from '../exam';

/** Why one option appears in the feedback panel. */
export type FeedbackEntryKind = 'chosen-wrong' | 'missed-correct' | 'correct-chosen';

/** One per-option explanation, tagged so the UI can group by kind. */
export interface FeedbackEntry {
  /** Option key in display space, matching the option labels on screen. */
  readonly key: string;
  /** The `explanation.options[key]` text for this option. */
  readonly text: string;
  readonly kind: FeedbackEntryKind;
}

/**
 * The read-only feedback for one graded question.
 *
 * `summary` is the question's `explanation.summary`, shown for every graded
 * question. `options` holds only the explanations that matter, grouped by
 * kind: for a fully correct answer every entry is `correct-chosen`; for an
 * incorrect one the `chosen-wrong` and `missed-correct` sets identify every
 * wrongly selected option and every correct option, and a partial selection
 * also carries `correct-chosen` entries.
 */
export interface QuestionFeedback {
  readonly questionId: string;
  readonly isCorrect: boolean;
  readonly summary: string;
  readonly options: readonly FeedbackEntry[];
}

/**
 * Build the feedback for one graded question. A null value is the graded
 * "no answer" case: every correct option is missed and nothing was chosen.
 */
export function buildQuestionFeedback(
  question: Question,
  value: string | string[] | null,
): QuestionFeedback {
  const type = questionType(question);
  const correct = correctAnswerFor(question);
  return {
    questionId: question.id,
    isCorrect: value !== null && isAnswerCorrect(value, correct, type),
    summary: question.explanation.summary,
    options: feedbackEntries(question, type, value, correct),
  };
}

function feedbackEntries(
  question: Question,
  type: QuestionType,
  value: string | string[] | null,
  correct: string | string[],
): FeedbackEntry[] {
  const chosenWrong: string[] = [];
  const missedCorrect: string[] = [];
  const correctChosen: string[] = [];

  if (type === 'ordering') {
    const chosen = Array.isArray(value) ? value : [];
    const correctSequence = Array.isArray(correct) ? correct : [];
    chosen.forEach((key, index) => {
      if (key === correctSequence[index]) {
        correctChosen.push(key);
      } else {
        chosenWrong.push(key);
      }
    });
    correctSequence.forEach((key, index) => {
      if (chosen[index] !== key) {
        missedCorrect.push(key);
      }
    });
  } else if (type === 'matching') {
    const userPairs = new Map(
      (Array.isArray(value) ? value : []).map((token) => token.split(':') as [string, string]),
    );
    for (const token of Array.isArray(correct) ? correct : []) {
      const [key, target] = token.split(':');
      if (userPairs.get(key) === target) {
        correctChosen.push(key);
      } else {
        chosenWrong.push(key);
        missedCorrect.push(key);
      }
    }
  } else {
    const chosen =
      type === 'single'
        ? typeof value === 'string' && value !== ''
          ? [value]
          : []
        : Array.isArray(value)
          ? [...value]
          : [];
    const correctKeys = Array.isArray(correct) ? correct : [correct];
    for (const key of chosen) {
      if (correctKeys.includes(key)) {
        correctChosen.push(key);
      } else {
        chosenWrong.push(key);
      }
    }
    for (const key of correctKeys) {
      if (!chosen.includes(key)) {
        missedCorrect.push(key);
      }
    }
  }

  const textFor = (key: string): string => question.explanation.options[key] ?? '';
  return [
    ...chosenWrong.map((key): FeedbackEntry => ({ key, text: textFor(key), kind: 'chosen-wrong' })),
    ...missedCorrect.map(
      (key): FeedbackEntry => ({ key, text: textFor(key), kind: 'missed-correct' }),
    ),
    ...correctChosen.map(
      (key): FeedbackEntry => ({ key, text: textFor(key), kind: 'correct-chosen' }),
    ),
  ];
}
