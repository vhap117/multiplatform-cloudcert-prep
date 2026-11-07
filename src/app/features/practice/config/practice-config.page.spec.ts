import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { expectNoA11yViolations } from '../../../core/a11y/axe-scan';
import { practiceRunPath } from '../practice.routes';
import { PracticeSessionService } from '../session/practice-session.service';

import { PracticeConfigPage } from './practice-config.page';

interface SessionStub {
  hasInProgress: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
  discard: ReturnType<typeof vi.fn>;
}

interface CapturedAlert {
  header?: string;
  message?: string;
  buttons?: unknown[];
}

let stub: SessionStub;
let router: { navigateByUrl: ReturnType<typeof vi.fn> };
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

function makeStub(): SessionStub {
  return {
    hasInProgress: vi.fn().mockResolvedValue(false),
    start: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(true),
    discard: vi.fn().mockResolvedValue(undefined),
  };
}

async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
}

async function render(domain?: string): Promise<ComponentFixture<PracticeConfigPage>> {
  await TestBed.configureTestingModule({
    imports: [PracticeConfigPage],
    providers: [
      { provide: Router, useValue: router },
      { provide: AlertController, useValue: alertControllerStub },
      { provide: PracticeSessionService, useValue: stub },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(PracticeConfigPage);
  fixture.componentRef.setInput('certCode', 'clf-c02');
  if (domain !== undefined) {
    fixture.componentRef.setInput('domain', domain);
  }
  fixture.detectChanges();
  await flush();
  fixture.detectChanges();
  return fixture;
}

function textOf(fixture: ComponentFixture<PracticeConfigPage>): string {
  return (fixture.nativeElement.textContent ?? '').replace(/\s+/g, ' ');
}

function buttonByText(fixture: ComponentFixture<PracticeConfigPage>, text: string): HTMLElement {
  const button = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button, ion-button')].find(
    (candidate) => (candidate.textContent ?? '').replace(/\s+/g, ' ').trim() === text,
  );
  if (!button) {
    throw new Error(`button "${text}" not found`);
  }
  return button as HTMLElement;
}

function buttonByLabel(
  fixture: ComponentFixture<PracticeConfigPage>,
  label: string,
): HTMLButtonElement {
  const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
    `button[aria-label="${label}"]`,
  );
  if (!button) {
    throw new Error(`button "${label}" not found`);
  }
  return button;
}

async function click(
  fixture: ComponentFixture<PracticeConfigPage>,
  element: HTMLElement,
): Promise<void> {
  element.click();
  fixture.detectChanges();
  await flush();
  fixture.detectChanges();
}

beforeEach(() => {
  stub = makeStub();
  router = { navigateByUrl: vi.fn().mockResolvedValue(true) };
  createdAlerts = [];
  dismissRole = 'cancel';
});

afterEach(() => {
  TestBed.resetTestingModule();
});

describe('PracticeConfigPage accessibility', () => {
  it('has no axe violations in either theme', async () => {
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;

    await expectNoA11yViolations(el, 'light');
    await expectNoA11yViolations(el, 'dark');
  });
});

describe('PracticeConfigPage domain preselect (PRACT-2, PRACT-3)', () => {
  it('preselects the domain named by the deep link', async () => {
    const fixture = await render('3');
    const page = fixture.componentInstance;

    expect(page.selectedDomainId()).toBe(3);
    expect(textOf(fixture)).toContain('Cloud Technology & Services');
  });

  it('falls back to the first domain when the deep link names none', async () => {
    const fixture = await render();

    expect(fixture.componentInstance.selectedDomainId()).toBe(1);
  });
});

describe('PracticeConfigPage size control (PRACT-4, PRACT-5, SR-41)', () => {
  it('defaults to 20 and moves in steps of 5 between 10 and 50', async () => {
    const fixture = await render();
    const page = fixture.componentInstance;

    expect(page.size()).toBe(20);
    await click(fixture, buttonByLabel(fixture, 'Increase session size'));
    expect(page.size()).toBe(25);
    await click(fixture, buttonByLabel(fixture, 'Decrease session size'));
    expect(page.size()).toBe(20);
  });

  it('disables the buttons at the bounds', async () => {
    const fixture = await render();
    const page = fixture.componentInstance;

    for (let i = 0; i < 6; i++) {
      await click(fixture, buttonByLabel(fixture, 'Increase session size'));
    }
    expect(page.size()).toBe(50);
    expect(
      (buttonByLabel(fixture, 'Increase session size') as HTMLButtonElement).disabled,
    ).toBe(true);

    for (let i = 0; i < 10; i++) {
      await click(fixture, buttonByLabel(fixture, 'Decrease session size'));
    }
    expect(page.size()).toBe(10);
    expect(
      (buttonByLabel(fixture, 'Decrease session size') as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

describe('PracticeConfigPage start (PRACT-6, PRACT-7, PRACT-8)', () => {
  it('starts the chosen domain and size, then opens the runner', async () => {
    const fixture = await render('2');

    await click(fixture, buttonByText(fixture, 'Start practice'));

    expect(createdAlerts).toHaveLength(0);
    expect(stub.start).toHaveBeenCalledWith('clf-c02', 2, 20);
    expect(router.navigateByUrl).toHaveBeenCalledWith(practiceRunPath('clf-c02'));
  });

  it('requires an explicit resume-or-discard choice when a session is in progress', async () => {
    stub.hasInProgress.mockResolvedValue(true);
    const fixture = await render();

    await click(fixture, buttonByText(fixture, 'Start practice'));

    expect(createdAlerts).toHaveLength(1);
    expect(createdAlerts[0]!.header).toBe('Practice already in progress');
    expect(stub.start).not.toHaveBeenCalled();
    expect(stub.discard).not.toHaveBeenCalled();
  });

  it('resumes the saved session when Resume is chosen', async () => {
    stub.hasInProgress.mockResolvedValue(true);
    dismissRole = 'resume';
    const fixture = await render();

    await click(fixture, buttonByText(fixture, 'Start practice'));

    expect(stub.resume).toHaveBeenCalledWith('clf-c02');
    expect(stub.start).not.toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith(practiceRunPath('clf-c02'));
  });

  it('discards first and then starts fresh when Discard is chosen', async () => {
    stub.hasInProgress.mockResolvedValue(true);
    dismissRole = 'discard';
    const fixture = await render();

    await click(fixture, buttonByText(fixture, 'Start practice'));

    expect(stub.discard).toHaveBeenCalledWith('clf-c02');
    expect(stub.start).toHaveBeenCalledWith('clf-c02', 1, 20);
    expect(stub.discard.mock.invocationCallOrder[0]).toBeLessThan(
      stub.start.mock.invocationCallOrder[0]!,
    );
    expect(router.navigateByUrl).toHaveBeenCalledWith(practiceRunPath('clf-c02'));
  });
});

describe('PracticeConfigPage failures (PRACT-24, PRACT-25)', () => {
  it('shows a retryable error and re-enables Start when the bank or save fails', async () => {
    stub.start.mockRejectedValueOnce(new Error('The domain 1 bank could not be loaded.'));
    const fixture = await render();

    await click(fixture, buttonByText(fixture, 'Start practice'));

    expect(textOf(fixture)).toContain('The domain 1 bank could not be loaded.');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(buttonByText(fixture, 'Start practice')).not.toBeNull();

    stub.start.mockResolvedValueOnce(undefined);
    await click(fixture, buttonByText(fixture, 'Start practice'));
    expect(stub.start).toHaveBeenCalledTimes(2);
  });

  it('shows a retryable error when the saved session cannot be read', async () => {
    stub.hasInProgress.mockRejectedValueOnce(new Error('The saved practice session could not be read.'));
    const fixture = await render();

    expect(textOf(fixture)).toContain('The saved practice session could not be read.');
    const retry = buttonByText(fixture, 'Try again');
    stub.hasInProgress.mockResolvedValueOnce(false);
    await click(fixture, retry);
    expect(stub.hasInProgress).toHaveBeenCalledTimes(2);
    expect(textOf(fixture)).not.toContain('could not be read');
  });
});
