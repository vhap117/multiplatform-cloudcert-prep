import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Contrast audit (ACC-13, ACC-14, ACC-18).
 *
 * jsdom cannot compute rendered colours, and axe's `color-contrast` rule is
 * disabled there (see `axe-scan.ts`). This spec closes that gap: it parses the
 * real theme tokens from `styles.css` and asserts WCAG AA ratios, so a token
 * change that breaks contrast fails the build instead of relying on review.
 *
 * The palette is the single source of truth in `styles.css`; parsing it means
 * the test cannot drift from what ships.
 */

type Channels = readonly [number, number, number];

const STYLES_PATH = resolve(process.cwd(), 'src/styles.css');

function themeBlock(selector: string): string {
  const css = readFileSync(STYLES_PATH, 'utf8');
  const start = css.indexOf(selector);
  if (start === -1) {
    throw new Error(`theme selector "${selector}" not found in styles.css`);
  }
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') {
      depth++;
    } else if (css[i] === '}') {
      depth--;
      if (depth === 0) {
        return css.slice(open + 1, i);
      }
    }
  }
  throw new Error(`unterminated block for "${selector}"`);
}

function parseTokens(block: string): Record<string, Channels> {
  const tokens: Record<string, Channels> = {};
  const pattern = /--ccp-([a-z0-9-]+):\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s*;/g;
  for (const match of block.matchAll(pattern)) {
    tokens[match[1]] = [Number(match[2]), Number(match[3]), Number(match[4])];
  }
  return tokens;
}

function channelLuminance(value: number): number {
  const channel = value / 255;
  return channel <= 0.03928
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]: Channels): number {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

function contrast(foreground: Channels, background: Channels): number {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

interface Pair {
  readonly foreground: string;
  readonly background: string;
  readonly largeOnly?: boolean;
}

const TEXT_PAIRS: readonly Pair[] = [
  { foreground: 'text', background: 'bg' },
  { foreground: 'text', background: 'bg-card' },
  { foreground: 'text', background: 'bg-card-hover' },
  { foreground: 'text-muted', background: 'bg' },
  { foreground: 'text-muted', background: 'bg-card' },
  { foreground: 'text-muted', background: 'bg-card-hover' },
  { foreground: 'link', background: 'bg' },
  { foreground: 'link', background: 'bg-card' },
  { foreground: 'success', background: 'bg' },
  { foreground: 'success', background: 'bg-card' },
  { foreground: 'danger', background: 'bg' },
  { foreground: 'danger', background: 'bg-card' },
  { foreground: 'warning', background: 'bg' },
  { foreground: 'warning', background: 'bg-card' },
  { foreground: 'brand-text', background: 'bg' },
  { foreground: 'brand-text', background: 'bg-card' },
  { foreground: 'brand-text', background: 'bg-card-hover' },
  { foreground: 'on-brand', background: 'brand' },
  { foreground: 'on-brand', background: 'brand-hover' },
  { foreground: 'on-cta', background: 'cta' },
  { foreground: 'on-danger', background: 'danger' },
  { foreground: 'on-header', background: 'header-bg' },
];

describe('theme contrast (ACC-13)', () => {
  const themes = {
    light: parseTokens(themeBlock('.theme-light')),
    dark: parseTokens(themeBlock('.theme-dark')),
  } as const;

  for (const [name, tokens] of Object.entries(themes)) {
    describe(`${name} theme`, () => {
      it('parsed the full token set', () => {
        expect(Object.keys(tokens).length).toBeGreaterThanOrEqual(19);
      });

      for (const pair of TEXT_PAIRS) {
        const minimum = pair.largeOnly ? 3 : 4.5;
        it(`${pair.foreground} on ${pair.background} meets ${minimum}:1`, () => {
          const foreground = tokens[pair.foreground];
          const background = tokens[pair.background];
          expect(foreground, `missing token --ccp-${pair.foreground}`).toBeDefined();
          expect(background, `missing token --ccp-${pair.background}`).toBeDefined();
          expect(
            contrast(foreground!, background!),
            `${pair.foreground} on ${pair.background} in ${name}`,
          ).toBeGreaterThanOrEqual(minimum);
        });
      }
    });
  }

  it('ships complete light and dark themes rather than an inversion (ACC-14)', () => {
    const light = themes.light;
    const dark = themes.dark;

    expect(luminance(light['bg'])).toBeGreaterThan(luminance(dark['bg']));
    expect(luminance(light['bg-card'])).toBeGreaterThan(luminance(dark['bg-card']));
    expect(luminance(light['text'])).toBeLessThan(luminance(dark['text']));

    const sharedNames = Object.keys(light).filter((token) => token in dark);
    const differing = sharedNames.filter(
      (token) => light[token].join(',') !== dark[token].join(','),
    );
    expect(differing.length).toBeGreaterThanOrEqual(8);
  });
});
