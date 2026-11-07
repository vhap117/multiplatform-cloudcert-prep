import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { afterEach, describe, expect, it } from 'vitest';

import { expectNoA11yViolations } from '../../core/a11y/axe-scan';
import { TabsPage } from './tabs.page';

describe('TabsPage shell (CERT-9 to CERT-12, CERT-27, CERT-28)', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  async function render(): Promise<HTMLElement> {
    await TestBed.configureTestingModule({
      imports: [TabsPage],
      providers: [provideRouter([]), provideIonicAngular()],
    }).compileComponents();
    const fixture = TestBed.createComponent(TabsPage);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders exactly the four tabs with their labels', async () => {
    const el = await render();
    const tabs = [...el.querySelectorAll('ion-tab-button')];

    expect(tabs).toHaveLength(4);
    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual([
      'Home',
      'Practice',
      'History',
      'Settings',
    ]);
  });

  it('has no login, account, profile, or sign-out entry', async () => {
    const el = await render();

    expect(el.textContent ?? '').not.toMatch(/login|sign in|sign out|account|profile/i);
  });

  it('has no axe violations in either theme', async () => {
    const el = await render();

    await expectNoA11yViolations(el, 'light');
    await expectNoA11yViolations(el, 'dark');
  });
});
