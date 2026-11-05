# Issue 008: Cert dashboard and resume card

## Context

The dashboard is the home surface for the selected cert. It answers four
questions at a glance: how am I doing, what should I do next, what is in
progress, and what happened recently. All of it comes from local rows through
the repository interface.

Terminology: the app has two exam modes, mock exam and study exam, plus domain
practice sessions. Domain practice is not a third exam mode. Every exam metric
below is scoped to the selected certCode, the registry identifier such as
`clf-c02`.

Spec: `../ionic-requirements/05-progress-and-history.md` (dashboard rows
PROG-1 to PROG-15) and `../ionic-requirements/04-spaced-repetition.md`
(next-domain rows SR-35 to SR-40). Engine from issue 004, storage from issue
002.

Traces: `PROG-1` to `PROG-15`, `SR-35` to `SR-40`, `DATA-21`.

Depends on: 002, 004, 005, 006, 007.
Blocks: 010 (dashboard is the cert-switching surface).

## Tasks

- [x] Header of the selected cert: name, short name, level, and question
      count from the bundled registry. (`PROG-2`)
- [x] Exam performance tile: all-time pass rate, average score percentage,
      and best score percentage across completed mock and study exam attempts
      for the selected certCode, or N/A with a baseline hint when there are no
      exam attempts. Study exams and mock exams feed the same metrics. Practice
      sessions SHALL NOT appear in these metrics. (`PROG-3`, `PROG-3A`,
      `PROG-3B`, `PROG-3C`, `STUDY-50`, `PROG-48`)
- [x] Two primary actions: mock exam and domain practice, both scoped to
      the selected cert. (`PROG-4`)
- [x] Combined domain view: one row per domain with practice coverage and
      exam accuracy. Practice coverage is bank coverage capped at 100, derived
      from completed practice session rows (`AttemptRow` with
      `kind: 'practice'`) and their per-domain scores. Exam accuracy comes from
      completed mock and study exam attempts. Order rows by lowest practice
      coverage, then lowest exam accuracy, then cert order. Every bar needs an
      accessible label and value. Domains with no exam data show an explicit
      no-exam-data state, never a fabricated 0 percent. (`PROG-5`, `PROG-6`,
      `PROG-3D`)
- [x] Next up action using the issue 004 recommendation: first unstarted
      domain in cert order, else lowest-percent practiced domain labelled
      Weakest domain. Unstarted domains are phrased You have not practiced X
      yet and are never called weakest. The action opens domain practice with
      the domain preselected. (`PROG-7`, `SR-35` to `SR-39`)
- [x] Zero-exam-attempt state: pass rate, average score, and best score show
      N/A with a baseline hint, and Next up points at the first domain. A
      practice session does not clear this state or change the exam metrics.
      (`SR-40`, `PROG-3C`)
- [x] Recent exam attempts list: the latest three completed mock and study
      exams, newest first, with pass or fail, score percentage, date, and a
      link to history; empty state shows No exam attempts yet with a start
      action. Practice sessions never appear in this list. (`PROG-8`, `PROG-9`)
- [x] Resume cards for the selected cert: one per in-progress kind (mock,
      study, practice), naming the kind, cert, answered count, and last
      activity time. Tapping a card resumes that kind directly in its runner.
      (`PROG-13`, `PROG-14`, `DATA-21`)
- [x] Load states: skeletons and an accessible busy state while reading.
      (`PROG-12`)
- [x] Failure states: each data section loads independently. A failed local
      read shows an inline error with Try again in that section only, while the
      header and other sections keep rendering; a successful retry clears the
      error and renders the failed section. (`PROG-10`, `PROG-11`)
- [x] No Export backup action here: backup lives in Settings and is
      implemented by issue 011. (`PROG-15`)
- [x] Cert context: the dashboard clearly names the active cert on every
      view, including tablet width. (`CERT-20`)

## Acceptance criteria

- Fresh install: no exam attempts, pass rate, average score, and best score
      are N/A with a baseline hint, Next up points at domain 1, and no mastery
      number is fabricated.
- After a completed practice session, the practiced domain's practice coverage
      bar moves by exactly the coverage delta, capped at 100, while pass rate,
      average score, best score, recent exam attempts, and exam accuracy stay
      unchanged.
- After a completed mock or study exam, pass rate, average score, best score,
      recent exam attempts, and exam accuracy update for the selected certCode
      only. Another certCode's metrics are untouched.
- With a study exam in progress, the resume card names it, shows answered
      count, and tapping resumes at the saved position.
- Corrupt a row in a test fixture: the dashboard shows the Try again error,
      and retry recovers after the row is quarantined.
- Dashboard renders in both themes, phone and tablet widths, no horizontal
      scrolling, screen-reader readable bars.

## Out of scope

- History list page and local statistics (issue 009).
- Cert switcher UI (issue 010); this issue only reads the selected cert.
- Reset actions (issue 009) and backup export (issue 011).
