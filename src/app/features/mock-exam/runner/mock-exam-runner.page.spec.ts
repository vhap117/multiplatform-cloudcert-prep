/**
 * Runner page specs (issue 005: S3, S11, S12, S13, EXAM-24 to EXAM-27).
 *
 * The session service is stubbed in memory, so no IndexedDB and no storage
 * layer is involved. The Ionic AlertController is stubbed the same way: the
 * stub captures the dialog options and resolves the dismiss role the test
 * picks, which is what makes the submit and leave confirmations observable.
 */

import { computed, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router, provideRouter, type ActivatedRouteSnapshot, type RouterStateSnapshot } from '@angular/router';
import { AlertController, provideIonicAngular } from '@ionic/angular';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { expectNoA11yViolations } from '../../../core/a11y/axe-scan';
import type { Question } from '../../../core/content/question-types';
import { correctAnswerFor } from '../../../core/exam';
import type { AttemptRow } from '../../../core/storage/types';
import { MockExamSessionService } from '../session/mock-exam-session.service';
import type { MockExamResult } from '../session/mock-exam-session.types';

import { mockExamLeaveGuard } from './mock-exam-leave.guard';
import { MockExamRunnerPage } from './mock-exam-runner.page';

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

/** One question of each response format, in runner display space. */
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
    domainId: 1,
    isMultiAnswer: false,
    type: 'ordering',
    question: 'Order the steps.',
    options: { ...ORDER_OPTIONS },
    correctOrder: ['B', 'A', 'D', 'C'],
    explanation: explanation(ORDER_OPTIONS),
  },
  {
    id: 'q-match',
    domainId: 1,
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
    id: 'clf-c02:mock:1000',
    cert: 'clf-c02',
    kind: 'mock',
    startedAt: 1000,
    finishedAt: 61000,
    totalQuestions: 4,
    correctCount: 3,
    scorePercent: 75,
    passed: true,
    timeTakenSeconds: 60,
    domainScores: [],
  };
}

/** In-memory stand-in for MockExamSessionService with signal state. */
class StubSessionService {
  readonly active = signal(true);
  readonly isActive = computed(() => this.active());
  readonly questions = signal<readonly Question[]>(BANK);
  readonly totalQuestions = computed(() => this.questions().length);
  readonly currentIndex = signal(0);
  readonly currentQuestion = computed(() => this.questions()[this.currentIndex()] ?? null);
  readonly answeredCount = signal(0);
  readonly flaggedIds = signal<readonly string[]>([]);
  readonly result = signal<MockExamResult | null>(null);

  remaining = 5400;
  expired = false;
  readonly stored = new Map<string, string | string[]>();

  readonly start = vi.fn<(certCode: string) => Promise<void>>(() => Promise.resolve());
  readonly resume = vi.fn<(certCode: string) => Promise<boolean>>(() => Promise.resolve(true));
  readonly hasInProgress = vi.fn<(certCode: string) => Promise<boolean>>(() =>
    Promise.resolve(false),
  );
  readonly abandon = vi.fn<() => Promise<void>>(() => Promise.resolve());

  readonly answer = vi.fn<(id: string, value: string | readonly string[]) => Promise<void>>(
    (id, value) => {
      const next = typeof value === 'string' ? value : [...value];
      if (next === '' || (Array.isArray(next) && next.length === 0)) {
        this.stored.delete(id);
      } else {
        this.stored.set(id, next);
      }
      this.answeredCount.set([...this.stored.keys()].filter((key) => this.isAnswered(key)).length);
      return Promise.resolve();
    },
  );

  readonly setFlag = vi.fn<(id: string, flagged: boolean) => Promise<void>>((id, flagged) => {
    const next = new Set(this.flaggedIds());
    if (flagged) {
      next.add(id);
    } else {
      next.delete(id);
    }
    this.flaggedIds.set([...next].sort());
    return Promise.resolve();
  });

  readonly goTo = vi.fn<(index: number) => Promise<void>>((index) => {
    this.currentIndex.set(index);
    return Promise.resolve();
  });

  readonly submit = vi.fn<() => Promise<AttemptRow>>(() => {
    const attempt = makeAttempt();
    this.result.set({ attempt, isTooShort: false, committed: true });
    return Promise.resolve(attempt);
  });

  readonly endIfExpired = vi.fn<() => Promise<AttemptRow | null>>(() => Promise.resolve(null));
  readonly hasExpired = vi.fn<() => boolean>(() => this.expired);
  readonly remainingSeconds = vi.fn<() => number>(() => this.remaining);

  answerFor(id: string): string | string[] | null {
    return this.stored.get(id) ?? null;
  }

  isAnswered(id: string): boolean {
    const value = this.stored.get(id);
    const question = this.questions().find((candidate) => candidate.id === id);
    if (value === undefined || !question) {
      return false;
    }
    if (typeof value === 'string') {
      return value !== '';
    }
    const correct = correctAnswerFor(question);
    return Array.isArray(correct) && value.length === correct.length;
  }

  isFlagged(id: string): boolean {
    return this.flaggedIds().includes(id);
  }
}

interface CapturedAlert {
  header?: string;
  message?: string;
  buttons?: unknown[];
}

let stub: StubSessionService;
let dismissRole: 'cancel' | 'confirm';
let createdAlerts: CapturedAlert[];

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

/** Drain the microtask queue so awaited handler chains settle. */
async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
}

async function render(): Promise<{
  fixture: ComponentFixture<MockExamRunnerPage>;
  page: MockExamRunnerPage;
  el: HTMLElement;
}> {
  const fixture = TestBed.createComponent(MockExamRunnerPage);
  fixture.componentRef.setInput('certCode', 'clf-c02');
  fixture.detectChanges();
  await flush();
  fixture.detectChanges();
  return { fixture, page: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
}

function buttonByText(el: HTMLElement, text: string): HTMLButtonElement {
  const button = [...el.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === text,
  );
  if (!button) {
    throw new Error(`button "${text}" not found`);
  }
  return button;
}

function submitButton(el: HTMLElement): HTMLElement {
  const button = el.querySelector('ion-button');
  if (!button) {
    throw new Error('submit ion-button not found');
  }
  return button as HTMLElement;
}

function checkboxes(el: HTMLElement): HTMLInputElement[] {
  return [...el.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
}

describe('MockExamRunnerPage', () => {
  beforeEach(async () => {
    stub = new StubSessionService();
    dismissRole = 'cancel';
    createdAlerts = [];
    await TestBed.configureTestingModule({
      imports: [MockExamRunnerPage],
      providers: [
        provideRouter([]),
        provideIonicAngular(),
        { provide: MockExamSessionService, useValue: stub },
        { provide: AlertController, useValue: alertControllerStub },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('has no axe violations in either theme', async () => {
    const { el } = await render();

    await expectNoA11yViolations(el, 'light');
    await expectNoA11yViolations(el, 'dark');
  });

  it('answers a single question immediately when an option is selected', async () => {
    const { el } = await render();
    const radio = el.querySelector<HTMLInputElement>(
      'input[type="radio"][name="answer-q-single"][value="C"]',
    );
    expect(radio).not.toBeNull();

    radio!.click();
    await flush();

    expect(stub.answer).toHaveBeenCalledWith('q-single', 'C');
    expect(stub.goTo).not.toHaveBeenCalled();
  });

  it('keeps multi selections in a draft until confirmed and caps them at the engine limit', async () => {
    const { el, fixture } = await render();
    stub.currentIndex.set(1);
    fixture.detectChanges();

    const boxes = checkboxes(el);
    boxes[0]!.click();
    boxes[2]!.click();
    await flush();
    fixture.detectChanges();

    expect(stub.answer).not.toHaveBeenCalled();
    const third = checkboxes(el)[1]!;
    expect(third.disabled).toBe(true);
    third.click();
    await flush();
    expect(stub.answer).not.toHaveBeenCalled();

    const confirm = buttonByText(el, 'Confirm answer');
    expect(confirm.disabled).toBe(false);
    confirm.click();
    await flush();

    expect(stub.answer).toHaveBeenCalledWith('q-multi', ['A', 'C']);
  });

  it('saves the new sequence immediately when an ordering step moves', async () => {
    const { el, fixture } = await render();
    stub.currentIndex.set(2);
    fixture.detectChanges();

    const down = el.querySelector<HTMLButtonElement>('[aria-label="Move First step down"]');
    expect(down).not.toBeNull();
    down!.click();
    await flush();

    expect(stub.answer).toHaveBeenCalledWith('q-order', ['B', 'A', 'C', 'D']);
  });

  it('saves a matching pair as a token when its target is chosen', async () => {
    const { el, fixture } = await render();
    stub.currentIndex.set(3);
    fixture.detectChanges();

    const select = el.querySelector<HTMLSelectElement>('select[aria-label="Match for Left one"]');
    expect(select).not.toBeNull();
    select!.value = '2';
    select!.dispatchEvent(new Event('change', { bubbles: true }));
    await flush();

    expect(stub.answer).toHaveBeenCalledWith('q-match', ['A:2']);
  });

  it('flags and unflags the current question through the service', async () => {
    const { el, fixture } = await render();

    buttonByText(el, 'Flag for review').click();
    await flush();
    fixture.detectChanges();

    expect(stub.setFlag).toHaveBeenCalledWith('q-single', true);
    expect(buttonByText(el, 'Flagged').getAttribute('aria-pressed')).toBe('true');

    buttonByText(el, 'Flagged').click();
    await flush();
    fixture.detectChanges();

    expect(stub.setFlag).toHaveBeenCalledWith('q-single', false);
    expect(buttonByText(el, 'Flag for review').getAttribute('aria-pressed')).toBe('false');
  });

  it('marks answered, unanswered, current, and flagged cells in the question grid', async () => {
    const { el, fixture } = await render();
    await stub.answer('q-single', 'B');
    await stub.setFlag('q-order', true);
    fixture.detectChanges();

    const cells = el.querySelectorAll<HTMLButtonElement>('.grid-cell');
    expect(cells).toHaveLength(4);
    expect(cells[0]!.getAttribute('aria-label')).toBe('Question 1, answered, current');
    expect(cells[1]!.getAttribute('aria-label')).toBe('Question 2, unanswered');
    expect(cells[2]!.getAttribute('aria-label')).toBe('Question 3, unanswered, flagged');
    expect(cells[0]!.classList.contains('answered')).toBe(true);
    expect(cells[2]!.classList.contains('flagged')).toBe(true);
    expect(cells[0]!.getAttribute('aria-current')).toBe('true');
    expect(cells[1]!.hasAttribute('aria-current')).toBe(false);
  });

  it('jumps to a question through the grid and through previous and next', async () => {
    const { el, fixture } = await render();

    el.querySelectorAll<HTMLButtonElement>('.grid-cell')[3]!.click();
    await flush();
    expect(stub.goTo).toHaveBeenCalledWith(3);

    fixture.detectChanges();
    buttonByText(el, 'Previous').click();
    await flush();
    expect(stub.goTo).toHaveBeenCalledWith(2);
  });

  it('shows position, answered progress, and remaining time in the persistent toolbar', async () => {
    stub.remaining = 5400;
    const { el, fixture } = await render();
    await stub.answer('q-single', 'B');
    fixture.detectChanges();

    expect(el.textContent).toContain('Question 1 of 4');
    expect(el.textContent).toContain('Answered 1 of 4');
    expect(el.textContent).toContain('90:00');
  });

  it('recomputes the remaining time from the service on every tick', async () => {
    vi.useFakeTimers();
    stub.remaining = 5400;
    const { el, fixture } = await render();

    stub.remaining = 599;
    vi.advanceTimersByTime(1000);
    fixture.detectChanges();

    expect(el.textContent).toContain('09:59');
  });

  it('recomputes the remaining time when the app becomes visible again', async () => {
    const { el, fixture } = await render();

    stub.remaining = 1200;
    document.dispatchEvent(new Event('visibilitychange'));
    await flush();
    fixture.detectChanges();

    expect(el.textContent).toContain('20:00');
  });

  it('announces the low-time warning once when the threshold is crossed, not on every tick', async () => {
    vi.useFakeTimers();
    stub.remaining = 601;
    const { el, fixture } = await render();

    stub.remaining = 599;
    vi.advanceTimersByTime(1000);
    fixture.detectChanges();

    const region = el.querySelector('[role="status"]');
    expect(region?.textContent).toContain('Low time warning: 09:59 remaining.');
    expect(el.querySelector('.timer')?.classList.contains('low')).toBe(true);

    vi.advanceTimersByTime(3000);
    fixture.detectChanges();
    expect(region?.textContent).toContain('Low time warning: 09:59 remaining.');
    expect(el.querySelectorAll('[role="status"]')).toHaveLength(1);
  });

  it('requires the Ready to submit dialog and summarizes answered and flagged counts', async () => {
    const { el, fixture } = await render();
    await stub.answer('q-single', 'B');
    await stub.setFlag('q-order', true);
    fixture.detectChanges();

    dismissRole = 'confirm';
    submitButton(el).click();
    await flush();

    expect(createdAlerts).toHaveLength(1);
    expect(createdAlerts[0]!.header).toBe('Ready to submit?');
    expect(createdAlerts[0]!.message).toContain('1 of 4');
    expect(createdAlerts[0]!.message).toContain('flagged 1');
    expect(stub.submit).toHaveBeenCalledTimes(1);

    fixture.detectChanges();
    expect(el.textContent).toContain('Passed');
    expect(el.textContent).toContain('75 percent');
  });

  it('does not submit when the Ready to submit dialog is dismissed', async () => {
    const { el } = await render();

    dismissRole = 'cancel';
    submitButton(el).click();
    await flush();

    expect(createdAlerts).toHaveLength(1);
    expect(stub.submit).not.toHaveBeenCalled();
  });

  it('blocks navigation away from a running exam until the leave dialog is confirmed', async () => {
    const { page } = await render();
    const route = {} as ActivatedRouteSnapshot;
    const state = {} as RouterStateSnapshot;

    dismissRole = 'cancel';
    const stay = await mockExamLeaveGuard(page, route, state, state);
    expect(stay).toBe(false);
    expect(createdAlerts).toHaveLength(1);
    expect(createdAlerts[0]!.header).toBe('Leave the exam?');

    dismissRole = 'confirm';
    const leave = await mockExamLeaveGuard(page, route, state, state);
    expect(leave).toBe(true);
  });

  it('lets the student leave freely once the exam has a result', async () => {
    const { page } = await render();
    stub.result.set({ attempt: makeAttempt(), isTooShort: false, committed: true });
    const route = {} as ActivatedRouteSnapshot;
    const state = {} as RouterStateSnapshot;

    const allowed = await mockExamLeaveGuard(page, route, state, state);

    expect(allowed).toBe(true);
    expect(createdAlerts).toHaveLength(0);
  });

  it('ends the attempt on entry when the deadline passed while backgrounded', async () => {
    const attempt = makeAttempt();
    stub.endIfExpired.mockImplementation(() => {
      stub.result.set({ attempt, isTooShort: false, committed: true });
      return Promise.resolve(attempt);
    });

    const { el, fixture } = await render();
    fixture.detectChanges();

    expect(stub.endIfExpired).toHaveBeenCalled();
    expect(el.textContent).toContain('Passed');
    expect(el.textContent).toContain('75 percent');
  });

  it('resumes a stored session when the runner opens without an active exam', async () => {
    stub.active.set(false);
    stub.resume.mockImplementation(() => {
      stub.active.set(true);
      return Promise.resolve(true);
    });

    const { el } = await render();

    expect(stub.resume).toHaveBeenCalledWith('clf-c02');
    expect(el.textContent).not.toContain('No exam running');
  });

  it('shows a recoverable empty state when no exam is running or resumable', async () => {
    stub.active.set(false);
    stub.resume.mockResolvedValue(false);

    const { el } = await render();

    expect(el.textContent).toContain('No exam running');
  });

  it('confirms before restoring a timed attempt on a cold entry (CERT-32)', async () => {
    stub.active.set(false);
    stub.hasInProgress.mockResolvedValue(true);
    stub.resume.mockImplementation(() => {
      stub.active.set(true);
      return Promise.resolve(true);
    });
    dismissRole = 'confirm';

    await render();

    expect(createdAlerts.some((alert) => alert.header === 'Resume timed exam?')).toBe(true);
    expect(stub.resume).toHaveBeenCalledWith('clf-c02');
  });

  it('leaves for the start screen when the resume confirmation is declined', async () => {
    stub.active.set(false);
    stub.hasInProgress.mockResolvedValue(true);
    dismissRole = 'cancel';
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    await render();

    expect(navigate).toHaveBeenCalledWith('/mock-exam/clf-c02');
    expect(stub.resume).not.toHaveBeenCalled();
  });
});
