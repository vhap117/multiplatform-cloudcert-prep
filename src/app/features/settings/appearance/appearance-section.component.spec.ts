import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MotionService } from '../../../core/motion/motion.service';
import { SETTINGS_KEYS } from '../../../core/settings/local-settings';
import { ThemeService } from '../../../core/theme/theme.service';

import { AppearanceSectionComponent } from './appearance-section.component';

async function render(): Promise<HTMLElement> {
  await TestBed.configureTestingModule({
    imports: [AppearanceSectionComponent],
  }).compileComponents();
  const fixture = TestBed.createComponent(AppearanceSectionComponent);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

function radio(el: HTMLElement, name: string, value: string): HTMLInputElement {
  const input = el.querySelector<HTMLInputElement>(
    `input[type="radio"][name="${name}"][value="${value}"]`,
  );
  if (!input) {
    throw new Error(`radio ${name}=${value} not found`);
  }
  return input;
}

function select(input: HTMLInputElement): void {
  input.checked = true;
  input.dispatchEvent(new Event('change'));
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = '';
});

afterEach(() => {
  localStorage.clear();
  document.documentElement.className = '';
  TestBed.resetTestingModule();
});

describe('AppearanceSectionComponent theme (ACC-16)', () => {
  it('starts on the system default and shows the resolved device theme', async () => {
    const el = await render();

    expect(radio(el, 'theme-preference', 'system').checked).toBe(true);
    expect(el.textContent).toContain('Following your device');
  });

  it('persists an explicit theme and applies it to the root element', async () => {
    const el = await render();

    select(radio(el, 'theme-preference', 'dark'));

    expect(TestBed.inject(ThemeService).preference()).toBe('dark');
    expect(localStorage.getItem(SETTINGS_KEYS.theme)).toBe('dark');
    expect(document.documentElement.classList.contains('theme-dark')).toBe(true);
  });

  it('keeps the stored choice across a fresh component (restart)', async () => {
    const first = await render();
    select(radio(first, 'theme-preference', 'light'));
    TestBed.resetTestingModule();

    const second = await render();

    expect(radio(second, 'theme-preference', 'light').checked).toBe(true);
    expect(document.documentElement.classList.contains('theme-light')).toBe(true);
  });
});

describe('AppearanceSectionComponent motion (ACC-21, IONIC-16)', () => {
  it('starts on the system default', async () => {
    const el = await render();

    expect(radio(el, 'motion-preference', 'system').checked).toBe(true);
  });

  it('persists an explicit reduced-motion override and applies the class', async () => {
    const el = await render();

    select(radio(el, 'motion-preference', 'reduce'));

    expect(TestBed.inject(MotionService).preference()).toBe('reduce');
    expect(localStorage.getItem(SETTINGS_KEYS.motion)).toBe('reduce');
    expect(document.documentElement.classList.contains('reduce-motion')).toBe(true);
  });

  it('can force full motion even when the device asks for reduced', async () => {
    const el = await render();

    select(radio(el, 'motion-preference', 'full'));

    expect(TestBed.inject(MotionService).reduced()).toBe(false);
    expect(document.documentElement.classList.contains('reduce-motion')).toBe(false);
  });
});
