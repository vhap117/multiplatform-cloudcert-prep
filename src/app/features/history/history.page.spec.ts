import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadAllQuestions } from '../../core/content/question-loader';
import type { Question } from '../../core/content/question-types';
import { SETTINGS_KEYS } from '../../core/settings/local-settings';
import { STUDY_REPOSITORY } from '../../core/storage/repository-provider';
import type {
  AttemptRow,
  QuestionResultRow,
} from '../../core/storage/types';

import { HistoryPage } from './history.page';

let bank: Question[];
let repository: FakeRepository;
let fixture: ComponentFixture<HistoryPage>;

function attempt(overrides: Partial<AttemptRow>): AttemptRow {
  return {
    id: 'attempt-1',
    cert: 'clf-c02',
    kind: 'mock',
    startedAt: 1,
    finishedAt: 2,
    totalQuestions: 10,
    correctCount: 8,
    scorePercent: 80,
    passed: true,
    timeTakenSeconds: 100,
    domainScores: [{ domainId: 1, correct: 8, total: 10, percent: 80 }],
    ...overrides,
  };
}

function result(question: Question, attemptId: string): QuestionResultRow {
  return {
    id: `${attemptId}:${question.id}`,
    attemptId,
    cert: 'clf-c02',
    domainId: question.domainId,
    questionId: question.id,
    userAnswer: 'A',
    correctAnswer: 'A',
    isCorrect: true,
    wasFlagged: false,
    answeredAt: 1,
  };
}

class FakeRepository {
  attempts: AttemptRow[] = [];
  practiceResults: QuestionResultRow[] = [];
  questionResults: QuestionResultRow[] = [];
  failAttempts = false;

  async listAttempts(): Promise<AttemptRow[]> {
    if (this.failAttempts) {
      throw new Error('Could not read history.');
    }
    return this.attempts;
  }

  async listPracticeResults(): Promise<QuestionResultRow[]> {
    return this.practiceResults;
  }

  async listQuestionResults(): Promise<QuestionResultRow[]> {
    return this.questionResults;
  }
}

async function render(): Promise<HTMLElement> {
  await TestBed.configureTestingModule({
    imports: [HistoryPage],
    providers: [
      provideIonicAngular(),
      { provide: STUDY_REPOSITORY, useValue: repository },
    ],
  }).compileComponents();
  fixture = TestBed.createComponent(HistoryPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
}

function textOf(el: HTMLElement): string {
  return (el.textContent ?? '').replace(/\s+/g, ' ');
}

function buttonByText(el: HTMLElement, text: string): HTMLElement {
  const button = [...el.querySelectorAll('button, ion-button')].find(
    (candidate) => (candidate.textContent ?? '').replace(/\s+/g, ' ').trim() === text,
  );
  if (!button) {
    throw new Error(`button "${text}" not found`);
  }
  return button as HTMLElement;
}

async function click(el: HTMLElement, button: HTMLElement): Promise<void> {
  button.click();
  await flush();
  fixture.detectChanges();
}

beforeEach(async () => {
  localStorage.setItem(SETTINGS_KEYS.selectedCert, 'clf-c02');
  bank = await loadAllQuestions('clf-c02');
  repository = new FakeRepository();
});

afterEach(() => {
  localStorage.removeItem(SETTINGS_KEYS.selectedCert);
  TestBed.resetTestingModule();
});

describe('HistoryPage history segment', () => {
  it('names the selected cert and renders both segments', async () => {
    const el = await render();
    const text = textOf(el);

    expect(text).toContain('AWS Cloud Practitioner');
    expect(text).toContain('History');
    expect(text).toContain('Statistics');
    expect(el.querySelectorAll('[role="tab"]')).toHaveLength(2);
  });

  it('shows exam verdicts and a practice session without review', async () => {
    repository.attempts = [
      attempt({ id: 'mock-1', kind: 'mock', passed: true }),
      attempt({ id: 'study-1', kind: 'study', passed: false }),
      attempt({ id: 'practice-1', kind: 'practice', scorePercent: 100 }),
    ];
    const el = await render();

    expect(el.querySelectorAll('.attempt-card')).toHaveLength(3);
    expect(textOf(el)).toContain('Passed');
    expect(textOf(el)).toContain('Not passed');
    expect(textOf(el)).toContain('Completed');

    const practiceCard = [...el.querySelectorAll<HTMLElement>('.attempt-card')].find(
      (card) => card.textContent?.includes('Domain practice'),
    );
    expect(practiceCard?.querySelector('.details-button')).toBeNull();
  });

  it('filters passed and failed without including practice', async () => {
    repository.attempts = [
      attempt({ id: 'mock-pass', kind: 'mock', passed: true }),
      attempt({ id: 'study-fail', kind: 'study', passed: false }),
      attempt({ id: 'practice', kind: 'practice', passed: true }),
    ];
    const el = await render();

    await click(el, buttonByText(el, 'Passed'));
    expect(el.querySelectorAll('.attempt-card')).toHaveLength(1);
    const cards = [...el.querySelectorAll<HTMLElement>('.attempt-card')];
    expect(cards[0]?.textContent).toContain('Mock exam');
    expect(cards.some((card) => card.textContent?.includes('Domain practice'))).toBe(false);

    await click(el, buttonByText(el, 'Failed'));
    expect(el.querySelectorAll('.attempt-card')).toHaveLength(1);
    expect(textOf(el)).toContain('Study exam');
  });

  it('uses Load more pagination', async () => {
    repository.attempts = Array.from({ length: 12 }, (_, index) =>
      attempt({
        id: `attempt-${index}`,
        finishedAt: 100 - index,
      }),
    );
    const el = await render();

    expect(el.querySelectorAll('.attempt-card')).toHaveLength(10);
    await click(el, buttonByText(el, 'Load more'));
    expect(el.querySelectorAll('.attempt-card')).toHaveLength(12);
  });

  it('expands an exam attempt into question review', async () => {
    const question = bank[0]!;
    repository.attempts = [attempt({ id: 'mock-1' })];
    repository.questionResults = [result(question, 'mock-1')];
    const el = await render();

    await click(el, buttonByText(el, 'Show details'));

    expect(textOf(el)).toContain('Results by domain');
    expect(textOf(el)).toContain('Review answers');
    expect(el.querySelectorAll('.review-card')).toHaveLength(1);
    expect(textOf(el)).toContain(question.question);
  });
});

describe('HistoryPage statistics segment', () => {
  it('shows local totals, exam metrics, and per-kind statistics', async () => {
    repository.attempts = [
      attempt({ kind: 'mock', totalQuestions: 10, correctCount: 8, timeTakenSeconds: 100 }),
      attempt({
        kind: 'study',
        totalQuestions: 10,
        correctCount: 5,
        scorePercent: 50,
        passed: false,
        timeTakenSeconds: 100,
      }),
      attempt({
        kind: 'practice',
        totalQuestions: 20,
        correctCount: 20,
        scorePercent: 100,
        timeTakenSeconds: 50,
      }),
    ];
    const el = await render();

    await click(el, buttonByText(el, 'Statistics'));
    const text = textOf(el);

    expect(text).toContain('These numbers are personal and stored only on this device');
    expect(text).toContain('Exam attempts2');
    expect(text).toContain('Practice sessions1');
    expect(text).toContain('Questions answered40');
    expect(text).toContain('Accuracy83%');
    expect(text).toContain('Pass rate50%');
    expect(text).toContain('Mock exam');
    expect(text).toContain('Study exam');
    expect(text).toContain('Domain practice');
  });

  it('shows a retryable error when history cannot be read', async () => {
    repository.failAttempts = true;
    const el = await render();

    expect(textOf(el)).toContain('Could not read history.');
    expect(() => buttonByText(el, 'Try again')).not.toThrow();
  });
});
