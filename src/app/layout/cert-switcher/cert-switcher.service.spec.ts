import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ActionSheetController, type ActionSheetButton } from '@ionic/angular';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SelectedCertService } from '../../core/content/selected-cert.service';
import { SplashService } from '../../core/motion/splash.service';
import { SETTINGS_KEYS } from '../../core/settings/local-settings';

import { CertSwitcherService } from './cert-switcher.service';

interface CapturedSheet {
  header?: string;
  subHeader?: string;
  buttons?: ActionSheetButton[];
}

let captured: CapturedSheet[];
let router: { url: string; navigateByUrl: ReturnType<typeof vi.fn> };
let splash: { show: ReturnType<typeof vi.fn> };

const actionSheetStub = {
  create(options: CapturedSheet): Promise<{
    present: () => Promise<void>;
    onDidDismiss: () => Promise<{ role: string }>;
  }> {
    captured.push(options);
    return Promise.resolve({
      present: () => Promise.resolve(),
      onDidDismiss: () => Promise.resolve({ role: 'cancel' }),
    });
  },
};

function create(): { switcher: CertSwitcherService; selected: SelectedCertService } {
  TestBed.configureTestingModule({
    providers: [
      { provide: ActionSheetController, useValue: actionSheetStub },
      { provide: Router, useValue: router },
      { provide: SplashService, useValue: splash },
    ],
  });
  return {
    switcher: TestBed.inject(CertSwitcherService),
    selected: TestBed.inject(SelectedCertService),
  };
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(SETTINGS_KEYS.selectedCert, 'clf-c02');
  captured = [];
  router = { url: '/tabs/home', navigateByUrl: vi.fn().mockResolvedValue(true) };
  splash = { show: vi.fn() };
});

afterEach(() => {
  localStorage.clear();
  TestBed.resetTestingModule();
});

describe('CertSwitcherService sheet (CERT-2, CERT-6)', () => {
  it('lists active certs as choices, marks the current one, and disables coming soon', async () => {
    const { switcher } = create();

    await switcher.open();

    expect(captured).toHaveLength(1);
    expect(captured[0]!.header).toBe('Choose certification');
    const buttons = captured[0]!.buttons ?? [];
    expect(buttons.map((button) => button.text)).toEqual([
      'AIF-C01',
      'CLF-C02 (current)',
      'SAA-C03 (coming soon)',
      'Cancel',
    ]);
    expect(buttons[2]!.disabled).toBe(true);
    expect(buttons[3]!.role).toBe('cancel');
  });
});

describe('CertSwitcherService switching (CERT-8, CERT-21, CERT-22)', () => {
  it('switches in place on a tab screen without navigating', async () => {
    const { switcher, selected } = create();

    expect(await switcher.switchTo('aif-c01')).toBe(true);
    expect(selected.cert()?.code).toBe('aif-c01');
    expect(localStorage.getItem(SETTINGS_KEYS.selectedCert)).toBe('aif-c01');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(splash.show).toHaveBeenCalledWith(1200);
  });

  it('leaves a guarded runner through the router before committing the switch', async () => {
    router.url = '/mock-exam/clf-c02/run';
    const { switcher, selected } = create();

    expect(await switcher.switchTo('aif-c01')).toBe(true);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/tabs/home');
    expect(selected.cert()?.code).toBe('aif-c01');
  });

  it('aborts the switch when the leave guard vetoes navigation', async () => {
    router.url = '/practice/clf-c02/run';
    router.navigateByUrl.mockResolvedValue(false);
    const { switcher, selected } = create();

    expect(await switcher.switchTo('aif-c01')).toBe(false);
    expect(selected.cert()?.code).toBe('clf-c02');
    expect(localStorage.getItem(SETTINGS_KEYS.selectedCert)).toBe('clf-c02');
    expect(splash.show).not.toHaveBeenCalled();
  });

  it('refuses coming-soon certs and is a no-op for the current cert', async () => {
    const { switcher } = create();

    expect(await switcher.switchTo('saa-c03')).toBe(false);
    expect(await switcher.switchTo('clf-c02')).toBe(true);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(splash.show).not.toHaveBeenCalled();
  });
});
