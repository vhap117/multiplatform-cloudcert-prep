# Issue 009: History, attempt review, and local statistics

## Context

History replaces the web app's server-backed activity feed. It lists every
completed attempt and practice session, opens any of them for full question
review, and powers a local statistics view. Reset operations live here because
they act on exactly this data.

Spec: `../ionic-requirements/05-progress-and-history.md` (history, reset, and
statistics rows PROG-16 to PROG-49) and the review rules in
`../ionic-requirements/02-mock-exam.md` (EXAM-39 to EXAM-41).

Traces: `PROG-16` to `PROG-49`, `DATA-31`, `DATA-32`, `EXAM-39` to `EXAM-41`.

Depends on: 002, 005 (real attempt rows to list and review).
Blocks: 013 (history is part of the hardening pass).

## Tasks

- [ ] History list of local attempts and completed sessions, newest first.
      (`PROG-16`, `PROG-24`)
- [ ] Filters: by cert, all, passed, failed, mock exam, study exam, and domain
      practice. Filter chips expose their selected state to assistive
      technology. (`PROG-17`, `PROG-18`)
- [ ] Session types stay distinguishable in the list and in records, with
      study exams contributing to the shared best-score dashboard.
      (`PROG-47`, `PROG-48`)
- [ ] Each attempt expands to show per-domain scores and metadata; expanding
      loads its question results and offers review. (`PROG-20`, `PROG-21`)
- [ ] Question review filters by all, incorrect, flagged, and domain. Each
      card shows the explanation summary and per-option explanations for the
      recorded answer, plus student answer, correct answer, correctness, and
      flag state. (`PROG-22`, `PROG-23`, `EXAM-39` to `EXAM-41`)
- [ ] Long lists paginate or virtualize so a large local history stays
      responsive. (`PROG-19`)
- [ ] Failure handling: a history load failure shows an error with Try again;
      no spinner depends on a network call; offline use never shows a
      connection error. (`PROG-25`, `PROG-26`)
- [ ] Local statistics view: totals for attempts, questions answered,
      accuracy, study time, and best score, split by mock exams, study exams,
      and domain practice, with per-domain accuracy and coverage for the
      selected cert. A read failure shows a retryable error, never fabricated
      numbers. (`PROG-35` to `PROG-40`)
- [ ] The statistics view states plainly that the numbers are personal and
      device-local. No community stats, leaderboards, or other-user data, and
      no calls to any public-stats endpoint. (`PROG-39`, `PROG-41`,
      `PROG-42`)
- [ ] Reset per cert: scoped to the active cert when a cert filter is
      selected, gated by a destructive confirmation, and stating that other
      certs are unaffected. It deletes attempts, question results, domain
      aggregates, per-question mastery, and in-progress sessions for that
      scope. (`PROG-29` to `PROG-31`)
- [ ] Delete all local data: gated by an explicit destructive confirmation,
      removes all study data, and never touches the bundled question bank.
      Reset failures surface an error instead of success. (`PROG-32` to
      `PROG-34`, `DATA-31`, `DATA-32`)
- [ ] History and statistics read only from the repository interface; nothing
      here depends on a network connection. (`PROG-26`, `PROG-49`)
- [ ] Presentation: US English, mobile accessibility, light and dark themes.
      (`PROG-27`, `PROG-28`)

## Acceptance criteria

- A completed mock exam, study exam, and practice session all appear with
      their correct type labels and pass or fail states where applicable.
- Expanding a mock exam and reviewing shows the exact recorded answers and
      the per-option explanations, with all four filters working.
- Reset one cert: its attempts and mastery vanish while another cert's data
      is untouched; the confirmation names the scope.
- Statistics match hand-computed values from a known fixture and never invent
      numbers on a failed read.
- Everything above works in airplane mode.

## Out of scope

- Dashboard rendering (issue 008).
- Backup export and import (issue 011); reset is a destructive local action,
      not a backup story.
- Optional biometric app lock (issue 012).
