import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AlertController, provideIonicAngular } from '@ionic/angular';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BackupService, type ImportPreview } from '../../../core/backup/backup.service';
import { buildBackup } from '../../../core/backup/backup-format';
import { SETTINGS_KEYS } from '../../../core/settings/local-settings';

import { DataManagementComponent } from './data-management.component';

interface CapturedAlert {
  header?: string;
  message?: string;
  inputs?: unknown[];
  buttons?: {
    text: string;
    role?: string;
    handler?: (data: unknown) => boolean;
  }[];
}

let captured: CapturedAlert[];
let dismissRole = 'cancel';

const alertStub = {
  create(options: CapturedAlert): Promise<{
    present: () => Promise<void>;
    onDidDismiss: () => Promise<{ role: string }>;
  }> {
    captured.push(options);
    return Promise.resolve({
      present: () => Promise.resolve(),
      onDidDismiss: () => Promise.resolve({ role: dismissRole }),
    });
  },
};

let backup: {
  overlayMessage: ReturnType<typeof signal<string | null>>;
  export: ReturnType<typeof vi.fn>;
  inspectImport: ReturnType<typeof vi.fn>;
  applyImport: ReturnType<typeof vi.fn>;
  resetCert: ReturnType<typeof vi.fn>;
  resetAll: ReturnType<typeof vi.fn>;
};

function preview(): ImportPreview {
  const parsed = buildBackup({ rows: emptyRows(), settings: {} });
  return {
    backup: parsed,
    counts: {
      attempts: 3,
      questionResults: 10,
      certProgress: 2,
      questionMastery: 8,
      sessions: 1,
    },
    skipped: {
      attempts: 0,
      questionResults: 0,
      certProgress: 0,
      questionMastery: 0,
      sessions: 0,
    },
    skippedRows: 0,
    certCodes: ['clf-c02'],
    exportedAt: Date.UTC(2026, 0, 2),
    appVersion: '0.0.0',
  };
}

function emptyRows() {
  return {
    attempts: [],
    questionResults: [],
    certProgress: [],
    questionMastery: [],
    sessions: [],
  };
}

async function render(): Promise<{ el: HTMLElement; fixture: ReturnType<typeof TestBed.createComponent> }> {
  await TestBed.configureTestingModule({
    imports: [DataManagementComponent],
    providers: [
      provideIonicAngular(),
      { provide: AlertController, useValue: alertStub },
      { provide: BackupService, useValue: backup },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(DataManagementComponent);
  fixture.detectChanges();
  await fixture.whenStable();
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

async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(SETTINGS_KEYS.selectedCert, 'clf-c02');
  captured = [];
  dismissRole = 'cancel';
  backup = {
    overlayMessage: signal<string | null>(null),
    export: vi.fn(),
    inspectImport: vi.fn().mockResolvedValue(null),
    applyImport: vi.fn().mockResolvedValue(undefined),
    resetCert: vi.fn().mockResolvedValue(undefined),
    resetAll: vi.fn().mockResolvedValue(undefined),
  };
});

afterEach(() => {
  localStorage.clear();
  TestBed.resetTestingModule();
});

describe('DataManagementComponent notices (OFF-18, OFF-29, PRIV-30, PRIV-32)', () => {
  it('states that data stays local, never syncs, and is deleted on uninstall', async () => {
    const { el } = await render();
    const text = (el.textContent ?? '').replace(/\s+/g, ' ');

    expect(text).toContain('Your data');
    expect(text).toContain('Nothing is uploaded, synced, or backed up automatically');
    expect(text).toContain('uninstalling the app deletes your study data');
    expect(text).toContain('Export a backup first');
  });
});

describe('DataManagementComponent export (DATA-24 to DATA-26)', () => {
  it('reports the saved file name', async () => {
    backup.export.mockResolvedValue({ fileName: 'backup.json' });
    const { el, fixture } = await render();

    buttonByText(el, 'Export backup').click();
    await flush();
    fixture.detectChanges();

    expect(backup.export).toHaveBeenCalledTimes(1);
    expect(el.textContent).toContain('Backup saved as backup.json.');
  });

  it('surfaces a failed export as a visible error', async () => {
    backup.export.mockRejectedValue(new Error('The backup file could not be saved.'));
    const { el, fixture } = await render();

    buttonByText(el, 'Export backup').click();
    await flush();
    fixture.detectChanges();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'The backup file could not be saved.',
    );
  });
});

describe('DataManagementComponent import (DATA-27 to DATA-29)', () => {
  it('does nothing when the picker is canceled', async () => {
    const { el } = await render();

    buttonByText(el, 'Import backup').click();
    await flush();

    expect(backup.inspectImport).toHaveBeenCalledTimes(1);
    expect(captured).toHaveLength(0);
    expect(backup.applyImport).not.toHaveBeenCalled();
  });

  it('names exactly what a confirmed import replaces', async () => {
    backup.inspectImport.mockResolvedValue(preview());
    dismissRole = 'destructive';
    const { el } = await render();

    buttonByText(el, 'Import backup').click();
    await flush();

    expect(captured[0]?.header).toBe('Replace all local data?');
    expect(captured[0]?.message).toContain('ALL local study data');
    expect(captured[0]?.message).toContain('3 exam attempts');
    expect(captured[0]?.message).toContain('1 in-progress sessions');
    expect(backup.applyImport).toHaveBeenCalledTimes(1);
  });

  it('leaves data untouched when the import confirmation is canceled', async () => {
    backup.inspectImport.mockResolvedValue(preview());
    dismissRole = 'cancel';
    const { el } = await render();

    buttonByText(el, 'Import backup').click();
    await flush();

    expect(backup.applyImport).not.toHaveBeenCalled();
  });

  it('shows a validation error and writes nothing', async () => {
    backup.inspectImport.mockRejectedValue(
      new Error('This backup uses schema version 9, but this app reads version 1.'),
    );
    const { el, fixture } = await render();

    buttonByText(el, 'Import backup').click();
    await flush();
    fixture.detectChanges();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'schema version 9',
    );
    expect(backup.applyImport).not.toHaveBeenCalled();
  });
});

describe('DataManagementComponent reset (DATA-31, DATA-32, PROG-29 to PROG-34)', () => {
  it('names the cert and states other certs are unaffected', async () => {
    dismissRole = 'destructive';
    const { el } = await render();

    buttonByText(el, 'Reset this certification').click();
    await flush();

    expect(captured[0]?.header).toBe('Reset CLF-C02?');
    expect(captured[0]?.message).toContain('Other certifications are unaffected');
    expect(backup.resetCert).toHaveBeenCalledWith('clf-c02');
  });

  it('resets the cert chosen in the picker', async () => {
    dismissRole = 'destructive';
    const { el } = await render();

    const select = el.querySelector<HTMLSelectElement>('#reset-cert');
    select!.value = 'aif-c01';
    select!.dispatchEvent(new Event('change'));

    buttonByText(el, 'Reset this certification').click();
    await flush();

    expect(captured[0]?.header).toBe('Reset AIF-C01?');
    expect(backup.resetCert).toHaveBeenCalledWith('aif-c01');
  });

  it('does not reset when the confirmation is canceled', async () => {
    dismissRole = 'cancel';
    const { el } = await render();

    buttonByText(el, 'Reset this certification').click();
    await flush();

    expect(backup.resetCert).not.toHaveBeenCalled();
  });

  it('requires the typed DELETE gate for delete-all', async () => {
    dismissRole = 'destructive';
    const { el } = await render();

    buttonByText(el, 'Delete all local data').click();
    await flush();

    const options = captured[0];
    expect(options?.message).toContain('Type DELETE to confirm');
    const handler = options?.buttons?.[1]?.handler;
    expect(handler?.({ confirmation: 'delete' })).toBe(false);
    expect(handler?.({ confirmation: 'DELETE' })).toBe(true);
    expect(backup.resetAll).toHaveBeenCalledTimes(1);
  });
});

describe('DataManagementComponent recovery overlay (issue 011)', () => {
  it('renders the overlay message while a reload is pending', async () => {
    const { fixture, el } = await render();

    backup.overlayMessage.set('Restoring your data...');
    fixture.detectChanges();

    expect(el.querySelector('.data-overlay')?.textContent).toContain(
      'Restoring your data...',
    );
  });
});
