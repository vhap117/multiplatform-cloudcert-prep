import { Injectable, computed, signal } from '@angular/core';
import {
  SETTINGS_KEYS,
  prefersReducedMotion,
  readSetting,
  writeSetting,
} from '../settings/local-settings';

export type MotionPreference = 'system' | 'reduce' | 'full';

const VALID_PREFERENCES: readonly MotionPreference[] = ['system', 'reduce', 'full'];
const REDUCE_CLASS = 'reduce-motion';

function parsePreference(raw: string | null): MotionPreference {
  return VALID_PREFERENCES.includes(raw as MotionPreference)
    ? (raw as MotionPreference)
    : 'system';
}

/**
 * Owns the reduced motion override.
 *
 * The system preference is the default and is also honoured directly in CSS
 * through `prefers-reduced-motion`. This service adds an explicit in-app
 * override on top (ACC-21) and mirrors the result to a `reduce-motion` class
 * so both sources collapse motion the same way.
 */
@Injectable({ providedIn: 'root' })
export class MotionService {
  private readonly systemPrefersReduced = signal(prefersReducedMotion());

  readonly preference = signal<MotionPreference>(
    parsePreference(readSetting(SETTINGS_KEYS.motion)),
  );

  readonly reduced = computed<boolean>(() => {
    const preference = this.preference();
    if (preference === 'reduce') {
      return true;
    }
    if (preference === 'full') {
      return false;
    }
    return this.systemPrefersReduced();
  });

  constructor() {
    this.watchSystemPreference();
    this.apply();
  }

  setPreference(preference: MotionPreference): void {
    this.preference.set(preference);
    writeSetting(SETTINGS_KEYS.motion, preference);
    this.apply();
  }

  private apply(): void {
    const root = globalThis.document?.documentElement;
    if (!root) {
      return;
    }
    root.classList.toggle(REDUCE_CLASS, this.reduced());
  }

  private watchSystemPreference(): void {
    try {
      const query = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
      query?.addEventListener('change', (event) => {
        this.systemPrefersReduced.set(event.matches);
        this.apply();
      });
    } catch {
      // No media query support. The explicit choice still works.
    }
  }
}
