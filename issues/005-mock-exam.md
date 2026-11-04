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
S6. Submit is one local transaction covering the attempt, its question rows,
and the derived domain progress, and it marks the session complete so it
leaves Resume. It writes no question mastery rows: a mock exam is pure
assessment for per-question mastery (EXAM-34A). A failed write keeps results
on screen with a retry and never claims success. (`EXAM-27` to `EXAM-34`,
`EXAM-34A`, `EXAM-36`, `DATA-10`, `DATA-39`)

S7. Exactly at the passing threshold passes, and there is no 60-second minimum:
a completed short attempt still saves. (`EXAM-30`, `EXAM-33`)

S8. Results show pass or fail, score percentage, correct count, total
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

L5 (decision, 2026-11-04): mock submit no longer writes question mastery
rows at all. This reverses L2 and decision 3. The exclusion window and
mastered threshold now exist (issue 007 log L2: mastered at 2 consecutive
correct answers, window 3 completed practice sessions), and the user decided
a mock exam must have no effect on question mastery: only study exams and
practice sessions move it, specified as EXAM-34A in
`../ionic-requirements/02-mock-exam.md` and SR-7/SR-11 in
`../ionic-requirements/04-spaced-repetition.md`. Domain progress still
updates from mock results per EXAM-34. Mastery rows written by earlier dev
mock exams self-heal the next time a practice session folds that question.

## Tasks

- [x] Start screen: show cert format, question count, duration, and pass
      threshold from the registry, with a Start exam action. (`EXAM-1`,
      `EXAM-4`)
- [x] Resume entry: when an in-progress mock exam exists for the cert, show a
      Resume exam action; starting fresh with one in progress requires an
      explicit resume-or-discard choice. (`EXAM-5`, `EXAM-6`, `DATA-40`)
- [x] Composition: build the question set with `selectExamQuestions`, shuffle
      question and option order with remap preserved, and persist the session
      state before the first question renders. (`EXAM-2`, `EXAM-3`, `EXAM-7`,
      `DATA-21`)
- [x] Question flow for all four types: single grades on selection; multi,
      ordering, and matching grade after an explicit submit once the response
      is complete; grading is all-or-nothing. (`EXAM-8`, `EXAM-9`, `EXAM-10`)
- [x] Flag and unflag per question, and a question grid showing answered,
      unanswered, current, and flagged states. (`EXAM-11`, `EXAM-12`)
- [x] Persistent toolbar with position, answered progress, remaining time, and
      a submit action. Previous, next, and grid navigation between questions.
      (`EXAM-13`, `EXAM-15`)
- [x] Save each answer locally the moment it is given, before any navigation.
      (`EXAM-14`)
- [x] Leave guard: in-app navigation away opens a leave-confirmation modal;
      confirming preserves the attempt and returns to the previous screen
      without discarding answers. The hardware back handler is deferred to the
      native phase and must reuse this same guard when added. (`EXAM-16` to
      `EXAM-19`)
- [x] Wall-clock timer: deadline stored as `startedAt + examTimeSeconds`;
      remaining time recomputed from `Date.now()`; backgrounding and screen
      lock keep time elapsing; on resume recompute and restore without losing
      answers. (`EXAM-20` to `EXAM-23`)
- [x] Deadline passed while backgrounded: end the attempt and show results,
      unless the student already submitted. (`EXAM-24`)
- [x] Low-time warning below a documented threshold, announced to assistive
      technology at sensible intervals without noise. (`EXAM-25`, `EXAM-26`)
- [x] Submit flow: Ready to submit dialog summarizing answered and flagged
      counts; on confirm compute score percentage, per-domain scores,
      pass or fail, and elapsed time in one local transaction that also marks
      the session complete. (`EXAM-27` to `EXAM-34`, `EXAM-36`)
- [x] Exactly at the passing threshold passes. No 60-second minimum: a short
      completed attempt still saves. (`EXAM-30`, `EXAM-33`)
- [x] Failed save keeps the results on screen with a retry action and never
      claims success. (`EXAM-35`)
- [x] Results screen: pass or fail, score percentage, correct count,
      total questions, elapsed time, and per-domain breakdown. (`EXAM-37`,
      `EXAM-38`)
- [x] Review mode with all, incorrect, flagged, and per-domain filters; each
      card shows student answer, correct answer, correctness, flag state,
      explanation summary, and per-option explanations. (`EXAM-39` to
      `EXAM-41`)
- [x] Results actions: Practice weakest domain (from local per-domain data)
      on a failed result, retake with reset state, and return to the cert
      dashboard. Optional: share text that never uploads score data, and a
      report-question action that copies the question id or opens a
      configured issue URL. (`EXAM-42` to `EXAM-46`)
- [x] Keep exam events local; nothing leaves the device. (`EXAM-47`)

## Acceptance criteria

- Background the app mid-exam for longer than the remaining time: on reopen
      the attempt has ended and results show. (`EXAM-24`)
- Force close mid-exam, reopen: Resume exam restores position, answers, flag
      states, and correct remaining time.
- A completed 2-minute attempt still saves to history. (`EXAM-33`)
- Scoring matches the engine unit tests: 65-question CLF-C02 exam, known
      answer pattern, expected score percentage and per-domain percentages.
- In-app back during the exam opens the leave modal instead of discarding.
- The whole flow runs with the browser offline and produces zero network
      errors.

## Delivered slices

| Commit | Slice | Tests |
|---|---|---|
| `ed3fd68` | session lifecycle, persistence, typed commit failure | 14 |
| `6220b3d` | this spec and log | - |
| `c6f70b8` | start screen | 10 |
| `2338d93` | results and review | 39 |
| `3c3b382` | routes and navigation across the three screens | - |
| `fix` | `app.config` provider for `STUDY_REPOSITORY`, plus a spec that boots the real provider list | 1 |
| `feat` | home screen entry into the flow | 3 |

## Wiring defect found after the close

The flow shipped with routes but no `provideStudyRepository()` in
`app.config.ts`, so all three screens threw a NullInjectorError while
constructing and rendered blank. Every feature spec provided the token itself,
which is why build and 316 tests were green while the app was unusable.

Two lessons are now enforced: `src/app/app.config.spec.ts` boots the real
provider list and requires the token to resolve, and no screen is considered
delivered before a headless browser dump shows its content, because Ionic
renders `<app-root>` only and grepping the served HTML proves nothing.



Verification: `npm run verify` green on the branch, 313 tests in 24 files, plus
dash lint, bank drift, ESLint, and the production build. Each slice was rerun by
the parent before its commit instead of trusting the writer report.

## Decisions recorded during implementation

1. **The flow is full screen.** `/mock-exam/:certCode` with `run` and `results`
   children sits outside the tabs shell, because an exam in progress must not
   expose tab navigation and the leave guard only means something when leaving
   is an explicit decision.
2. **`SessionRow` gained two fields.** `optionKeyMaps` persists each question's
   display mapping and `flagged` owns the review flags. The first cut rebuilt
   the option shuffle from a PRNG seeded by `startedAt`, which would silently
   misgrade every stored answer after any bank or shuffle change. Borrowing
   `feedbackShown` for flags would collide with issue 006. `applyOptionKeyMap`
   was added to the engine so a resume re-applies the stored map.
3. **Mastery rows never carry a null weight** here, because the exclusion
    window has no documented length. See the open gaps. Reversed by log L5:
    submit writes no mastery rows at all (EXAM-34A).
4. **Share is not implemented** (EXAM-43 is optional and no target is
   configured). Report question copies the question id (EXAM-42).
5. **Practice weakest domain navigates to `/tabs/practice?domain=<id>`**, which
   issue 007 will consume.
6. **The runner keeps a stopgap result panel** for an uncommitted save, since
   the results screen needs a stored attempt to review. A committed attempt
   always goes to the real results route.

## Entry point

The mock exam is reached from the Home screen card, which issue 008 will
replace with the real dashboard navigation. The flow is full screen, so it has
no tab bar once inside.

## Open gaps

1. **Exclusion window length.** Resolved 2026-11-04: pinned at 3 completed
   practice sessions of the domain, with mastery flipping at 2 consecutive
   correct answers, in `core/exam-session/mastery.ts` and recorded in issue
   007 log L2. Mock submit no longer writes mastery rows at all (log L5),
   so this gap no longer touches the mock exam.
2. **Mastered threshold.** Resolved by the same decision: 2 consecutive
   correct answers, owned by the shared mastery writer that study and
   practice use. The mock exam's inline rule was removed with log L5.
3. **Exam format wording.** The registry has no format field, so the start
   screen reads "Timed mock exam, scored by percentage".
4. **Coming-soon refusal is composed screen-side** because the session service
   does not validate `status`. Moving it into the service is the cleaner home.
5. **Hardware back is deferred** to the native phase and must reuse
   `mockExamLeaveGuard` (EXAM-19).

## Out of scope

- Study exam (issue 006) and domain practice (issue 007), though this feature
      shares their session-state infrastructure.
- History list and dashboard display of results (issues 008 and 009); this
      issue only records them correctly.
