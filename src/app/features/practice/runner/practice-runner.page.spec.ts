/**
 * Practice runner specs (issue 007: PRACT-9 to PRACT-23, PRACT-27 to PRACT-33).
 *
 * The session service is stubbed in memory, so no IndexedDB is involved. The
 * stub mirrors the real contract: singles grade inside `answer`, the other
 * formats grade only through `submitAnswer`, and counts derive from graded
 * questions.
 */

import { computed, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, provideRouter } from '@angular/router';
import { AlertController, provideIonicAngular } from '@ionic/angular';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { expectNoA11yViolations } from '../../../core/a11y/axe-scan';
import { questionType, type Question } from '../../../core/content/question-types';
import { correctAnswerFor, isAnswerCorrect } from '../../../core/exam';
import type { AttemptRow } from '../../../core/storage/types';
import { PracticeSessionService } from '../session/practice-session.service';
import type { PracticeSubmitResult } from '../session/practice-session.types';

import { practiceLeaveGuard } from './practice-leave.guard';
import { PracticeRunnerPage } from './practice-runner.page';

const OPTIONS = { A: 'Alpha', B: 'Beta', C: 'Gamma', D: 'Delta' };
const ORDER_OPTIONS = { A: 'First step', B: 'Second step', C: 'Third step', D: 'Fourth step' };
const MATCH_OPTIONS = { A: 'Left one', B: 'Left two', C: 'Left three', D: 'Left four' };
const MATCH_TARGETS = { 1: 'Right one', 2: 'Right two', 3: 'Right three', 4: 'Right four' };

function explanation(options: Record<string, string>): Question['explanation'] {
  const perOption: Record<string, string> = {};
  for (const key of Object.keys(options)) {
    perOption[key] = `Note on ${key}.`;
  }
  return { summary: 'Summary.', options: perOption };
}

const BANK: Question[] = [
  {
    id: 'q-single',
    domainId: 1,
    isMultiAnswer: false,
    question: 'Pick one.',
    options: { ...OPTIONS },
    answer: 'B',
    explanation: explanation(OPTIONS),
  },
  {
    id: 'q-multi',
    domainId: 1,
    isMultiAnswer: true,
    question: 'Pick two.',
    options: { ...OPTIONS },
    answer: ['A', 'C'],
    explanation: explanation(OPTIONS),
  },
  {
    id: 'q-order',
    domainId: 2,
    isMultiAnswer: false,
    type: 'ordering',
    question: 'Order the steps.',
    options: { ...ORDER_OPTIONS },
    correctOrder: ['B', 'A', 'D', 'C'],
    explanation: explanation(ORDER_OPTIONS),
  },
  {
    id: 'q-match',
    domainId: 2,
    isMultiAnswer: false,
    type: 'matching',
    question: 'Match the pairs.',
    options: { ...MATCH_OPTIONS },
    targets: { ...MATCH_TARGETS },
    correctMatches: { A: '2', B: '1', C: '4', D: '3' },
    explanation: explanation(MATCH_OPTIONS),
  },
];

function makeAttempt(): AttemptRow {
  return {
    id: 'clf-c02:practice:1000',
    cert: 'clf-c02',
    kind: 'practice',
    startedAt: 1000,
    finishedAt: 61000,
    totalQuestions: 4,
    correctCount: 2,
    scorePercent: 50,
    passed: false,
    timeTakenSeconds: 60,
    domainScores: [],
  };
}

class StubSessionService {
  readonly active = signal(true);
  readonly isActive = computed(() => this.active());
  readonly questions = signal<readonly Question[]>(BANK);
  readonly totalQuestions = computed(() => this.questions().length);
  readonly currentIndex = signal(0);
  readonly currentQuestion = computed(() => this.questions()[this.currentIndex()] ?? null);

  readonly gradedIds = signal<readonly string[]>([]);
  readonly stored = new Map<string, string | string[]>();

  readonly answeredCount = computed(() => this.gradedIds().length);
  readonly correctCount = computed(
    () =>
      this.questions().filter(
        (question) => this.gradedIds().includes(question.id) && this.gradeStored(question),
      ).length,
  );
  readonly wrongCount = computed(() => this.answeredCount() - this.correctCount());
  readonly answeredPercent = computed(() =>
    this.totalQuestions() === 0
      ? 0
      : Math.round((this.answeredCount() / this.totalQuestions()) * 100),
  );

  readonly hasInProgress = vi.fn<(certCode: string) => Promise<boolean>>(() =>
    Promise.resolve(false),
  );
  readonly resume = vi.fn<(certCode: string) => Promise<boolean>>(() => Promise.resolve(true));
  readonly discard = vi.fn<() => Promise<void>>(() => Promise.resolve());
  readonly start = vi.fn<() => Promise<void>>(() => Promise.resolve());

  readonly answer = vi.fn<(id: string, value: string | readonly string[]) => Promise<void>>(
    (id, value) => {
      const question = this.questions().find((candidate) => candidate.id === id);
      const next = typeof value === 'string' ? value : [...value];
      if (next === '' || (Array.isArray(next) && next.length === 0)) {
        this.stored.delete(id);
      } else {
        this.stored.set(id, next);
      }
      if (question && questionType(question) === 'single' && typeof next === 'string' && next !== '') {
        this.markGraded(id);
      }
      return Promise.resolve();
    },
  );

  readonly submitAnswer = vi.fn<(id: string) => Promise<PracticeSubmitResult>>((id) => {
    this.markGraded(id);
    return Promise.resolve('graded');
  });

  readonly goTo = vi.fn<(index: number) => Promise<void>>((index) => {
    this.currentIndex.set(index);
    return Promise.resolve();
  });

  readonly complete = vi.fn<() => Promise<{ attempt: AttemptRow; domainScores: [] }>>(() => {
    this.active.set(false);
    return Promise.resolve({ attempt: makeAttempt(), domainScores: [] });
  });

  answerFor(id: string): string | string[] | null {
    return this.stored.get(id) ?? null;
  }

  isGraded(id: string): boolean {
    return this.gradedIds().includes(id);
  }

  isCorrect(id: string): boolean | null {
    const question = this.questions().find((candidate) => candidate.id === id);
    if (!question || !this.gradedIds().includes(id)) {
      return null;
    }
    return this.gradeStored(question);
  }

  feedbackFor(id: string) {
    const question = this.questions().find((candidate) => candidate.id === id);
    if (!question || !this.gradedIds().includes(id)) {
      return null;
    }
    const type = questionType(question);
    const value = this.stored.get(id) ?? null;
    const correct = correctAnswerFor(question);
    const isCorrect = value !== null && isAnswerCorrect(value, correct, type);
    const chosen =
      type === 'single'
        ? typeof value === 'string' && value !== ''
          ? [value]
          : []
        : Array.isArray(value)
          ? [...value]
          : [];
    const correctKeys = Array.isArray(correct) ? correct : [correct];
    const textFor = (key: string): string => question.explanation.options[key] ?? '';
    return {
      questionId: id,
      isCorrect,
      summary: question.explanation.summary,
      options: [
        ...chosen
          .filter((key) => !correctKeys.includes(key))
          .map((key) => ({ key, text: textFor(key), kind: 'chosen-wrong' as const })),
        ...correctKeys
          .filter((key) => !chosen.includes(key))
          .map((key) => ({ key, text: textFor(key), kind: 'missed-correct' as const })),
        ...chosen
          .filter((key) => correctKeys.includes(key))
          .map((key) => ({ key, text: textFor(key), kind: 'correct-chosen' as const })),
      ],
    };
  }

  private markGraded(id: string): void {
    if (!this.gradedIds().includes(id)) {
      this.gradedIds.set([...this.gradedIds(), id].sort());
    }
  }

  private gradeStored(question: Question): boolean {
    const value = this.stored.get(question.id) ?? null;
    return (
      value !== null && isAnswerCorrect(value, correctAnswerFor(question), questionType(question))
    );
  }
}

interface CapturedAlert {
  header?: string;
  message?: string;
  buttons?: unknown[];
}

let stub: StubSessionService;
let createdAlerts: CapturedAlert[];
let dismissRole: string;

const alertControllerStub = {
  create(options: CapturedAlert): Promise<{
    present: () => Promise<void>;
    onDidDismiss: () => Promise<{ role: string }>;
  }> {
    createdAlerts.push(options);
    return Promise.resolve({
      present: () => Promise.resolve(),
      onDidDismiss: () => Promise.resolve({ role: dismissRole }),
    });
  },
};

async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
}

async function render(): Promise<{
  fixture: ComponentFixture<PracticeRunnerPage>;
  page: PracticeRunnerPage;
  el: HTMLElement;
}> {
  const fixture = TestBed.createComponent(PracticeRunnerPage);
  fixture.componentRef.setInput('certCode', 'clf-c02');
  fixture.detectChanges();
  await flush();
  fixture.detectChanges();
  return { fixture, page: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
}

function buttonByText(el: HTMLElement, text: string): HTMLButtonElement {
  const button = [...el.querySelectorAll('button, ion-button')].find(
    (candidate) => (candidate.textContent ?? '').replace(/\s+/g, ' ').trim() === text,
  );
  if (!button) {
    throw new Error(`button "${text}" not found`);
  }
  return button as HTMLButtonElement;
}

function checkboxes(el: HTMLElement): HTMLInputElement[] {
  return [...el.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
}

async function goTo(fixture: ComponentFixture<PracticeRunnerPage>, index: number): Promise<void> {
  stub.currentIndex.set(index);
  fixture.detectChanges();
  await flush();
  fixture.detectChanges();
}

async function answerSingle(
  fixture: ComponentFixture<PracticeRunnerPage>,
  el: HTMLElement,
  key: string,
): Promise<void> {
  const radio = el.querySelector<HTMLInputElement>(
    `input[type="radio"][name="answer-q-single"][value="${key}"]`,
  );
  expect(radio).not.toBeNull();
  radio!.click();
  await flush();
  fixture.detectChanges();
}

beforeEach(async () => {
  stub = new StubSessionService();
  createdAlerts = [];
  dismissRole = 'cancel';
  await TestBed.configureTestingModule({
    imports: [PracticeRunnerPage],
    providers: [
      provideRouter([]),
      provideIonicAngular(),
      { provide: AlertController, useValue: alertControllerStub },
      { provide: PracticeSessionService, useValue: stub },
    ],
  }).compileComponents();
});

afterEach(() => {
  TestBed.resetTestingModule();
});

describe('PracticeRunnerPage accessibility', () => {
  it('has no axe violations in either theme', async () => {
    const { el } = await render();

    await expectNoA11yViolations(el, 'light');
    await expectNoA11yViolations(el, 'dark');
  });
});

describe('PracticeRunnerPage question flow (PRACT-9 to PRACT-15)', () => {
  it('shows Question N of M and a progress bar that advances when answered', async () => {
    const { fixture, el } = await render();

    expect(el.textContent).toContain('Question 1 of 4');
    const bars = () => [...el.querySelectorAll<HTMLElement>('[role="progressbar"]')];
    expect(bars()).toHaveLength(3);
    expect(bars()[0]?.getAttribute('aria-valuenow')).toBe('0');

    await answerSingle(fixture, el, 'B');

    const [answered, correct, wrong] = bars() as [HTMLElement, HTMLElement, HTMLElement];
    expect(answered.getAttribute('aria-valuenow')).toBe('1');
    expect(answered.getAttribute('aria-valuemax')).toBe('4');
    expect(answered.getAttribute('aria-valuetext')).toBe('1 of 4 answered, 25 percent');
    expect(correct.getAttribute('aria-valuenow')).toBe('1');
    expect(correct.getAttribute('aria-valuetext')).toBe('1 correct');
    expect(wrong.getAttribute('aria-valuenow')).toBe('0');
    expect(wrong.getAttribute('aria-valuetext')).toBe('0 wrong');
    expect(el.querySelector('#practice-bar-answered-label')?.textContent).toBe('Answered');
    expect(el.querySelector('#practice-bar-correct-label')?.textContent).toBe('Correct');
    expect(el.querySelector('#practice-bar-wrong-label')?.textContent).toBe('Wrong');
  });

  it('grades a single answer on selection and shows the explanation feedback', async () => {
    const { fixture, el } = await render();

    await answerSingle(fixture, el, 'C');

    expect(stub.answer).toHaveBeenCalledWith('q-single', 'C');
    expect(stub.submitAnswer).not.toHaveBeenCalled();
    const feedback = el.querySelector('.feedback');
    expect(feedback).not.toBeNull();
    expect(feedback!.textContent).toContain('Incorrect answer.');
    expect(feedback!.textContent).toContain('Summary.');
  });

  it('grades multi, ordering, and matching on explicit confirm', async () => {
    const { fixture, el } = await render();
    await goTo(fixture, 1);

    expect(buttonByText(el, 'Confirm answer').disabled).toBe(true);
    checkboxes(el)[0]!.click();
    await flush();
    fixture.detectChanges();
    checkboxes(el)[1]!.click();
    await flush();
    fixture.detectChanges();
    buttonByText(el, 'Confirm answer').click();
    await flush();
    fixture.detectChanges();

    expect(stub.submitAnswer).toHaveBeenCalledWith('q-multi');

    await goTo(fixture, 2);
    el.querySelector<HTMLButtonElement>('[aria-label="Move First step down"]')!.click();
    await flush();
    fixture.detectChanges();
    expect(stub.answer).toHaveBeenCalledWith('q-order', ['B', 'A', 'C', 'D']);
    buttonByText(el, 'Confirm answer').click();
    await flush();
    fixture.detectChanges();
    expect(stub.submitAnswer).toHaveBeenCalledWith('q-order');

    await goTo(fixture, 3);
    const targets = ['2', '1', '4', '3'];
    [...el.querySelectorAll<HTMLSelectElement>('select.match-select')].forEach((select, index) => {
      select.value = targets[index]!;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await flush();
    fixture.detectChanges();
    buttonByText(el, 'Confirm answer').click();
    await flush();
    fixture.detectChanges();
    expect(stub.submitAnswer).toHaveBeenCalledWith('q-match');
  });

  it('warns instead of grading when the service reports an incomplete response', async () => {
    stub.submitAnswer.mockResolvedValueOnce('incomplete');
    const { fixture, el } = await render();
    await goTo(fixture, 1);

    checkboxes(el)[0]!.click();
    await flush();
    fixture.detectChanges();
    await fixture.componentInstance.confirmMulti('q-multi');
    fixture.detectChanges();

    expect(el.textContent).toContain('not complete yet');
    expect(stub.isGraded('q-multi')).toBe(false);
  });

  it('keeps a graded question read-only and restores it when revisited', async () => {
    const { fixture, el } = await render();
    await answerSingle(fixture, el, 'B');

    await goTo(fixture, 1);
    await goTo(fixture, 0);

    const radios = [...el.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    expect(radios.every((radio) => radio.disabled)).toBe(true);
    expect(el.querySelector<HTMLInputElement>('input[type="radio"][value="B"]')?.checked).toBe(true);
    expect(el.querySelector('.feedback')).not.toBeNull();

    const calls = stub.answer.mock.calls.length;
    radios[2]!.click();
    await flush();
    expect(stub.answer.mock.calls.length).toBe(calls);
  });

  it('advances with Next question and finishes with Finish session on the last question', async () => {
    const { fixture, el } = await render();

    buttonByText(el, 'Next question').click();
    await flush();
    expect(stub.goTo).toHaveBeenCalledWith(1);

    await goTo(fixture, 3);
    expect(() => buttonByText(el, 'Next question')).toThrow();
    buttonByText(el, 'Finish session').click();
    await flush();
    fixture.detectChanges();

    expect(stub.complete).toHaveBeenCalledTimes(1);
    expect(el.textContent).toContain('Practice session complete');
    expect(el.textContent).toContain('Score');
    expect(el.textContent).toContain('50 percent');
  });

  it('offers the optional report action that copies only on explicit tap', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const { fixture, el } = await render();

    expect(writeText).not.toHaveBeenCalled();
    buttonByText(el, 'Report question').click();
    await flush();
    fixture.detectChanges();

    expect(writeText).toHaveBeenCalledWith('q-single');
    expect(el.textContent).toContain('Question id copied');
  });

  it('shows a retryable error when an answer or the finish save fails', async () => {
    stub.answer.mockRejectedValueOnce(new Error('save failed'));
    const { fixture, el } = await render();
    await answerSingle(fixture, el, 'B');
    expect(el.textContent).toContain('could not be saved');

    stub.complete.mockRejectedValueOnce(new Error('save failed'));
    await goTo(fixture, 3);
    buttonByText(el, 'Finish session').click();
    await flush();
    fixture.detectChanges();
    expect(el.textContent).toContain('could not be saved locally');
    expect(stub.isActive()).toBe(true);
  });
});

describe('PracticeRunnerPage lifecycle and leave guard (PRACT-27 to PRACT-33)', () => {
  it('resumes a saved session when the runner opens without an active one', async () => {
    stub.active.set(false);
    stub.resume.mockImplementation(() => {
      stub.active.set(true);
      return Promise.resolve(true);
    });

    const { el } = await render();

    expect(stub.resume).toHaveBeenCalledWith('clf-c02');
    expect(el.textContent).not.toContain('No practice session running');
  });

  it('shows a retryable empty state when nothing is active or resumable', async () => {
    stub.active.set(false);
    stub.resume.mockResolvedValue(false);

    const { el } = await render();

    expect(el.textContent).toContain('No practice session running');
    expect(() => buttonByText(el, 'Try again')).not.toThrow();
  });

  it('asks Leave practice and keeps the session mounted on Cancel', async () => {
    const { page } = await render();
    const route = {} as ActivatedRouteSnapshot;
    const state = {} as RouterStateSnapshot;

    dismissRole = 'cancel';
    const stay = await practiceLeaveGuard(page, route, state, state);
    expect(stay).toBe(false);
    expect(createdAlerts[0]!.header).toBe('Leave practice?');
    expect(stub.isActive()).toBe(true);

    dismissRole = 'confirm';
    const leave = await practiceLeaveGuard(page, route, state, state);
    expect(leave).toBe(true);
    expect(stub.discard).not.toHaveBeenCalled();
  });

  it('leaves freely once the summary is showing', async () => {
    const { page } = await render();

    await page.finish();
    const allowed = await page.confirmLeave();

    expect(stub.complete).toHaveBeenCalledTimes(1);
    expect(allowed).toBe(true);
  });

  it('never starts a timer or a timed-exam active state', async () => {
    const { el } = await render();

    expect(el.querySelector('[role="timer"]')).toBeNull();
    expect(/\d{1,2}:\d{2}/.test(el.textContent ?? '')).toBe(false);
  });
});
