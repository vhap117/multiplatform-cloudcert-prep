# Practice by subject

Scope: domain practice in the Ionic app. The student picks one exam domain,
answers a short session, and gets instant feedback. All history and progress stay
on the device.

## Entry and configuration

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| PRACT-1 | Domain practice SHALL be reachable from the cert dashboard and from the Practice tab or menu. | Required | `06-certifications-and-navigation.md` |
| PRACT-2 | The app SHALL list the selected cert's domains with a practice action per domain. | Required | Web `PRACT-3` |
| PRACT-3 | A dashboard or results deep link that names a domain SHALL preselect it on the config screen. | Required | Web `PRACT-2` |
| PRACT-4 | The student SHALL choose a session size from 10 to 50 questions in steps of 5, defaulting to 20. | Required | Web `PRACT-4` |
| PRACT-5 | The size control SHALL have accessible increase and decrease labels and SHALL disable at the bounds. | Required | Web `PRACT-5` |
| PRACT-6 | Starting a session SHALL load the domain question set from the bundled bank and select questions locally. | Required | `IONIC-12` |
| PRACT-7 | Starting a session with an in-progress domain practice for the same cert SHALL require an explicit choice to resume or discard. | Required | `DATA-38`, `DATA-40` |
| PRACT-8 | Starting a session SHALL save the session state locally before the first question appears. | Required | `DATA-21` |
| PRACT-9 | The session SHALL support single answer, multi answer, ordering, and matching questions with all-or-nothing grading. | Required | Web `PRACT-15` |

## Question flow and feedback

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| PRACT-10 | The session SHALL show Question N of M and a progress bar. | Required | Web `PRACT-11` |
| PRACT-11 | The progress bar SHALL advance as soon as the current question is answered. | Required | Web `PRACT-12` |
| PRACT-12 | Single-answer questions SHALL grade on selection. Multi, ordering, and matching SHALL grade after an explicit submit once complete. | Required | Web `PRACT-13` |
| PRACT-13 | After grading, the session SHALL show correct or incorrect feedback and the explanation content for the question. | Required | Web `PRACT-14` |
| PRACT-14 | Feedback SHALL use the explanation summary for the correct answer and the per-option explanations for options relevant to the student's answer. | Required | `10-study-exams.md` |
| PRACT-15 | The student SHALL advance with Next question and finish with Finish session on the last question. | Required | Web `PRACT-16` |
| PRACT-16 | Answering a question SHALL save the answer and derived local counters immediately. | Required | `DATA-10`, `IONIC-7` |
| PRACT-17 | The session SHALL warn when a multi-answer response is incomplete rather than silently grading it wrong. | Required | Web `PRACT-19` |
| PRACT-18 | The session SHALL offer a report-question action that copies the question id or opens a configured issue URL. | Optional | Web `PRACT-20` |
| PRACT-19 | An answered question SHALL be read-only for the rest of the session. | Required | Web `STUDY-16` |
| PRACT-20 | Returning to an earlier answered question SHALL show the same answer and feedback. | Required | Web `STUDY-18` |

## Session completion and persistence

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| PRACT-21 | Completing a session SHALL show Practice session complete with score and summary. | Required | Web `PRACT-21` |
| PRACT-22 | Completion SHALL record one question-result row per answered question and update the domain aggregate in the same transaction. | Required | `DATA-10`, `DATA-17`, `DATA-19` |
| PRACT-23 | A completed practice session SHALL appear in local history. | Required | `05-progress-and-history.md` |
| PRACT-24 | A failed local save SHALL show a visible, retryable error. | Required | Web `PRACT-26` |
| PRACT-25 | A failed bank or session load SHALL show a retryable error and re-enable Start. | Required | Web `PRACT-27` |
| PRACT-26 | The app SHALL NOT use network requests to load domain questions or save practice results. | Required | `IONIC-2`, `IONIC-3` |

## Navigation and lifecycle

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| PRACT-27 | Android hardware back and in-app back during an active practice session SHALL open a Leave practice confirmation. | Required | Web `PRACT-29`, `PRACT-30`, `PRACT-31` |
| PRACT-28 | The Leave practice modal SHALL keep the session mounted. Keep practicing SHALL dismiss it. | Required | Web `PRACT-30` |
| PRACT-29 | Confirming Leave practice SHALL preserve the session for resume, not discard it. | Required | This document, overrides web `PRACT-31` |
| PRACT-30 | Switching certs during practice SHALL route through the leave guard and SHALL NOT silently discard the session. | Required | Web `PRACT-32` |
| PRACT-31 | Backgrounding the app during practice SHALL preserve the session and current answer state. | Required | `IONIC-7` |
| PRACT-32 | Force-closing and reopening the app SHALL offer Resume practice for the saved session. | Required | `DATA-21` |
| PRACT-33 | Practice SHALL NOT set the timed-exam active state and SHALL NOT lock unrelated navigation. | Required | Web `STUDY-50` |

## Presentation

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| PRACT-34 | The practice surface SHALL use US English spelling. | Required | `IONIC-13` |
| PRACT-35 | The practice surface SHALL work in light and dark themes and at phone and tablet widths. | Required | `08-accessibility-and-resilience.md` |
| PRACT-36 | The practice surface SHALL be screen-reader usable and SHALL meet the mobile accessibility requirements. | Required | `08-accessibility-and-resilience.md` |
| PRACT-37 | The practice surface SHALL respect reduced motion. | Required | `IONIC-16` |
| PRACT-38 | A displayed mastery percentage SHALL use the local bank-coverage definition. | Required | `04-spaced-repetition.md` |

## Analytics

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| PRACT-39 | Practice events SHALL remain local. No practice event SHALL be sent off device by default. | Required | `07-privacy-and-telemetry.md` |
