import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

function stubSystemTheme(prefersDark: boolean): void {
  const listeners: (() => void)[] = [];
  Object.defineProperty(globalThis, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: query.includes('dark') ? prefersDark : false,
      media: query,
      onchange: null,
      addEventListener: (_type: string, cb: () => void) => listeners.push(cb),
      removeEventListener: () => undefined,
      addListener: (cb: () => void) => listeners.push(cb),
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
  });

  it('defaults to the system preference', () => {
    stubSystemTheme(false);
    const service = TestBed.inject(ThemeService);
    expect(service.preference()).toBe('system');
  });

  it('resolves to light when the system is light and no override exists', () => {
    stubSystemTheme(false);
    const service = TestBed.inject(ThemeService);
    expect(service.resolved()).toBe('light');
  });

  it('resolves to dark when the system is dark and no override exists', () => {
    stubSystemTheme(true);
    const service = TestBed.inject(ThemeService);
    expect(service.resolved()).toBe('dark');
  });

  it('honours an explicit override over the system preference', () => {
    stubSystemTheme(true);
    const service = TestBed.inject(ThemeService);
    service.setPreference('light');
    expect(service.resolved()).toBe('light');
    expect(service.preference()).toBe('light');
  });

  it('applies exactly one theme class to the root element', () => {
    stubSystemTheme(false);
    const service = TestBed.inject(ThemeService);
    service.setPreference('dark');
    const classes = Array.from(document.documentElement.classList);
    expect(classes).toContain('theme-dark');
    expect(classes).not.toContain('theme-light');
  });

  it('persists the explicit choice so it survives a reload', () => {
    stubSystemTheme(false);
    const service = TestBed.inject(ThemeService);
    service.setPreference('dark');
    expect(localStorage.getItem('ccp.theme')).toBe('dark');
  });

  it('ignores a corrupt stored value and falls back to system', () => {
    localStorage.setItem('ccp.theme', 'neon');
    stubSystemTheme(false);
    const service = TestBed.inject(ThemeService);
    expect(service.preference()).toBe('system');
  });
});
