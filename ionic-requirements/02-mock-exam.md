# Mock exam

Scope: the timed, scored mock exam in the Ionic app. Behaviour follows the web
mock exam, with local persistence and mobile lifecycle rules replacing the
server save path.

## Composition and start

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| EXAM-1 | The exam SHALL use the cert's configured question count, time limit, and passing score. Values SHALL come from the bundled cert registry. | Required | `09-content-and-app-build.md` |
| EXAM-2 | Questions SHALL be selected by the cert's domain proportions, with the last domain absorbing the remainder so the total is exact. | Required | Web `EXAM-1`, `EXAM-2` |
| EXAM-3 | Question order and option order SHALL be shuffled per attempt, preserving the correct-answer mapping. | Required | Web `EXAM-3` |
| EXAM-4 | The start screen SHALL show the format, question count, duration, pass threshold, and a Start exam action. | Required | Web `EXAM-4` |
| EXAM-5 | The start screen SHALL show a Resume exam action when an in-progress mock exam exists for the cert. | Required | `DATA-21` |
| EXAM-6 | Starting an exam with an existing in-progress exam SHALL require an explicit choice to resume or discard the existing one. | Required | `DATA-40` |
| EXAM-7 | Starting an exam SHALL record the start time, set the active-session state, and save it locally before the first question is shown. | Required | This document |

## Question flow

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| EXAM-8 | The exam SHALL support single answer, multi answer, ordering, and matching questions. | Required | Web `EXAM-11` to `EXAM-16` |
| EXAM-9 | Single-answer questions SHALL grade on selection. Multi, ordering, and matching SHALL grade after an explicit submit once the response is complete. | Required | Web `EXAM-12`, `EXAM-13` |
| EXAM-10 | Grading SHALL be all-or-nothing with no partial credit. | Required | Web `EXAM-16` |
| EXAM-11 | The student SHALL be able to flag and unflag a question for review. | Required | Web `EXAM-17` |
| EXAM-12 | The exam SHALL show a question grid with answered, unanswered, current, and flagged states. | Required | Web `EXAM-18` |
| EXAM-13 | The exam SHALL show current position, answered progress, remaining time, and a submit action in a persistent toolbar. | Required | Web `EXAM-19` |
| EXAM-14 | Answering a question SHALL save the answer locally immediately, before the student moves to another question. | Required | `DATA-21`, `IONIC-7` |
| EXAM-15 | The student SHALL be able to move between questions using previous, next, and the question grid. | Required | Web `EXAM-23` |
| EXAM-16 | Navigating away from an active exam inside the app SHALL open a leave-confirmation modal. | Required | Web `EXAM-24` |
| EXAM-17 | The modal SHALL explain that leaving pauses or preserves the attempt, according to the lifecycle rule in this document, and SHALL offer stay and leave actions. | Required | This document |
| EXAM-18 | Confirming leave SHALL preserve the in-progress attempt and return to the previous screen. It SHALL NOT discard answers. | Required | This document |
| EXAM-19 | The Android hardware back action SHALL follow the same leave-confirmation rule as in-app navigation. | Required | `06-certifications-and-navigation.md` |

## Timer and app lifecycle

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| EXAM-20 | The exam timer SHALL be based on the cert's `examTimeSeconds` and SHALL count down. | Required | Web `EXAM-7` |
| EXAM-21 | The timer SHALL be computed from an absolute start and deadline, not from a countdown that depends on foreground execution. | Required | This document |
| EXAM-22 | When the app is backgrounded or the screen locks, the timer SHALL continue to elapse in wall-clock terms. | Required | This document |
| EXAM-23 | On resume, the app SHALL recompute remaining time and SHALL restore the exam without losing answers. | Required | This document |
| EXAM-24 | If the deadline passed while the app was backgrounded, the app SHALL end the attempt and show the results, unless the student had already submitted. | Required | This document |
| EXAM-25 | The exam SHALL warn when remaining time falls below a documented threshold. | Required | Web `EXAM-21` |
| EXAM-26 | The timer SHALL be announced to assistive technology at sensible intervals without becoming noisy. | Required | `08-accessibility-and-resilience.md` |

## Submission and scoring

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| EXAM-27 | Submitting SHALL require confirmation through a Ready to submit dialog that summarizes answered and flagged counts. | Required | Web `EXAM-33` |
| EXAM-28 | Confirming submission SHALL compute raw score, scaled score, per-domain scores, pass/fail, and elapsed time. | Required | Web `EXAM-35` |
| EXAM-29 | The scaled score SHALL map raw percentage to the AWS 100 to 1000 scale and clamp to that range. | Required | Web `EXAM-36` |
| EXAM-30 | Pass/fail SHALL use the cert-specific passing score from the bundled registry. Exactly at the threshold SHALL pass. | Required | Web `EXAM-37` |
| EXAM-31 | Elapsed time SHALL be derived from wall-clock timestamps and clamped to the exam length. A forward clock jump SHALL NOT inflate saved time. | Required | Web `EXAM-39` |
| EXAM-32 | A backward clock jump SHALL NOT cause a completed attempt to be discarded as too short. | Required | Web `EXAM-39` |
| EXAM-33 | There SHALL be no 60-second minimum for saving a mock exam. A completed local attempt SHALL be saved even if it is short. | Required | This document, overrides web `EXAM-42` |
| EXAM-34 | Saving SHALL be a single local transaction covering the attempt, its question rows, and the derived domain progress. | Required | `DATA-10` |
| EXAM-35 | A failed local save SHALL keep the results on screen and SHALL offer retry. It SHALL NOT claim success. | Required | Web `EXAM-48` |
| EXAM-36 | A successful save SHALL mark the in-progress session complete and remove it from resume. | Required | `DATA-39` |

## Results and review

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| EXAM-37 | The results screen SHALL show pass/fail, scaled score, percentage, correct count, total questions, and elapsed time. | Required | Web `EXAM-49` |
| EXAM-38 | The results screen SHALL show a per-domain breakdown. | Required | Web `EXAM-50` |
| EXAM-39 | Review questions SHALL be available when question data is available locally. | Required | Web `EXAM-51` |
| EXAM-40 | Review SHALL support all, incorrect, flagged, and per-domain filters. | Required | Web `EXAM-52` |
| EXAM-41 | Each reviewed question SHALL show the student answer, correct answer, correctness, flag state, explanation summary, and per-option explanations. | Required | Web `EXAM-53`; `10-study-exams.md` |
| EXAM-42 | The review card SHALL offer a report-question action. Because the app is personal, this MAY copy the question id to the clipboard or open a configured repository issue URL. | Optional | Web `EXAM-54` |
| EXAM-43 | A passed result MAY offer share. Any share text SHALL NOT upload score data automatically. | Optional | Web `EXAM-56`, `EXAM-57` |
| EXAM-44 | A failed result SHALL offer a Practice weakest domain action derived from local per-domain data. | Required | Web `EXAM-58` |
| EXAM-45 | The results screen SHALL offer a retake action that starts a fresh attempt with reset state. | Required | Web `EXAM-60` |
| EXAM-46 | The results screen SHALL offer a return to the cert dashboard. | Required | This document |

## Analytics

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| EXAM-47 | Exam events SHALL NOT be sent off device by default. Local counters MAY be recorded for the local dashboard. | Required | `07-privacy-and-telemetry.md` |

## Removed web behaviour

The following web requirements do not apply in the Ionic app:

- Guest versus signed-in save paths.
- Claiming a saved attempt after login.
- Pending-attempt owner binding and cross-account protection.
- Server row writes and RLS.
- The 60-second persistence floor.
- `beforeunload` as a browser-level leave net.
