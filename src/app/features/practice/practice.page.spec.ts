import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SETTINGS_KEYS } from '../../core/settings/local-settings';

import { PracticePage } from './practice.page';
import { practiceConfigPath } from './practice.routes';

describe('PracticePage domain list (PRACT-1, PRACT-2, PRACT-3)', () => {
  beforeEach(() => {
    localStorage.setItem(SETTINGS_KEYS.selectedCert, 'clf-c02');
  });

  afterEach(() => {
    localStorage.removeItem(SETTINGS_KEYS.selectedCert);
    TestBed.resetTestingModule();
  });

  async function render(): Promise<HTMLElement> {
    await TestBed.configureTestingModule({
      imports: [PracticePage],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(PracticePage);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('lists every domain of the selected cert with a practice action', async () => {
    const el = await render();

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
    const el = await render();

    const links = [...el.querySelectorAll<HTMLAnchorElement>('a.practice-domain')];
    expect(links[0]?.getAttribute('href')).toBe(practiceConfigPath('clf-c02', 1));
    expect(links[3]?.getAttribute('href')).toBe(practiceConfigPath('clf-c02', 4));
  });

  it('names the selected cert on the domain list', async () => {
    const el = await render();

    expect(el.textContent).toContain('AWS Cloud Practitioner');
  });
});
