# Issue 006: Study exam feature

## Context

The study exam is the untimed learning mode: same question composition as the
mock exam, but with immediate per-option feedback, three live progress bars,
and a save after every graded answer. It is the mode a student opens for five
minutes on a bus, so resume fidelity is the core promise.

Spec: `../ionic-requirements/10-study-exams.md` (all of it). Engine from issue
004, storage from issue 002.

Traces: `STUDY-1` to `STUDY-64`, `DATA-21`, `DATA-38` to `DATA-41`.

Depends on: 002, 004.
Blocks: 009.

## Specs

S1. The study exam is untimed: no countdown, no deadline, no auto-submit, and
no time-pressure UI anywhere in the mode. (`STUDY-1`)

S2. Composition uses the exact mock-exam rules: cert question count, domain
proportions with the last-domain remainder, shuffled question and option order.
No alternate sampling. (`STUDY-2`, `STUDY-2A`)

S3. Single answers grade on selection. Multi, ordering, and matching grade after
an explicit submit once the response is complete. (`STUDY-3`, `STUDY-9`)

S4. Feedback appears immediately after every grade. Fully correct shows
`explanation.summary`. Incorrect identifies every selected wrong option and
every correct option, each with its `explanation.options[key]` text, and a
partial multi covers both sets. (`STUDY-4`, `STUDY-10` to `STUDY-15`)

S5. A graded question becomes read-only for the rest of the session. Revisiting
it shows the recorded answer, its correctness, and its feedback. (`STUDY-16`,
`STUDY-18`)

S6. The feedback panel is keyboard and screen-reader reachable and is announced
when it appears. (`STUDY-19`)

S7. Three compact progress bars stay visible: answered of total with a
percentage, correct count, and wrong count, each with full progressbar ARIA
values, a text label, and a numeric value. Correct plus wrong always equals
answered, including after resume. (`STUDY-22` to `STUDY-31`)

S8. Every graded answer persists the selected answer, correctness, current
position, and per-domain tallies in the shared transactional write. A failed
write is visible, retryable, and never advances as if saved. (`STUDY-20`,
`STUDY-21`, `STUDY-32`, `STUDY-33`)

S9. Resume restores exact question order, current position, recorded answers,
feedback state, and all three bars. A new session shuffles fresh; a resumed
session keeps its saved order and never re-grades or duplicates answers.
(`STUDY-36` to `STUDY-38`)

S10. One in-progress study exam per cert. Starting another requires an explicit
resume-or-discard choice, and discard requires confirmation and removes the
saved session. (`STUDY-34`, `STUDY-35`, `STUDY-41`)

S11. Completion shows a summary with total answered, correct, wrong, accuracy,
and per-domain results, marks the session complete so it stops being resumable,
and records an attempt with per-domain scores and question rows identical in
shape to mock-exam rows. Domains with no questions are never fabricated as 0
percent. (`STUDY-39`, `STUDY-40`, `STUDY-44` to `STUDY-51`)

S12. There is no leave guard: progress is saved continuously, so navigating away
never discards. The study exam never sets the timed-exam active state and never
touches a mock-exam session. (`STUDY-52`, `STUDY-53`, `STUDY-56`)

S13. Counters stay local. Nothing is transmitted. (`STUDY-51`, `EXAM-47`)

## Log

L1 (user, 2026-11-03): "I merged the branch, now continue with issue 006-study-exam.md"

L2 (decision, 2026-11-03): the attempt, question-result, progress, and mastery
rows written at completion are built by one pure builder shared with the mock
exam, so history, mastery, and best score keep consuming one row shape
(STUDY-44 to STUDY-51). The builder is additive and the mock exam keeps its
current path until a later issue adopts it, because refactoring the merged
mock session service inside this feature is how issue 005 gets broken.

L3 (decision, 2026-11-03): the study session is its own service keyed on the
`study` session kind. `SessionRow.feedbackShown` is used for its documented
purpose here (which questions have shown feedback), which is why issue 005
moved mock flags to their own `flagged` list.

L4 (decision, 2026-11-03): the study exam does not use flags. STUDY-1 to
STUDY-64 never require them, and the mode has no submit-later review, so no
flag control is built.

L5 (decision, 2026-11-03): per-domain tallies for the bars are derived from the
recorded answers, not stored separately, so a resume can never disagree with
the persisted answers.

## Tasks

- [x] Start screen: explain the mode (untimed, immediate feedback, auto-save,
      resumable) and show a resume-primary state when an in-progress study
      exam exists for the cert. (`STUDY-59`, `STUDY-60`)
- [x] Enforce the untimed guarantee: no countdown, no deadline, no auto-submit,
      no timer or time-pressure UI anywhere in the mode. (`STUDY-1`)
- [x] Compose the question set with the exact mock-exam rules: cert question
      count, domain proportions with last-domain remainder, shuffled question
      and option order. No alternate sampling. (`STUDY-2`, `STUDY-2A`)
- [x] Question flow: single grades on selection; multi, ordering, and matching
      grade after explicit submit once complete. (`STUDY-3`, `STUDY-9`)
- [x] Immediate feedback after every grade. Fully correct: show
      `explanation.summary`. Incorrect: identify every selected wrong option
      and every correct option, each with its `explanation.options[key]` text.
      Partial multi selections get both sets covered. (`STUDY-4`, `STUDY-10`
      to `STUDY-15`)
- [x] Graded questions become read-only for the rest of the session; revisiting
      one shows the exact recorded answer, its correctness, and its feedback.
      (`STUDY-16`, `STUDY-18`)
- [x] Feedback panel is keyboard and screen-reader reachable and announced when
      it appears. (`STUDY-19`)
- [x] Three compact progress bars throughout: answered (of total, shows
      percentage), correct (count, fill of total), wrong (count, fill of
      total). Correct plus wrong always equals answered, including after
      resume. (`STUDY-22` to `STUDY-25`)
- [x] Bar styling: correct uses a light-green to dark-green gradient, wrong
      uses intense-orange to deep-red, and the answered bar blends between
      light green and intense orange by accuracy. Colour is never the only
      signal: every bar has a text label, numeric value, and full progressbar
      ARIA values. (`STUDY-26` to `STUDY-31`)
- [x] Persist after every graded answer: selected answer, correctness, current
      position, and per-domain tallies, in the shared transactional write. A
      failed write is visible, retryable, and never advances as if saved.
      (`STUDY-20`, `STUDY-21`, `STUDY-32`, `STUDY-33`)
- [x] Resume restores exact question order, current position, recorded answers,
      feedback state, and all three bars. A new session shuffles fresh; a
      resumed session keeps its saved order and never re-grades or duplicates
      answers. (`STUDY-36` to `STUDY-38`)
- [x] One in-progress study exam per cert. Starting another requires an
      explicit resume-or-discard choice; discard requires confirmation and
      removes the saved session. (`STUDY-34`, `STUDY-35`, `STUDY-41`)
- [x] Completion: summary with total answered, correct, wrong, accuracy, and
      per-domain results; the session is marked complete and stops being
      resumable. (`STUDY-39`, `STUDY-40`)
- [x] Record a completed study exam as an attempt with per-domain scores and
      question-level rows identical in shape to mock-exam rows, so history,
      mastery, and the shared best-score dashboard consume it uniformly.
      Domains with no questions are never fabricated as 0 percent. (`STUDY-44`
      to `STUDY-51`)
- [x] No leave guard: progress is saved continuously, so navigating away never
      discards. The study exam never sets the timed-exam active state and
      never touches a mock-exam session; the two stores are separate.
      (`STUDY-52`, `STUDY-53`, `STUDY-56`)
- [x] Local-only counters for the events table in the spec; nothing is
      transmitted. (`STUDY-51`, study-exam local events table)

## Acceptance criteria

- Answer 10 questions, force close, reopen, resume: position, answers,
      feedback state, and all three bars match exactly the pre-close state.
- Start a new study exam while one is in progress: the resume-or-discard
      dialog appears; discarding removes the session from storage.
- Complete a study exam: it appears in history, distinguishable from mock
      exams, and contributes to best score and mastery.
- Feedback and progress-bar values are exposed through ARIA roles, labels,
      and live-region announcements, verified with an accessibility audit in
      the browser. Hardware screen-reader confirmation is deferred to the
      native phase.
- Correct + wrong = answered holds after every answer and after every resume
      (unit and UI tested).

## Delivered slices

| Commit | Slice | Tests |
|---|---|---|
| `4a05c36` | study session layer plus the shared attempt-row builder | 28 |
| `fix` | `discard()` deletes a stored session with no active instance | 1 |
| `feat` | start screen, runner, routes, and the Home entry | 30 |

## Verification evidence

- `npm run verify` green: 377 tests in 31 files, plus dash lint, bank drift,
  ESLint, and the production build.
- Every slice was rerun by the parent before its commit, not taken on the
  writer's report, and the merged mock exam suite stayed green throughout.
- The runner has an integration spec that mounts it against the real session
  service and the real store, with no stubs, and asserts the three progress
  bars and the empty state. A headless browser dump cannot prove this: a
  standalone IndexedDB probe under `--dump-dom` never leaves `pending`, so
  index-dependent screens cannot be verified that way in this environment.

## Decisions recorded during implementation

1. **`discard(certCode?)`.** The start screen can offer Resume before anything
   is loaded, so discarding there must delete the stored row without an active
   session. The alternative reading (no-op) silently kept the session.
2. **The runner states its state.** While the entry logic settles it shows
   "Loading your study exam", then either the exam or a recoverable empty
   state. It never renders nothing.
3. **Completion summary lives in the runner.** No separate results route: the
   mode finishes in place, and issue 009 reads the attempt from storage.
4. **The Home entry is temporary.** Issue 008 owns the real dashboard.
5. **No flags in the study exam**, per log L4.

## Open gaps

1. **Exclusion window length** (from issue 004) now blocks issue 007 directly,
   because domain practice writes the same mastery rows.
2. **Mastered threshold** is still undocumented. The study exam reuses the
   conservative rule recorded in issue 005.
3. **The mock exam runner has the same blank-while-loading gap** that was fixed
   here. It is issue 005 code and was deliberately left alone; a later change
   should give it the same loading and empty states.
4. **End-to-end verification of index-backed screens** needs a real browser or
   a CDP harness. `--dump-dom` cannot observe anything behind IndexedDB.

## Out of scope

- Mock exam timer behaviour (issue 005) and domain practice sizing (issue
      007).
- Backup inclusion of in-progress sessions (issue 011); this issue only keeps
      the session rows exportable.
