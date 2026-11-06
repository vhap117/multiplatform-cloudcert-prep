import { describe, expect, it } from 'vitest';

import packageJson from '../../../../package.json';

/**
 * Mechanical privacy audit (PRIV-4, PRIV-13).
 *
 * The app must not enable third-party analytics, advertising, tracking, or
 * crash-reporting SDKs. Enumerating forbidden package-name families here is the
 * same "fail the build instead of trusting review" approach used by the dash
 * and bank-drift lints.
 */
const FORBIDDEN_PACKAGE_PATTERN =
  /analytics|telemetry|segment|sentry|posthog|amplitude|gtag|mixpanel|bugsnag|datadog|newrelic|crashlytics|crash-report|tracking/i;

describe('dependency privacy audit (PRIV-4)', () => {
  it('ships no analytics, advertising, tracking, or crash-reporting SDK', () => {
    const packages = Object.keys({
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    });

    expect(packages.filter((name) => FORBIDDEN_PACKAGE_PATTERN.test(name))).toEqual([]);
  });
});
