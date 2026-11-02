import { describe, expect, it } from 'vitest';

import type { Certification } from './cert-registry';
import {
  type ValidationIssue,
  validateCertContent,
  validateDomainQuestions,
} from './validate-question';

const CERT: Certification = {
  code: 'test-01',
  provider: 'aws',
  level: 'foundational',
  name: 'Test Certification',
  shortName: 'TEST-01',
  examQuestionCount: 10,
  examTimeSeconds: 600,
  passingScore: 700,
  status: 'active',
  domains: [
    { id: 1, name: 'Domain One', questionCount: 3, examProportion: 0.5 },
    { id: 2, name: 'Domain Two', questionCount: 2, examProportion: 0.5 },
  ],
  taskStatements: [
    { id: '1.1', domainId: 1, name: 'First task' },
    { id: '2.1', domainId: 2, name: 'Second task' },
  ],
};

function single(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'q1',
    question: 'Which service stores objects?',
    options: { A: 'Amazon S3', B: 'Amazon EC2' },
    answer: 'A',
    explanation: {
      summary: 'Amazon S3 stores objects.',
      options: {
        A: 'Correct answer. S3 is object storage.',
        B: 'EC2 provides compute, not object storage.',
      },
    },
    note: 'S3 is the object storage service.',
    isMultiAnswer: false,
    ...overrides,
  };
}

function codes(issues: ValidationIssue[]): string[] {
  return issues.map((issue) => issue.code);
}

function errors(issues: ValidationIssue[]): ValidationIssue[] {
  return issues.filter((issue) => issue.severity === 'error');
}

function warn(issues: ValidationIssue[]): ValidationIssue[] {
  return issues.filter((issue) => issue.severity === 'warning');
}

describe('validateDomainQuestions', () => {
  it('accepts a well formed single-answer question', () => {
    expect(errors(validateDomainQuestions([single()], CERT, 1))).toEqual([]);
  });

  it('rejects a payload that is not an array', () => {
    expect(codes(errors(validateDomainQuestions({}, CERT, 1)))).toContain(
      'bank-not-array',
    );
  });

  it('requires a non-empty id', () => {
    expect(codes(errors(validateDomainQuestions([single({ id: '' })], CERT, 1)))).toContain(
      'id-missing',
    );
  });

  it('rejects duplicate ids inside a domain', () => {
    const issues = validateDomainQuestions([single(), single()], CERT, 1);
    expect(codes(errors(issues))).toContain('id-duplicate');
  });

  it('requires at least two options', () => {
    const issues = validateDomainQuestions(
      [single({ options: { A: 'only' }, answer: 'A', explanation: {
        summary: 'x', options: { A: 'y' },
      } })],
      CERT,
      1,
    );
    expect(codes(errors(issues))).toContain('options-too-few');
  });

  it('rejects option keys outside A to E', () => {
    const issues = validateDomainQuestions(
      [single({ options: { A: 'a', B: 'b', F: 'f' } })],
      CERT,
      1,
    );
    expect(codes(errors(issues))).toContain('option-key-invalid');
  });

  it('rejects a single answer that is not a known option key', () => {
    expect(
      codes(errors(validateDomainQuestions([single({ answer: 'C' })], CERT, 1))),
    ).toContain('answer-single-invalid');
  });

  it('requires a multi answer to list two or more valid keys', () => {
    const one = single({
      isMultiAnswer: true,
      answer: ['A'],
      options: { A: 'a', B: 'b' },
    });
    expect(codes(errors(validateDomainQuestions([one], CERT, 1)))).toContain(
      'answer-multi-invalid',
    );
  });

  it('accepts a valid multi answer regardless of key order', () => {
    const multi = single({
      isMultiAnswer: true,
      answer: ['B', 'A'],
      options: { A: 'a', B: 'b' },
      explanation: { summary: 's', options: { A: 'x', B: 'y' } },
    });
    expect(errors(validateDomainQuestions([multi], CERT, 1))).toEqual([]);
  });

  it('rejects an ordering question whose correctOrder is not a permutation', () => {
    const ordering = single({
      type: 'ordering',
      answer: '',
      options: { A: 'a', B: 'b', C: 'c' },
      correctOrder: ['A', 'B'],
      explanation: { summary: 's', options: { A: 'x', B: 'y', C: 'z' } },
    });
    expect(codes(errors(validateDomainQuestions([ordering], CERT, 1)))).toContain(
      'ordering-not-permutation',
    );
  });

  it('accepts a valid ordering question', () => {
    const ordering = single({
      type: 'ordering',
      answer: '',
      options: { A: 'a', B: 'b' },
      correctOrder: ['B', 'A'],
      explanation: { summary: 's', options: { A: 'x', B: 'y' } },
    });
    expect(errors(validateDomainQuestions([ordering], CERT, 1))).toEqual([]);
  });

  it('accepts an ordering question that omits the unused answer field', () => {
    const ordering = single({
      type: 'ordering',
      options: { A: 'a', B: 'b' },
      correctOrder: ['B', 'A'],
      explanation: { summary: 's', options: { A: 'x', B: 'y' } },
    });
    delete ordering['answer'];
    expect(errors(validateDomainQuestions([ordering], CERT, 1))).toEqual([]);
  });

  it('rejects an ordering question that populates the unused answer field', () => {
    const ordering = single({
      type: 'ordering',
      answer: 'A',
      options: { A: 'a', B: 'b' },
      correctOrder: ['B', 'A'],
      explanation: { summary: 's', options: { A: 'x', B: 'y' } },
    });
    expect(codes(errors(validateDomainQuestions([ordering], CERT, 1)))).toContain(
      'answer-must-be-empty',
    );
  });

  it('rejects a matching question that does not map every option', () => {
    const matching = single({
      type: 'matching',
      answer: '',
      options: { A: 'a', B: 'b' },
      targets: { 1: 't1', 2: 't2' },
      correctMatches: { A: '1' },
      explanation: { summary: 's', options: { A: 'x', B: 'y' } },
    });
    expect(codes(errors(validateDomainQuestions([matching], CERT, 1)))).toContain(
      'matching-incomplete',
    );
  });

  it('rejects a matching question whose target is unknown', () => {
    const matching = single({
      type: 'matching',
      answer: '',
      options: { A: 'a', B: 'b' },
      targets: { 1: 't1', 2: 't2' },
      correctMatches: { A: '1', B: '9' },
      explanation: { summary: 's', options: { A: 'x', B: 'y' } },
    });
    expect(codes(errors(validateDomainQuestions([matching], CERT, 1)))).toContain(
      'matching-target-unknown',
    );
  });

  it('requires an explanation summary', () => {
    const issues = validateDomainQuestions(
      [single({ explanation: { options: { A: 'x', B: 'y' } } })],
      CERT,
      1,
    );
    expect(codes(errors(issues))).toContain('explanation-summary-missing');
  });

  it('requires one explanation per option key and no extras', () => {
    const issues = validateDomainQuestions(
      [single({ explanation: { summary: 's', options: { A: 'x' } } })],
      CERT,
      1,
    );
    expect(codes(errors(issues))).toContain('explanation-coverage');
  });

  it('requires a note for a live bank', () => {
    const issues = validateDomainQuestions([single({ note: '' })], CERT, 1);
    expect(codes(errors(issues))).toContain('note-missing');
  });

  it('infers the type from isMultiAnswer when type is absent', () => {
    const multi = single({
      isMultiAnswer: true,
      answer: ['A', 'B'],
      options: { A: 'a', B: 'b' },
      explanation: { summary: 's', options: { A: 'x', B: 'y' } },
    });
    expect(errors(validateDomainQuestions([multi], CERT, 1))).toEqual([]);
    expect(multi['type']).toBeUndefined();
  });

  it('rejects an unknown type', () => {
    expect(
      codes(errors(validateDomainQuestions([single({ type: 'essay' })], CERT, 1))),
    ).toContain('type-invalid');
  });

  it('rejects an em dash anywhere in content', () => {
    const issues = validateDomainQuestions(
      [single({ question: 'Which service \u2014 exactly \u2014 stores objects?' })],
      CERT,
      1,
    );
    expect(codes(errors(issues))).toContain('forbidden-dash');
  });

  it('rejects an en dash anywhere in content', () => {
    const issues = validateDomainQuestions(
      [single({ note: 'Storage \u2013 not compute.' })],
      CERT,
      1,
    );
    expect(codes(errors(issues))).toContain('forbidden-dash');
  });

  it('warns, but does not fail, on a missing space after a sentence period', () => {
    const issues = validateDomainQuestions(
      [single({ question: 'The exam ends.Next question starts here.' })],
      CERT,
      1,
    );
    expect(codes(warn(issues))).toContain('missing-space-after-period');
    expect(errors(issues)).toEqual([]);
  });

  it('does not warn about technology names that contain a period', () => {
    const issues = validateDomainQuestions(
      [single({ question: 'Which runtime runs .NET and Node.js workloads?' })],
      CERT,
      1,
    );
    expect(codes(warn(issues))).not.toContain('missing-space-after-period');
  });

  it('rejects leading or trailing whitespace in content', () => {
    expect(
      codes(errors(validateDomainQuestions([single({ question: ' padded ' })], CERT, 1))),
    ).toContain('whitespace');
  });

  it('rejects HTML in content', () => {
    expect(
      codes(
        errors(validateDomainQuestions([single({ question: 'Read <b>this</b>' })], CERT, 1)),
      ),
    ).toContain('html-in-content');
  });

  it('rejects a taskStatement that belongs to another domain', () => {
    const issues = validateDomainQuestions([single({ taskStatement: '2.1' })], CERT, 1);
    expect(codes(errors(issues))).toContain('task-statement-domain-mismatch');
  });

  it('rejects a taskStatement the cert does not declare', () => {
    const issues = validateDomainQuestions([single({ taskStatement: '9.9' })], CERT, 1);
    expect(codes(errors(issues))).toContain('task-statement-unknown');
  });

  it('rejects a malformed lastVerified date', () => {
    const issues = validateDomainQuestions(
      [single({ lastVerified: '15/06/2026' })],
      CERT,
      1,
    );
    expect(codes(errors(issues))).toContain('last-verified-invalid');
  });

  it('accepts an ISO lastVerified date', () => {
    expect(
      errors(validateDomainQuestions([single({ lastVerified: '2026-06-15' })], CERT, 1)),
    ).toEqual([]);
  });
});

describe('validateCertContent', () => {
  it('rejects an id duplicated across two domains of the same cert', () => {
    const issues = validateCertContent(
      CERT,
      new Map<number, unknown>([
        [1, [single({ id: 'dup' })]],
        [2, [single({ id: 'dup', taskStatement: '2.1' })]],
      ]),
    );
    expect(codes(errors(issues))).toContain('id-duplicate');
  });

  it('reports the domain in the message so the file is findable', () => {
    const issues = validateCertContent(
      CERT,
      new Map<number, unknown>([[1, [single({ id: '' })]]]),
    );
    expect(errors(issues)[0].message).toContain('domain 1');
  });

  it('passes clean content for every domain', () => {
    const issues = validateCertContent(
      CERT,
      new Map<number, unknown>([
        [1, [single({ id: 'a' })]],
        [2, [single({ id: 'b', taskStatement: '2.1' })]],
      ]),
    );
    expect(errors(issues)).toEqual([]);
  });
});
