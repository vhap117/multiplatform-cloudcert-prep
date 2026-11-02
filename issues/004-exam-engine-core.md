# Issue 004: Exam engine core (pure functions)

## Context

All study behaviour funnels through a small set of pure, framework-independent
functions ported from the web app. No Angular, no Ionic, no storage imports in
this module: inputs in, results out, fully unit-testable. Features in issues
005 to 008 call these functions and nothing else for selection, grading,
scoring, timing, and mastery.

Spec: `../ionic-requirements/cert-banks/EXAM-ENGINE.md` (all of it, including
porting gotchas), `../ionic-requirements/04-spaced-repetition.md`.

Source to port: `../ionic-requirements/cert-banks/reference/`: `types.ts`,
`scoring.ts`, `utils.ts`, `spacedRepetition.ts`, `domainStats.ts`,
`constants.ts`, plus the five test files.

Traces: `EXAM-2`, `EXAM-3`, `EXAM-8` to `EXAM-10`, `EXAM-28` to `EXAM-33`,
`SR-1` to `SR-43`, `STUDY-2`, `STUDY-2A`, `CONT-42`.

Depends on: 003 (bank and registry shapes).
Blocks: 005, 006, 007, 008.

## Tasks

- [ ] Port the domain types (`Question`, `Certification`, attempt and result
      shapes) into `core/exam/`. (EXAM-ENGINE.md structure)
- [ ] Port `getExamDomainTargets(cert)`: per-domain `round()` except the last
      domain, which absorbs the remainder so the total is exactly
      `examQuestionCount`. (`EXAM-2`)
- [ ] Port `selectExamQuestions(bank, cert)`: domain-proportional draw, then a
      final shuffle. Used by both mock and study exams. (`EXAM-2`, `STUDY-2A`)
- [ ] Port `fisherYatesShuffle` and `shuffleQuestionOptions(question)` with
      its `keyMap`: display keys stay A to E, content moves, `answer`,
      `correctOrder`, and the left side of `correctMatches` are remapped, and
      matching targets are never shuffled. (`EXAM-3`)
- [ ] Port `encodeAnswerForDb` and its decode path so persisted answer shapes
      match the web canonical forms (comma-joined keys; `K:T` tokens for
      matching). (EXAM-ENGINE.md shuffling section)
- [ ] Port `correctAnswerFor` and `isAnswerCorrect` for all four types with
      all-or-nothing grading: strict equality for single, set equality for
      multi and matching, positional equality for ordering. (`EXAM-8`,
      `EXAM-9`, `EXAM-10`)
- [ ] Port `calculateScaledScore` (100 to 1000, clamped) and `isPassed`
      (threshold inclusive) and per-domain percentages. (`EXAM-28` to
      `EXAM-30`)
- [ ] Port timing: absolute `startedAt` plus deadline, remaining time from
      `Date.now()`, `timeTaken` clamped to `[0, examTimeSeconds]`, forward
      clock jumps never inflate saved time, backward jumps never discard a
      completed attempt. (`EXAM-31`, `EXAM-32`)
- [ ] Port `selectPracticeQuestions(bank, count, masteryRows)`: partition into
      unseen, active, and backfill pools; unseen quota `ceil(count * 0.2)`
      capped by availability; leftover unseen join active at weight 5;
      weighted draw without replacement; oldest-last-seen backfill; final
      shuffle; never a duplicate. (`SR-18` to `SR-25`)
- [ ] Port the weight bands: unseen 5, last-wrong 6, learning 2 to 3,
      mastered 1, exclusion window means null weight and backfill-only.
      Document the exclusion window in code and tests together. (`SR-12` to
      `SR-17`)
- [ ] Port mastery as bank coverage: correct unique questions divided by
      current bank size, deduplicated by question id, intersected with the
      bundled bank, rounded, clamped to 100, unknown domain or cert returns 0,
      failed reads never overwrite real mastery with 0. (`SR-27` to `SR-34`)
- [ ] Port the next-domain recommendation: first unstarted domain in cert
      order, else lowest-percent practiced domain, ties break to cert order.
      (`SR-35` to `SR-40`)
- [ ] Port all five reference test files and keep them green against the real
      bundled banks. (`CONT-42`)
- [ ] Keep the module dependency-clean: a lint or architecture check fails if
      anything under `core/exam/` imports Angular, Ionic, Capacitor, or the
      storage layer. (`SR-25`, `SR-26`)

## Acceptance criteria

- All ported tests pass: `scoring.test.ts`, `spacedRepetition.test.ts`,
      `domainStats.test.ts`, `utils.test.ts`,
      `questionTypes.integration.test.ts`.
- For each active cert, `getExamDomainTargets` sums exactly to
      `examQuestionCount` (tested for every cert in the registry).
- Practice selection tests prove: 20 percent unseen quota, no duplicates,
      backfill order oldest first, excluded questions hidden from the active
      pool.
- The engine module has zero framework imports (checked in CI or lint).

## Out of scope

- Session state, persistence, and resume (issue 002 provides storage; issues
      005 to 007 wire it).
- Any UI. This module never renders.
- Calendar-based scheduling. Explicitly rejected by `SR-2`.
