import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { expectNoA11yViolations } from '../../../core/a11y/axe-scan';
import type { StorageDiagnostics } from '../../../core/storage/diagnostics';
import { StorageOpenError } from '../../../core/storage/errors';
import {
  IS_NATIVE_STORAGE,
  STUDY_REPOSITORY,
} from '../../../core/storage/repository-provider';

import { StorageDiagnosticsPage } from './storage-diagnostics.page';

const healthyReport: StorageDiagnostics = {
  backend: 'sqlite',
  expectedSchemaVersion: 2,
  actualSchemaVersion: 2,
  tables: [
    { name: 'attempts', present: true },
    { name: 'meta', present: true },
  ],
  migrations: [
    { version: 1, applied: true },
    { version: 2, applied: true },
  ],
};

let diagnose: ReturnType<typeof vi.fn>;

async function render(isNative = true): Promise<HTMLElement> {
  await TestBed.configureTestingModule({
    imports: [StorageDiagnosticsPage],
    providers: [
      provideIonicAngular(),
      provideRouter([]),
      { provide: IS_NATIVE_STORAGE, useValue: isNative },
      { provide: STUDY_REPOSITORY, useValue: { diagnose } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(StorageDiagnosticsPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

beforeEach(() => {
  diagnose = vi.fn().mockResolvedValue(healthyReport);
});

afterEach(() => {
  vi.restoreAllMocks();
  TestBed.resetTestingModule();
});

describe('StorageDiagnosticsPage', () => {
  it('reports a healthy SQLite schema', async () => {
    const text = (await render()).textContent ?? '';

    expect(text).toContain('The local database is healthy.');
    expect(text).toContain('SQLite');
    expect(text).toContain('2 of 2');
    expect(text).toContain('attempts');
    expect(text).toContain('Present');
    expect(text).toContain('Ran');
    expect(diagnose).toHaveBeenCalledTimes(1);
  });

  it('names missing tables and migrations', async () => {
    diagnose.mockResolvedValue({
      ...healthyReport,
      actualSchemaVersion: 1,
      tables: [
        { name: 'attempts', present: true },
        { name: 'meta', present: false },
      ],
      migrations: [
        { version: 1, applied: true },
        { version: 2, applied: false },
      ],
    });

    const text = (await render()).textContent ?? '';

    expect(text).toContain('The local database needs attention.');
    expect(text).toContain('Missing');
    expect(text).toContain('Not run');
    expect(text).toContain('1 of 2 ran');
  });

  it('shows a failed check with the full cause chain', async () => {
    diagnose.mockRejectedValue(
      new StorageOpenError(
        'Could not open the local database',
        new Error('Open: database not opened'),
      ),
    );

    const el = await render();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'Could not open the local database. Caused by: Open: database not opened',
    );
    expect(el.textContent).toContain('Try again');
  });

  it('is inert in the browser and skips the database query', async () => {
    const text = (await render(false)).textContent ?? '';

    expect(text).toContain('Only on a device');
    expect(diagnose).not.toHaveBeenCalled();
  });

  it('has no axe violations in either theme', async () => {
    const el = await render();

    await expectNoA11yViolations(el, 'light');
    await expectNoA11yViolations(el, 'dark');
  });
});
