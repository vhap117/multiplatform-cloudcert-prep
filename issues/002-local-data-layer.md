# Issue 002: Local data layer and repository contract

## Context

Every feature in this app reads and writes through one repository interface.
The interface is defined now and implemented against IndexedDB, which is the
only store in the current web-only scope. A Capacitor SQLite adapter will
implement the same interface later, sharing the schema, migrations, and
contract suite. Feature code never touches IndexedDB or SQLite directly, so
that swap stays a one-module change.

Spec: `../ionic-requirements/01-local-data-and-device.md`,
`../ionic-requirements/cert-banks/EXAM-ENGINE.md` (local persistence section).

Traces: `IONIC-6`, `IONIC-7`, `IONIC-19`, `IONIC-20`, `DATA-7` to `DATA-23`,
`DATA-36`, `DATA-37`, `CONT-32`, `CONT-33`, `CONT-37`, `CONT-43`, `CONT-48`.

Depends on: 001.
Blocks: 005, 006, 007, 008, 009, 011.

## Tasks

- [x] Define the `StudyRepository` TypeScript interface covering attempts,
      question results, domain aggregates, per-question mastery, and
      in-progress sessions. (`DATA-16` to `DATA-21`, `IONIC-20`)
- [x] Define schema version 1 as a **relational** shape, not an IndexedDB
      shape: tables `attempts`, `attempt_questions`, `cert_progress`,
      `question_mastery`, and `sessions`, each with named columns and row
      records matching the entity fields in EXAM-ENGINE.md. IndexedDB then
      stores one object store per table whose records mirror those rows, so the
      future SQLite DDL is a transcription of the same schema rather than a
      redesign. Document the mapping in a short comment block above the schema.
      (`DATA-9A`, `IONIC-19`, `CONT-37`)
- [x] Implement the IndexedDB adapter for browser development and automated
      UI tests. It must behave identically, including error handling, so bugs
      surface during `ionic serve`. (`DATA-7`, `DATA-9C`, `ACC-43`, `CONT-33`)
- [x] Add platform detection that selects the adapter; currently an injection
      token plus a single factory, so the native phase adds one branch.
      (`IONIC-6`, `IONIC-20`)
- [x] Implement the forward-only migration runner. A migration failure leaves
      previous data intact and surfaces a recoverable error; it never silently
      deletes the database. (`DATA-11`, `DATA-12`, `ACC-39`)
- [x] Implement the transactional answer write: attempt row, question result,
      session state, domain aggregate, and per-question mastery commit
      together or roll back together. (`DATA-10`, `SR-11`, `SR-33`)
- [x] Validate rows on read. A malformed or unknown row is ignored or
      quarantined, never a crash. (`DATA-23`, `ACC-40`)
- [x] Add the separate small key-value settings store (selected cert, theme,
      reduced motion). `localStorage` is allowed only here, never for study
      data. (`DATA-8`, `DATA-22`)
- [x] Handle full or unavailable disk: the current screen keeps working and
      the failed write is visible and retryable. Storage failures surface as
      `StorageWriteError`, never as a raw `DOMException`. (`DATA-13`, `ACC-41`)
- [x] Close or checkpoint the database on app pause and shutdown where the
      platform supports it. `close()` exists and a `versionchange` event closes
      the connection so another tab can migrate. (`DATA-14`)
- [x] Write the repository contract test suite. It runs against IndexedDB now
      and will run unchanged against SQLite later. (`CONT-43`)
- [x] Write migration tests: upgrading from schema version N to N+1 preserves
      all data. (`CONT-48`)

### Deferred, by scope

- [x] Implement the Capacitor SQLite adapter against the shared schema and
      repository contract. It runs the same contract suite as IndexedDB through
      a sql.js test driver, and the Capacitor driver sits behind the platform
      gate in `repository-provider.ts`. (`DATA-7`, `IONIC-19`, `CONT-32`,
      `CONT-43`)
- [ ] Verify on an Android device or emulator that the database lives in the app
      private data directory and is not world-readable. (`DATA-9`)
      **Deferred: the Capacitor Android platform is added separately.**

## Acceptance criteria

- [x] The repository contract test suite passes against the IndexedDB adapter.
      The same suite passes against the SQLite adapter through a sql.js driver;
      device verification of the Capacitor driver is tracked separately.
- [x] An injected failure mid-commit leaves no partial answer: the attempt,
      progress, mastery, and session clear are all absent afterwards.
- [x] A forced migration failure reports `StorageMigrationError` with the from
      and to versions, and the pre-migration data still reads correctly.
- [x] Lint proves feature code imports only `StudyRepository`, never IndexedDB
      APIs directly and never the Capacitor SQLite plugin. (`IONIC-20`)
- [x] Nothing in the data layer performs a network request. (`DATA-15`)

## Out of scope

- Backup export and import (issue 011), though the schema already carries the
  fields exports will need.
- Reset and delete-all actions (issues 009 and 011); this issue provides
  `resetCert` and `resetAll` which those issues call.
- The optional biometric app lock (`DATA-33` to `DATA-35`), deferred to
  issue 012.

## Log

L1 (verbatim): "proceed with issue 2, if you need to delete files or folders
from /tmp feel free to do so"

### Evidence

| Moment | Result |
|---|---|
| TDD RED | `ng test` failed: `Cannot find module './indexeddb-study-repository'` |
| TDD GREEN | 35 tests, 4 files |
| Final tests | 6 files, 46 tests passing |
| ESLint | "All files pass linting" |
| Dash lint | clean |
| Build | `ng build` exit 0 |
| Boundary rule negative test | a probe file using the adapter, `indexedDB`, and `fetch` produced exactly 3 errors, then was deleted |
| Network scan | no `fetch`, `XMLHttpRequest`, `WebSocket`, or `sendBeacon` in `src/app/core/storage/` |

### Decisions and findings

1. **The contract came first, deliberately.** The spec imports
   `IndexedDbStudyRepository` before it exists, so RED was a real compile
   failure, not a simulated one. The implementation then had to satisfy 24
   behavioural assertions rather than the other way round.
2. **Atomicity is proven, not assumed.** The adapter takes an optional
   `hooks.beforeCommit` test seam that throws inside the live transaction.
   The suite asserts the attempt, progress, mastery, and the session clear all
   vanish together, and that a pre-existing session survives. Without this the
   atomic claim would be untested marketing.
3. **`writeRawForTest` exists on purpose.** Row quarantine (DATA-23) can only
   be proven by writing a row that bypasses validation. It is on the class, not
   on `StudyRepository`, so feature code cannot reach it.
4. **The storage boundary is enforced, not documented.** An ESLint block
   forbids importing the adapter, `@capacitor/*`, and the globals `indexedDB`,
   `fetch`, and `XMLHttpRequest` from anywhere outside `core/storage`. I
   verified the rule fires by adding a violating probe file, confirming three
   errors, and deleting it. A rule that silently matches nothing is worse than
   no rule.
5. **`open()` is lazy and idempotent.** Every public method awaits it, so a
   storage failure surfaces at the point of use as a typed error rather than
   preventing app boot. That matters for DATA-12 and ACC-46.
6. **Spec tension recorded, not silently resolved.** DATA-38 says "exactly one
   active in-progress session per cert at a time", while STUDY-56 says a study
   exam and a mock exam must not consume each other and "the stores SHALL be
   separate". Both cannot be true if only one session per cert may exist. This
   implementation keys sessions by `cert:kind`, which permits one mock and one
   study per cert, matching STUDY-56. The feature issues (005 to 007) must
   decide which combination the UI allows. Worth fixing in the spec.
7. **`fake-indexeddb` is required for tests.** jsdom has no IndexedDB, so the
   dev dependency provides it to the vitest environment.
