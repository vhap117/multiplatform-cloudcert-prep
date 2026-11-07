import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { expectNoA11yViolations } from '../../../core/a11y/axe-scan';
import { SETTINGS_KEYS } from '../../../core/settings/local-settings';
import { StudyExamSessionError } from '../session/study-exam-session.errors';
import { StudyExamSessionService } from '../session/study-exam-session.service';
import { studyExamRunPath } from '../study-exam.routes';

import { StudyExamStartPage } from './study-exam-start.page';

/**
 * Start screen (S1, S10; STUDY-59, STUDY-60).
 *
 * The session service and the router are stubbed: these specs pin the screen
 * behaviour and the exact call order into the service, never the service
 * internals.
 */

interface SessionStub {
  hasInProgress: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
  discard: ReturnType<typeof vi.fn>;
}

interface RouterStub {
  navigateByUrl: ReturnType<typeof vi.fn>;
}

function makeStub(): SessionStub {
  return {
    hasInProgress: vi.fn().mockResolvedValue(false),
    start: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(true),
    discard: vi.fn().mockResolvedValue(undefined),
  };
}

function makeRouter(): RouterStub {
  return { navigateByUrl: vi.fn().mockResolvedValue(true) };
}

async function renderPage(
  stub: SessionStub,
  router: RouterStub,
): Promise<ComponentFixture<StudyExamStartPage>> {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [StudyExamStartPage],
    providers: [
      { provide: StudyExamSessionService, useValue: stub },
      { provide: Router, useValue: router },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(StudyExamStartPage);
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

function dialogsOf(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll('[role="alertdialog"]'));
}

function textOf(root: ParentNode): string {
  return (root.textContent ?? '').replace(/\s+/g, ' ');
}

async function click(
  fixture: ComponentFixture<StudyExamStartPage>,
  element: HTMLElement,
): Promise<void> {
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

describe('StudyExamStartPage mode copy (S1, STUDY-59)', () => {
  it('explains the mode: untimed, immediate feedback, saved automatically, resumable', async () => {
    const stub = makeStub();
    const router = makeRouter();
    const fixture = await renderPage(stub, router);
    const root = fixture.nativeElement as HTMLElement;
    const text = textOf(root);

    expect(root.querySelectorAll('h1')).toHaveLength(1);
    expect(text).toContain('Untimed: no countdown, no deadline, no auto-submit.');
    expect(text).toContain('Feedback after every answer');
    expect(text).toContain('saved automatically');
    expect(text).toContain('resume exactly where you left off');
    // The untimed promise never becomes time pressure: no duration, no timer.
    expect(text).not.toContain('time limit');
    expect(text).not.toContain('minutes');
  });
});

describe('StudyExamStartPage exam facts (STUDY-59)', () => {
  it('shows the question count and the domain split from the registry', async () => {
    const stub = makeStub();
    const router = makeRouter();
    const fixture = await renderPage(stub, router);
    const root = fixture.nativeElement as HTMLElement;
    const text = textOf(root);

    expect(text).toContain('AWS Cloud Practitioner (CLF-C02)');
    expect(text).toContain('Untimed study exam with feedback after every answer');
    const factValues = Array.from(root.querySelectorAll('.fact dd')).map((dd) =>
      (dd.textContent ?? '').trim(),
    );
    expect(factValues[1]).toBe('65');
    // The split is the engine composition for clf-c02: 16, 20, 22, and the
    // last domain absorbing the remainder with 7 of 65.
    expect(text).toContain('Cloud Concepts: 16 of 65');
    expect(text).toContain('Security & Compliance: 20 of 65');
    expect(text).toContain('Cloud Technology & Services: 22 of 65');
    expect(text).toContain('Billing, Pricing & Support: 7 of 65');
  });

  it('uses the first active cert when no settings selection exists', async () => {
    localStorage.removeItem(SETTINGS_KEYS.selectedCert);
    const stub = makeStub();
    const router = makeRouter();
    const fixture = await renderPage(stub, router);
    const text = textOf(fixture.nativeElement as HTMLElement);

    expect(text).toContain('AWS Certified AI Practitioner (AIF-C01)');
    expect(stub.hasInProgress).toHaveBeenCalledWith('aif-c01');
  });
});

describe('StudyExamStartPage resume offer (STUDY-60)', () => {
  it('hides Resume study exam when no session is in progress', async () => {
    const stub = makeStub();
    const router = makeRouter();
    const fixture = await renderPage(stub, router);
    const root = fixture.nativeElement as HTMLElement;

    expect(stub.hasInProgress).toHaveBeenCalledWith('clf-c02');
    expect(ionButton(root, 'Resume study exam')).toBeNull();
    expect(ionButton(root, 'Start study exam')).not.toBeNull();
  });

  it('offers Resume as the primary action when a session is in progress', async () => {
    const stub = makeStub();
    stub.hasInProgress.mockResolvedValue(true);
    const router = makeRouter();
    const fixture = await renderPage(stub, router);
    const root = fixture.nativeElement as HTMLElement;

    const resume = ionButton(root, 'Resume study exam');
    const start = ionButton(root, 'Start study exam');
    expect(resume).not.toBeNull();
    expect(start).not.toBeNull();

    // Resume is the primary action: solid fill, and first in the DOM so
    // reading and focus order put it ahead of the outlined Start. The fill
    // value is read as the element property: the Ionic proxy assigns inputs
    // as properties, so this is the value the button renders with.
    const resumeFill = (resume as unknown as { fill?: string } | null)?.fill;
    const startFill = (start as unknown as { fill?: string } | null)?.fill;
    expect(resumeFill).not.toBe('outline');
    expect(startFill).toBe('outline');
    expect(resume && start ? resume.compareDocumentPosition(start) : 0).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('resume calls the service and navigates to the runner path', async () => {
    const stub = makeStub();
    stub.hasInProgress.mockResolvedValue(true);
    const router = makeRouter();
    const fixture = await renderPage(stub, router);
    const root = fixture.nativeElement as HTMLElement;

    await click(fixture, ionButton(root, 'Resume study exam') as HTMLElement);

    expect(stub.resume).toHaveBeenCalledTimes(1);
    expect(stub.resume).toHaveBeenCalledWith('clf-c02');
    expect(stub.start).not.toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith(studyExamRunPath('clf-c02'));
  });
});

describe('StudyExamStartPage start without a session', () => {
  it('starts immediately and navigates to the runner path', async () => {
    const stub = makeStub();
    const router = makeRouter();
    const fixture = await renderPage(stub, router);
    const root = fixture.nativeElement as HTMLElement;

    await click(fixture, ionButton(root, 'Start study exam') as HTMLElement);

    expect(dialogsOf(root)).toHaveLength(0);
    expect(stub.start).toHaveBeenCalledTimes(1);
    expect(stub.start).toHaveBeenCalledWith('clf-c02');
    expect(stub.discard).not.toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith(studyExamRunPath('clf-c02'));
  });
});

describe('StudyExamStartPage resume-or-discard choice (S10, STUDY-35)', () => {
  it('opens an accessible choice dialog on Start and starts nothing until a choice is made', async () => {
    const stub = makeStub();
    stub.hasInProgress.mockResolvedValue(true);
    const router = makeRouter();
    const fixture = await renderPage(stub, router);
    const root = fixture.nativeElement as HTMLElement;

    await click(fixture, ionButton(root, 'Start study exam') as HTMLElement);

    const dialogs = dialogsOf(root);
    expect(dialogs).toHaveLength(1);
    const dialog = dialogs[0] as HTMLElement;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const titleId = dialog.getAttribute('aria-labelledby');
    expect(titleId).toBeTruthy();
    const title = titleId ? root.querySelector(`#${titleId}`) : null;
    expect(title?.textContent ?? '').toContain('Study exam already in progress');

    expect(stub.start).not.toHaveBeenCalled();
    expect(stub.resume).not.toHaveBeenCalled();
    expect(stub.discard).not.toHaveBeenCalled();

    await click(fixture, ionButton(dialog, 'Cancel') as HTMLElement);

    expect(dialogsOf(root)).toHaveLength(0);
    expect(stub.start).not.toHaveBeenCalled();
    expect(stub.resume).not.toHaveBeenCalled();
    expect(stub.discard).not.toHaveBeenCalled();
  });

  it('resumes from the dialog without starting or discarding', async () => {
    const stub = makeStub();
    stub.hasInProgress.mockResolvedValue(true);
    const router = makeRouter();
    const fixture = await renderPage(stub, router);
    const root = fixture.nativeElement as HTMLElement;

    await click(fixture, ionButton(root, 'Start study exam') as HTMLElement);
    const dialog = dialogsOf(root)[0] as HTMLElement;
    await click(fixture, ionButton(dialog, 'Resume study exam') as HTMLElement);

    expect(stub.resume).toHaveBeenCalledTimes(1);
    expect(stub.resume).toHaveBeenCalledWith('clf-c02');
    expect(stub.start).not.toHaveBeenCalled();
    expect(stub.discard).not.toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith(studyExamRunPath('clf-c02'));
    expect(dialogsOf(root)).toHaveLength(0);
  });
});

describe('StudyExamStartPage discard confirmation (S10, STUDY-41)', () => {
  it('asks for a second confirmation before anything is discarded or started', async () => {
    const stub = makeStub();
    stub.hasInProgress.mockResolvedValue(true);
    const router = makeRouter();
    const fixture = await renderPage(stub, router);
    const root = fixture.nativeElement as HTMLElement;

    await click(fixture, ionButton(root, 'Start study exam') as HTMLElement);
    const choice = dialogsOf(root)[0] as HTMLElement;
    await click(fixture, ionButton(choice, 'Discard and start fresh') as HTMLElement);

    // The choice dialog is gone and only the confirmation dialog remains.
    const confirms = dialogsOf(root);
    expect(confirms).toHaveLength(1);
    const confirm = confirms[0] as HTMLElement;
    expect(confirm.getAttribute('aria-modal')).toBe('true');
    const titleId = confirm.getAttribute('aria-labelledby');
    const title = titleId ? root.querySelector(`#${titleId}`) : null;
    expect(title?.textContent ?? '').toContain('Discard saved exam?');

    // Choosing discard in the first dialog changed nothing yet.
    expect(stub.discard).not.toHaveBeenCalled();
    expect(stub.start).not.toHaveBeenCalled();
    expect(router.navigateByUrl).not.toHaveBeenCalled();

    await click(fixture, ionButton(confirm, 'Keep saved exam') as HTMLElement);

    expect(dialogsOf(root)).toHaveLength(0);
    expect(stub.discard).not.toHaveBeenCalled();
    expect(stub.start).not.toHaveBeenCalled();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('confirming discard calls discard before start, then navigates to the runner', async () => {
    const stub = makeStub();
    stub.hasInProgress.mockResolvedValue(true);
    const router = makeRouter();
    const fixture = await renderPage(stub, router);
    const root = fixture.nativeElement as HTMLElement;

    await click(fixture, ionButton(root, 'Start study exam') as HTMLElement);
    const choice = dialogsOf(root)[0] as HTMLElement;
    await click(fixture, ionButton(choice, 'Discard and start fresh') as HTMLElement);
    const confirm = dialogsOf(root)[0] as HTMLElement;
    expect(stub.discard).not.toHaveBeenCalled();

    await click(fixture, ionButton(confirm, 'Discard saved exam') as HTMLElement);

    expect(stub.discard).toHaveBeenCalledTimes(1);
    expect(stub.start).toHaveBeenCalledTimes(1);
    expect(stub.start).toHaveBeenCalledWith('clf-c02');
    const discardOrder = stub.discard.mock.invocationCallOrder[0] as number;
    const startOrder = stub.start.mock.invocationCallOrder[0] as number;
    expect(discardOrder).toBeLessThan(startOrder);
    expect(router.navigateByUrl).toHaveBeenCalledWith(studyExamRunPath('clf-c02'));
    expect(dialogsOf(root)).toHaveLength(0);
  });
});

describe('StudyExamStartPage refusals', () => {
  it('surfaces the exact service message when the bank cannot fill the composition', async () => {
    const message =
      'Cert "clf-c02" can supply 10 of 65 exam questions; a short exam is refused.';
    const stub = makeStub();
    stub.start.mockRejectedValue(new StudyExamSessionError(message));
    const router = makeRouter();
    const fixture = await renderPage(stub, router);
    const root = fixture.nativeElement as HTMLElement;

    await click(fixture, ionButton(root, 'Start study exam') as HTMLElement);

    const alert = root.querySelector('[role="alert"]');
    expect(alert?.textContent?.trim()).toBe(message);
    // No navigation happened, and the start action is not a dead end.
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(ionButton(root, 'Start study exam')).not.toBeNull();
  });

  it('refuses a cert whose registry status is not active without calling the service', async () => {
    localStorage.setItem(SETTINGS_KEYS.selectedCert, 'saa-c03');
    const stub = makeStub();
    const router = makeRouter();
    const fixture = await renderPage(stub, router);
    const root = fixture.nativeElement as HTMLElement;

    const alert = root.querySelector('[role="alert"]');
    expect(alert?.textContent ?? '').toContain('coming soon');
    expect(ionButton(root, 'Start study exam')).toBeNull();
    expect(ionButton(root, 'Resume study exam')).toBeNull();
    expect(stub.start).not.toHaveBeenCalled();
    expect(stub.resume).not.toHaveBeenCalled();
    expect(stub.hasInProgress).not.toHaveBeenCalled();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});

describe('StudyExamStartPage accessibility', () => {
  it('has no axe violations in either theme', async () => {
    const fixture = await renderPage(makeStub(), makeRouter());
    const el = fixture.nativeElement as HTMLElement;

    await expectNoA11yViolations(el, 'light');
    await expectNoA11yViolations(el, 'dark');
  });
});
