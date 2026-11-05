# Local data and device identity

Scope: the single-user data model, local persistence, schema migration, backup,
restore, reset, and optional device-level protection. This topic replaces the web
app's authentication and account requirements.

## Identity model

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| DATA-1 | The app SHALL be single-user. There SHALL be no sign-in, sign-up, password, email, OAuth, magic link, or account recovery flow. | Required | `IONIC-1` |
| DATA-2 | The device install SHALL be the identity boundary. All study data SHALL belong to the local install. | Required | This document |
| DATA-3 | The app MAY offer a local display name for personalisation. The name SHALL be optional and SHALL NOT be used as a security identity. | Optional | This document |
| DATA-4 | The app SHALL NOT create or require a remote user id. | Required | This document |
| DATA-5 | The app SHALL NOT expose a guest or signed-in distinction. Every feature SHALL be available to the single local user. | Required | `IONIC-1`, `IONIC-18` |
| DATA-6 | A fresh install SHALL start with an empty local database and the default cert selection. | Required | This document |

## Durable local store

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| DATA-7 | Persistent data SHALL use a platform-adaptive transactional store behind one repository interface. On native devices this SHALL be Capacitor SQLite. In the browser, including `ionic serve` development and tests, this SHALL be IndexedDB. | Required | `IONIC-6`, `IONIC-19` |
| DATA-8 | `localStorage` SHALL be used only for small, non-critical preferences. It SHALL NOT be the primary store for attempts, answers, mastery, or active sessions. | Required | `IONIC-6` |
| DATA-9 | The native database SHALL be stored in the app's private data directory and SHALL not be world-readable. The browser IndexedDB store SHALL be scoped to the development origin. | Required | This document |
| DATA-9A | The native and web adapters SHALL share the same schema version, migrations, and repository contract, so a feature behaves the same in `ionic serve` and on a device. | Required | `IONIC-19` |
| DATA-9B | Feature code SHALL depend on the repository interface, not on Capacitor SQLite or IndexedDB directly. | Required | `IONIC-20` |
| DATA-9C | The browser adapter SHALL be used for local development and automated UI tests. It SHALL NOT be presented as the primary production store on a device. | Required | This document |
| DATA-9D | A backup exported from the browser adapter SHALL be importable by the native adapter, and the reverse, subject to schema version compatibility. | Required | `DATA-24` to `DATA-30` |
| DATA-10 | Write operations for an answer SHALL be transactional: the attempt row, question row, and any derived progress update SHALL commit together or not at all. | Required | This document |
| DATA-11 | The app SHALL use a schema version and SHALL run forward-only migrations on startup when the stored version is older. | Required | `IONIC-6` |
| DATA-12 | A migration failure SHALL leave the previous data intact and SHALL show a recoverable error. It SHALL NOT silently delete the database. | Required | This document |
| DATA-13 | The app SHALL handle a full or unavailable disk without crashing the current study screen. The failed write SHALL be visible and retryable. | Required | This document |
| DATA-14 | The app SHALL close or checkpoint the database on app pause and on shutdown where the platform supports it. | Required | This document |
| DATA-15 | The app SHALL NOT depend on a network connection to read or write study data. | Required | `IONIC-2` |

## Local data model

The exact table names are implementation details. The following records SHALL
exist in some form.

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| DATA-16 | The app SHALL store completed attempts with cert code, started and finished timestamps, score percentage, pass flag, time taken, total questions, correct count, and per-domain scores. | Required | `02-mock-exam.md` |
| DATA-17 | The app SHALL store one question-result row per answered question, linked to its attempt where applicable, with cert, domain, question id, user answer, correct answer, correctness, and flag state. | Required | `05-progress-and-history.md` |
| DATA-18 | Domain practice rows SHALL be stored without a parent mock-exam attempt. | Required | `03-practice-by-subject.md` |
| DATA-19 | The app SHALL store per-domain aggregates: attempted count, correct count, mastery percentage, and update time. | Required | `04-spaced-repetition.md` |
| DATA-20 | The app SHALL store per-question mastery state needed for adaptive selection: correct streak, last-was-wrong flag, last-seen time, mastered flag, exclusion state, and weight. | Required | `04-spaced-repetition.md` |
| DATA-21 | The app SHALL store in-progress session state for resume: session kind, cert, question order, current position, answers, feedback state, timing state, and progress counters. | Required | `02-mock-exam.md`, `10-study-exams.md` |
| DATA-22 | The app SHALL store the selected cert, theme, reduced-motion preference, and other small settings in a separate key-value store. | Required | This document |
| DATA-23 | Stored rows SHALL be validated on read. A row with an unknown or malformed shape SHALL be ignored or quarantined, not allowed to crash the app. | Required | This document |

## Backup and restore

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| DATA-24 | The app SHALL provide an export action that writes a single backup file containing a schema version, export timestamp, app version, settings, attempts, question results, domain progress, per-question mastery, and any in-progress sessions. | Required | `IONIC-8` |
| DATA-25 | The export SHALL be human-readable JSON or a documented archive format containing JSON. | Required | This document |
| DATA-26 | The app SHALL allow the student to share or save the export file through the device share sheet or file picker. | Required | This document |
| DATA-27 | The app SHALL provide an import action that validates the backup schema version and contents before replacing or merging data. | Required | This document |
| DATA-28 | Import SHALL default to replacing local data only after an explicit confirmation that names what will be replaced. | Required | This document |
| DATA-29 | Import SHALL reject an incompatible schema version or malformed file without modifying the existing database. | Required | This document |
| DATA-30 | A restore from backup SHALL rebuild the history, dashboard, mastery, and resume state without requiring a network connection. | Required | This document |
| DATA-31 | The app SHALL provide a local reset that deletes some or all study data after an explicit destructive confirmation. | Required | `05-progress-and-history.md` |
| DATA-32 | Reset SHALL NOT delete the bundled question bank or the app itself. | Required | This document |

## Device protection

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| DATA-33 | The app MAY offer an optional device-level lock, such as biometric unlock, for privacy when the phone is shared. | Optional | This document |
| DATA-34 | Any app lock SHALL be a local access gate, not an account identity. It SHALL NOT create a remote profile or upload data. | Optional | This document |
| DATA-35 | If the device lock is unavailable or fails, the app SHALL fall back to the device passcode protection or to a clear no-lock state, without corrupting data. | Optional | This document |
| DATA-36 | The app SHALL not log study answers, backup contents, or other personal data to the system console or crash output. | Required | `07-privacy-and-telemetry.md` |
| DATA-37 | The app SHALL unlink or clear its private database when the operating system uninstalls the app, subject to platform behaviour. | Required | This document |

## Data lifecycle rules

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| DATA-38 | There SHALL be at most one active in-progress session per kind per cert at a time. | Required | `STUDY-35`, `02-mock-exam.md` |
| DATA-39 | Completing a session SHALL mark it complete and remove it from the resume list. | Required | `10-study-exams.md` |
| DATA-40 | Starting a new session for a cert with an existing in-progress session SHALL require an explicit choice to resume or discard. | Required | `10-study-exams.md` |
| DATA-41 | A discarded session SHALL be removed from local storage and SHALL NOT contribute to history or mastery. | Required | This document |
| DATA-42 | A completed attempt SHALL remain in history until the student resets it. | Required | `05-progress-and-history.md` |
| DATA-43 | The app SHALL not use the web app's pending-attempt adoption rules. There is no second account to adopt into. | Required | This document |
| DATA-44 | The app SHALL not use RLS, service role keys, or Supabase. | Required | `IONIC-1`, `IONIC-3` |
