/**
 * Component tests for the mock exam results and review screen (S8, S9).
 *
 * The repository and the session service are stubs, so no IndexedDB is
 * needed. The question bank is the real bundled CLF-C02 bank: the stored
 * answer text is produced with the real engine encoder, and the review cards
 * resolve the same real questions the stored rows point at, which exercises
 * the exact decode path the session service writes.
 */

import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router, type UrlTree } from '@angular/router';
import { signal, type WritableSignal } from '@angular/core';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { expectNoA11yViolations } from '../../../core/a11y/axe-scan';
import { loadAllQuestions } from '../../../core/content/question-loader';
import { questionType, type Question } from '../../../core/content/question-types';
import { correctAnswerFor, encodeAnswerForDb } from '../../../core/exam';
import { STUDY_REPOSITORY } from '../../../core/storage/repository-provider';
import type { StudyRepository } from '../../../core/storage/study-repository';
import type {
  AttemptRow,
  CertProgressRow,
  QuestionMasteryRow,
  QuestionResultRow,
  SessionRow,
} from '../../../core/storage/types';

import type { MockExamResult } from '../session/mock-exam-session.types';
import { MockExamSessionService } from '../session/mock-exam-session.service';
import { MockExamResultsPage } from './mock-exam-results.page';

/** In-memory repository with the two reads the results screen needs. */
class FakeRepository implements StudyRepository {
  readonly schemaVersion = 1;
  readonly attempts = new Map<string, AttemptRow>();
  readonly results = new Map<string, QuestionResultRow[]>();

  async open(): Promise<void> {
    return Promise.resolve();
  }
  async close(): Promise<void> {
    return Promise.resolve();
  }
  async commitAnswers(): Promise<void> {
    throw new Error('not used by the results screen');
  }
  async getAttempt(id: string): Promise<AttemptRow | null> {
    return this.attempts.get(id) ?? null;
  }
  async listAttempts(): Promise<AttemptRow[]> {
    return [...this.attempts.values()];
  }
  async listQuestionResults(attemptId: string): Promise<QuestionResultRow[]> {
    return this.results.get(attemptId) ?? [];
  }
  async listPracticeResults(): Promise<QuestionResultRow[]> {
    return [];
  }
  async listAllQuestionResults(): Promise<QuestionResultRow[]> {
    return [];
  }
  async getCertProgress(): Promise<CertProgressRow[]> {
    return [];
  }
  async getQuestionMastery(): Promise<QuestionMasteryRow[]> {
    return [];
  }
  async listAllCertProgress(): Promise<CertProgressRow[]> {
    return [];
  }
  async listAllQuestionMastery(): Promise<QuestionMasteryRow[]> {
    return [];
  }
  async getSession(): Promise<SessionRow | null> {
    return null;
  }
  async listSessions(): Promise<SessionRow[]> {
    return [];
  }
  async putSession(): Promise<void> {
    throw new Error('not used by the results screen');
  }
  async deleteSession(): Promise<void> {
    return Promise.resolve();
  }
  async resetCert(): Promise<void> {
    return Promise.resolve();
  }
  async resetAll(): Promise<void> {
    return Promise.resolve();
  }
  async replaceAll(): Promise<void> {
    return Promise.resolve();
  }
}

const PASS_ATTEMPT: AttemptRow = {
  id: 'clf-c02:mock:1000',
  cert: 'clf-c02',
  kind: 'mock',
  startedAt: 1000,
  finishedAt: 1000 + 3_123_000,
  totalQuestions: 65,
  correctCount: 44,
  scorePercent: 68,
  passed: true,
  timeTakenSeconds: 3123,
  domainScores: [
    { domainId: 1, correct: 12, total: 16, percent: 75 },
    { domainId: 2, correct: 14, total: 20, percent: 70 },
    { domainId: 3, correct: 13, total: 22, percent: 59 },
    { domainId: 4, correct: 5, total: 7, percent: 71 },
  ],
};

const FAIL_ATTEMPT: AttemptRow = {
  ...PASS_ATTEMPT,
  correctCount: 40,
  scorePercent: 62,
  passed: false,
  domainScores: [
    { domainId: 1, correct: 9, total: 16, percent: 56 },
    { domainId: 2, correct: 12, total: 20, percent: 60 },
    { domainId: 3, correct: 14, total: 22, percent: 64 },
    { domainId: 4, correct: 5, total: 7, percent: 71 },
  ],
};

let repository: FakeRepository;
let session: {
  result: WritableSignal<MockExamResult | null>;
  questions: WritableSignal<readonly Question[]>;
  submit: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
};
let bank: readonly Question[];

beforeAll(async () => {
  bank = await loadAllQuestions('clf-c02');
});

beforeEach(() => {
  repository = new FakeRepository();
  session = {
    result: signal<MockExamResult | null>(null),
    questions: signal<readonly Question[]>([]),
    submit: vi.fn(async () => PASS_ATTEMPT),
    start: vi.fn(async () => undefined),
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  TestBed.resetTestingModule();
  delete (navigator as { clipboard?: unknown }).clipboard;
});

function setResult(attempt: AttemptRow, committed: boolean): void {
  session.result.set({ attempt, isTooShort: false, committed });
}

async function createPage(): Promise<ComponentFixture<MockExamResultsPage>> {
  await TestBed.configureTestingModule({
    imports: [MockExamResultsPage],
    providers: [
      provideRouter([]),
      { provide: STUDY_REPOSITORY, useValue: repository },
      { provide: MockExamSessionService, useValue: session },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(MockExamResultsPage);
  await settle(fixture);
  return fixture;
}

/**
 * Run change detection, drain the async load, and render again. Two rounds
 * cover both the effect flush and the repository and bank promise chain.
 */
async function settle(fixture: ComponentFixture<MockExamResultsPage>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

function pick(type: 'single' | 'multi', domainId: number): Question {
  const question = bank.find(
    (candidate) => candidate.domainId === domainId && questionType(candidate) === type,
  );
  if (!question) {
    throw new Error(`no ${type} question in domain ${domainId}`);
  }
  return question;
}

function stored(question: Question, value: string | readonly string[] | null): string {
  return encodeAnswerForDb(value ?? null, {}, questionType(question));
}

function resultRow(question: Question, overrides: Partial<QuestionResultRow> = {}): QuestionResultRow {
  const correct = stored(question, correctAnswerFor(question));
  return {
    id: `${FAIL_ATTEMPT.id}:${question.id}`,
    attemptId: FAIL_ATTEMPT.id,
    cert: 'clf-c02',
    domainId: question.domainId,
    questionId: question.id,
    userAnswer: correct,
    correctAnswer: correct,
    isCorrect: true,
    wasFlagged: false,
    answeredAt: 2000,
    ...overrides,
  };
}

function wrongAnswer(question: Question): string {
  const correct = correctAnswerFor(question);
  if (typeof correct !== 'string') {
    throw new Error('expected a single correct answer');
  }
  const wrong = Object.keys(question.options).find((key) => key !== correct);
  if (!wrong) {
    throw new Error('no wrong key available');
  }
  return stored(question, wrong);
}

function cards(fixture: ComponentFixture<MockExamResultsPage>): HTMLElement[] {
  return [...fixture.nativeElement.querySelectorAll('.review-card')];
}

function buttonWithText(
  fixture: ComponentFixture<MockExamResultsPage>,
  selector: string,
  text: string,
): HTMLElement {
  const found = [...fixture.nativeElement.querySelectorAll(selector)].find(
    (el: Element) => el.textContent?.includes(text),
  );
  if (!found) {
    throw new Error(`no ${selector} element containing "${text}"`);
  }
  return found;
}

function chip(fixture: ComponentFixture<MockExamResultsPage>, label: string): HTMLElement {
  return buttonWithText(fixture, '.chip', label);
}

describe('MockExamResultsPage', () => {
  it('has no axe violations in either theme', async () => {
    setResult(PASS_ATTEMPT, true);
    const fixture = await createPage();
    const el = fixture.nativeElement as HTMLElement;

    await expectNoA11yViolations(el, 'light');
    await expectNoA11yViolations(el, 'dark');
  });

  it('renders the score facts and the per-domain breakdown (S8, EXAM-37, EXAM-38)', async () => {
    setResult(PASS_ATTEMPT, true);
    const fixture = await createPage();
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('You passed');
    expect(text).toContain('68%');
    expect(text).toContain('pass mark 67%');
    expect(text).toContain('68%');
    expect(text).toContain('44');
    expect(text).toContain('of 65 questions');
    expect(text).toContain('52:03');

    expect(text).toContain('Domain breakdown');
    expect(text).toContain('Cloud Concepts');
    expect(text).toContain('Security & Compliance');
    expect(text).toContain('Cloud Technology & Services');
    expect(text).toContain('Billing, Pricing & Support');
    expect(text).toContain('75% (12 of 16)');
    expect(text).toContain('59% (13 of 22)');

    const bars = fixture.nativeElement.querySelectorAll('[role="progressbar"]');
    expect(bars).toHaveLength(4);
    expect(bars[0].getAttribute('aria-valuenow')).toBe('75');
    expect(bars[0].getAttribute('aria-valuetext')).toContain('Cloud Concepts');
  });

  it('shows no result state without a session result or an attempt id', async () => {
    const fixture = await createPage();

    expect(fixture.nativeElement.textContent).toContain('No result to show');
  });

  it('loads a stored attempt when the route binds an attempt id', async () => {
    repository.attempts.set(PASS_ATTEMPT.id, PASS_ATTEMPT);
    const fixture = await createPage();

    fixture.componentRef.setInput('attemptId', PASS_ATTEMPT.id);
    await settle(fixture);

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('You passed');
    expect(text).toContain('68%');
  });

  it('narrows the review list with each filter (S9, EXAM-39, EXAM-40)', async () => {
    const single1 = pick('single', 1);
    const single2 = pick('single', 2);
    const multi1 = pick('multi', 1);
    const single3 = pick('single', 3);
    repository.results.set(FAIL_ATTEMPT.id, [
      resultRow(single1),
      resultRow(single2, { isCorrect: false, wasFlagged: true }),
      resultRow(multi1, { isCorrect: false }),
      resultRow(single3, { wasFlagged: true }),
    ]);
    setResult(FAIL_ATTEMPT, true);
    const fixture = await createPage();

    expect(cards(fixture)).toHaveLength(4);

    chip(fixture, 'Incorrect').click();
    fixture.detectChanges();
    expect(cards(fixture)).toHaveLength(2);

    chip(fixture, 'Flagged').click();
    fixture.detectChanges();
    expect(cards(fixture)).toHaveLength(2);

    chip(fixture, 'Cloud Concepts').click();
    fixture.detectChanges();
    expect(cards(fixture)).toHaveLength(2);
    expect(fixture.nativeElement.textContent).toContain(pick('single', 1).question);

    chip(fixture, 'All').click();
    fixture.detectChanges();
    expect(cards(fixture)).toHaveLength(4);
  });

  it('exposes the selected state of filter chips to assistive technology', async () => {
    repository.results.set(FAIL_ATTEMPT.id, [resultRow(pick('single', 1))]);
    setResult(FAIL_ATTEMPT, true);
    const fixture = await createPage();

    const incorrect = chip(fixture, 'Incorrect');
    expect(incorrect.getAttribute('aria-pressed')).toBe('false');

    incorrect.click();
    fixture.detectChanges();

    expect(incorrect.getAttribute('aria-pressed')).toBe('true');
    expect(chip(fixture, 'All').getAttribute('aria-pressed')).toBe('false');
  });

  it('shows the summary and the explanations for a wrong choice and the correct one (EXAM-41)', async () => {
    const question = pick('single', 1);
    const wrongKey = Object.keys(question.options).find(
      (key) => key !== correctAnswerFor(question),
    ) as string;
    const correctKey = correctAnswerFor(question) as string;
    const otherKey = Object.keys(question.options).find(
      (key) => key !== correctKey && key !== wrongKey,
    ) as string;

    repository.results.set(FAIL_ATTEMPT.id, [
      resultRow(question, {
        userAnswer: wrongAnswer(question),
        isCorrect: false,
        wasFlagged: true,
      }),
    ]);
    setResult(FAIL_ATTEMPT, true);
    const fixture = await createPage();
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Incorrect');
    expect(text).toContain('Flagged');
    expect(text).toContain('Your answer');
    expect(text).toContain(question.options[wrongKey]);
    expect(text).toContain('Correct answer');
    expect(text).toContain(question.options[correctKey]);

    expect(text).toContain(question.explanation.summary);
    expect(text).toContain(question.explanation.options[wrongKey]);
    expect(text).toContain(question.explanation.options[correctKey]);
    expect(text).not.toContain(question.explanation.options[otherKey]);
  });

  it('keeps an uncommitted result on screen with a retry that commits it (EXAM-35)', async () => {
    setResult(PASS_ATTEMPT, false);
    session.submit.mockImplementation(async () => {
      setResult(PASS_ATTEMPT, true);
      return PASS_ATTEMPT;
    });
    const fixture = await createPage();

    // The results stay on screen while the save has failed.
    expect(fixture.nativeElement.textContent).toContain('You passed');
    expect(fixture.nativeElement.textContent).toContain('Results not saved');
    expect(fixture.nativeElement.textContent).toContain(
      'Answer review appears here once the save succeeds',
    );
    expect(fixture.nativeElement.textContent).not.toContain(
      'Results saved on this device',
    );

    buttonWithText(fixture, 'ion-button', 'Retry save').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(session.submit).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).not.toContain('Results not saved');
    expect(fixture.nativeElement.textContent).toContain('Results saved on this device');
  });

  it('never claims success when a retry fails again (EXAM-35)', async () => {
    setResult(PASS_ATTEMPT, false);
    session.submit.mockRejectedValue(new Error('still failing'));
    const fixture = await createPage();

    buttonWithText(fixture, 'ion-button', 'Retry save').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Results not saved');
    expect(fixture.nativeElement.textContent).not.toContain(
      'Results saved on this device',
    );
  });

  it('offers Practice weakest domain on a failed result and navigates with the domain parameter (EXAM-44)', async () => {
    setResult(FAIL_ATTEMPT, true);
    const fixture = await createPage();
    const router = TestBed.inject(Router);
    const navigateByUrl = vi
      .spyOn(router, 'navigateByUrl')
      .mockResolvedValue(true);

    const action = buttonWithText(fixture, 'ion-button', 'Practice weakest domain');
    expect(action.textContent).toContain('Cloud Concepts');

    action.click();
    await fixture.whenStable();

    expect(navigateByUrl).toHaveBeenCalledTimes(1);
    const tree = navigateByUrl.mock.calls[0]?.[0] as UrlTree;
    expect(router.serializeUrl(tree)).toBe('/tabs/practice?domain=1');
  });

  it('does not offer Practice weakest domain on a passing result (EXAM-44)', async () => {
    setResult(PASS_ATTEMPT, true);
    const fixture = await createPage();

    expect(fixture.nativeElement.textContent).not.toContain('Practice weakest domain');
    buttonWithText(fixture, 'ion-button', 'Retake exam');
    buttonWithText(fixture, 'ion-button', 'Back to dashboard');
  });

  it('starts a fresh attempt with reset state on retake and navigates to the exam runner (EXAM-45)', async () => {
    setResult(PASS_ATTEMPT, true);
    const fixture = await createPage();
    const router = TestBed.inject(Router);
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    buttonWithText(fixture, 'ion-button', 'Retake exam').click();
    await fixture.whenStable();

    expect(session.start).toHaveBeenCalledWith('clf-c02');
    expect(navigateByUrl).toHaveBeenCalledWith('/mock-exam/clf-c02/run');
  });

  it('copies the question id to the clipboard from the report action (EXAM-42)', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const question = pick('single', 1);
    repository.results.set(FAIL_ATTEMPT.id, [resultRow(question)]);
    setResult(FAIL_ATTEMPT, true);
    const fixture = await createPage();

    buttonWithText(fixture, '.report-button', 'Report question').click();
    // The copy resolves in a microtask; whenStable would also wait out the
    // 2 s reset timer and miss the message.
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    expect(writeText).toHaveBeenCalledWith(question.id);
    expect(fixture.nativeElement.textContent).toContain(
      'Question id copied to the clipboard',
    );
  });

  it('shows a retryable error when the saved results cannot be read (ACC-45)', async () => {
    repository.attempts.set(PASS_ATTEMPT.id, PASS_ATTEMPT);
    repository.getAttempt = () => Promise.reject(new Error('unreadable'));    const fixture = await createPage();

    fixture.componentRef.setInput('attemptId', PASS_ATTEMPT.id);
    await settle(fixture);

    expect(fixture.nativeElement.textContent).toContain('Results unavailable');

    repository.getAttempt = (id: string) =>
      Promise.resolve(repository.attempts.get(id) ?? null);
    buttonWithText(fixture, 'ion-button', 'Try again').click();
    await settle(fixture);

    expect(fixture.nativeElement.textContent).toContain('You passed');
  });
});
