import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SplashService } from './splash.service';

const host = globalThis as { ccpShowSplash?: (durationMs?: number) => void };

afterEach(() => {
  delete host.ccpShowSplash;
  TestBed.resetTestingModule();
});

describe('SplashService', () => {
  it('replays the boot splash through the global hook', () => {
    const show = vi.fn();
    host.ccpShowSplash = show;

    TestBed.inject(SplashService).show(1200);

    expect(show).toHaveBeenCalledWith(1200);
  });

  it('defaults to the first-load duration', () => {
    const show = vi.fn();
    host.ccpShowSplash = show;

    TestBed.inject(SplashService).show();

    expect(show).toHaveBeenCalledWith(5000);
  });

  it('is a no-op when the splash hook has not loaded', () => {
    expect(() => TestBed.inject(SplashService).show()).not.toThrow();
  });
});
