import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadAllQuestions } from '../../core/content/question-loader';
import type { Question } from '../../core/content/question-types';
import { SETTINGS_KEYS } from '../../core/settings/local-settings';
import { STUDY_REPOSITORY } from '../../core/storage/repository-provider';
import type {
  AttemptRow,
  QuestionResultRow,
  SessionRow,
} from '../../core/storage/types';
import { mockExamStartPath } from '../mock-exam/mock-exam.routes';
import { MockExamSessionService } from '../mock-exam/session/mock-exam-session.service';
import { practiceConfigPath } from '../practice/practice.routes';
import { PracticeSessionService } from '../practice/session/practice-session.service';
import { StudyExamSessionService } from '../study-exam/session/study-exam-session.service';

import { HomePage } from './home.page';

let bank: Question[];
let fixture: ComponentFixture<HomePage>;
let repository: FakeRepository;
let router: { navigateByUrl: ReturnType<typeof vi.fn> };
let mockSessions: { resume: ReturnType<typeof vi.fn> };
let studySessions: { resume: ReturnType<typeof vi.fn> };
let practiceSessions: { resume: ReturnType<typeof vi.fn> };

function attempt(overrides: Partial<AttemptRow>): AttemptRow {
  return {
    id: 'a',
    cert: 'clf-c02',
    kind: 'mock',
    startedAt: 1,
    finishedAt: 2,
    totalQuestions: 10,
    correctCount: 5,
    scorePercent: 50,
    passed: false,
    timeTakenSeconds: 10,
    domainScores: [],
    ...overrides,
  };
}

function session(overrides: Partial<SessionRow>): SessionRow {
  return {
    id: 'clf-c02:mock',
    cert: 'clf-c02',
    kind: 'mock',
    questionOrder: [],
    currentIndex: 0,
    answers: {},
    feedbackShown: [],
    flagged: [],
    optionKeyMaps: {},
    startedAt: 1,
    deadlineAt: null,
    answeredCount: 2,
    correctCount: 1,
    wrongCount: 1,
    updatedAt: 1_000,
    ...overrides,
  };
}

function practiceResult(question: Question, isCorrect = true): QuestionResultRow {
  return {
    id: `result-${question.id}`,
    attemptId: null,
    cert: 'clf-c02',
    domainId: question.domainId,
    questionId: question.id,
    userAnswer: 'A',
    correctAnswer: 'A',
    isCorrect,
    wasFlagged: false,
    answeredAt: 1,
  };
}

class FakeRepository {
  attempts: AttemptRow[] = [];
  practiceResults: QuestionResultRow[] = [];
  sessions: SessionRow[] = [];
  failAttempts = false;

  async listAttempts(): Promise<AttemptRow[]> {
    if (this.failAttempts) {
      throw new Error('Could not read attempts.');
    }
    return this.attempts;
  }

  async listPracticeResults(): Promise<QuestionResultRow[]> {
    return this.practiceResults;
  }

  async listSessions(): Promise<SessionRow[]> {
    return this.sessions;
  }
}

async function render(): Promise<HTMLElement> {
  await TestBed.configureTestingModule({
    imports: [HomePage],
    providers: [
      provideIonicAngular(),
      { provide: Router, useValue: router },
      { provide: STUDY_REPOSITORY, useValue: repository },
      { provide: MockExamSessionService, useValue: mockSessions },
      { provide: StudyExamSessionService, useValue: studySessions },
      { provide: PracticeSessionService, useValue: practiceSessions },
    ],
  }).compileComponents();
  fixture = TestBed.createComponent(HomePage);
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

function metricValue(el: HTMLElement, label: string): string {
  const metric = [...el.querySelectorAll<HTMLElement>('.metric')].find(
    (candidate) => candidate.querySelector('dt')?.textContent?.trim() === label,
  );
  return metric?.querySelector('dd')?.textContent?.trim() ?? '';
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
}

beforeEach(async () => {
  localStorage.setItem(SETTINGS_KEYS.selectedCert, 'clf-c02');
  bank = await loadAllQuestions('clf-c02');
  repository = new FakeRepository();
  router = { navigateByUrl: vi.fn().mockResolvedValue(true) };
  mockSessions = { resume: vi.fn().mockResolvedValue(true) };
  studySessions = { resume: vi.fn().mockResolvedValue(true) };
  practiceSessions = { resume: vi.fn().mockResolvedValue(true) };
});

afterEach(() => {
  localStorage.removeItem(SETTINGS_KEYS.selectedCert);
  TestBed.resetTestingModule();
});

describe('HomePage cert context', () => {
  it('names the selected cert with level and question count', async () => {
    const el = await render();
    const text = textOf(el);

    expect(el.querySelectorAll('h1')).toHaveLength(1);
    expect(text).toContain('AWS Cloud Practitioner');
    expect(text).toContain('CLF-C02');
    expect(text).toContain('Foundational');
    expect(text).toContain('65 questions');
  });

  it('offers the two dashboard primary actions', async () => {
    const el = await render();

    await click(el, buttonByText(el, 'Start mock exam'));
    expect(router.navigateByUrl).toHaveBeenCalledWith(mockExamStartPath('clf-c02'));

    await click(el, buttonByText(el, 'Start domain practice'));
    expect(router.navigateByUrl).toHaveBeenCalledWith(practiceConfigPath('clf-c02'));

    await click(el, buttonByText(el, 'Study exam'));
    expect(router.navigateByUrl).toHaveBeenCalledWith('/study-exam/clf-c02');
  });
});

describe('HomePage exam performance', () => {
  it('shows all-time exam metrics and excludes practice from them', async () => {
    repository.attempts = [
      attempt({ id: 'mock', kind: 'mock', passed: true, scorePercent: 80, finishedAt: 30 }),
      attempt({ id: 'study', kind: 'study', passed: false, scorePercent: 50, finishedAt: 20 }),
      attempt({ id: 'practice', kind: 'practice', passed: true, scorePercent: 100, finishedAt: 40 }),
    ];
    const el = await render();
    const text = textOf(el);

    expect(metricValue(el, 'Pass rate')).toBe('50%');
    expect(metricValue(el, 'Average score')).toBe('65%');
    expect(metricValue(el, 'Best score')).toBe('80%');
    expect(text).toContain('Across 2 completed mock and study exam attempts');
  });

  it('shows N/A and the baseline hint when there are no exam attempts', async () => {
    repository.attempts = [attempt({ kind: 'practice', scorePercent: 100 })];
    const el = await render();
    const text = textOf(el);

    expect(metricValue(el, 'Pass rate')).toBe('N/A');
    expect(metricValue(el, 'Average score')).toBe('N/A');
    expect(metricValue(el, 'Best score')).toBe('N/A');
    expect(text).toContain('Complete a mock or study exam to build your baseline');
    expect(text).toContain('No exam attempts yet');
  });

  it('lists the latest three exam attempts and links to history', async () => {
    repository.attempts = [
      attempt({ id: '1', kind: 'mock', finishedAt: 10, scorePercent: 60, passed: true }),
      attempt({ id: '2', kind: 'study', finishedAt: 20, scorePercent: 70, passed: true }),
      attempt({ id: '3', kind: 'mock', finishedAt: 30, scorePercent: 80, passed: false }),
      attempt({ id: '4', kind: 'study', finishedAt: 40, scorePercent: 90, passed: true }),
      attempt({ id: 'p', kind: 'practice', finishedAt: 50, scorePercent: 100, passed: true }),
    ];
    const el = await render();
    const text = textOf(el);

    expect(el.querySelectorAll('.attempt-row')).toHaveLength(3);
    expect(text).toContain('Recent exam attempts');
    expect(text).not.toContain('Domain practice');

    await click(el, buttonByText(el, 'View history'));
    expect(router.navigateByUrl).toHaveBeenCalledWith('/tabs/history');
  });
});

describe('HomePage combined domain view', () => {
  it('shows practice coverage, exam accuracy, and no-exam-data states', async () => {
    const first = bank.find((question) => question.domainId === 1)!;
    repository.practiceResults = [practiceResult(first, true)];
    repository.attempts = [
      attempt({
        kind: 'mock',
        domainScores: [{ domainId: 1, correct: 1, total: 2, percent: 50 }],
      }),
    ];
    const el = await render();
    const text = textOf(el);

    expect(text).toContain('Practice coverage');
    expect(text).toContain('Exam accuracy');
    expect(el.querySelectorAll('[role="progressbar"]').length).toBeGreaterThanOrEqual(4);
    expect(text).toContain('No exam data');
  });

  it('uses the issue 004 recommendation for Next up and preselects the domain', async () => {
    const el = await render();

    expect(textOf(el)).toContain('You have not practiced Cloud Concepts yet.');
    await click(el, buttonByText(el, 'Practice Cloud Concepts'));
    expect(router.navigateByUrl).toHaveBeenCalledWith(practiceConfigPath('clf-c02', 1));
  });
});

describe('HomePage resume cards', () => {
  it('shows one card per in-progress kind for the selected cert and resumes directly', async () => {
    repository.sessions = [
      session({ id: 'clf-c02:mock', kind: 'mock', answeredCount: 4 }),
      session({ id: 'clf-c02:study', kind: 'study', answeredCount: 8, updatedAt: 2_000 }),
      session({ id: 'aif-c01:practice', cert: 'aif-c01', kind: 'practice' }),
    ];
    const el = await render();

    expect(el.querySelectorAll('.resume-card')).toHaveLength(2);
    expect(textOf(el)).toContain('Mock exam');
    expect(textOf(el)).toContain('Study exam');
    expect(textOf(el)).not.toContain('Domain practice');

    await click(el, buttonByText(el, 'Resume Study exam'));
    expect(studySessions.resume).toHaveBeenCalledWith('clf-c02');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/study-exam/clf-c02/run');
  });
});

describe('HomePage section-level failures', () => {
  it('keeps the header and resume section while exam and domain sections show retry errors', async () => {
    repository.failAttempts = true;
    repository.sessions = [session({ kind: 'practice', answeredCount: 1 })];
    const el = await render();
    const text = textOf(el);

    expect(text).toContain('AWS Cloud Practitioner');
    expect(text).toContain('Could not read attempts.');
    expect(text).toContain('In progress');
    expect(buttonByText(el, 'Resume Domain practice')).not.toBeNull();

    repository.failAttempts = false;
    repository.attempts = [attempt({ kind: 'mock', passed: true, scorePercent: 80 })];
    const retry = [...el.querySelectorAll('button, ion-button')].find(
      (candidate) => (candidate.textContent ?? '').trim() === 'Try again',
    ) as HTMLElement;
    retry.click();
    await flush();
    fixture.detectChanges();
    expect(metricValue(el, 'Pass rate')).toBe('100%');
  });
});
