import axe, { type AxeResults, type Result } from 'axe-core';
import { expect } from 'vitest';

/**
 * Automated accessibility scan helper (ACC-1 to ACC-13).
 *
 * Runs axe against a rendered screen and asserts zero violations. The scanner
 * is part of the normal unit test suite, so contrast, names, roles, and
 * structure regress the build instead of relying on review.
 *
 * jsdom has no layout or paint engine, so a few rules cannot be evaluated
 * honestly here. They are disabled with a named reason and covered by other
 * evidence, never silently dropped:
 *
 * - `color-contrast`: covered by `contrast.spec.ts` (token maths for both
 *   themes) and the real-browser contrast pass recorded in the hardening
 *   report.
 * - `target-size`: tap-target size is a layout measurement; covered by the
 *   browser responsive pass.
 * - `scrollable-region-focusable`: depends on computed overflow and scroll
 *   geometry; covered by the browser keyboard pass.
 */
const JSDOM_BLIND_RULES = [
  'color-contrast',
  'target-size',
  'scrollable-region-focusable',
] as const;

export type ScanTheme = 'light' | 'dark';

const LIGHT_CLASS = 'theme-light';
const DARK_CLASS = 'theme-dark';

function applyTheme(theme: ScanTheme): void {
  const root = globalThis.document?.documentElement;
  if (!root) {
    return;
  }
  root.classList.remove(LIGHT_CLASS, DARK_CLASS);
  root.classList.add(theme === 'dark' ? DARK_CLASS : LIGHT_CLASS);
}

function clearTheme(): void {
  const root = globalThis.document?.documentElement;
  root?.classList.remove(LIGHT_CLASS, DARK_CLASS);
}

function describeViolations(violations: Result[]): string {
  if (violations.length === 0) {
    return '';
  }
  const lines = violations.map(
    (violation) =>
      `${violation.id}: ${violation.help} (${violation.nodes.length} node${
        violation.nodes.length === 1 ? '' : 's'
      })`,
  );
  return `Accessibility violations:\n${lines.join('\n')}`;
}

/**
 * Scan a rendered screen in the given theme and fail on any violation.
 *
 * The theme class is applied to the document root, matching how
 * `ThemeService` switches themes, so the scan exercises the same cascade the
 * user sees.
 */
export async function expectNoA11yViolations(
  element: HTMLElement,
  theme: ScanTheme = 'light',
): Promise<void> {
  applyTheme(theme);
  try {
    const rules = Object.fromEntries(
      JSDOM_BLIND_RULES.map((id) => [id, { enabled: false }]),
    );
    const results: AxeResults = await axe.run(element, { rules });
    expect(results.violations, describeViolations(results.violations)).toEqual([]);
  } finally {
    clearTheme();
  }
}
