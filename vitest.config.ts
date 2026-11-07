import { defineConfig } from 'vitest/config';

/**
 * Vitest options layered on top of the Angular unit-test builder.
 *
 * The specs render real Ionic screens and import the full question banks, so
 * a serial cold run can exceed the 5 second default on a loaded machine. A
 * higher timeout and a bounded worker count keep the release gate stable
 * without changing what the tests assert.
 */
export default defineConfig({
  test: {
    testTimeout: 20_000,
    hookTimeout: 20_000,
    maxWorkers: 4,
  },
});
