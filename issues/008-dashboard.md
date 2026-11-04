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

Traces: `PROG-1` to `PROG-15`, `SR-35` to `SR-40`, `DATA-21`, `CERT-26`.

Depends on: 002, 004.
Blocks: 010 (dashboard is the cert-switching surface).

## Tasks

- [ ] Header of the selected cert: name, short name, level, and question
      count from the bundled registry. (`PROG-2`)
- [ ] Exam performance tile: pass rate, average score percentage, and best
      score percentage across completed mock and study exam attempts for the
      selected certCode, or N/A with a baseline hint when there are no exam
      attempts. Study exams and mock exams feed the same metrics. Practice
      sessions SHALL NOT appear in these metrics. (`PROG-3`, `PROG-3A`,
      `PROG-3B`, `PROG-3C`, `STUDY-50`, `PROG-48`)
- [ ] Two primary actions: mock exam and domain practice, both scoped to
      the selected cert. (`PROG-4`)
- [ ] Practice coverage list: one progress bar per domain, bank coverage
      capped at 100, with an accessible label and value on every bar. Derive
      practice domain strength from completed practice session rows
      (`AttemptRow` with `kind: 'practice'`) and their per-domain scores.
      Practice sessions are what move this coverage. (`PROG-5`, `PROG-6`)
- [ ] Exam domain performance list: per-domain accuracy from completed mock
      and study exam attempts, ordered strongest to weakest, so the student can
      see which exam domains need more study. Domains with no exam data show an
      explicit no-exam-data state, never a fabricated 0 percent. (`PROG-3D`)
- [ ] Next up action using the issue 004 recommendation: first unstarted
      domain in cert order, else lowest-percent practiced domain labelled
      Weakest domain. Unstarted domains are phrased You have not practiced X
      yet and are never called weakest. The action opens domain practice with
      the domain preselected. (`PROG-7`, `SR-35` to `SR-39`)
- [ ] Zero-exam-attempt state: pass rate, average score, and best score show
      N/A with a baseline hint, and Next up points at the first domain. A
      practice session does not clear this state or change the exam metrics.
      (`SR-40`, `PROG-3C`)
- [ ] Recent exam attempts list of completed mock and study exams with pass or
      fail, score percentage, and a link to history; empty state shows
      No exam attempts yet with a start action. Practice sessions never appear
      in this list. (`PROG-8`, `PROG-9`)
- [ ] Resume card when any session is in progress for any cert: session kind,
      cert name, answered count, and last activity time. Tapping resumes the
      right session kind. (`PROG-13`, `PROG-14`, `DATA-21`)
- [ ] Load states: skeletons and an accessible busy state while reading.
      (`PROG-12`)
- [ ] Failure states: a failed local read shows an inline error with Try
      again; a successful retry clears the error and renders the mastery
      section. (`PROG-10`, `PROG-11`)
- [ ] No Export backup action here: backup lives in Settings (issue 012).
      (`PROG-15`)
- [ ] Cert context: the dashboard clearly names the active cert on every
      view, including tablet width. (`CERT-20`)

## Acceptance criteria

- Fresh install: no exam attempts, pass rate, average score, and best score
      are N/A with a baseline hint, Next up points at domain 1, and no mastery
      number is fabricated.
- After a completed practice session, the practised domain's practice coverage
      bar moves by exactly the coverage delta, capped at 100, while pass rate,
      average score, best score, recent exam attempts, and exam domain
      performance stay unchanged.
- After a completed mock or study exam, pass rate, average score, best score,
      recent exam attempts, and exam domain performance update for the selected
      certCode only. Another certCode's metrics are untouched.
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
