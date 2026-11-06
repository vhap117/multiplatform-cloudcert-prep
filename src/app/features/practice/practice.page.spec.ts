import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideIonicAngular } from '@ionic/angular';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SelectedCertService } from '../../core/content/selected-cert.service';
import { SETTINGS_KEYS } from '../../core/settings/local-settings';
import { STUDY_REPOSITORY } from '../../core/storage/repository-provider';
import type { SessionRow } from '../../core/storage/types';
import { CertSwitcherService } from '../../layout/cert-switcher/cert-switcher.service';
import { MockExamSessionService } from '../mock-exam/session/mock-exam-session.service';
import { StudyExamSessionService } from '../study-exam/session/study-exam-session.service';

import { PracticePage } from './practice.page';
import { practiceConfigPath } from './practice.routes';
import { PracticeSessionService } from './session/practice-session.service';

class FakeRepository {
  sessions: SessionRow[] = [];

  async listSessions(): Promise<SessionRow[]> {
    return this.sessions;
  }
}

let repository: FakeRepository;
let router: { navigateByUrl: ReturnType<typeof vi.fn> };
let mockSessions: { resume: ReturnType<typeof vi.fn> };
let studySessions: { resume: ReturnType<typeof vi.fn> };
let practiceSessions: { resume: ReturnType<typeof vi.fn> };
let switcher: { open: ReturnType<typeof vi.fn> };

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
    answeredCount: 3,
    correctCount: 2,
    wrongCount: 1,
    updatedAt: 1_000,
    ...overrides,
  };
}

async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
}

async function render(): Promise<{ el: HTMLElement; fixture: ComponentFixture<PracticePage> }> {
  await TestBed.configureTestingModule({
    imports: [PracticePage],
    providers: [
      provideRouter([]),
      provideIonicAngular(),
      { provide: STUDY_REPOSITORY, useValue: repository },
      { provide: MockExamSessionService, useValue: mockSessions },
      { provide: StudyExamSessionService, useValue: studySessions },
      { provide: PracticeSessionService, useValue: practiceSessions },
      { provide: CertSwitcherService, useValue: switcher },
    ],
  }).compileComponents();
  router = {
    navigateByUrl: vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true),
  };
  const fixture = TestBed.createComponent(PracticePage);
  fixture.detectChanges();
  await flush();
  fixture.detectChanges();
  return { el: fixture.nativeElement as HTMLElement, fixture };
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

beforeEach(() => {
  localStorage.setItem(SETTINGS_KEYS.selectedCert, 'clf-c02');
  repository = new FakeRepository();
  router = { navigateByUrl: vi.fn().mockResolvedValue(true) };
  mockSessions = { resume: vi.fn().mockResolvedValue(true) };
  studySessions = { resume: vi.fn().mockResolvedValue(true) };
  practiceSessions = { resume: vi.fn().mockResolvedValue(true) };
  switcher = { open: vi.fn().mockResolvedValue(undefined) };
});

afterEach(() => {
  localStorage.removeItem(SETTINGS_KEYS.selectedCert);
  TestBed.resetTestingModule();
});

describe('PracticePage domain list (PRACT-1, PRACT-2, PRACT-3)', () => {
  it('lists every domain of the selected cert with a practice action', async () => {
    const { el } = await render();

    const links = [...el.querySelectorAll<HTMLAnchorElement>('a.practice-domain')];
    expect(links).toHaveLength(4);
    expect(links.map((link) => link.querySelector('.ccp-body')?.textContent?.trim())).toEqual([
      'Cloud Concepts',
      'Security & Compliance',
      'Cloud Technology & Services',
      'Billing, Pricing & Support',
    ]);
  });

  it('links each domain to the config screen with that domain preselected', async () => {
    const { el } = await render();

    const links = [...el.querySelectorAll<HTMLAnchorElement>('a.practice-domain')];
    expect(links[0]?.getAttribute('href')).toBe(practiceConfigPath('clf-c02', 1));
    expect(links[3]?.getAttribute('href')).toBe(practiceConfigPath('clf-c02', 4));
  });

  it('names the selected cert', async () => {
    const { el } = await render();

    expect(el.textContent).toContain('AWS Cloud Practitioner');
    expect(el.textContent).toContain('CLF-C02');
  });
});

describe('PracticePage entry points (CERT-25, CERT-29)', () => {
  it('lists mock exam, domain practice, and study exam actions', async () => {
    const { el } = await render();

    buttonByText(el, 'Mock exam').click();
    buttonByText(el, 'Domain practice').click();
    buttonByText(el, 'Study exam').click();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/mock-exam/clf-c02');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/practice/clf-c02');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/study-exam/clf-c02');
  });

  it('opens the shared cert list from the All certifications entry', async () => {
    const { el } = await render();

    buttonByText(el, 'All certifications').click();

    expect(switcher.open).toHaveBeenCalledTimes(1);
  });
});

describe('PracticePage resume card (CERT-26)', () => {
  it('shows the most recent in-progress session and resumes it', async () => {
    repository.sessions = [
      session({ id: 'clf-c02:mock', kind: 'mock', updatedAt: 1_000 }),
      session({ id: 'clf-c02:study', kind: 'study', updatedAt: 2_000, answeredCount: 9 }),
      session({ id: 'aif-c01:practice', cert: 'aif-c01', kind: 'practice' }),
    ];
    const { el } = await render();

    expect(el.textContent).toContain('In progress');
    expect(el.textContent).toContain('Study exam · 9 answered');

    buttonByText(el, 'Resume Study exam').click();
    await flush();

    expect(studySessions.resume).toHaveBeenCalledWith('clf-c02');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/study-exam/clf-c02/run');
  });

  it('shows no resume card when nothing is in progress', async () => {
    const { el } = await render();

    expect(el.textContent).not.toContain('In progress');
  });
});

describe('PracticePage cert switching (CERT-21)', () => {
  it('re-scopes the entries and domains in place when the cert changes', async () => {
    const { el, fixture } = await render();

    TestBed.inject(SelectedCertService).select('aif-c01');
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    expect(el.textContent).toContain('AWS Certified AI Practitioner');
    expect(el.querySelectorAll('a.practice-domain')).toHaveLength(5);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});

@Component({ template: '' })
class PracticeTargetPage {}

describe('PracticePage navigation from the tab URL (PRACT-1)', () => {
  it('navigates to the absolute config URL even when rendered under /tabs/practice', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'tabs/practice', component: PracticePage },
          { path: 'practice/:certCode', component: PracticeTargetPage },
        ]),
        provideIonicAngular(),
        { provide: STUDY_REPOSITORY, useValue: repository },
        { provide: MockExamSessionService, useValue: mockSessions },
        { provide: StudyExamSessionService, useValue: studySessions },
        { provide: PracticeSessionService, useValue: practiceSessions },
        { provide: CertSwitcherService, useValue: switcher },
      ],
    });

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/tabs/practice');
    const link = harness.routeNativeElement?.querySelector<HTMLAnchorElement>(
      'a.practice-domain',
    );
    expect(link).not.toBeNull();

    link!.click();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/practice/clf-c02?domain=1');
  });
});
