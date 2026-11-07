import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { expectNoA11yViolations } from '../../../core/a11y/axe-scan';
import { SETTINGS_KEYS } from '../../../core/settings/local-settings';
import { MockExamSessionError } from '../session/mock-exam-session.errors';
import { MockExamSessionService } from '../session/mock-exam-session.service';

import { MockExamStartPage } from './mock-exam-start.page';

/**
 * Start screen (S10, EXAM-1, EXAM-4, EXAM-5, EXAM-6, DATA-40).
 *
 * The session service is stubbed: these specs pin the screen behaviour and
 * the exact call order into the service, never the service internals.
 */

interface SessionStub {
  hasInProgress: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
  abandon: ReturnType<typeof vi.fn>;
}

function makeStub(): SessionStub {
  return {
    hasInProgress: vi.fn().mockResolvedValue(false),
    start: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(true),
    abandon: vi.fn().mockResolvedValue(undefined),
  };
}

async function renderPage(stub: SessionStub): Promise<ComponentFixture<MockExamStartPage>> {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [MockExamStartPage],
    providers: [{ provide: MockExamSessionService, useValue: stub }],
  }).compileComponents();
  const fixture = TestBed.createComponent(MockExamStartPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

function ionButton(root: ParentNode, label: string): HTMLElement | null {
  const buttons = Array.from(root.querySelectorAll('ion-button'));
  const match = buttons.find((button) =>
    (button.textContent ?? '').replace(/\s+/g, ' ').trim().includes(label),
  );
  return (match as HTMLElement | undefined) ?? null;
}

function dialogOf(root: ParentNode): HTMLElement | null {
  return root.querySelector('[role="alertdialog"]');
}

async function click(fixture: ComponentFixture<MockExamStartPage>, element: HTMLElement): Promise<void> {
  element.click();
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

beforeEach(() => {
  localStorage.setItem(SETTINGS_KEYS.selectedCert, 'clf-c02');
});

afterEach(() => {
  localStorage.removeItem(SETTINGS_KEYS.selectedCert);
  TestBed.resetTestingModule();
});

describe('MockExamStartPage facts (EXAM-1, EXAM-4)', () => {
  it('shows the format, question count, duration, and pass threshold from the registry', async () => {
    const stub = makeStub();
    const fixture = await renderPage(stub);
    const root = fixture.nativeElement as HTMLElement;
    const text = (root.textContent ?? '').replace(/\s+/g, ' ');

    expect(root.querySelectorAll('h1')).toHaveLength(1);
    expect(text).toContain('AWS Cloud Practitioner (CLF-C02)');
    expect(text).toContain('Timed mock exam, scored by percentage');
    expect(text).toContain('65');
    expect(text).toContain('1h 30m');
    expect(text).toContain('67 percent');

    const start = ionButton(root, 'Start exam');
    expect(start).not.toBeNull();
    expect(start?.textContent?.trim()).toContain('Start exam');
  });

  it('uses the first active cert when no settings selection exists', async () => {
    localStorage.removeItem(SETTINGS_KEYS.selectedCert);
    const stub = makeStub();
    const fixture = await renderPage(stub);
    const text = ((fixture.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');

    expect(text).toContain('AWS Certified AI Practitioner (AIF-C01)');
    expect(stub.hasInProgress).toHaveBeenCalledWith('aif-c01');
  });

  it('reads the registry for the selected cert, not hardcoded numbers', async () => {
    localStorage.setItem(SETTINGS_KEYS.selectedCert, 'saa-c03');
    const stub = makeStub();
    const fixture = await renderPage(stub);
    const text = ((fixture.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');

    expect(text).toContain('AWS Solutions Architect Associate (SAA-C03)');
    expect(text).toContain('2h 10m');
    expect(text).toContain('69 percent');
  });
});

describe('MockExamStartPage resume offer (EXAM-5)', () => {
  it('hides Resume exam when no session is in progress', async () => {
    const stub = makeStub();
    const fixture = await renderPage(stub);
    const root = fixture.nativeElement as HTMLElement;

    expect(stub.hasInProgress).toHaveBeenCalledWith('clf-c02');
    expect(ionButton(root, 'Resume exam')).toBeNull();
    expect(ionButton(root, 'Start exam')).not.toBeNull();
  });

  it('offers Resume exam when a session is in progress, and resume calls the service', async () => {
    const stub = makeStub();
    stub.hasInProgress.mockResolvedValue(true);
    const fixture = await renderPage(stub);
    const root = fixture.nativeElement as HTMLElement;

    const resume = ionButton(root, 'Resume exam');
    expect(resume).not.toBeNull();

    await click(fixture, resume as HTMLElement);

    expect(stub.resume).toHaveBeenCalledTimes(1);
    expect(stub.resume).toHaveBeenCalledWith('clf-c02');
    expect(stub.start).not.toHaveBeenCalled();
  });
});

describe('MockExamStartPage resume-or-discard choice (EXAM-6, DATA-40)', () => {
  it('opens an accessible choice dialog on Start and starts nothing until a choice is made', async () => {
    const stub = makeStub();
    stub.hasInProgress.mockResolvedValue(true);
    const fixture = await renderPage(stub);
    const root = fixture.nativeElement as HTMLElement;

    await click(fixture, ionButton(root, 'Start exam') as HTMLElement);

    const dialog = dialogOf(root);
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    const titleId = dialog?.getAttribute('aria-labelledby');
    expect(titleId).toBeTruthy();
    const title = titleId ? root.querySelector(`#${titleId}`) : null;
    expect(title?.textContent ?? '').toContain('Exam already in progress');

    expect(stub.start).not.toHaveBeenCalled();
    expect(stub.resume).not.toHaveBeenCalled();
    expect(stub.abandon).not.toHaveBeenCalled();

    await click(fixture, ionButton(dialog as HTMLElement, 'Cancel') as HTMLElement);

    expect(dialogOf(root)).toBeNull();
    expect(stub.start).not.toHaveBeenCalled();
    expect(stub.resume).not.toHaveBeenCalled();
    expect(stub.abandon).not.toHaveBeenCalled();
  });

  it('resumes from the dialog without starting or abandoning', async () => {
    const stub = makeStub();
    stub.hasInProgress.mockResolvedValue(true);
    const fixture = await renderPage(stub);
    const root = fixture.nativeElement as HTMLElement;

    await click(fixture, ionButton(root, 'Start exam') as HTMLElement);
    const dialog = dialogOf(root) as HTMLElement;
    await click(fixture, ionButton(dialog, 'Resume exam') as HTMLElement);

    expect(stub.resume).toHaveBeenCalledTimes(1);
    expect(stub.resume).toHaveBeenCalledWith('clf-c02');
    expect(stub.start).not.toHaveBeenCalled();
    expect(stub.abandon).not.toHaveBeenCalled();
    expect(dialogOf(root)).toBeNull();
  });

  it('discarding calls abandon before start', async () => {
    const stub = makeStub();
    stub.hasInProgress.mockResolvedValue(true);
    const fixture = await renderPage(stub);
    const root = fixture.nativeElement as HTMLElement;

    await click(fixture, ionButton(root, 'Start exam') as HTMLElement);
    const dialog = dialogOf(root) as HTMLElement;
    expect(stub.start).not.toHaveBeenCalled();

    await click(fixture, ionButton(dialog, 'Discard and start fresh') as HTMLElement);

    expect(stub.abandon).toHaveBeenCalledTimes(1);
    expect(stub.start).toHaveBeenCalledTimes(1);
    expect(stub.start).toHaveBeenCalledWith('clf-c02');
    const abandonOrder = stub.abandon.mock.invocationCallOrder[0] as number;
    const startOrder = stub.start.mock.invocationCallOrder[0] as number;
    expect(abandonOrder).toBeLessThan(startOrder);
    expect(dialogOf(root)).toBeNull();
  });
});

describe('MockExamStartPage refusals (EXAM-1)', () => {
  it('surfaces the exact service message when the bank cannot supply the exam', async () => {
    const message =
      'Cert "clf-c02" can supply 10 of 65 exam questions; a short exam is refused.';
    const stub = makeStub();
    stub.start.mockRejectedValue(new MockExamSessionError(message));
    const fixture = await renderPage(stub);
    const root = fixture.nativeElement as HTMLElement;

    await click(fixture, ionButton(root, 'Start exam') as HTMLElement);

    const alert = root.querySelector('[role="alert"]');
    expect(alert?.textContent?.trim()).toBe(message);
    // The start action stays available so the refusal is not a dead end.
    expect(ionButton(root, 'Start exam')).not.toBeNull();
  });

  it('refuses a cert whose registry status is not active without calling the service', async () => {
    localStorage.setItem(SETTINGS_KEYS.selectedCert, 'saa-c03');
    const stub = makeStub();
    const fixture = await renderPage(stub);
    const root = fixture.nativeElement as HTMLElement;

    const alert = root.querySelector('[role="alert"]');
    expect(alert?.textContent ?? '').toContain('coming soon');
    expect(ionButton(root, 'Start exam')).toBeNull();
    expect(ionButton(root, 'Resume exam')).toBeNull();
    expect(stub.start).not.toHaveBeenCalled();
    expect(stub.resume).not.toHaveBeenCalled();
    expect(stub.hasInProgress).not.toHaveBeenCalled();
  });
});

describe('MockExamStartPage accessibility', () => {
  it('has no axe violations in either theme', async () => {
    const fixture = await renderPage(makeStub());
    const el = fixture.nativeElement as HTMLElement;

    await expectNoA11yViolations(el, 'light');
    await expectNoA11yViolations(el, 'dark');
  });
});
