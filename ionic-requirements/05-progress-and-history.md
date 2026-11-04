# Progress and history

Scope: the local cert dashboard, history, attempt review, reset, and local
statistics. Community statistics and server reads are removed.

## Cert dashboard

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| PROG-1 | The dashboard SHALL be the home surface for the selected cert. | Required | `06-certifications-and-navigation.md` |
| PROG-2 | The dashboard SHALL show the cert name, short name, level, and question count. | Required | This document |
| PROG-3 | The dashboard SHALL show the best score percentage across completed mock and study exam attempts for the selected certCode, or N/A with a baseline hint when there are no exam attempts. | Required | Web `PROG-3` |
| PROG-3A | The dashboard SHALL show the pass rate and average score percentage across completed mock and study exam attempts for the selected certCode, or N/A when there are no exam attempts. | Required | This document |
| PROG-3B | Pass rate SHALL be the number of passed exam attempts divided by all completed mock and study exam attempts, rounded to a whole percent. Average score SHALL be the mean score percentage of those attempts, rounded to a whole percent. | Required | This document |
| PROG-3C | Practice sessions SHALL NOT contribute to pass rate, average score, best score, exam attempt counts, or the recent exam attempts list. | Required | This document, `03-practice-by-subject.md` |
| PROG-3D | The dashboard SHALL show per-domain exam performance from completed mock and study exam attempts for the selected certCode, ordered strongest to weakest, so the student can see which exam domains need more study. Each percentage SHALL be correct answers divided by questions asked in that domain across those attempts. A domain with no exam data SHALL NOT be fabricated as 0 percent. | Required | This document |
| PROG-4 | The dashboard SHALL show two primary actions: mock exam and domain practice. | Required | Web `PROG-4` |
| PROG-5 | The dashboard SHALL show domain mastery per domain, derived from local bank coverage and capped at 100. | Required | `04-spaced-repetition.md` |
| PROG-6 | Each mastery row SHALL be a progress bar with an accessible value and label. | Required | `08-accessibility-and-resilience.md` |
| PROG-7 | The dashboard SHALL show the Next up recommendation defined in `04-spaced-repetition.md`. | Required | Web `PROG-7` |
| PROG-8 | The dashboard SHALL show recent local exam attempts, meaning completed mock and study exams, with pass/fail, score percentage, and a link to history. Practice sessions SHALL NOT appear as exam attempts. | Required | Web `PROG-8` |
| PROG-9 | With no exam attempts, recent exam attempts SHALL show a No exam attempts yet empty state with a start action. | Required | Web `PROG-9` |
| PROG-10 | A failed local read SHALL show an inline error with Try again. | Required | Web `PROG-10` |
| PROG-11 | A successful retry SHALL clear the error and render the mastery section. | Required | Web `PROG-11` |
| PROG-12 | Loading SHALL show skeletons and an accessible busy state. | Required | Web `PROG-12` |
| PROG-13 | The dashboard SHALL show a Resume card when an in-progress mock exam, practice session, or study exam exists. | Required | `DATA-21` |
| PROG-14 | The Resume card SHALL name the session kind, cert, answered count, and last activity time. | Required | This document |
| PROG-15 | The dashboard SHALL show an Export backup action in settings, not as a primary dashboard action. | Required | `01-local-data-and-device.md` |

## History

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| PROG-16 | History SHALL list local exam attempts and completed practice sessions. | Required | This document |
| PROG-17 | History SHALL support filtering by cert, all, passed, failed, mock exam, study exam, and domain practice. | Required | Web `PROG-15`, extended for Ionic |
| PROG-18 | Filter chips SHALL expose their selected state to assistive technology. | Required | Web `PROG-15` |
| PROG-19 | History SHALL paginate or virtualize long lists so a large local history stays responsive. | Required | This document |
| PROG-20 | Each exam attempt SHALL be expandable to show per-domain scores and metadata. | Required | Web `PROG-17` |
| PROG-21 | Expanding an exam attempt SHALL load its question results and offer review. | Required | Web `PROG-18` |
| PROG-22 | Question review SHALL filter by all, incorrect, flagged, and domain. | Required | Web `PROG-19` |
| PROG-23 | Review SHALL show the explanation summary and per-option explanations for the recorded answer. | Required | `10-study-exams.md` |
| PROG-24 | History SHALL show pass/fail, score percentage, date, time taken, and session type. | Required | Web `PROG-20` |
| PROG-24A | Pass/fail SHALL apply only to exam attempts. Practice sessions SHALL be labelled as practice sessions and SHALL NOT show a pass/fail verdict. | Required | This document |
| PROG-25 | A history load failure SHALL show an error with Try again. | Required | Web `PROG-21` |
| PROG-26 | History SHALL be usable offline and SHALL NOT show a loading spinner that depends on a network call. | Required | `IONIC-2` |
| PROG-27 | History SHALL use US English spelling. | Required | `IONIC-13` |
| PROG-28 | History SHALL meet mobile accessibility requirements. | Required | `08-accessibility-and-resilience.md` |

## Reset and data management

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| PROG-29 | The student SHALL be able to reset local progress, gated by a destructive confirmation. | Required | Web `PROG-25` |
| PROG-30 | Reset SHALL be scoped to the active cert when a cert filter is selected, and SHALL state that other certs are unaffected. | Required | Web `PROG-27` |
| PROG-31 | Reset SHALL delete exam attempts, practice session records, question results, domain aggregates, per-question mastery, and in-progress sessions for the selected scope. | Required | Web `PROG-28`, `DATA-31` |
| PROG-32 | Reset failure SHALL surface an error rather than success. | Required | Web `PROG-29` |
| PROG-33 | The student SHALL be able to delete all local data after typing or confirming a destructive action. | Required | `01-local-data-and-device.md` |
| PROG-34 | Data deletion SHALL NOT remove the bundled question bank. | Required | `DATA-32` |

## Local statistics

The web app exposes public community stats. The Ionic app has no server and no
community, so this becomes a local statistics view.

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| PROG-35 | The app SHALL show local totals: exam attempts, practice sessions, questions answered, accuracy, study time, pass rate, average score, and best score. | Required | This document |
| PROG-36 | Local statistics SHALL be computed from local rows only. | Required | `IONIC-3` |
| PROG-37 | Local statistics SHALL distinguish mock exams, study exams, and domain practice. | Required | This document |
| PROG-38 | Local statistics SHALL show per-domain accuracy and coverage for the selected cert. | Required | This document |
| PROG-39 | Local statistics SHALL clearly state that the numbers are personal and device-local. | Required | This document |
| PROG-40 | A statistics read failure SHALL show a retryable error, not fabricated numbers. | Required | Web `PROG-34` |
| PROG-41 | The app SHALL NOT show community pass rates, leaderboards, or other-user data. | Required | `IONIC-3` |
| PROG-42 | The app SHALL NOT call `get_public_exam_stats` or `get_public_totals`. | Required | This document |

## History data rules

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| PROG-43 | A completed mock exam SHALL record per-domain scores for the domains represented. | Required | `02-mock-exam.md` |
| PROG-44 | A completed study exam SHALL record per-domain scores for the domains represented. | Required | `10-study-exams.md` |
| PROG-45 | A completed domain practice session SHALL record per-domain accuracy and update mastery. | Required | `03-practice-by-subject.md` |
| PROG-46 | A domain with no questions in a session SHALL NOT be fabricated as 0 percent. | Required | Web `STUDY-47` |
| PROG-47 | History records SHALL remain distinguishable by session type. | Required | `STUDY-46` |
| PROG-48 | A completed study exam SHALL contribute to the same best-score dashboard as a mock exam. | Required | `STUDY-46A` |
| PROG-49 | History and dashboard reads SHALL NOT depend on a network connection. | Required | `IONIC-2` |

## Removed web behaviour

- Supabase history and dashboard queries.
- RLS-scoped data access.
- Public community statistics and aggregate RPCs.
- Server-side data export and account deletion.
- Cross-device history.
