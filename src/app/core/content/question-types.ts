/**
 * Question schema.
 *
 * Mirrors CONT-2 to CONT-15 and the bundled bank format. `explanation` is an
 * object with a `summary` and a per-option map: the reference `types.ts` in
 * `ionic-requirements/cert-banks/reference/` still declares it as a plain
 * string, which is stale relative to the banks and to the requirements. The
 * banks are the source of truth here.
 */

export type OptionKey = 'A' | 'B' | 'C' | 'D' | 'E';
export type DomainId = number;
export type QuestionType = 'single' | 'multi' | 'ordering' | 'matching';

export interface QuestionExplanation {
  /** Rationale for the correct answer. */
  summary: string;
  /** One explanation per non-empty option key. */
  options: Record<string, string>;
}

/**
 * A question as it appears in the bundled JSON, before it is stamped with its
 * domain. Every field except `domainId` is present in the file.
 */
export interface RawQuestion {
  id: string;
  question: string;
  options: Record<string, string>;
  /**
   * A key for single and multi questions. Ordering and matching questions
   * carry an empty string here and use `correctOrder` or `correctMatches`.
   */
  answer: string | string[];
  explanation: QuestionExplanation;
  /** Short takeaway. Required for live banks, optional in fixtures. */
  note?: string;
  isMultiAnswer?: boolean;
  /** Optional. Inferred from `isMultiAnswer` when absent (CONT-14). */
  type?: QuestionType;
  correctOrder?: string[];
  targets?: Record<string, string>;
  correctMatches?: Record<string, string>;
  taskStatement?: string;
  lastVerified?: string;
  services?: string[];
}

/** A bundled question stamped with the domain it was loaded from. */
export interface Question extends Omit<RawQuestion, 'isMultiAnswer'> {
  domainId: DomainId;
  isMultiAnswer: boolean;
}

/**
 * Resolve the response format. `type` is optional for backward compatibility
 * and defaults to multi when `isMultiAnswer` is set, otherwise single
 * (CONT-14).
 */
export function questionType(question: Pick<RawQuestion, 'type' | 'isMultiAnswer'>): QuestionType {
  if (question.type) {
    return question.type;
  }
  return question.isMultiAnswer ? 'multi' : 'single';
}
