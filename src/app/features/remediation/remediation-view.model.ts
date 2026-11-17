/**
 * Read-only remediation list built from stored domain-practice results.
 *
 * One item per question, using the latest wrong practice answer. A question is
 * hidden while its latest wrong answer is older than its remediation dismissal,
 * and returns automatically after a newer wrong answer. Questions missing from
 * the current bank are skipped so stale ids never render.
 */

import type { Certification } from '../../core/content/cert-registry';
import { questionType, type Question } from '../../core/content/question-types';
import { decodeAnswerForDb } from '../../core/exam';
import { buildQuestionFeedback, type QuestionFeedback } from '../../core/exam-session/feedback';
import type { QuestionResultRow, RemediationDismissalRow } from '../../core/storage/types';

export interface RemediationItem {
  readonly result: QuestionResultRow;
  readonly question: Question;
  readonly answer: string | string[];
  readonly feedback: QuestionFeedback;
  readonly domainName: string;
}

export function buildRemediationItems(
  practiceResults: readonly QuestionResultRow[],
  dismissals: readonly RemediationDismissalRow[],
  bank: readonly Question[],
  cert: Certification | null,
): RemediationItem[] {
  const latestWrong = new Map<string, QuestionResultRow>();
  for (const row of practiceResults) {
    if (row.attemptId !== null || row.isCorrect) {
      continue;
    }
    const current = latestWrong.get(row.questionId);
    if (
      !current ||
      row.answeredAt > current.answeredAt ||
      (row.answeredAt === current.answeredAt && row.id > current.id)
    ) {
      latestWrong.set(row.questionId, row);
    }
  }

  const dismissedAt = new Map<string, number>();
  for (const row of dismissals) {
    const current = dismissedAt.get(row.questionId) ?? 0;
    if (row.dismissedAt > current) {
      dismissedAt.set(row.questionId, row.dismissedAt);
    }
  }

  const questions = new Map(bank.map((question) => [question.id, question]));
  const items: RemediationItem[] = [];
  for (const row of latestWrong.values()) {
    if (row.answeredAt <= (dismissedAt.get(row.questionId) ?? 0)) {
      continue;
    }
    const question = questions.get(row.questionId);
    if (!question) {
      continue;
    }
    const answer = decodeAnswerForDb(row.userAnswer, questionType(question));
    items.push({
      result: row,
      question,
      answer,
      feedback: buildQuestionFeedback(question, answer),
      domainName:
        cert?.domains.find((domain) => domain.id === row.domainId)?.name ?? `Domain ${row.domainId}`,
    });
  }

  return items.sort(
    (a, b) => b.result.answeredAt - a.result.answeredAt || a.question.id.localeCompare(b.question.id),
  );
}
