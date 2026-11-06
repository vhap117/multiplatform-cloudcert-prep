import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppReloader } from '../../core/backup/app-reloader';
import { BACKUP_TRANSPORT } from '../../core/backup/backup-transport';
import { SETTINGS_KEYS } from '../../core/settings/local-settings';
import { SCHEMA_VERSION } from '../../core/storage/schema';
import { STUDY_REPOSITORY } from '../../core/storage/repository-provider';

import { SettingsPage } from './settings.page';

async function render(): Promise<HTMLElement> {
  await TestBed.configureTestingModule({
    imports: [SettingsPage],
    providers: [
      provideIonicAngular(),
      { provide: STUDY_REPOSITORY, useValue: { schemaVersion: SCHEMA_VERSION } },
      {
        provide: BACKUP_TRANSPORT,
        useValue: { saveBackup: vi.fn(), pickBackup: vi.fn().mockResolvedValue(null) },
      },
      { provide: AppReloader, useValue: { reload: vi.fn() } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(SettingsPage);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(SETTINGS_KEYS.selectedCert, 'clf-c02');
  document.documentElement.className = '';
});

afterEach(() => {
  localStorage.clear();
  document.documentElement.className = '';
  TestBed.resetTestingModule();
});

describe('SettingsPage (CERT-12, issue 012)', () => {
  it('renders every settings section with a single h1', async () => {
    const el = await render();
    const text = (el.textContent ?? '').replace(/\s+/g, ' ');

    expect(el.querySelectorAll('h1')).toHaveLength(1);
    expect(text).toContain('Appearance');
    expect(text).toContain('Your data');
    expect(text).toContain('Privacy');
    expect(text).toContain('App information');
  });

  it('exposes the theme and motion controls', async () => {
    const el = await render();

    expect(el.querySelectorAll('input[name="theme-preference"]')).toHaveLength(3);
    expect(el.querySelectorAll('input[name="motion-preference"]')).toHaveLength(3);
  });

  it('shows the app, schema, and content versions', async () => {
    const text = (await render()).textContent ?? '';

    expect(text).toContain('App version');
    expect(text).toContain('Database schema version');
    expect(text).toContain('Content versions');
  });
});
