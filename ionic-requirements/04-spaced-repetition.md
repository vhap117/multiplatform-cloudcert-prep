# Spaced repetition and mastery

Scope: how the Ionic app chooses questions, tracks per-question history, computes
mastery, and recommends the next domain. The source of history is now the local
database, not a server view.

## Design position

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| SR-1 | The app SHALL use the web app's adaptive weighted sampling model without modification. | Required | Web `SR-1` to `SR-27` |
| SR-2 | The app SHALL NOT introduce calendar-based selection or alter selection based on elapsed time. | Required | This document |
| SR-3 | Mock exam selection SHALL remain non-adaptive and separate from practice selection. | Required | `02-mock-exam.md` |
| SR-4 | Selection SHALL happen once per session, at session start. | Required | Web `SR-2` |
| SR-5 | Grades SHALL be binary, correct or incorrect. | Required | Web `SR-4` |
| SR-6 | The app SHALL call the feature adaptive practice in user-facing copy, matching the web app's description. | Required | Web `SR-5` |

## Local input state

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| SR-7 | Per-question history SHALL be derived from local question-result rows, not from a remote view. | Required | `DATA-17` |
| SR-8 | Each derived mastery row SHALL provide question id, correct streak, last-was-wrong, last-seen time, mastered flag, exclusion state, and weight. | Required | `DATA-20` |
| SR-9 | A null weight SHALL mean the question is excluded from the active pool and eligible only for backfill. | Required | Web `SR-8` |
| SR-10 | A missing history row SHALL mean the question is unseen. | Required | Web `SR-9` |
| SR-11 | The app SHALL recompute or update mastery rows inside the same local transaction that saves an answer. | Required | `DATA-10` |

## Weight bands

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| SR-12 | Unseen questions SHALL carry a baseline weight of 5 when they join the weighted pool. | Required | Web `SR-11` |
| SR-13 | A question whose most recent answer was wrong SHALL carry the highest band, weight 6. | Required | Web `SR-12` |
| SR-14 | A question in learning state SHALL carry weight 2 to 3. | Required | Web `SR-13` |
| SR-15 | A mastered question SHALL carry weight 1. | Required | Web `SR-14` |
| SR-16 | A mastered question inside the exclusion window SHALL carry null weight and be hidden from the active pool. | Required | Web `SR-15` |
| SR-17 | The exclusion window SHALL be documented in the local schema and tests. Changing it SHALL update the docs and tests together. | Required | Web `SR-16` |

## Selection algorithm

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| SR-18 | The session SHALL partition the domain bank into unseen, active, and backfill pools. | Required | Web `SR-18` |
| SR-19 | The session SHALL reserve a new-question quota of `ceil(count * 0.2)`, capped by unseen availability. | Required | Web `SR-19` |
| SR-20 | Leftover unseen questions SHALL join the active pool at weight 5. | Required | Web `SR-20` |
| SR-21 | Remaining slots SHALL be filled by a weighted draw without replacement. | Required | Web `SR-21` |
| SR-22 | A session SHALL never contain duplicate questions. | Required | Web `SR-22` |
| SR-23 | If the session is still short, excluded questions SHALL backfill oldest last-seen first. | Required | Web `SR-23` |
| SR-24 | The final list SHALL be shuffled so guaranteed and backfill questions are not clustered. | Required | Web `SR-24` |
| SR-25 | The selector SHALL be a pure function over the local bank and mastery rows, with unit tests. | Required | Web `SR-25` |
| SR-26 | The app SHALL NOT depend on the web app's server view or SQL for selection logic. | Required | `IONIC-1`, `IONIC-3` |

## Mastery

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| SR-27 | Domain mastery SHALL be bank coverage: correct unique questions divided by the domain bank size, times 100. | Required | Web `SR-28` |
| SR-28 | Mastery SHALL be rounded and clamped to a maximum of 100. | Required | Web `SR-29` |
| SR-29 | An unknown domain or cert SHALL return 0 mastery. | Required | Web `SR-30` |
| SR-30 | Mastery SHALL be described as coverage, not retention. | Required | Web `SR-31` |
| SR-31 | Local progress updates SHALL deduplicate by question id and intersect with the current bundled bank before computing mastery. | Required | Web `SR-32` |
| SR-32 | A failed read SHALL NOT overwrite real mastery with 0. | Required | Web `SR-33` |
| SR-33 | Mastery and progress updates SHALL be transactional with the answer save. | Required | `DATA-10` |
| SR-34 | Displayed mastery SHALL cap the correct count to the current bank size and re-derive the percentage. | Required | Web `SR-35` |

## Next-domain recommendation

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| SR-35 | The dashboard Next up action SHALL prefer the first unstarted domain in cert order. | Required | Web `SR-36` |
| SR-36 | An unstarted domain SHALL be phrased You have not practiced X yet and SHALL NOT be called weakest. | Required | Web `SR-37` |
| SR-37 | Once every domain is practiced, the action SHALL pick the lowest-percent practiced domain and label it Weakest domain. | Required | Web `SR-38` |
| SR-38 | Ties SHALL break toward the first domain in cert order. | Required | Web `SR-39` |
| SR-39 | The Next up action SHALL open domain practice with the chosen domain preselected. | Required | Web `SR-40` |
| SR-40 | With zero attempts, the dashboard SHALL show Best score N/A, a baseline hint, and point Next up at the first domain. | Required | Web `SR-41` |

## Session size

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| SR-41 | Practice sessions SHALL respect 10 to 50 questions, default 20. | Required | Web `SR-42` |
| SR-42 | Every answered practice question SHALL be recorded locally with cert, domain, question id, answer, correctness, and flag state. | Required | `DATA-17`, `DATA-18` |
| SR-43 | Mastery SHALL be recomputed after a practice session for each domain represented. | Required | Web `SR-44` |

## Known limitations

- No expanding interval.
- Mastery is coverage, not retention.
- Binary grading discards confidence.
- The exclusion window is counted in sessions, not days.
- Struggling questions are probabilistically favoured, not guaranteed.
