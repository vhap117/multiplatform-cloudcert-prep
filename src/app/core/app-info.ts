/**
 * App version written into backups and shown in Settings (DATA-24, issue 012).
 *
 * Kept as a constant so the bundle never imports `package.json`; the spec
 * asserts it matches the package version so the two cannot drift.
 */
export const APP_VERSION = '0.0.0';
