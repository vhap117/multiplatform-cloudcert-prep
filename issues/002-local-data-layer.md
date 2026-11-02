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

- [ ] Define the `StudyRepository` TypeScript interface covering attempts,
      question results, domain aggregates, per-question mastery, and
      in-progress sessions. (`DATA-16` to `DATA-21`, `IONIC-20`)
- [ ] Define schema version 1 DDL once, shared by both adapters: tables for
      `attempts`, `attempt_questions`, `cert_progress`, `question_mastery`,
      and `sessions`, using the entity fields listed in EXAM-ENGINE.md.
      (`DATA-9A`, `CONT-37`)
- [ ] Implement the Capacitor SQLite adapter. The database lives in the app
      private data directory and is not world-readable. (`DATA-7`, `DATA-9`,
      `CONT-32`)
      **Deferred: web-only scope. Do not start this task.**
- [ ] Implement the IndexedDB adapter for browser development and automated
      UI tests. It must behave identically, including error handling, so bugs
      surface during `ionic serve`. (`DATA-7`, `DATA-9C`, `ACC-43`, `CONT-33`)
- [ ] Add platform detection that selects the adapter: SQLite on native,
      IndexedDB in the browser. (`IONIC-6`)
- [ ] Implement the forward-only migration runner. A migration failure leaves
      previous data intact and surfaces a recoverable error; it never silently
      deletes the database. (`DATA-11`, `DATA-12`, `ACC-39`)
- [ ] Implement the transactional answer write: attempt row, question result,
      session state, domain aggregate, and per-question mastery commit
      together or roll back together. (`DATA-10`, `SR-11`, `SR-33`)
- [ ] Validate rows on read. A malformed or unknown row is ignored or
      quarantined, never a crash. (`DATA-23`, `ACC-40`)
- [ ] Add the separate small key-value settings store (selected cert, theme,
      reduced motion). `localStorage` is allowed only here, never for study
      data. (`DATA-8`, `DATA-22`)
- [ ] Handle full or unavailable disk: the current screen keeps working and
      the failed write is visible and retryable. (`DATA-13`, `ACC-41`)
- [ ] Close or checkpoint the database on app pause and shutdown where the
      platform supports it. (`DATA-14`)
- [ ] Write the repository contract test suite and run it against both
      adapters. (`CONT-43`)
- [ ] Write migration tests: upgrading from schema version N to N+1 preserves
      all data. (`CONT-48`)

## Acceptance criteria

- The repository contract test suite passes against the IndexedDB adapter in
      Chrome. The same suite will run against SQLite when the native phase
      starts; the tests are written against the interface so no rewrite is
      needed.
- Killing the process mid-write never leaves a partial answer: on next launch
      the transaction is either fully applied or fully absent.
- A forced migration failure in a test shows the recoverable error and the
      pre-migration data still reads correctly.
- Grep proves feature code imports only `StudyRepository`, never IndexedDB
      APIs directly and never the Capacitor SQLite plugin. (`IONIC-20`)
- Nothing in the data layer performs a network request. (`DATA-15`)

## Out of scope

- Backup export and import (issue 011), though the schema must already carry
      the fields exports will need.
- Reset and delete-all actions (issues 009 and 011); this issue only provides
      the repository operations they will call.
- The optional biometric app lock (`DATA-33` to `DATA-35`), deferred to
      issue 012.
