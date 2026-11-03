# Issue 005: Mock exam feature

## Context

The timed, scored mock exam is the headline flow. It mirrors the web app's exam
behaviour but persists locally and survives phone lifecycle events: the timer
runs on wall-clock time, so backgrounding, screen lock, and force close never
corrupt an attempt.

Spec: `../ionic-requirements/02-mock-exam.md` (all of it). Engine functions
come from issue 004; storage from issue 002.

Traces: `EXAM-1` to `EXAM-47`, `DATA-21`, `DATA-38` to `DATA-42`.

Depends on: 002, 004.
Blocks: 009, 010.

## Specs

S1. Starting an exam builds the set with `selectExamQuestions`, shuffles question
and option order with the remap preserved, and persists the session before the
first question renders. (`EXAM-2`, `EXAM-3`, `EXAM-7`, `DATA-21`)

S2. Every answer is saved locally the moment it is given, before any navigation.
(`EXAM-14`)

S3. Single answers grade on selection. Multi, ordering, and matching grade after
an explicit submit once the response is complete. Grading is all-or-nothing.
(`EXAM-8`, `EXAM-9`, `EXAM-10`)

S4. The timer is wall clock: `deadlineAt = startedAt + examTimeSeconds * 1000`,
remaining time recomputed from `Date.now()`, `timeTaken` clamped to
`[0, examTimeSeconds]`. Backgrounding and screen lock keep time elapsing.
(`EXAM-20` to `EXAM-23`, `EXAM-31`)

S5. If the deadline passed while the app was backgrounded, the attempt ends and
results show, unless the student already submitted. (`EXAM-24`)

S6. Submit is one local transaction covering the attempt, its question rows, the
derived domain progress, and the mastery rows, and it marks the session complete
so it leaves Resume. A failed write keeps results on screen with a retry and
never claims success. (`EXAM-27` to `EXAM-34`, `EXAM-36`, `DATA-10`, `DATA-39`)

S7. Exactly at the passing threshold passes, and there is no 60-second minimum:
a completed short attempt still saves. (`EXAM-30`, `EXAM-33`)

S8. Results show pass or fail, scaled score, percentage, correct count, total
questions, elapsed time, and a per-domain breakdown. (`EXAM-37`, `EXAM-38`)

S9. Review supports all, incorrect, flagged, and per-domain filters. Each card
shows the student answer, the correct answer, correctness, flag state, the
explanation summary, and the per-option explanations. (`EXAM-39` to `EXAM-41`)

S10. A start screen shows format, question count, duration, and pass threshold
from the bundled registry. When an in-progress mock exam exists for the cert it
offers Resume exam, and starting fresh requires an explicit resume-or-discard
choice. (`EXAM-1`, `EXAM-4`, `EXAM-5`, `EXAM-6`, `DATA-40`)

S11. In-app navigation away from an active exam opens a leave-confirmation
modal. Confirming preserves the attempt and returns to the previous screen
without discarding answers. (`EXAM-16` to `EXAM-19`)

S12. Flag and unflag per question, with a question grid showing answered,
unanswered, current, and flagged states, and a persistent toolbar with position,
answered progress, remaining time, and submit. (`EXAM-11`, `EXAM-12`, `EXAM-13`)

S13. Low-time warning below a documented threshold, announced to assistive
technology at sensible intervals without becoming noisy. (`EXAM-25`, `EXAM-26`)

S14. Exam events never leave the device. No network request is made by this
feature. (`EXAM-47`, `DATA-15`)

## Log

L1 (user, 2026-11-03): "I merged the branch, now continue with issue 005-mock-exam.md"

L2 (decision, 2026-11-03): the mastery row written by submit uses the engine
weight bands and never a null weight, because the exclusion window has no
documented length yet. The window is recorded as an open gap in issue 004 and
must be fixed where mastery rows are written before issues 006 and 007 rely on
it.

L3 (decision, 2026-11-03): share text (EXAM-43) is not implemented because no
share target is configured and it is optional. Report question (EXAM-42) copies
the question id to the clipboard.

L4 (decision, 2026-11-03): Practice weakest domain (EXAM-44) navigates to the
practice tab with the domain preselected through a query parameter. Issue 007
owns the practice session itself.

## Tasks

- [ ] Start screen: show cert format, question count, duration, and pass
      threshold from the registry, with a Start exam action. (`EXAM-1`,
      `EXAM-4`)
- [ ] Resume entry: when an in-progress mock exam exists for the cert, show a
      Resume exam action; starting fresh with one in progress requires an
      explicit resume-or-discard choice. (`EXAM-5`, `EXAM-6`, `DATA-40`)
- [ ] Composition: build the question set with `selectExamQuestions`, shuffle
      question and option order with remap preserved, and persist the session
      state before the first question renders. (`EXAM-2`, `EXAM-3`, `EXAM-7`,
      `DATA-21`)
- [ ] Question flow for all four types: single grades on selection; multi,
      ordering, and matching grade after an explicit submit once the response
      is complete; grading is all-or-nothing. (`EXAM-8`, `EXAM-9`, `EXAM-10`)
- [ ] Flag and unflag per question, and a question grid showing answered,
      unanswered, current, and flagged states. (`EXAM-11`, `EXAM-12`)
- [ ] Persistent toolbar with position, answered progress, remaining time, and
      a submit action. Previous, next, and grid navigation between questions.
      (`EXAM-13`, `EXAM-15`)
- [ ] Save each answer locally the moment it is given, before any navigation.
      (`EXAM-14`)
- [ ] Leave guard: in-app navigation away opens a leave-confirmation modal;
      confirming preserves the attempt and returns to the previous screen
      without discarding answers. The hardware back handler is deferred to the
      native phase and must reuse this same guard when added. (`EXAM-16` to
      `EXAM-19`)
- [ ] Wall-clock timer: deadline stored as `startedAt + examTimeSeconds`;
      remaining time recomputed from `Date.now()`; backgrounding and screen
      lock keep time elapsing; on resume recompute and restore without losing
      answers. (`EXAM-20` to `EXAM-23`)
- [ ] Deadline passed while backgrounded: end the attempt and show results,
      unless the student already submitted. (`EXAM-24`)
- [ ] Low-time warning below a documented threshold, announced to assistive
      technology at sensible intervals without noise. (`EXAM-25`, `EXAM-26`)
- [ ] Submit flow: Ready to submit dialog summarizing answered and flagged
      counts; on confirm compute raw score, scaled score, per-domain scores,
      pass or fail, and elapsed time in one local transaction that also marks
      the session complete. (`EXAM-27` to `EXAM-34`, `EXAM-36`)
- [ ] Exactly at the passing threshold passes. No 60-second minimum: a short
      completed attempt still saves. (`EXAM-30`, `EXAM-33`)
- [ ] Failed save keeps the results on screen with a retry action and never
      claims success. (`EXAM-35`)
- [ ] Results screen: pass or fail, scaled score, percentage, correct count,
      total questions, elapsed time, and per-domain breakdown. (`EXAM-37`,
      `EXAM-38`)
- [ ] Review mode with all, incorrect, flagged, and per-domain filters; each
      card shows student answer, correct answer, correctness, flag state,
      explanation summary, and per-option explanations. (`EXAM-39` to
      `EXAM-41`)
- [ ] Results actions: Practice weakest domain (from local per-domain data)
      on a failed result, retake with reset state, and return to the cert
      dashboard. Optional: share text that never uploads score data, and a
      report-question action that copies the question id or opens a
      configured issue URL. (`EXAM-42` to `EXAM-46`)
- [ ] Keep exam events local; nothing leaves the device. (`EXAM-47`)

## Acceptance criteria

- Background the app mid-exam for longer than the remaining time: on reopen
      the attempt has ended and results show. (`EXAM-24`)
- Force close mid-exam, reopen: Resume exam restores position, answers, flag
      states, and correct remaining time.
- A completed 2-minute attempt still saves to history. (`EXAM-33`)
- Scoring matches the engine unit tests: 65-question CLF-C02 exam, known
      answer pattern, expected scaled score and per-domain percentages.
- In-app back during the exam opens the leave modal instead of discarding.
- The whole flow runs with the browser offline and produces zero network
      errors.

## Out of scope

- Study exam (issue 006) and domain practice (issue 007), though this feature
      shares their session-state infrastructure.
- History list and dashboard display of results (issues 008 and 009); this
      issue only records them correctly.
