/**
 * Adaptive practice selection (SR-18 to SR-26).
 *
 * This is the weighted sampling model the web app used, unchanged (SR-1): no
 * calendar, no due dates, no expanding interval. Selection happens once at
 * session start (SR-4) because the weights read here cannot change mid-session.
 *
 * The three pools:
 *
 * - unseen: no history row at all (SR-10);
 * - active: a numeric weight, so the question competes in the weighted draw;
 * - backfill: a null weight, meaning the question sits inside the exclusion
 *   window and is hidden from the active pool (SR-9, SR-16). It is only used
 *   when the other two pools cannot fill the session, oldest last-seen first
 *   (SR-23).
 *
 * Exam selection is a different algorithm and must not be used here (SR-3,
 * EXAM-ENGINE.md "Porting gotchas").
 */

import type { Question } from '../content/question-types';
import {
  LAST_WRONG_WEIGHT,
  LEARNING_WEIGHT_MAX,
  LEARNING_WEIGHT_MIN,
  MASTERED_WEIGHT,
  UNSEEN_QUOTA,
  UNSEEN_WEIGHT,
} from './exam-constants';
import type { PracticeMastery, RandomSource } from './exam-types';
import { fisherYatesShuffle } from './shuffle';

interface WeightedCandidate {
  question: Question;
  weight: number;
}

interface BackfillCandidate {
  question: Question;
  lastSeenAt: number;
}

/** The facts a weight band is derived from (SR-12 to SR-15). */
export interface MasteryState {
  mastered: boolean;
  lastWasWrong: boolean;
  correctStreak: number;
}

/**
 * The weight band for one question.
 *
 * An unseen question never reaches this function: it has no row, and it joins
 * the pool at `UNSEEN_WEIGHT` (SR-12). A question inside the exclusion window
 * is not here either, because its persisted weight is null (SR-16).
 *
 * The learning band is split by streak so progress inside it is visible: a
 * question never answered correctly since its last reset sits at the low end,
 * and one with an accumulated streak sits at the high end. That interpretation
 * is pinned by the tests because it is the only part of the band model the
 * reference derived inside SQL rather than in TypeScript.
 */
export function masteryWeight(state: MasteryState): number {
  if (state.lastWasWrong) {
    return LAST_WRONG_WEIGHT;
  }
  if (state.mastered) {
    return MASTERED_WEIGHT;
  }
  return state.correctStreak > 0 ? LEARNING_WEIGHT_MAX : LEARNING_WEIGHT_MIN;
}

/**
 * Draw `count` candidates without replacement, proportional to their weight.
 *
 * A zero total weight is a degenerate input, not an impossible one: a row can
 * carry weight 0. The reference implementation would spin forever in that case
 * because the subtraction never crosses zero and nothing is removed from the
 * pool, so this version always removes exactly one candidate per pass.
 */
function weightedDraw(
  pool: readonly WeightedCandidate[],
  count: number,
  random: RandomSource,
): Question[] {
  const remaining = [...pool];
  const selected: Question[] = [];

  while (selected.length < count && remaining.length > 0) {
    const totalWeight = remaining.reduce((sum, item) => sum + Math.max(0, item.weight), 0);

    if (totalWeight <= 0) {
      const fallback = remaining.pop();
      if (fallback) {
        selected.push(fallback.question);
      }
      continue;
    }

    let target = random() * totalWeight;
    let picked = remaining.length - 1;
    for (let index = 0; index < remaining.length; index++) {
      target -= Math.max(0, remaining[index].weight);
      if (target <= 0) {
        picked = index;
        break;
      }
    }

    selected.push(remaining[picked].question);
    remaining.splice(picked, 1);
  }

  return selected;
}

/**
 * Choose the questions for one practice session.
 *
 * Pure over the domain bank and the mastery rows (SR-25): it reads no storage,
 * no clock, and no framework. `random` is injectable so tests can pin a
 * session.
 */
export function selectPracticeQuestions(
  bank: readonly Question[],
  count: number,
  masteryMap: ReadonlyMap<string, PracticeMastery>,
  random: RandomSource = Math.random,
): Question[] {
  const unseenPool: Question[] = [];
  const activePool: WeightedCandidate[] = [];
  const backfillPool: BackfillCandidate[] = [];

  for (const question of bank) {
    const row = masteryMap.get(question.id);

    if (!row) {
      unseenPool.push(question);
      continue;
    }
    if (row.weight === null) {
      backfillPool.push({ question, lastSeenAt: row.lastSeenAt });
      continue;
    }
    activePool.push({ question, weight: row.weight });
  }

  const unseenQuota = Math.min(Math.ceil(count * UNSEEN_QUOTA), unseenPool.length);
  const guaranteedUnseen = fisherYatesShuffle(unseenPool, random).slice(0, unseenQuota);
  const guaranteedIds = new Set(guaranteedUnseen.map((question) => question.id));

  // Leftover unseen questions still compete, at the baseline weight (SR-20).
  for (const question of unseenPool) {
    if (!guaranteedIds.has(question.id)) {
      activePool.push({ question, weight: UNSEEN_WEIGHT });
    }
  }

  const remainingSlots = count - guaranteedUnseen.length;
  let selected = [
    ...guaranteedUnseen,
    ...weightedDraw(activePool, remainingSlots, random),
  ];

  if (selected.length < count) {
    const needed = count - selected.length;
    const oldestFirst = [...backfillPool].sort((a, b) => a.lastSeenAt - b.lastSeenAt);
    selected = [...selected, ...oldestFirst.slice(0, needed).map((entry) => entry.question)];
  }

  // The final shuffle keeps guaranteed and backfilled questions from clustering
  // at the start or the end of the session (SR-24).
  return fisherYatesShuffle(selected, random);
}
