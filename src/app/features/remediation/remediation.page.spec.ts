import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AlertController, provideIonicAngular } from '@ionic/angular';

import { getCert } from '../../core/content/cert-registry';
import { loadAllQuestions } from '../../core/content/question-loader';
import { questionType, type Question } from '../../core/content/question-types';
import { correctAnswerFor } from '../../core/exam';
import { STUDY_REPOSITORY } from '../../core/storage/repository-provider';
import type {
  QuestionResultRow,
  RemediationDismissalRow,
} from '../../core/storage/types';

import { RemediationPage } from './remediation.page';

const CERT = getCert('clf-c02')!;

let bank: readonly Question[];
let question: Question;
let wrongKey: string;
let correctKey: string;

class FakeRepository {
  results: QuestionResultRow[] = [];
  dismissals: RemediationDismissalRow[] = [];
  readonly putRemediationDismissal = vi.fn(async (row: RemediationDismissalRow) => {
    this.dismissals = [...this.dismissals.filter((item) => item.id !== row.id), row];
  });

  async listPracticeResults(): Promise<QuestionResultRow[]> {
    return this.results;
  }

  async listRemediationDismissals(): Promise<RemediationDismissalRow[]> {
    return this.dismissals;
  }
}

let repository: FakeRepository;
let fixture: ComponentFixture<RemediationPage>;
let dismissRole: string;
let createdAlerts: unknown[];

const alertControllerStub = {
  create(options: unknown): Promise<{
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

function result(overrides: Partial<QuestionResultRow> = {}): QuestionResultRow {
  return {
    id: `${CERT.code}:practice:1000:${question.id}`,
    attemptId: null,
    cert: CERT.code,
    domainId: question.domainId,
    questionId: question.id,
    userAnswer: wrongKey,
    correctAnswer: correctKey,
    isCorrect: false,
    wasFlagged: false,
    answeredAt: 1000,
    ...overrides,
  };
}

async function render(): Promise<HTMLElement> {
  await TestBed.configureTestingModule({
    imports: [RemediationPage],
    providers: [
      provideRouter([]),
      provideIonicAngular(),
      { provide: AlertController, useValue: alertControllerStub },
      { provide: STUDY_REPOSITORY, useValue: repository },
    ],
  }).compileComponents();
  fixture = TestBed.createComponent(RemediationPage);
  fixture.componentRef.setInput('certCode', CERT.code);
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

beforeEach(async () => {
  bank = await loadAllQuestions(CERT.code);
  question = bank.find((candidate) => questionType(candidate) === 'single')!;
  correctKey = String(correctAnswerFor(question));
  wrongKey = Object.keys(question.options).find((key) => key !== correctKey)!;
  repository = new FakeRepository();
  repository.results = [result()];
  dismissRole = 'cancel';
  createdAlerts = [];
  TestBed.resetTestingModule();
});

afterEach(() => {
  TestBed.resetTestingModule();
});

describe('RemediationPage', () => {
  it('renders the stubbed empty state when there is nothing to remediate', async () => {
    repository.results = [];
    const el = await render();

    expect(el.textContent).toContain('Nothing to remediate');
  });

  it('renders the wrong answer read-only with the practice feedback groups', async () => {
    const el = await render();

    expect(el.textContent).toContain(question.question);
    expect(el.textContent).toContain('Incorrect answer.');
    expect(el.textContent).toContain('Wrong options you chose');
    expect(el.textContent).toContain('Correct options you missed');
    expect(el.querySelector('input[type="radio"]')).toBeNull();
    expect(el.querySelector('ion-item-sliding')).toBeNull();
  });

  it('asks for confirmation and dismisses the question on Remove', async () => {
    dismissRole = 'destructive';
    const el = await render();

    const remove = [...el.querySelectorAll('ion-button')].find((button) =>
      (button.textContent ?? '').includes('Remove from remediation'),
    ) as HTMLElement | undefined;
    expect(remove).not.toBeUndefined();
    remove!.click();
    await flush();
    fixture.detectChanges();

    expect(createdAlerts).toHaveLength(1);
    expect(repository.putRemediationDismissal).toHaveBeenCalledTimes(1);
    expect(repository.putRemediationDismissal.mock.calls[0]?.[0]).toMatchObject({
      id: `${CERT.code}:${question.id}`,
      cert: CERT.code,
      questionId: question.id,
    });
    expect(el.textContent).toContain('Nothing to remediate');
  });

  it('does not dismiss when the confirmation is cancelled', async () => {
    const el = await render();

    const remove = [...el.querySelectorAll('ion-button')].find((button) =>
      (button.textContent ?? '').includes('Remove from remediation'),
    ) as HTMLElement | undefined;
    remove!.click();
    await flush();
    fixture.detectChanges();

    expect(repository.putRemediationDismissal).not.toHaveBeenCalled();
    expect(el.textContent).not.toContain('Nothing to remediate');
  });

  it('hides a question whose dismissal is newer than the wrong answer', async () => {
    repository.dismissals = [
      { id: `${CERT.code}:${question.id}`, cert: CERT.code, questionId: question.id, dismissedAt: 2000 },
    ];
    const el = await render();

    expect(el.textContent).toContain('Nothing to remediate');
  });
});
