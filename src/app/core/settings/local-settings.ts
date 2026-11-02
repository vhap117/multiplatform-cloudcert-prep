/**
 * Small key-value preferences.
 *
 * `localStorage` is used here and only here. Study data (attempts, answers,
 * mastery, sessions) never touches it, per DATA-8. A blocked or full store
 * must degrade to "the choice does not persist", never to a crash.
 */

export const SETTINGS_KEYS = {
  theme: 'ccp.theme',
  motion: 'ccp.motion',
  selectedCert: 'ccp.selectedCert',
} as const;

export function readSetting(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeSetting(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // Nothing to recover here. The in-memory signal already reflects the
    // choice, so the app stays correct for this session.
  }
}

export function prefersDark(): boolean {
  try {
    return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  } catch {
    return false;
  }
}

export function prefersReducedMotion(): boolean {
  try {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}
