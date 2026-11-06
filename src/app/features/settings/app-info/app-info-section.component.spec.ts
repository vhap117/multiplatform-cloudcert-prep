import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';

import { APP_VERSION } from '../../../core/app-info';
import { contentVersionFor } from '../../../core/content/content-versions';
import { SCHEMA_VERSION } from '../../../core/storage/schema';
import { STUDY_REPOSITORY } from '../../../core/storage/repository-provider';

import { AppInfoSectionComponent } from './app-info-section.component';

async function render(): Promise<HTMLElement> {
  await TestBed.configureTestingModule({
    imports: [AppInfoSectionComponent],
    providers: [
      { provide: STUDY_REPOSITORY, useValue: { schemaVersion: SCHEMA_VERSION } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(AppInfoSectionComponent);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

afterEach(() => {
  TestBed.resetTestingModule();
});

describe('AppInfoSectionComponent (CONT-36, CONT-37)', () => {
  it('shows the app version and the database schema version', async () => {
    const text = (await render()).textContent ?? '';

    expect(text).toContain('App version');
    expect(text).toContain(APP_VERSION);
    expect(text).toContain('Database schema version');
    expect(text).toContain(String(SCHEMA_VERSION));
  });

  it('lists content freshness per cert and marks unpublished content honestly', async () => {
    const text = (await render()).textContent ?? '';

    expect(text).toContain(`CLF-C02: ${contentVersionFor('clf-c02')}`);
    expect(text).toContain(`AIF-C01: ${contentVersionFor('aif-c01')}`);
    expect(text).toContain('SAA-C03: Not yet published');
  });
});
