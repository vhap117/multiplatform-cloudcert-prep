// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = defineConfig([
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {},
  },
  {
    /*
     * Storage boundary (IONIC-20, DATA-15).
     *
     * Feature code depends on the StudyRepository interface only. Reaching for
     * the IndexedDB implementation, a Capacitor SQLite plugin, or a network API
     * from anywhere outside the storage layer is a defect, so it fails lint
     * instead of relying on review.
     */
    files: ['src/app/**/*.ts'],
    ignores: ['src/app/core/storage/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/indexeddb-study-repository', '**/storage/indexeddb*'],
              message:
                'Feature code must depend on StudyRepository, not the adapter (IONIC-20).',
            },
            {
              group: ['@capacitor-community/sqlite', '@capacitor/*'],
              message:
                'Native plugins are only reached through the storage adapter.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        {
          name: 'indexedDB',
          message: 'Use StudyRepository instead of IndexedDB directly (IONIC-20).',
        },
        {
          name: 'fetch',
          message: 'Core study flows must not use the network (DATA-15, OFF-3).',
        },
        {
          name: 'XMLHttpRequest',
          message: 'Core study flows must not use the network (DATA-15, OFF-3).',
        },
      ],
    },
  },
  {
    /*
     * Engine boundary (SR-25, SR-26, issue 004).
     *
     * `core/exam` is the pure engine: selection, shuffling, grading, scoring,
     * timing, adaptive practice, and mastery. A framework or storage import
     * would make it untestable without a device and would break the promise
     * that swapping IndexedDB for SQLite is a one-module change.
     */
    files: ['src/app/core/exam/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@angular/*', '@ionic/*', '@capacitor/*', '@capacitor-community/*'],
              message: 'The exam engine is framework independent (SR-25, SR-26).',
            },
            {
              group: ['**/storage/**', '../storage', '../storage/*'],
              message: 'The engine computes; StudyRepository persists (IONIC-19, SR-26).',
            },
          ],
        },
      ],
    },
  },
]);
