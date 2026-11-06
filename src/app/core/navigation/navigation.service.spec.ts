import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ActionSheetController, ModalController } from '@ionic/angular';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NavigationService } from './navigation.service';

let sheet: { dismiss: ReturnType<typeof vi.fn> } | null;
let modal: { dismiss: ReturnType<typeof vi.fn> } | null;
let router: { navigateByUrl: ReturnType<typeof vi.fn> };
let location: { back: ReturnType<typeof vi.fn> };

function create(): NavigationService {
  TestBed.configureTestingModule({
    providers: [
      {
        provide: ActionSheetController,
        useValue: { getTop: () => Promise.resolve(sheet) },
      },
      { provide: ModalController, useValue: { getTop: () => Promise.resolve(modal) } },
      { provide: Router, useValue: router },
      { provide: Location, useValue: location },
    ],
  });
  return TestBed.inject(NavigationService);
}

afterEach(() => {
  globalThis.history.replaceState({ navigationId: 1 }, '');
  TestBed.resetTestingModule();
});

describe('NavigationService.back (CERT-15 to CERT-17)', () => {
  it('closes an open overlay before touching the stack', async () => {
    sheet = { dismiss: vi.fn().mockResolvedValue(true) };
    modal = null;
    globalThis.history.replaceState({ navigationId: 3 }, '');
    router = { navigateByUrl: vi.fn() };
    location = { back: vi.fn() };

    await create().back();

    expect(sheet.dismiss).toHaveBeenCalledTimes(1);
    expect(location.back).not.toHaveBeenCalled();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('closes an open modal when no sheet is open', async () => {
    sheet = null;
    modal = { dismiss: vi.fn().mockResolvedValue(true) };
    router = { navigateByUrl: vi.fn() };
    location = { back: vi.fn() };

    await create().back();

    expect(modal.dismiss).toHaveBeenCalledTimes(1);
    expect(location.back).not.toHaveBeenCalled();
  });

  it('pops one level when the app stack has history', async () => {
    sheet = null;
    modal = null;
    globalThis.history.replaceState({ navigationId: 2 }, '');
    router = { navigateByUrl: vi.fn() };
    location = { back: vi.fn() };

    await create().back();

    expect(location.back).toHaveBeenCalledTimes(1);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('falls back to the dashboard when there is no in-app history', async () => {
    sheet = null;
    modal = null;
    globalThis.history.replaceState({ navigationId: 1 }, '');
    router = { navigateByUrl: vi.fn().mockResolvedValue(true) };
    location = { back: vi.fn() };

    await create().back();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/tabs/home');
    expect(location.back).not.toHaveBeenCalled();
  });
});
