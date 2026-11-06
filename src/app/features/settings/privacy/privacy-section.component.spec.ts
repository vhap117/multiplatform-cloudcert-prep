import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';

import { PrivacySectionComponent } from './privacy-section.component';

async function render(): Promise<HTMLElement> {
  await TestBed.configureTestingModule({
    imports: [PrivacySectionComponent],
  }).compileComponents();
  const fixture = TestBed.createComponent(PrivacySectionComponent);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

afterEach(() => {
  TestBed.resetTestingModule();
});

describe('PrivacySectionComponent (PRIV-29 to PRIV-34)', () => {
  it('makes each privacy promise in plain copy', async () => {
    const text = ((await render()).textContent ?? '').replace(/\s+/g, ' ');

    expect(text).toContain('All of your study data stays on this device');
    expect(text).toContain('nothing is uploaded');
    expect(text).toContain('Deleting the app deletes your study data');
    expect(text).toContain('Export a backup');
    expect(text).toContain('no cookies, no tracking, and no consent banner');
    expect(text).toContain('no cloud backup, no sync, and no account recovery');
    expect(text).toContain('computed on this device from your own history');
  });

  it('uses US English without em or en dashes', async () => {
    const text = (await render()).textContent ?? '';

    expect(text).not.toMatch(/[\u2013\u2014]/);
  });
});
