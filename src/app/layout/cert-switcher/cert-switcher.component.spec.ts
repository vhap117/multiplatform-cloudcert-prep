import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getCert } from '../../core/content/cert-registry';
import { SETTINGS_KEYS } from '../../core/settings/local-settings';

import { CertSwitcherComponent } from './cert-switcher.component';

describe('CertSwitcherComponent (CERT-6, CERT-7)', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(SETTINGS_KEYS.selectedCert, 'clf-c02');
  });

  afterEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  async function render(): Promise<HTMLElement> {
    await TestBed.configureTestingModule({
      imports: [CertSwitcherComponent],
      providers: [provideIonicAngular()],
    }).compileComponents();
    const fixture = TestBed.createComponent(CertSwitcherComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('names the current cert and exposes an accessible switch action', async () => {
    const el = await render();
    const button = el.querySelector('ion-button');

    expect(el.getAttribute('slot')).toBe('end');
    expect(button).not.toBeNull();
    expect(button!.textContent).toContain('CLF-C02');
    expect(button!.getAttribute('aria-label')).toBe(
      'Switch certification, current: CLF-C02',
    );
  });

  it('hides itself when only one active cert exists', async () => {
    await TestBed.configureTestingModule({
      imports: [CertSwitcherComponent],
      providers: [provideIonicAngular()],
    }).compileComponents();
    const fixture = TestBed.createComponent(CertSwitcherComponent);
    const only = getCert('clf-c02');
    fixture.componentRef.setInput('certs', only ? [only] : []);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('ion-button')).toBeNull();
  });
});
