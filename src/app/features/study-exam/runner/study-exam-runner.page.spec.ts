/**
 * Study exam runner specs (issue 006: S3, S4, S5, S6, S7, S11 display, S12).
 *
 * The session service is stubbed in memory, so no IndexedDB and no storage
 * layer is involved. The stub mirrors the service contract: a single answer
 * grades inside `answer`, the other formats grade only through
 * `submitAnswer`, and the bar counts derive from the graded set so correct
 * plus wrong always equals answered.
 */

import { computed, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { questionType, type Question } from '../../../core/content/question-types';
import { correctAnswerFor, isAnswerCorrect } from '../../../core/exam';
import type { AttemptRow } from '../../../core/storage/types';
import { StudyExamSessionService } from '../session/study-exam-session.service';
import type {
  DomainTally,
  FeedbackEntry,
  QuestionFeedback,
} from '../session/study-exam-session.types';

import { StudyExamRunnerPage } from './study-exam-runner.page';

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
    id: 'clf-c02:study:1000',
    cert: 'clf-c02',
    kind: 'study',
    startedAt: 1000,
    finishedAt: 61000,
    totalQuestions: 4,
    correctCount: 1,
    scorePercent: 25,
    scaledScore: 250,
    passed: false,
    timeTakenSeconds: 60,
    domainScores: [],
  };
}

/** In-memory stand-in for StudyExamSessionService with signal state. */
class StubSessionService {
  readonly active = signal(true);
  readonly isActive = computed(() => this.active());
  readonly questions = signal<readonly Question[]>(BANK);
  readonly totalQuestions = computed(() => this.questions().length);
  readonly currentIndex = signal(0);
  readonly currentQuestion = computed(() => this.questions()[this.currentIndex()] ?? null);

  /** Ids of graded questions, mirroring `feedbackShown` on the session row. */
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
  readonly domainTallies = computed<readonly DomainTally[]>(() =>
    [1, 2].map((domainId) => {
      let answered = 0;
      let correct = 0;
      for (const question of this.questions()) {
        if (question.domainId !== domainId || !this.gradedIds().includes(question.id)) {
          continue;
        }
        answered += 1;
        if (this.gradeStored(question)) {
          correct += 1;
        }
      }
      return { domainId, answered, correct, wrong: answered - correct };
    }),
  );

  readonly start = vi.fn<(certCode: string) => Promise<void>>(() => Promise.resolve());
  readonly resume = vi.fn<(certCode: string) => Promise<boolean>>(() => Promise.resolve(true));
  readonly hasInProgress = vi.fn<(certCode: string) => Promise<boolean>>(() =>
    Promise.resolve(false),
  );
  readonly discard = vi.fn<() => Promise<void>>(() => Promise.resolve());

  /** Singles grade on this call; other formats only persist a draft (S3). */
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
        this.gradedIds.set([...this.gradedIds(), id].sort());
      }
      return Promise.resolve();
    },
  );

  /** Multi, ordering, and matching grade only through this explicit submit. */
  readonly submitAnswer = vi.fn<(id: string) => Promise<void>>((id) => {
    if (!this.gradedIds().includes(id)) {
      this.gradedIds.set([...this.gradedIds(), id].sort());
    }
    return Promise.resolve();
  });

  readonly goTo = vi.fn<(index: number) => Promise<void>>((index) => {
    this.currentIndex.set(index);
    return Promise.resolve();
  });

  readonly complete = vi.fn<() => Promise<AttemptRow>>(() => {
    this.active.set(false);
    return Promise.resolve(makeAttempt());
  });

  answerFor(id: string): string | string[] | null {
    return this.stored.get(id) ?? null;
  }

  isAnswered(id: string): boolean {
    const question = this.questions().find((candidate) => candidate.id === id);
    if (!question) {
      return false;
    }
    const type = questionType(question);
    const value = this.stored.get(id) ?? null;
    if (value === null) {
      return false;
    }
    if (type === 'single') {
      return typeof value === 'string' && value !== '';
    }
    const expected = correctAnswerFor(question);
    return Array.isArray(value) && Array.isArray(expected) && value.length === expected.length;
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

  /** Mirror of the service grouping: chosen-wrong, missed-correct, correct-chosen (S4). */
  feedbackFor(id: string): QuestionFeedback | null {
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
    const options: FeedbackEntry[] = [
      ...chosen
        .filter((key) => !correctKeys.includes(key))
        .map((key): FeedbackEntry => ({ key, text: textFor(key), kind: 'chosen-wrong' })),
      ...correctKeys
        .filter((key) => !chosen.includes(key))
        .map((key): FeedbackEntry => ({ key, text: textFor(key), kind: 'missed-correct' })),
      ...chosen
        .filter((key) => correctKeys.includes(key))
        .map((key): FeedbackEntry => ({ key, text: textFor(key), kind: 'correct-chosen' })),
    ];
    return { questionId: id, isCorrect, summary: question.explanation.summary, options };
  }

  private gradeStored(question: Question): boolean {
    const value = this.stored.get(question.id) ?? null;
    return (
      value !== null && isAnswerCorrect(value, correctAnswerFor(question), questionType(question))
    );
  }
}

let stub: StubSessionService;

/** Drain the microtask queue so awaited handler chains settle. */
async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
}

async function render(): Promise<{
  fixture: ComponentFixture<StudyExamRunnerPage>;
  page: StudyExamRunnerPage;
  el: HTMLElement;
}> {
  const fixture = TestBed.createComponent(StudyExamRunnerPage);
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

function finishButton(el: HTMLElement): HTMLElement {
  const button = el.querySelector('ion-button');
  if (!button) {
    throw new Error('finish ion-button not found');
  }
  return button as HTMLElement;
}

function checkboxes(el: HTMLElement): HTMLInputElement[] {
  return [...el.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
}

function progressBars(el: HTMLElement): HTMLElement[] {
  return [...el.querySelectorAll<HTMLElement>('[role="progressbar"]')];
}

function progressValues(el: HTMLElement): string[] {
  return [...el.querySelectorAll<HTMLElement>('.progress-value')].map(
    (node) => node.textContent?.trim() ?? '',
  );
}

async function goTo(fixture: ComponentFixture<StudyExamRunnerPage>, index: number): Promise<void> {
  stub.currentIndex.set(index);
  fixture.detectChanges();
  await flush();
  fixture.detectChanges();
}

/** Grade the single question with the given key through the UI. */
async function answerSingle(
  fixture: ComponentFixture<StudyExamRunnerPage>,
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

describe('StudyExamRunnerPage', () => {
  beforeEach(async () => {
    stub = new StubSessionService();
    await TestBed.configureTestingModule({
      imports: [StudyExamRunnerPage],
      providers: [
        provideRouter([]),
        provideIonicAngular(),
        { provide: StudyExamSessionService, useValue: stub },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('grades a single answer on selection and shows the feedback panel', async () => {
    const { el, fixture } = await render();

    await answerSingle(fixture, el, 'C');

    expect(stub.answer).toHaveBeenCalledWith('q-single', 'C');
    expect(stub.submitAnswer).not.toHaveBeenCalled();
    const panel = el.querySelector('.feedback');
    expect(panel).not.toBeNull();
    expect(panel!.textContent).toContain('Incorrect answer.');
    expect(panel!.textContent).toContain('Summary.');
    expect(el.querySelector('.feedback-heading')?.textContent).toContain('Feedback');
  });

  it('grades a multi response only on explicit confirm, capped at the engine limit', async () => {
    const { el, fixture } = await render();
    await goTo(fixture, 1);

    const confirmBefore = buttonByText(el, 'Confirm answer');
    expect(confirmBefore.disabled).toBe(true);

    const boxes = checkboxes(el);
    boxes[0]!.click();
    await flush();
    fixture.detectChanges();
    expect(stub.submitAnswer).not.toHaveBeenCalled();

    boxes[1]!.click();
    await flush();
    fixture.detectChanges();

    // The cap disables every unselected option once two are chosen.
    const capped = checkboxes(el);
    expect(capped[2]!.disabled).toBe(true);
    expect(stub.submitAnswer).not.toHaveBeenCalled();

    const confirm = buttonByText(el, 'Confirm answer');
    expect(confirm.disabled).toBe(false);
    confirm.click();
    await flush();
    fixture.detectChanges();

    expect(stub.answer).toHaveBeenCalledWith('q-multi', ['A', 'B']);
    expect(stub.submitAnswer).toHaveBeenCalledWith('q-multi');
    expect(el.querySelector('.feedback')).not.toBeNull();
  });

  it('groups wrong-chosen, missed-correct, and correct-chosen options in the feedback', async () => {
    const { el, fixture } = await render();
    await goTo(fixture, 1);

    // q-multi is correct on A and C; the student picks A and B for a partial.
    checkboxes(el)[0]!.click();
    await flush();
    fixture.detectChanges();
    checkboxes(el)[1]!.click();
    await flush();
    fixture.detectChanges();
    buttonByText(el, 'Confirm answer').click();
    await flush();
    fixture.detectChanges();

    const groups = [...el.querySelectorAll<HTMLElement>('.feedback-group')];
    expect(groups).toHaveLength(3);

    const wrong = groups[0]!;
    expect(wrong.querySelector('h3')?.textContent).toBe('Wrong options you chose');
    expect(wrong.textContent).toContain('B.');
    expect(wrong.textContent).toContain('Beta');
    expect(wrong.textContent).toContain('Note on B.');

    const missed = groups[1]!;
    expect(missed.querySelector('h3')?.textContent).toBe('Correct options you missed');
    expect(missed.textContent).toContain('C.');
    expect(missed.textContent).toContain('Gamma');
    expect(missed.textContent).toContain('Note on C.');

    const chosen = groups[2]!;
    expect(chosen.querySelector('h3')?.textContent).toBe('Options you chose correctly');
    expect(chosen.textContent).toContain('A.');
    expect(chosen.textContent).toContain('Alpha');
  });

  it('grades an ordering response on explicit confirm', async () => {
    const { el, fixture } = await render();
    await goTo(fixture, 2);

    const down = el.querySelector<HTMLButtonElement>('[aria-label="Move First step down"]');
    expect(down).not.toBeNull();
    down!.click();
    await flush();
    fixture.detectChanges();

    expect(stub.answer).toHaveBeenCalledWith('q-order', ['B', 'A', 'C', 'D']);
    expect(stub.submitAnswer).not.toHaveBeenCalled();

    buttonByText(el, 'Confirm answer').click();
    await flush();
    fixture.detectChanges();

    expect(stub.submitAnswer).toHaveBeenCalledWith('q-order');
    expect(el.querySelector('.feedback')).not.toBeNull();
  });

  it('grades a matching response on explicit confirm once every pair is chosen', async () => {
    const { el, fixture } = await render();
    await goTo(fixture, 3);

    const confirmBefore = buttonByText(el, 'Confirm answer');
    expect(confirmBefore.disabled).toBe(true);

    const targets = ['2', '1', '4', '3'];
    const selects = [...el.querySelectorAll<HTMLSelectElement>('select.match-select')];
    expect(selects).toHaveLength(4);
    selects.forEach((select, index) => {
      select.value = targets[index]!;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await flush();
    fixture.detectChanges();

    expect(stub.submitAnswer).not.toHaveBeenCalled();

    const confirm = buttonByText(el, 'Confirm answer');
    expect(confirm.disabled).toBe(false);
    confirm.click();
    await flush();
    fixture.detectChanges();

    expect(stub.submitAnswer).toHaveBeenCalledWith('q-match');
    expect(el.querySelector('.feedback')?.textContent).toContain('Correct answer.');
  });

  it('renders a graded question read-only with the recorded answer and its feedback', async () => {
    const { el, fixture } = await render();
    await answerSingle(fixture, el, 'B');
    expect(el.querySelector('.feedback')?.textContent).toContain('Correct answer.');

    // Navigate away and back: the recorded state must be identical (S5).
    await goTo(fixture, 1);
    await goTo(fixture, 0);

    const radios = [...el.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    expect(radios).toHaveLength(4);
    for (const radio of radios) {
      expect(radio.disabled).toBe(true);
    }
    expect(el.querySelector<HTMLInputElement>('input[type="radio"][value="B"]')?.checked).toBe(
      true,
    );
    expect(el.textContent).toContain('Your answer');
    expect(el.querySelector('.feedback')).not.toBeNull();

    // A graded question never accepts a new answer (S5).
    const calls = stub.answer.mock.calls.length;
    radios[2]!.click();
    await flush();
    expect(stub.answer.mock.calls.length).toBe(calls);
  });

  it('exposes the three bars with labels, numeric values, and full progressbar ARIA', async () => {
    const { el, fixture } = await render();
    await answerSingle(fixture, el, 'B');

    await goTo(fixture, 1);
    checkboxes(el)[0]!.click();
    await flush();
    fixture.detectChanges();
    checkboxes(el)[1]!.click();
    await flush();
    fixture.detectChanges();
    buttonByText(el, 'Confirm answer').click();
    await flush();
    fixture.detectChanges();

    const bars = progressBars(el);
    expect(bars).toHaveLength(3);

    const [answered, correct, wrong] = bars as [HTMLElement, HTMLElement, HTMLElement];
    expect(answered.getAttribute('aria-valuenow')).toBe('2');
    expect(answered.getAttribute('aria-valuemin')).toBe('0');
    expect(answered.getAttribute('aria-valuemax')).toBe('4');
    expect(answered.getAttribute('aria-valuetext')).toBe('2 of 4 answered, 50 percent');
    expect(answered.getAttribute('aria-labelledby')).toBe('study-bar-answered-label');

    expect(correct.getAttribute('aria-valuenow')).toBe('1');
    expect(correct.getAttribute('aria-valuemax')).toBe('4');
    expect(correct.getAttribute('aria-valuetext')).toBe('1 correct');

    expect(wrong.getAttribute('aria-valuenow')).toBe('1');
    expect(wrong.getAttribute('aria-valuemax')).toBe('4');
    expect(wrong.getAttribute('aria-valuetext')).toBe('1 wrong');

    expect(el.querySelector('#study-bar-answered-label')?.textContent).toBe('Answered');
    expect(el.querySelector('#study-bar-correct-label')?.textContent).toBe('Correct');
    expect(el.querySelector('#study-bar-wrong-label')?.textContent).toBe('Wrong');

    const values = progressValues(el);
    expect(values[0]).toBe('2 of 4 (50%)');
    expect(values[1]).toBe('1');
    expect(values[2]).toBe('1');
  });

  it('keeps correct plus wrong equal to answered in the rendered bars', async () => {
    const { el, fixture } = await render();
    await answerSingle(fixture, el, 'B');

    await goTo(fixture, 1);
    checkboxes(el)[0]!.click();
    await flush();
    fixture.detectChanges();
    checkboxes(el)[1]!.click();
    await flush();
    fixture.detectChanges();
    buttonByText(el, 'Confirm answer').click();
    await flush();
    fixture.detectChanges();

    const values = progressValues(el);
    const answered = Number(/^(\d+)/.exec(values[0] ?? '')?.[1]);
    const correct = Number(values[1]);
    const wrong = Number(values[2]);
    expect(correct + wrong).toBe(answered);
  });

  it('announces feedback through the live region and moves focus to the panel', async () => {
    const { el, fixture } = await render();

    await answerSingle(fixture, el, 'C');
    await flush();
    fixture.detectChanges();

    const region = el.querySelector('[role="status"]');
    expect(region?.textContent).toContain('Feedback for question 1: incorrect.');

    const panel = el.querySelector<HTMLElement>('.feedback');
    expect(panel).not.toBeNull();
    expect(panel!.getAttribute('tabindex')).toBe('-1');
    expect(panel!.getAttribute('aria-labelledby')).toBe('study-feedback-heading');
    expect(document.activeElement).toBe(panel);
  });

  it('navigates between questions through the pager and the grid', async () => {
    const { el, fixture } = await render();

    buttonByText(el, 'Next').click();
    await flush();
    expect(stub.goTo).toHaveBeenCalledWith(1);

    fixture.detectChanges();
    el.querySelectorAll<HTMLButtonElement>('.grid-cell')[3]!.click();
    await flush();
    expect(stub.goTo).toHaveBeenCalledWith(3);

    fixture.detectChanges();
    const cells = el.querySelectorAll<HTMLButtonElement>('.grid-cell');
    expect(cells[0]!.getAttribute('aria-label')).toBe('Question 1, ungraded');
    expect(cells[3]!.getAttribute('aria-label')).toBe('Question 4, ungraded, current');
  });

  it('finishes through the service and renders the summary in place', async () => {
    const { el, fixture } = await render();
    await answerSingle(fixture, el, 'B');

    await goTo(fixture, 1);
    checkboxes(el)[0]!.click();
    await flush();
    fixture.detectChanges();
    checkboxes(el)[1]!.click();
    await flush();
    fixture.detectChanges();
    buttonByText(el, 'Confirm answer').click();
    await flush();
    fixture.detectChanges();

    finishButton(el).click();
    await flush();
    fixture.detectChanges();

    expect(stub.complete).toHaveBeenCalledTimes(1);
    expect(el.textContent).toContain('Study exam complete');
    expect(el.textContent).toContain('Answered');
    expect(el.textContent).toContain('2 of 4');
    expect(el.textContent).toContain('Accuracy');
    expect(el.textContent).toContain('50 percent');
    expect(el.textContent).toContain('Results by domain');
    expect(el.textContent).toContain('Cloud Concepts');
    expect(el.textContent).toContain('1 of 2 correct (50%)');
    // A domain nobody answered is never fabricated as 0 percent (STUDY-49).
    expect(el.textContent).not.toContain('Security');
  });

  it('keeps the session and shows a retryable error when the finish commit fails', async () => {
    stub.complete.mockRejectedValueOnce(new Error('disk full'));
    const { el, fixture } = await render();

    finishButton(el).click();
    await flush();
    fixture.detectChanges();

    expect(el.textContent).toContain('could not be saved locally');
    expect(el.querySelector('.feedback')).toBeNull();
  });

  it('shows no timer or time-pressure UI anywhere', async () => {
    const { el, fixture } = await render();
    await answerSingle(fixture, el, 'B');

    const text = el.textContent ?? '';
    expect(el.querySelector('[role="timer"]')).toBeNull();
    expect(/\d{1,2}:\d{2}/.test(text)).toBe(false);
    expect(text).not.toContain('Time');
    expect(text).not.toContain('countdown');
    expect(text).not.toContain('deadline');
  });

  it('resumes a saved session when the runner opens without an active one', async () => {
    stub.active.set(false);
    stub.resume.mockImplementation(() => {
      stub.active.set(true);
      return Promise.resolve(true);
    });

    const { el } = await render();

    expect(stub.resume).toHaveBeenCalledWith('clf-c02');
    expect(el.textContent).not.toContain('No study exam running');
  });

  it('shows a recoverable empty state when nothing is active or resumable', async () => {
    stub.active.set(false);
    stub.resume.mockResolvedValue(false);

    const { el } = await render();

    expect(el.textContent).toContain('No study exam running');
    expect(el.querySelector('.progress-track')).toBeNull();
  });
});
