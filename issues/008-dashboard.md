# Issue 008: Cert dashboard and resume card

## Context

The dashboard is the home surface for the selected cert. It answers four
questions at a glance: how am I doing, what should I do next, what is in
progress, and what happened recently. All of it comes from local rows through
the repository interface.

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
- [ ] Best score tile: best scaled score, or N/A with a baseline hint when
      there are no attempts. Study exams and mock exams feed the same best
      score. (`PROG-3`, `STUDY-50`, `PROG-48`)
- [ ] Two primary actions: practice exam and domain practice, both scoped to
      the selected cert. (`PROG-4`)
- [ ] Domain mastery list: one progress bar per domain, bank coverage capped
      at 100, with an accessible label and value on every bar. (`PROG-5`,
      `PROG-6`)
- [ ] Next up action using the issue 004 recommendation: first unstarted
      domain in cert order, else lowest-percent practiced domain labelled
      Weakest domain. Unstarted domains are phrased You have not practiced X
      yet and are never called weakest. The action opens domain practice with
      the domain preselected. (`PROG-7`, `SR-35` to `SR-39`)
- [ ] Zero-attempt state: Best score N/A, a baseline hint, and Next up
      pointing at the first domain. (`SR-40`)
- [ ] Recent attempts list with pass or fail, scaled score, percentage, and a
      link to history; empty state shows No attempts yet with a start action.
      (`PROG-8`, `PROG-9`)
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

- Fresh install: empty dashboard with baseline hint, Next up pointing at
      domain 1, no fabricated mastery numbers.
- After a completed practice session, the practised domain's mastery bar
      moves by exactly the coverage delta, capped at 100.
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
