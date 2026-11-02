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
- [ ] Leave guard: in-app navigation away and the Android hardware back button
      open a leave-confirmation modal; confirming preserves the attempt and
      returns to the previous screen without discarding answers. (`EXAM-16`
      to `EXAM-19`)
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
- Android hardware back during the exam opens the leave modal instead of
      exiting.
- The whole flow runs in airplane mode with zero network errors.

## Out of scope

- Study exam (issue 006) and domain practice (issue 007), though this feature
      shares their session-state infrastructure.
- History list and dashboard display of results (issues 008 and 009); this
      issue only records them correctly.
