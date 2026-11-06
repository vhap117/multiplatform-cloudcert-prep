import { describe, expect, it } from 'vitest';

import packageJson from '../../../package.json';

import { APP_VERSION } from './app-info';

describe('APP_VERSION', () => {
  it('matches the package version', () => {
    expect(APP_VERSION).toBe(packageJson.version);
  });
});
