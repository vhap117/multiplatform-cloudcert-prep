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

## Tasks

- [ ] Start screen: explain the mode (untimed, immediate feedback, auto-save,
      resumable) and show a resume-primary state when an in-progress study
      exam exists for the cert. (`STUDY-59`, `STUDY-60`)
- [ ] Enforce the untimed guarantee: no countdown, no deadline, no auto-submit,
      no timer or time-pressure UI anywhere in the mode. (`STUDY-1`)
- [ ] Compose the question set with the exact mock-exam rules: cert question
      count, domain proportions with last-domain remainder, shuffled question
      and option order. No alternate sampling. (`STUDY-2`, `STUDY-2A`)
- [ ] Question flow: single grades on selection; multi, ordering, and matching
      grade after explicit submit once complete. (`STUDY-3`, `STUDY-9`)
- [ ] Immediate feedback after every grade. Fully correct: show
      `explanation.summary`. Incorrect: identify every selected wrong option
      and every correct option, each with its `explanation.options[key]` text.
      Partial multi selections get both sets covered. (`STUDY-4`, `STUDY-10`
      to `STUDY-15`)
- [ ] Graded questions become read-only for the rest of the session; revisiting
      one shows the exact recorded answer, its correctness, and its feedback.
      (`STUDY-16`, `STUDY-18`)
- [ ] Feedback panel is keyboard and screen-reader reachable and announced when
      it appears. (`STUDY-19`)
- [ ] Three compact progress bars throughout: answered (of total, shows
      percentage), correct (count, fill of total), wrong (count, fill of
      total). Correct plus wrong always equals answered, including after
      resume. (`STUDY-22` to `STUDY-25`)
- [ ] Bar styling: correct uses a light-green to dark-green gradient, wrong
      uses intense-orange to deep-red, and the answered bar blends between
      light green and intense orange by accuracy. Colour is never the only
      signal: every bar has a text label, numeric value, and full progressbar
      ARIA values. (`STUDY-26` to `STUDY-31`)
- [ ] Persist after every graded answer: selected answer, correctness, current
      position, and per-domain tallies, in the shared transactional write. A
      failed write is visible, retryable, and never advances as if saved.
      (`STUDY-20`, `STUDY-21`, `STUDY-32`, `STUDY-33`)
- [ ] Resume restores exact question order, current position, recorded answers,
      feedback state, and all three bars. A new session shuffles fresh; a
      resumed session keeps its saved order and never re-grades or duplicates
      answers. (`STUDY-36` to `STUDY-38`)
- [ ] One in-progress study exam per cert. Starting another requires an
      explicit resume-or-discard choice; discard requires confirmation and
      removes the saved session. (`STUDY-34`, `STUDY-35`, `STUDY-41`)
- [ ] Completion: summary with total answered, correct, wrong, accuracy, and
      per-domain results; the session is marked complete and stops being
      resumable. (`STUDY-39`, `STUDY-40`)
- [ ] Record a completed study exam as an attempt with per-domain scores and
      question-level rows identical in shape to mock-exam rows, so history,
      mastery, and the shared best-score dashboard consume it uniformly.
      Domains with no questions are never fabricated as 0 percent. (`STUDY-44`
      to `STUDY-51`)
- [ ] No leave guard: progress is saved continuously, so navigating away never
      discards. The study exam never sets the timed-exam active state and
      never touches a mock-exam session; the two stores are separate.
      (`STUDY-52`, `STUDY-53`, `STUDY-56`)
- [ ] Local-only counters for the events table in the spec; nothing is
      transmitted. (`STUDY-51`, study-exam local events table)

## Acceptance criteria

- Answer 10 questions, force close, reopen, resume: position, answers,
      feedback state, and all three bars match exactly the pre-close state.
- Start a new study exam while one is in progress: the resume-or-discard
      dialog appears; discarding removes the session from storage.
- Complete a study exam: it appears in history, distinguishable from mock
      exams, and contributes to best score and mastery.
- TalkBack announces feedback and progress-bar values correctly.
- Correct + wrong = answered holds after every answer and after every resume
      (unit and UI tested).

## Out of scope

- Mock exam timer behaviour (issue 005) and domain practice sizing (issue
      007).
- Backup inclusion of in-progress sessions (issue 011); this issue only keeps
      the session rows exportable.
