# Issue 009: History, attempt review, and local statistics

## Context

History replaces the web app's server-backed activity feed. It lists every
completed exam attempt and practice session, opens each exam attempt for full
question review, and powers a local statistics view. Practice sessions show
session-level summaries only and are not reviewable. Reset and delete-all
operations live in issue 011.

Spec: `../ionic-requirements/05-progress-and-history.md` (history and
statistics rows PROG-16 to PROG-28 and PROG-35 to PROG-49) and the review rules
in `../ionic-requirements/02-mock-exam.md` (EXAM-39 to EXAM-41).

Traces: `PROG-16` to `PROG-28`, `PROG-35` to `PROG-49`, `EXAM-39` to
`EXAM-41`.

Depends on: 002, 005, 006, 007 (real attempt rows and practice rows).
Blocks: 013 (history is part of the hardening pass).

## Tasks

- [x] Require the selected cert before rendering History. The selected cert
      scopes the list and statistics; there is no all-certs view.
      (`PROG-16`, `PROG-17`)
- [x] Two segments under the History tab: History and Statistics.
- [x] History list of local exam attempts and completed practice sessions for
      the selected cert, newest first. (`PROG-16`, `PROG-24`)
- [x] Filters: all, passed, failed, mock exam, study exam, and domain practice.
      Passed and failed apply only to exam attempts. Filter chips expose their
      selected state to assistive technology. (`PROG-17`, `PROG-18`)
- [x] Session types stay distinguishable in the list and in records, with
      study exams contributing to the shared best-score dashboard.
      (`PROG-47`, `PROG-48`)
- [x] Each exam attempt expands to show per-domain scores and metadata;
      expanding loads its question results and offers review. (`PROG-20`,
      `PROG-21`)
- [x] Question review filters by all, incorrect, flagged, and domain. Each
      card shows the explanation summary and per-option explanations for the
      recorded answer, plus student answer, correct answer, correctness, and
      flag state. (`PROG-22`, `PROG-23`, `EXAM-39` to `EXAM-41`)
- [x] Long lists use Load more pagination so a large local history stays
      responsive. (`PROG-19`)
- [x] Failure handling: a history load failure shows an error with Try again;
      no spinner depends on a network call; offline use never shows a
      connection error. (`PROG-25`, `PROG-26`)
- [x] History list practice sessions as session-level summaries only; they
      are not expandable and offer no question review. (`PROG-20`, `PROG-24A`)
- [x] Local statistics view for the selected cert: totals for exam attempts,
      practice sessions, questions answered, accuracy, study time, pass rate,
      average score, and best score. Questions answered is the sum of attempt
      row totalQuestions; accuracy is correct answers divided by questions
      answered across all kinds; study time sums timeTakenSeconds. Pass rate,
      average score, and best score use mock and study exam attempts only.
      Split totals by mock exams, study exams, and domain practice, with
      per-domain accuracy and coverage for the selected cert. Practice
      sessions are not counted as exam attempts. A read failure shows a
      retryable error, never fabricated numbers. (`PROG-35` to `PROG-40`)
- [x] The statistics view states plainly that the numbers are personal and
      device-local. No community stats, leaderboards, or other-user data, and
      no calls to any public-stats endpoint. (`PROG-39`, `PROG-41`,
      `PROG-42`)
- [x] History and statistics read only from the repository interface; nothing
      here depends on a network connection. (`PROG-26`, `PROG-49`)
- [x] Presentation: US English, mobile accessibility, light and dark themes.
      (`PROG-27`, `PROG-28`)

## Acceptance criteria

- A completed mock exam, study exam, and practice session all appear with
      their correct type labels and pass or fail states where applicable.
- Expanding a mock exam and reviewing shows the exact recorded answers and
      the per-option explanations, with all four filters working.
- Statistics match hand-computed values from a known fixture and never invent
      numbers on a failed read.
- The selected cert is required before the History and Statistics segments
      render.
- Everything above works with the browser offline.

## Out of scope

- Dashboard rendering (issue 008).
- Backup export and import (issue 011); reset is a destructive local action,
      not a backup story.
- Reset and delete-all actions (issue 011).
- Optional biometric app lock (issue 012).
