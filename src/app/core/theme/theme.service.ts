import { Injectable, computed, signal } from '@angular/core';
import {
  SETTINGS_KEYS,
  prefersDark,
  readSetting,
  writeSetting,
} from '../settings/local-settings';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const VALID_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];
const LIGHT_CLASS = 'theme-light';
const DARK_CLASS = 'theme-dark';

function parsePreference(raw: string | null): ThemePreference {
  return VALID_PREFERENCES.includes(raw as ThemePreference)
    ? (raw as ThemePreference)
    : 'system';
}

/**
 * Owns the light and dark themes.
 *
 * The system preference is the default; an explicit choice wins and persists.
 * The class is applied in the constructor so the theme is correct on first
 * render. `index.html` applies the same class before first paint to avoid a
 * flash of the wrong theme (ACC-17); this service keeps it in sync afterwards.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly systemPrefersDark = signal(prefersDark());

  readonly preference = signal<ThemePreference>(
    parsePreference(readSetting(SETTINGS_KEYS.theme)),
  );

  readonly resolved = computed<ResolvedTheme>(() => {
    const preference = this.preference();
    if (preference === 'system') {
      return this.systemPrefersDark() ? 'dark' : 'light';
    }
    return preference;
  });

  constructor() {
    this.watchSystemPreference();
    this.apply();
  }

  setPreference(preference: ThemePreference): void {
    this.preference.set(preference);
    writeSetting(SETTINGS_KEYS.theme, preference);
    this.apply();
  }

  /** Cycle used by the Settings screen: system, light, dark. */
  next(): ThemePreference {
    const order: ThemePreference[] = ['system', 'light', 'dark'];
    const next = order[(order.indexOf(this.preference()) + 1) % order.length];
    this.setPreference(next);
    return next;
  }

  private apply(): void {
    const root = globalThis.document?.documentElement;
    if (!root) {
      return;
    }
    root.classList.remove(LIGHT_CLASS, DARK_CLASS);
    root.classList.add(this.resolved() === 'dark' ? DARK_CLASS : LIGHT_CLASS);
  }

  private watchSystemPreference(): void {
    try {
      const query = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
      query?.addEventListener('change', (event) => {
        this.systemPrefersDark.set(event.matches);
        this.apply();
      });
    } catch {
      // No media query support. The explicit choice still works.
    }
  }
}
