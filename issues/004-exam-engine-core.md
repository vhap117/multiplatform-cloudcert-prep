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

- [x] Port the domain types (`Question`, `Certification`, attempt and result
      shapes) into `core/exam/`. (EXAM-ENGINE.md structure)
- [x] Port `getExamDomainTargets(cert)`: per-domain `round()` except the last
      domain, which absorbs the remainder so the total is exactly
      `examQuestionCount`. (`EXAM-2`)
- [x] Port `selectExamQuestions(bank, cert)`: domain-proportional draw, then a
      final shuffle. Used by both mock and study exams. (`EXAM-2`, `STUDY-2A`)
- [x] Port `fisherYatesShuffle` and `shuffleQuestionOptions(question)` with
      its `keyMap`: display keys stay A to E, content moves, `answer`,
      `correctOrder`, and the left side of `correctMatches` are remapped, and
      matching targets are never shuffled. (`EXAM-3`)
- [x] Port `encodeAnswerForDb` and its decode path so persisted answer shapes
      match the web canonical forms (comma-joined keys; `K:T` tokens for
      matching). (EXAM-ENGINE.md shuffling section)
- [x] Port `correctAnswerFor` and `isAnswerCorrect` for all four types with
      all-or-nothing grading: strict equality for single, set equality for
      multi and matching, positional equality for ordering. (`EXAM-8`,
      `EXAM-9`, `EXAM-10`)
- [x] Port `calculateScaledScore` (100 to 1000, clamped) and `isPassed`
      (threshold inclusive) and per-domain percentages. (`EXAM-28` to
      `EXAM-30`)
- [x] Port timing: absolute `startedAt` plus deadline, remaining time from
      `Date.now()`, `timeTaken` clamped to `[0, examTimeSeconds]`, forward
      clock jumps never inflate saved time, backward jumps never discard a
      completed attempt. (`EXAM-31`, `EXAM-32`)
- [x] Port `selectPracticeQuestions(bank, count, masteryRows)`: partition into
      unseen, active, and backfill pools; unseen quota `ceil(count * 0.2)`
      capped by availability; leftover unseen join active at weight 5;
      weighted draw without replacement; oldest-last-seen backfill; final
      shuffle; never a duplicate. (`SR-18` to `SR-25`)
- [x] Port the weight bands: unseen 5, last-wrong 6, learning 2 to 3,
      mastered 1, exclusion window means null weight and backfill-only.
      Document the exclusion window in code and tests together. (`SR-12` to
      `SR-17`)
- [x] Port mastery as bank coverage: correct unique questions divided by
      current bank size, deduplicated by question id, intersected with the
      bundled bank, rounded, clamped to 100, unknown domain or cert returns 0,
      failed reads never overwrite real mastery with 0. (`SR-27` to `SR-34`)
- [x] Port the next-domain recommendation: first unstarted domain in cert
      order, else lowest-percent practiced domain, ties break to cert order.
      (`SR-35` to `SR-40`)
- [x] Port all five reference test files and keep them green against the real
      bundled banks. (`CONT-42`)
- [x] Keep the module dependency-clean: a lint or architecture check fails if
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

## Port notes and deliberate deviations

1. **`explanation.options` is remapped by the shuffle.** The reference remaps
   `answer`, `correctOrder`, and the left side of `correctMatches` but leaves the
   per-option explanations on their original keys. Because that map is indexed
   by option key, feedback after a shake explained the wrong option and broke
   PRACT-14 and EXAM-41. `shuffleQuestionOptions` now remaps it alongside the
   other key-indexed fields, and both a unit test and a real-bank round trip pin
   it.
2. **`answer` is optional in the content type.** The 10 ordering and matching
   questions omit the field instead of carrying `""`, which the old type
   contradicted. The validator already treats absent, empty, and empty-array
   values as unused (`answerIsUnused`), so the type caught up with the data.
3. **No guest branch in `selectPracticeQuestions`.** The reference took a
   `userId` and fell back to a uniform draw when it was null. The Ionic app has
   one local user and no login, so "no history" already means every question is
   unseen (SR-10) and the normal path produces the same uniform draw. The dead
   branch is not ported.
4. **`in_exclusion_window` is not a field.** The reference mastery row carried
   it; the storage row from issue 002 encodes the same fact as `weight: null`
   (SR-9, SR-16), so the engine reads that and the two sources of truth stay
   collapsed into one.
5. **`lastSeenAt` is epoch milliseconds, not an ISO string.** It matches the
   stored row, so backfill ordering is a numeric comparison with no date parsing
   and no `NaN` on a malformed value.
6. **The random source is injectable.** Every selector takes an optional
   `RandomSource`. Production passes nothing and gets `Math.random`; tests pass a
   seeded generator, which is what makes the weighted draw, the domain draw, and
   the backfill order assertable instead of "any random answer is fine".
7. **The weighted draw always makes progress.** The reference subtracted
   weights from a floating point target and pushed nothing when the subtraction
   never crossed zero, which spins forever on an all-zero weight pool. This
   version removes exactly one candidate per pass and has a test for it.
8. **`availableExamQuestions` gates a short bank.** SAA-C03 ships 5 questions
   per domain against a 65-question exam, so the draw silently returns 20. The
   helper reports the shortfall so issue 005 can refuse to start an exam that
   cannot be filled instead of mislabelling a 20-question run as a 65-question
   mock.
9. **`isTooShort` is a display hint, never a discard rule.** EXAM-33 removed
   the web app's 60-second persistence floor, while EXAM-32 still requires that a
   backward clock jump must not discard a completed attempt.
10. **The learning band splits by streak.** SR-14 fixes weights 2 to 3 but the
    reference derived the exact value inside SQL. `masteryWeight` uses the low
    end at streak 0 and the high end once a streak exists, and the tests pin that
    interpretation because it is the only part of the band model the reference
    did not express in TypeScript.
11. **Attempt and result shapes are not duplicated.** The task list asked to port
    them into `core/exam`, but issue 002 already owns the persistence shapes and
    the engine boundary forbids importing storage. The engine defines only the
    computation shapes it consumes and returns, so the storage contract stays in
    one place.

## Open spec gap

The exclusion window has no length anywhere in the materials: SR-16 and SR-17
require it to exist, say it is counted in sessions rather than days, and demand
that changing it updates docs and tests, but no number is given and the web
reference derived it in SQL that is not part of this port. Issue 004 therefore
consumes `weight: null` and does not invent a window. The value has to be fixed
where the mastery row is written, before issues 006 and 007 save answers.

## Out of scope

- Session state, persistence, and resume (issue 002 provides storage; issues
      005 to 007 wire it).
- Any UI. This module never renders.
- Calendar-based scheduling. Explicitly rejected by `SR-2`.

## Commits

Each commit is a reviewable work unit carrying its own tests.

| Commit | Contents | Lines |
|---|---|---|
| `e5f111e` | engine types, constants, shuffle with the explanation remap, optional `answer` | 471 |
| `43db8a5` | canonical answer encoding, decoding, and all-or-nothing grading | 380 |
| `0ec91b0` | domain targets, exam selection, scaled scoring, wall-clock timing | 475 |
| `89ae908` | adaptive practice selection, weight bands, backfill order | 360 |
| `5de0f75` | mastery coverage, next-domain action, real-bank round trip, lint boundary | 350 |
| `2bfe122` | unrelated pre-existing dash lint fix in issue 003 | 6 |
| `e4d9a94` | this document: port notes, deviations, and the open spec gap | 60 |
| `118318e` | test environment: in-memory Storage through `setupFiles` | 96 |

The last two are documentation and an unrelated gate fix, split out so the
engine work reviews as five units. The feature branch stays unmerged; push,
pull request, and merge are the user's decisions.

## Verification evidence

- `src/app/core/exam`: 125 tests across 9 spec files, green.
- Full gate green: dash lint, bank drift, ESLint, 229 tests in 19 files, and the
  production build.
- Lint boundary proven by a temporary probe file that imported `@angular/core`
  and `../storage/study-repository`: both were rejected, then the probe was
  removed.
- The gate was already red on `main` for two reasons that predate this branch,
  both fixed here because they blocked any verification of this work:
  - `issues/003-content-pipeline.md` quoted the literal dash entities in prose,
    which the dash lint rejects (commit `2bfe122`).
  - 19 tests in three spec files (`theme.service`, `motion.service`,
    `local-settings`) failed because the runner exposes `window` and `document`
    through jsdom but leaves `localStorage` and `sessionStorage` undefined, even
    though jsdom 28 provides both. A setup file now installs an in-memory
    Storage only when the global is missing (commit `118318e`). Reproduced on
    `main` with this work stashed before fixing it.
