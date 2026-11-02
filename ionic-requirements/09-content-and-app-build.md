# Content and app build

Scope: the question bank contract, content validation, bundled assets, and how
the Ionic app is built, versioned, and tested. This topic replaces the web
content, SEO, and build requirements.

## Question bank

The Ionic app reuses the web app's question bank as the starting content.

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| CONT-1 | Questions SHALL live in bundled data files, one set per cert and domain, shipped inside the app. | Required | `IONIC-12` |
| CONT-2 | Every question SHALL have `id`, `question`, `options`, `explanation`, and `note`, plus the correct-answer field required by its type. | Required | Web `CONT-2` |
| CONT-3 | Question ids SHALL be unique across the entire cert. | Required | Web `CONT-3` |
| CONT-4 | `options` SHALL have at least two non-empty keys using only `A` to `E`. | Required | Web `CONT-4` |
| CONT-5 | Single-answer questions SHALL have a string `answer` matching one option key. | Required | Web `CONT-5` |
| CONT-6 | Multi-answer questions SHALL have `isMultiAnswer: true` and an array `answer` of two or more valid keys. | Required | Web `CONT-6` |
| CONT-7 | Ordering questions SHALL have `type: 'ordering'`, an unused empty `answer`, and a `correctOrder` that is a permutation of every non-empty option key. | Required | Web `CONT-7` |
| CONT-8 | Matching questions SHALL have `type: 'matching'`, an unused empty `answer`, `targets` keyed `1` to `5`, and `correctMatches` mapping every option key to a valid target key. | Required | Web `CONT-8` |
| CONT-9 | `explanation` SHALL be an object with a `summary` string and an `options` map with one explanation string per non-empty option. | Required | `10-study-exams.md`, `03-practice-by-subject.md` |
| CONT-10 | Correct-option explanations SHALL state the correct answer rationale. Incorrect-option explanations SHALL state why that option is wrong. Ordering explanations SHALL state the correct position. Matching explanations SHALL state the correct target. | Required | This document |
| CONT-11 | `note` SHALL be a non-empty key sentence or short paragraph, derived from the correct-answer rationale. | Required | Web `CONT-59` |
| CONT-12 | Explanations and notes SHALL be plain text with no HTML or Markdown. | Required | Web `CONT-10` |
| CONT-13 | Content SHALL contain no em dashes or en dashes. | Required | `IONIC-14` |
| CONT-14 | `type` SHALL be optional for backward compatibility and inferred from `isMultiAnswer` when absent. | Required | Web `CONT-11` |
| CONT-15 | Optional `taskStatement`, `lastVerified`, and `services` fields SHALL be allowed for coverage tooling. | Required | Web `CONT-12` |
| CONT-16 | The bank SHALL be validated by a content validator that runs in the app's build and test pipeline. | Required | This document |

## Content validation rules

The Ionic validator mirrors the web validator, minus server and SEO concerns.

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| CONT-17 | The validator SHALL check every question against the schema in this document and fail the build on an error. | Required | This document |
| CONT-18 | The validator SHALL check that every live-bank question has a non-empty `note` and a well-formed `explanation` object. | Required | This document |
| CONT-19 | The validator SHALL check that no content field contains an em dash or en dash, a missing space after a period, or leading and trailing whitespace. | Required | Web validator rules |
| CONT-20 | The validator SHALL check that `explanation.summary` and every `explanation.options` value are non-empty strings. | Required | `CONT-9` |
| CONT-21 | The validator SHALL check that `explanation.options` covers exactly the non-empty option keys of the question. | Required | `CONT-9` |
| CONT-22 | The validator SHALL check ordering permutations and matching pairings exactly as the web validator does. | Required | `CONT-7`, `CONT-8` |
| CONT-23 | The validator SHALL warn or fail on stale or unknown cert references in the registry. | Required | This document |
| CONT-24 | Content validation SHALL run offline as part of the test suite and the build. | Required | `IONIC-2` |

## Cert registry and loaders

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| CONT-25 | The cert registry SHALL be bundled and SHALL remain the single source of truth for exam counts, times, passing scores, domains, and status. | Required | `06-certifications-and-navigation.md` |
| CONT-26 | Domain question files SHALL be loaded through a code-split or lazy loader per cert and domain so a large bank does not slow startup. | Required | Web `CONT-14` |
| CONT-27 | The app SHALL support any number of domains per cert with no scoring or history code changes. | Required | Web `CONT-15` |
| CONT-28 | Adding a cert SHALL require a registry entry, bundled question files, and a loader entry, and SHALL NOT require database or schema changes. | Required | Web `CONT-15` |
| CONT-29 | A coming-soon cert SHALL render as coming soon and SHALL NOT open a broken flow. | Required | `06-certifications-and-navigation.md` |
| CONT-30 | A cert's content freshness SHALL be tracked by a bundled content version or timestamp, updated when the bank changes. | Required | This document |

## App build

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| CONT-31 | The app SHALL be built with Ionic and Capacitor and SHALL produce native Android and iOS packages from one codebase. | Required | `IONIC-4` |
| CONT-32 | The native build SHALL use the Capacitor SQLite plugin for the local database. | Required | `IONIC-6`, `01-local-data-and-device.md` |
| CONT-33 | The web build used by `ionic serve` SHALL use the IndexedDB adapter so development and tests run in a browser without the native plugin. | Required | `IONIC-6`, `IONIC-19` |
| CONT-34 | The build SHALL embed the question bank and all app assets so the installed app is self-contained. | Required | `IONIC-12` |
| CONT-35 | The build SHALL be reproducible: same source, same content validation, same output, no secrets. | Required | This document |
| CONT-36 | The app SHALL carry an app version and a content version, both visible in Settings. | Required | `05-progress-and-history.md` |
| CONT-37 | A database schema version SHALL be tracked separately from the app version and SHALL run forward-only migrations. | Required | `DATA-11` |
| CONT-38 | The build SHALL NOT include web-only files: no SEO head, no sitemap, no `_headers`, no Cloudflare or Netlify config, no Supabase keys. | Required | `IONIC-1`, `IONIC-3` |
| CONT-39 | There SHALL be no service role key, anon key, or Supabase client anywhere in the app. | Required | `DATA-44` |
| CONT-40 | Signing and store publishing secrets SHALL NOT live in the repository. | Required | This document |
| CONT-41 | The app SHALL include only documented permissions, as listed in `07-privacy-and-telemetry.md`. | Required | `07-privacy-and-telemetry.md` |

## Testing

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| CONT-42 | Pure logic, such as scoring, selection, mastery, and validation, SHALL have unit tests. | Required | Web `CONT-50` |
| CONT-43 | The storage repository SHALL have contract tests that run against both the IndexedDB adapter and the SQLite adapter where possible. | Required | `IONIC-19` |
| CONT-44 | UI flows SHALL be exercised in a browser with the IndexedDB adapter during development. | Required | `IONIC-20` |
| CONT-45 | Core flows SHALL be smoke-tested on a real device before a release: install, study exam, mock exam, practice, history, backup, restore, airplane mode. | Required | `README.md` verification expectations |
| CONT-46 | Accessibility SHALL be checked with the platform screen readers and large text. | Required | `08-accessibility-and-resilience.md` |
| CONT-47 | Reduced motion and both themes SHALL be checked on every UI change. | Required | `08-accessibility-and-resilience.md` |
| CONT-48 | Migration tests SHALL cover upgrading from the previous schema version without data loss. | Required | `DATA-11`, `DATA-12` |
| CONT-49 | Backup export and import round-trips SHALL be tested, including between the web and native adapters. | Required | `DATA-9D` |
| CONT-50 | The content validator SHALL run in CI and in the local test script. | Required | `CONT-16` |

## Removed web behaviour

- SEO, sitemaps, canonical tags, structured data, and Lighthouse web scores.
- Cloudflare Pages functions, `_headers`, `_routes.json`, and CSP hash generation.
- Astro prerendering and file-format route emission.
- Supabase configuration, RLS, and edge functions.
- Blog, RSS, and marketing content as a product surface.
- Citation guards and the internal link graph.
- Web analytics and consent tooling.
