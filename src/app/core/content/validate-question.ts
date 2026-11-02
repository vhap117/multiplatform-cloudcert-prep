import type { Certification } from './certification-types';
import type { QuestionType } from './question-types';

/**
 * Content validator (CONT-16 to CONT-24).
 *
 * Pure functions: give them parsed JSON and a certification, get issues back.
 * They never read files, so the same rules run in the test suite (which
 * validates the real bundled banks) and can run in any future build step.
 *
 * Severity decides the gate. `error` fails the build. `warning` is reported for
 * a human to judge, and is reserved for rules that cannot be checked without
 * false positives.
 */

export type Severity = 'error' | 'warning';

export interface ValidationIssue {
  severity: Severity;
  code: string;
  message: string;
  questionId?: string;
}

const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E'] as const;
const VALID_TYPES: readonly QuestionType[] = ['single', 'multi', 'ordering', 'matching'];
const TARGET_KEYS = new Set(['1', '2', '3', '4', '5']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A period followed by a capital letter, but only when it follows a word of two
 * or more letters. That distinction keeps `.NET`, `Node.js`, and URLs
 * (`status.aws.amazon.com`) out of the report while still catching
 * "ends.Next". Calibrated against the 1,489 bundled questions, where the naive
 * version produced eight false positives.
 */
const MISSING_SPACE = /(?<=[A-Za-z]{2})\.(?=[A-Z])/;

const HTML_OR_MARKDOWN = [/<[a-zA-Z/][^>]*>/, /\*\*/, /__/, /\]\(/, /^#{1,6}\s/];

function issue(
  severity: Severity,
  code: string,
  message: string,
  questionId?: string,
): ValidationIssue {
  return questionId === undefined
    ? { severity, code, message }
    : { severity, code, message, questionId };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Every free-text field a question exposes, for the copy rules. */
function contentFields(raw: Record<string, unknown>): [string, string][] {
  const fields: [string, string][] = [];
  const push = (name: string, value: unknown): void => {
    if (typeof value === 'string' && value.length > 0) {
      fields.push([name, value]);
    }
  };

  push('question', raw['question']);
  push('note', raw['note']);

  const explanation = raw['explanation'];
  if (isObject(explanation)) {
    push('explanation.summary', explanation['summary']);
    const options = explanation['options'];
    if (isObject(options)) {
      for (const [key, value] of Object.entries(options)) {
        push(`explanation.options.${key}`, value);
      }
    }
  }

  const options = raw['options'];
  if (isObject(options)) {
    for (const [key, value] of Object.entries(options)) {
      push(`options.${key}`, value);
    }
  }

  const targets = raw['targets'];
  if (isObject(targets)) {
    for (const [key, value] of Object.entries(targets)) {
      push(`targets.${key}`, value);
    }
  }

  return fields;
}

function answerIsUnused(value: unknown): boolean {
  if (value === undefined || value === null || value === '') {
    return true;
  }
  return Array.isArray(value) && value.length === 0;
}

function nonEmptyOptionKeys(options: Record<string, unknown>): string[] {
  return OPTION_KEYS.filter((key) => nonEmptyString(options[key]));
}

function validateCopyRules(
  raw: Record<string, unknown>,
  id: string,
  domainId: number,
  where: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const [field, value] of contentFields(raw)) {
    // The entity alternatives are written as a group so this source file does
    // not itself contain the literal forbidden sequences that the dash lint
    // scans for.
    if (/[\u2013\u2014]|&(?:mdash|ndash);/i.test(value)) {
      issues.push(
        issue(
          'error',
          'forbidden-dash',
          `${where} ${field}: contains an em or en dash. Use ASCII punctuation (IONIC-14).`,
          id,
        ),
      );
    }

    if (/[<>]/.test(value) && HTML_OR_MARKDOWN.some((pattern) => pattern.test(value))) {
      issues.push(
        issue(
          'error',
          'html-in-content',
          `${where} ${field}: contains HTML or Markdown. Content is plain text (CONT-12).`,
          id,
        ),
      );
    }

    if (value !== value.trim()) {
      issues.push(
        issue(
          'error',
          'whitespace',
          `${where} ${field}: has leading or trailing whitespace (CONT-19).`,
          id,
        ),
      );
    }

    if (MISSING_SPACE.test(value)) {
      issues.push(
        issue(
          'warning',
          'missing-space-after-period',
          `${where} ${field}: a sentence period is followed by a capital letter with no space (CONT-19).`,
          id,
        ),
      );
    }
  }

  return issues;
}

function validateShape(
  raw: Record<string, unknown>,
  id: string,
  domainId: number,
  where: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!nonEmptyString(raw['question'])) {
    issues.push(issue('error', 'question-missing', `${where}: question text is empty`, id));
  }

  const options = raw['options'];
  if (!isObject(options)) {
    issues.push(issue('error', 'options-missing', `${where}: options are not an object`, id));
    return issues;
  }

  for (const [key, value] of Object.entries(options)) {
    if (!(OPTION_KEYS as readonly string[]).includes(key)) {
      issues.push(
        issue(
          'error',
          'option-key-invalid',
          `${where}: option key "${key}" is not one of A to E (CONT-4).`,
          id,
        ),
      );
    }
    if (typeof value !== 'string') {
      issues.push(
        issue('error', 'option-not-string', `${where}: option ${key} is not a string`, id),
      );
    }
  }

  const keys = nonEmptyOptionKeys(options);
  if (keys.length < 2) {
    issues.push(
      issue(
        'error',
        'options-too-few',
        `${where}: needs at least two non-empty options, found ${keys.length} (CONT-4).`,
        id,
      ),
    );
    return issues;
  }

  return issues;
}

function validateAnswer(
  raw: Record<string, unknown>,
  id: string,
  where: string,
  keys: string[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const declaredType = raw['type'];

  if (declaredType !== undefined && !VALID_TYPES.includes(declaredType as QuestionType)) {
    issues.push(
      issue(
        'error',
        'type-invalid',
        `${where}: type "${String(declaredType)}" is not single, multi, ordering, or matching (CONT-14).`,
        id,
      ),
    );
    return issues;
  }

  const type: QuestionType =
    (declaredType as QuestionType | undefined) ??
    (raw['isMultiAnswer'] === true ? 'multi' : 'single');

  const keySet = new Set(keys);

  if (type === 'single') {
    const answer = raw['answer'];
    if (typeof answer !== 'string' || !keySet.has(answer)) {
      issues.push(
        issue(
          'error',
          'answer-single-invalid',
          `${where}: single answer must be one of the option keys (CONT-5).`,
          id,
        ),
      );
    }
    return issues;
  }

  if (type === 'multi') {
    const answer = raw['answer'];
    const valid =
      Array.isArray(answer) &&
      answer.length >= 2 &&
      answer.every((key) => typeof key === 'string' && keySet.has(key)) &&
      new Set(answer).size === answer.length;
    if (!valid) {
      issues.push(
        issue(
          'error',
          'answer-multi-invalid',
          `${where}: multi answer must list two or more distinct option keys (CONT-6).`,
          id,
        ),
      );
    }
    return issues;
  }

  // `answer` is unused for these two types. CONT-7 and CONT-8 describe it as an
  // empty string, but the shipped bank omits the field entirely for all ten
  // ordering and matching questions. The rule's intent is "carries no meaning",
  // so absent, an empty string, and an empty array are all accepted, and any
  // non-empty value is rejected as a data error.
  if (!answerIsUnused(raw['answer'])) {
    issues.push(
      issue(
        'error',
        'answer-must-be-empty',
        `${where}: ${type} questions must not populate answer, which is unused for this type (CONT-7, CONT-8).`,
        id,
      ),
    );
  }

  if (type === 'ordering') {
    const order = raw['correctOrder'];
    const valid =
      Array.isArray(order) &&
      order.length === keys.length &&
      new Set(order).size === order.length &&
      order.every((key) => typeof key === 'string' && keySet.has(key));
    if (!valid) {
      issues.push(
        issue(
          'error',
          'ordering-not-permutation',
          `${where}: correctOrder must be a permutation of every non-empty option key (CONT-7).`,
          id,
        ),
      );
    }
    return issues;
  }

  const targets = raw['targets'];
  const matches = raw['correctMatches'];

  if (!isObject(targets) || Object.keys(targets).length === 0) {
    issues.push(
      issue(
        'error',
        'matching-targets-missing',
        `${where}: matching questions need a targets map (CONT-8).`,
        id,
      ),
    );
    return issues;
  }

  for (const key of Object.keys(targets)) {
    if (!TARGET_KEYS.has(key)) {
      issues.push(
        issue(
          'error',
          'matching-target-key-invalid',
          `${where}: target key "${key}" is not one of 1 to 5 (CONT-8).`,
          id,
        ),
      );
    }
  }

  if (!isObject(matches)) {
    issues.push(
      issue(
        'error',
        'matching-incomplete',
        `${where}: matching questions need a correctMatches map (CONT-8).`,
        id,
      ),
    );
    return issues;
  }

  for (const key of keys) {
    if (!(key in matches)) {
      issues.push(
        issue(
          'error',
          'matching-incomplete',
          `${where}: option ${key} has no entry in correctMatches (CONT-8).`,
          id,
        ),
      );
    }
  }

  for (const [key, target] of Object.entries(matches)) {
    if (!keySet.has(key)) {
      issues.push(
        issue(
          'error',
          'matching-option-unknown',
          `${where}: correctMatches references unknown option ${key} (CONT-8).`,
          id,
        ),
      );
    }
    if (typeof target !== 'string' || !TARGET_KEYS.has(target) || !(target in targets)) {
      issues.push(
        issue(
          'error',
          'matching-target-unknown',
          `${where}: correctMatches maps ${key} to an unknown target "${String(target)}" (CONT-8).`,
          id,
        ),
      );
    }
  }

  const values = Object.values(matches);
  if (new Set(values).size !== values.length) {
    issues.push(
      issue(
        'error',
        'matching-not-one-to-one',
        `${where}: correctMatches must pair each option with a distinct target (CONT-8).`,
        id,
      ),
    );
  }

  return issues;
}

function validateExplanation(
  raw: Record<string, unknown>,
  id: string,
  where: string,
  keys: string[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const explanation = raw['explanation'];

  if (!isObject(explanation)) {
    issues.push(
      issue(
        'error',
        'explanation-summary-missing',
        `${where}: explanation must be an object with summary and options (CONT-9).`,
        id,
      ),
    );
    return issues;
  }

  if (!nonEmptyString(explanation['summary'])) {
    issues.push(
      issue(
        'error',
        'explanation-summary-missing',
        `${where}: explanation.summary is empty (CONT-9).`,
        id,
      ),
    );
  }

  const perOption = explanation['options'];
  if (!isObject(perOption)) {
    issues.push(
      issue(
        'error',
        'explanation-coverage',
        `${where}: explanation.options is missing (CONT-9).`,
        id,
      ),
    );
    return issues;
  }

  for (const key of keys) {
    if (!nonEmptyString(perOption[key])) {
      issues.push(
        issue(
          'error',
          'explanation-coverage',
          `${where}: explanation.options is missing text for option ${key} (CONT-21).`,
          id,
        ),
      );
    }
  }

  for (const key of Object.keys(perOption)) {
    if (!keys.includes(key)) {
      issues.push(
        issue(
          'error',
          'explanation-coverage',
          `${where}: explanation.options describes "${key}", which is not a non-empty option (CONT-21).`,
          id,
        ),
      );
    }
  }

  return issues;
}

function validateMetadata(
  raw: Record<string, unknown>,
  id: string,
  domainId: number,
  cert: Certification,
  where: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const taskStatement = raw['taskStatement'];
  if (taskStatement !== undefined) {
    if (typeof taskStatement !== 'string') {
      issues.push(
        issue(
          'error',
          'task-statement-invalid',
          `${where}: taskStatement must be a string (CONT-15).`,
          id,
        ),
      );
    } else if (cert.taskStatements && cert.taskStatements.length > 0) {
      const declared = cert.taskStatements.find((task) => task.id === taskStatement);
      if (!declared) {
        issues.push(
          issue(
            'error',
            'task-statement-unknown',
            `${where}: taskStatement "${taskStatement}" is not declared for ${cert.code} (CONT-15).`,
            id,
          ),
        );
      } else if (declared.domainId !== domainId) {
        issues.push(
          issue(
            'error',
            'task-statement-domain-mismatch',
            `${where}: taskStatement "${taskStatement}" belongs to domain ${declared.domainId}, not ${domainId}.`,
            id,
          ),
        );
      }
    }
  }

  const lastVerified = raw['lastVerified'];
  if (lastVerified !== undefined && (typeof lastVerified !== 'string' || !ISO_DATE.test(lastVerified))) {
    issues.push(
      issue(
        'error',
        'last-verified-invalid',
        `${where}: lastVerified must be a YYYY-MM-DD date (CONT-15).`,
        id,
      ),
    );
  }

  const services = raw['services'];
  if (
    services !== undefined &&
    (!Array.isArray(services) || services.some((service) => typeof service !== 'string'))
  ) {
    issues.push(
      issue(
        'error',
        'services-invalid',
        `${where}: services must be an array of strings (CONT-15).`,
        id,
      ),
    );
  }

  return issues;
}

function validateOne(
  raw: unknown,
  cert: Certification,
  domainId: number,
  where: string,
): ValidationIssue[] {
  if (!isObject(raw)) {
    return [issue('error', 'question-not-object', `${where}: entry is not an object`)];
  }

  const id = typeof raw['id'] === 'string' ? raw['id'] : '';
  const labelled = id.length > 0 ? `${where} (${id})` : where;

  if (!nonEmptyString(raw['id'])) {
    return [issue('error', 'id-missing', `${where}: question id is missing or empty (CONT-2)`)];
  }

  const shape = validateShape(raw, id, domainId, labelled);
  if (shape.some((entry) => entry.code === 'options-missing' || entry.code === 'options-too-few')) {
    return [...shape, ...validateCopyRules(raw, id, domainId, labelled)];
  }

  const options = raw['options'] as Record<string, unknown>;
  const keys = nonEmptyOptionKeys(options);

  return [
    ...shape,
    ...validateAnswer(raw, id, labelled, keys),
    ...validateExplanation(raw, id, labelled, keys),
    ...validateMetadata(raw, id, domainId, cert, labelled),
    ...validateCopyRules(raw, id, domainId, labelled),
    ...(nonEmptyString(raw['note'])
      ? []
      : [
          issue(
            'error',
            'note-missing',
            `${labelled}: note is empty. Live banks require a study takeaway (CONT-11).`,
            id,
          ),
        ]),
  ];
}

/**
 * Validate one domain file. `domainId` comes from the file name because the
 * JSON does not store it.
 */
export function validateDomainQuestions(
  raw: unknown,
  cert: Certification,
  domainId: number,
): ValidationIssue[] {
  if (!Array.isArray(raw)) {
    return [
      issue(
        'error',
        'bank-not-array',
        `${cert.code} domain ${domainId}: expected an array of questions.`,
      ),
    ];
  }

  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();

  raw.forEach((entry, index) => {
    const where = `${cert.code} domain ${domainId} index ${index}`;
    const found = validateOne(entry, cert, domainId, where);
    issues.push(...found);

    if (isObject(entry) && nonEmptyString(entry['id'])) {
      const id = entry['id'];
      if (seen.has(id)) {
        issues.push(
          issue(
            'error',
            'id-duplicate',
            `${where} (${id}): duplicate question id inside domain ${domainId} (CONT-3).`,
            id,
          ),
        );
      }
      seen.add(id);
    }
  });

  // Prefix every message with the domain so a failure names the file.
  return issues;
}

/**
 * Validate every domain of one certification, including uniqueness across
 * domains (CONT-3).
 */
export function validateCertContent(
  cert: Certification,
  domains: ReadonlyMap<number, unknown>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Map<string, number>();

  for (const [domainId, raw] of domains) {
    issues.push(...validateDomainQuestions(raw, cert, domainId));

    if (!Array.isArray(raw)) {
      continue;
    }

    for (const entry of raw) {
      if (!isObject(entry) || !nonEmptyString(entry['id'])) {
        continue;
      }
      const id = entry['id'];
      const previous = seen.get(id);
      if (previous !== undefined && previous !== domainId) {
        issues.push(
          issue(
            'error',
            'id-duplicate',
            `${cert.code} domain ${domainId} (${id}): id already used in domain ${previous}. Question ids must be unique across the cert (CONT-3).`,
            id,
          ),
        );
      }
      seen.set(id, domainId);
    }
  }

  return issues;
}

/** Convenience for gates that only care about blocking problems. */
export function errorsOf(issues: readonly ValidationIssue[]): ValidationIssue[] {
  return issues.filter((entry) => entry.severity === 'error');
}
