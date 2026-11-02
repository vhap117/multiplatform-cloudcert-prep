# Study exams

Scope: an untimed, explanatory study mode for the Ionic app. A study exam is
separate from the timed mock exam and from domain practice. It is built for
learning and quick review on a phone.

This topic adapts the web study-exam requirements. Accounts and guest adoption
are removed. All progress is local.

## Core definition

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| STUDY-1 | A study exam SHALL be untimed. It SHALL NOT start a countdown, SHALL NOT auto-submit at a deadline, and SHALL NOT show a timer or time-pressure warning. | Required | This document |
| STUDY-2 | A study exam SHALL be scoped to one certification and SHALL draw questions from that cert's active question bank across its domains using the same selection and domain-proportion rules as the mock exam. | Required | `02-mock-exam.md` |
| STUDY-2A | The study exam question set SHALL reflect the same question mix as the mock exam: the cert's configured exam question count, the same domain proportions with the last domain absorbing the remainder, shuffled question order, and option shuffling. Study exams SHALL NOT use a different sampling policy or a configurable subset. | Required | `02-mock-exam.md` |
| STUDY-3 | A study exam SHALL support single answer, multi answer, ordering, and matching questions. | Required | `02-mock-exam.md` |
| STUDY-4 | A study exam SHALL give immediate per-question feedback. It SHALL NOT hide correctness until a final submission. | Required | This document |
| STUDY-5 | A study exam SHALL be available to the single local user with no login, account, or network requirement. | Required | `IONIC-1`, `IONIC-2` |
| STUDY-6 | Closing the app or browser and reopening it SHALL allow the student to continue the same in-progress study exam. | Required | `DATA-21` |
| STUDY-7 | A study exam SHALL remain available across app backgrounding, force close, device restart, and ordinary app upgrades until it is completed or explicitly discarded. | Required | `IONIC-7` |
| STUDY-8 | A study exam SHALL NOT use a per-card due-date scheduler or any calendar-based selection. It uses the same adaptive weighted selection as practice. | Required | `04-spaced-repetition.md` |

## Question flow and feedback

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| STUDY-9 | Single-answer questions SHALL grade on selection. Multi-answer, ordering, and matching questions SHALL grade after an explicit submit action once the response is complete. | Required | `03-practice-by-subject.md` |
| STUDY-10 | After grading, the study exam SHALL show whether the answer is correct or incorrect. | Required | This document |
| STUDY-11 | For an incorrect answer, the feedback SHALL identify every selected option that is wrong and explain why that option is wrong. | Required | This document |
| STUDY-12 | For an incorrect answer, the feedback SHALL identify every correct option and explain why it is correct. | Required | This document |
| STUDY-13 | For a response with some correct and some incorrect selections, the feedback SHALL cover both sets: why the selected wrong options fail and why the omitted correct options are right. | Required | This document |
| STUDY-14 | For a fully correct answer, the feedback SHALL display the question's `explanation.summary`. | Required | `09-content-and-app-build.md` |
| STUDY-15 | Per-option feedback SHALL use `explanation.options[key]`. Correct options get the correct-option explanation and incorrect options get the distractor explanation. | Required | `09-content-and-app-build.md` |
| STUDY-16 | Once a question is answered and graded, it SHALL become read-only until the study exam is submitted. The student SHALL NOT change the recorded answer during the session, and revisiting the question SHALL NOT reopen it for editing. | Required | This document |
| STUDY-17 | The student SHALL be able to move to the next question after reading the feedback. | Required | This document |
| STUDY-18 | Before the study exam is submitted, the student SHALL be able to return to any previously answered question and see it marked as answered, displaying the exact answer the student provided during that session along with its correctness state and feedback. | Required | This document |
| STUDY-19 | The feedback panel SHALL be keyboard and screen-reader reachable and SHALL be announced when it appears. | Required | `08-accessibility-and-resilience.md` |
| STUDY-20 | Every graded answer SHALL be written to the local database before the next question is shown. | Required | `DATA-10`, `IONIC-7` |
| STUDY-21 | A local write failure SHALL be visible and retryable. The app SHALL NOT advance as if the answer were saved. | Required | `01-local-data-and-device.md` |

## Progress display

A study exam SHALL show three compact progress bars throughout the session.

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| STUDY-22 | The first bar SHALL show total answered progress as answered divided by total questions and SHALL display the percentage. | Required | This document |
| STUDY-23 | The second bar SHALL show total correct answers and SHALL display the correct count. Its fill SHALL represent correct divided by total questions. | Required | This document |
| STUDY-24 | The third bar SHALL show total wrong answers and SHALL display the wrong count. Its fill SHALL represent wrong divided by total questions. | Required | This document |
| STUDY-25 | Correct plus wrong SHALL equal answered. The three bars SHALL stay consistent after every answer and after a resume. | Required | This document |
| STUDY-26 | The correct bar SHALL use a light green to dark green gradient. | Required | This document |
| STUDY-27 | The wrong bar SHALL use an intense orange to deep red gradient. | Required | This document |
| STUDY-28 | The total answered bar SHALL shift between light green and intense orange based on the balance of correct and wrong answers. All correct SHALL read light green. All wrong SHALL read intense orange. Intermediate accuracy SHALL blend continuously between them. | Required | This document |
| STUDY-29 | Colour SHALL NOT be the only signal. Each bar SHALL have a text label and a numeric value. | Required | `08-accessibility-and-resilience.md` |
| STUDY-30 | Each bar SHALL expose a progressbar role with current, minimum, maximum, and accessible value text. | Required | `08-accessibility-and-resilience.md` |
| STUDY-31 | The three bars SHALL fit on a phone without horizontal scrolling and SHALL be usable in light and dark themes. | Required | `DESIGN.md` |

## Persistence and resume

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| STUDY-32 | The app SHALL save study-exam progress after every graded answer, including the selected answer, correctness, current question, and per-domain tallies needed to rebuild the session. | Required | `DATA-21` |
| STUDY-33 | Study-exam state SHALL be stored through the shared repository interface, using Capacitor SQLite on a device and IndexedDB during `ionic serve` development and tests. | Required | `01-local-data-and-device.md`, `IONIC-19` |
| STUDY-34 | The app SHALL keep at most one in-progress study exam per cert. | Required | `DATA-38` |
| STUDY-35 | Starting a new study exam while one is in progress SHALL require an explicit choice to resume the existing one or discard it and start over. | Required | `DATA-40` |
| STUDY-36 | A resume SHALL restore the exact question order, the current position, the recorded answers, the feedback state, and all three progress bars. | Required | This document |
| STUDY-37 | Each time a new study exam session starts, the question order SHALL be shuffled so it differs from the order used by the previous session. A resumed session SHALL keep the order it was saved with. | Required | `STUDY-36` |
| STUDY-38 | A resume SHALL NOT re-grade or duplicate answers that were already saved. | Required | This document |
| STUDY-39 | A completed study exam SHALL be marked complete and SHALL no longer be offered as resumable. | Required | `DATA-39` |
| STUDY-40 | Completing a study exam SHALL show a summary with total answered, correct, wrong, accuracy, and per-domain results. | Required | This document |
| STUDY-41 | The student SHALL be able to discard an in-progress study exam. Discarding SHALL require confirmation and SHALL remove the saved session. | Required | `DATA-41` |
| STUDY-42 | Backup export SHALL include any in-progress study exam. Import SHALL restore it on the same or another install, subject to schema compatibility. | Required | `DATA-24` to `DATA-30` |
| STUDY-43 | There SHALL be no guest-to-account adoption flow. The app is single-user and every session is already local. | Required | `IONIC-1`, `DATA-5` |

## Per-domain scores and records

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| STUDY-44 | Every graded study-exam answer SHALL update the per-domain score for the question's domain, using the same domain-score semantics as the mock exam. | Required | `02-mock-exam.md` |
| STUDY-45 | A completed study exam SHALL be recorded as an attempt with its per-domain scores, total questions, correct answers, wrong answers, and completion timestamp. | Required | `05-progress-and-history.md` |
| STUDY-46 | Study-exam answers SHALL be recorded at question level with the same correctness and flagged fields used by mock exams, so they can feed mastery and history. | Required | `DATA-17` |
| STUDY-47 | Study-exam answers SHALL update domain progress through the same bank-intersected calculation used by mock exams and practice. | Required | `04-spaced-repetition.md` |
| STUDY-48 | Study-exam records SHALL be visible in local history and SHALL be distinguishable from mock-exam and domain-practice records. | Required | `05-progress-and-history.md` |
| STUDY-49 | Per-domain scores SHALL include only domains represented in the study exam. A domain with no questions SHALL NOT be fabricated as 0 percent. | Required | `05-progress-and-history.md` |
| STUDY-50 | Completed study-exam records SHALL contribute to the same best-score dashboard as mock exams. | Required | `05-progress-and-history.md` |
| STUDY-51 | Study-exam records SHALL be stored in the local database and SHALL NOT be sent to a server. | Required | `IONIC-3` |

## Navigation and lifecycle

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| STUDY-52 | Navigating away from a study exam SHALL NOT discard progress. Because progress is saved continuously, the app SHALL NOT block navigation with an exam leave guard. | Required | This document |
| STUDY-53 | The study exam SHALL NOT set the timed mock exam active state and SHALL NOT lock cert switching or the tab bar. | Required | `06-certifications-and-navigation.md` |
| STUDY-54 | Backgrounding the app during a study exam SHALL preserve the session and current position. | Required | `IONIC-7` |
| STUDY-55 | Force-closing and reopening the app SHALL offer Resume study exam for the saved session. | Required | `DATA-21` |
| STUDY-56 | A study exam SHALL NOT consume or alter a mock-exam in-progress session, and a mock exam SHALL NOT consume a study-exam session. The stores SHALL be separate. | Required | This document |
| STUDY-57 | Deleting all local data SHALL remove in-progress study exams along with the rest of the local study data. | Required | `DATA-31` |

## Entry points and presentation

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| STUDY-58 | The app SHALL expose a study-exam entry point from the cert dashboard and the Practice screen. | Required | `06-certifications-and-navigation.md` |
| STUDY-59 | The study-exam start screen SHALL explain that the mode is untimed, gives immediate feedback, saves progress automatically, and can be resumed. | Required | This document |
| STUDY-60 | The start screen SHALL show whether an in-progress study exam exists for the cert and SHALL offer resume as the primary action when one does. | Required | This document |
| STUDY-61 | The study exam SHALL show the current question number and total, the question text, the response control, and the three progress bars. | Required | This document |
| STUDY-62 | The study exam SHALL use US English spelling and SHALL contain no em dashes or en dashes. | Required | `IONIC-13`, `IONIC-14` |
| STUDY-63 | The study exam SHALL meet the mobile accessibility requirements in both themes. | Required | `08-accessibility-and-resilience.md` |
| STUDY-64 | The study exam SHALL use the design tokens in `DESIGN.md` for colour, type, spacing, radius, and motion. | Required | `DESIGN.md` |

## Local events

The app has no remote analytics. Local counters MAY be recorded for the local
statistics view:

| Event | When | Local fields |
|---|---|---|
| study_exam_started | A new study exam is created | cert, question count |
| study_exam_resumed | An existing session is resumed | cert, answered count |
| study_question_answered | An answer is graded | cert, domain id, correctness |
| study_exam_completed | The final question is graded | cert, correct, wrong, total |
| study_exam_discarded | An in-progress session is discarded | cert, answered count |

These events SHALL remain on the device and SHALL NOT be transmitted.

## Removed web behaviour

- Guest-local session adoption by a signed-in account.
- Sync across devices.
- Server persistence and RLS.
- Remote analytics for study events.
- Account-based conflict resolution. The only conflict is local, between two
  in-progress sessions for the same cert.
