# Issue 007: Domain practice with adaptive selection

## Context

Domain practice is the targeted drill: pick one exam domain, answer a short
session, get instant feedback, and watch mastery move. Question selection is
the adaptive weighted sampler from issue 004, driven entirely by local history.
This is the feature that makes the app feel personal without any account.

Spec: `../ionic-requirements/03-practice-by-subject.md` (all of it) and
`../ionic-requirements/04-spaced-repetition.md`. Engine from issue 004,
storage from issue 002.

Traces: `PRACT-1` to `PRACT-39`, `SR-4` to `SR-6`, `SR-41` to `SR-43`.

Depends on: 002, 004.
Blocks: 008 (dashboard mastery display), 009.

## Log

L1 (user, 2026-11-04): continue with issue 007 on its own branch after
merging the issue 006 branch.

L2 (user decision, 2026-11-04): a question becomes mastered after 2
consecutive correct answers and then rests for 3 completed practice sessions
of its domain at a null weight. The window is counted in sessions of the
domain, never in days (SR-2, SR-16, SR-17). Pinned as `MASTERED_STREAK` and
`EXCLUSION_WINDOW_SESSIONS` in `src/app/core/exam-session/mastery.ts`;
changing either updates the requirements, the docs, and the tests together.

L3 (decision, 2026-11-04): a stored mastery row without `sessionsSinceSeen`
reads as 0, because rows written before the mastery writer existed do not
carry the counter.

L4 (decision, 2026-11-04): practice is kind-isolated. Every storage call uses
the `practice` session kind, and mock or study session rows are never read
or written.

L5 (user decision, 2026-11-04): mock exams have no effect on question
mastery. Only study exams and practice sessions move it, specified as
EXAM-34A in `../ionic-requirements/02-mock-exam.md` and as SR-7 and SR-11 in
`../ionic-requirements/04-spaced-repetition.md`. Mock submit writes no
mastery rows, and the practice mastery fold excludes mock attempt results.
Domain-level progress (attempted, correct, coverage percent) still updates
from mock results per EXAM-34.

L6 (implementation, 2026-11-04): the remaining UI slices landed on this
branch. The Practice tab lists the selected cert's domains with one
practice action each, the config screen takes a `domain` query parameter for
deep links, and the runner is guarded by `practiceLeaveGuard`. The runner
grades finals through the same service calls the engine tests already cover,
so the UI specs stub the service and pin visible behaviour only.

## Tasks

- [x] Entry points: cert dashboard and Practice tab both reach the domain
      list for the selected cert, each domain with a practice action. A deep
      link naming a domain preselects it on the config screen. (`PRACT-1`,
      `PRACT-2`, `PRACT-3`)
- [x] Session size control: 10 to 50 questions in steps of 5, default 20,
      with accessible increase and decrease labels and disabled states at the
      bounds. (`PRACT-4`, `PRACT-5`, `SR-41`)
- [x] Selection: load the domain bank locally and call
      `selectPracticeQuestions` once at session start. With no history this
      degenerates to uniform random; never reuse the exam selector here.
      (`PRACT-6`, `SR-4`)
- [x] Resume rule: starting a session with an in-progress practice session for
      the same cert requires an explicit resume-or-discard choice, and the
      session state is saved before the first question renders. (`PRACT-7`,
      `PRACT-8`)
- [x] Question flow: Question N of M label, a progress bar that advances the
      moment the current question is answered, and all four question types
      with all-or-nothing grading. (`PRACT-9` to `PRACT-12`)
- [x] Instant feedback after grading: correct or incorrect, the explanation
      summary, and the per-option explanations relevant to the student's
      answer. (`PRACT-13`, `PRACT-14`)
- [x] Answered questions are read-only for the rest of the session; returning
      to one shows the same answer and feedback. (`PRACT-19`, `PRACT-20`)
- [x] Multi-answer guard: warn on an incomplete response instead of silently
      grading it wrong. (`PRACT-17`)
- [x] Save every answer and its derived counters immediately in the shared
      transactional write; recompute mastery for the session's domains on
      completion. (`PRACT-16`, `PRACT-22`, `SR-42`, `SR-43`)
- [x] Completion screen: Practice session complete with score and summary;
      the session appears in local history. (`PRACT-21`, `PRACT-23`)
- [x] Failure handling: failed save shows a visible retryable error; failed
      bank or session load shows a retryable error and re-enables Start.
      (`PRACT-24`, `PRACT-25`)
- [x] Leave practice guard: in-app back opens a Leave practice
      confirmation; Keep practicing dismisses it; confirming Leave preserves
      the session for resume. Switching certs routes through the same guard.
      The hardware back handler is deferred to the native phase and must reuse
      this guard. (`PRACT-27` to `PRACT-30`)
- [x] Lifecycle: backgrounding preserves the session and current answer;
      force close and reopen offers Resume practice. Practice never sets the
      timed-exam active state and never locks unrelated navigation.
      (`PRACT-31` to `PRACT-33`)
- [x] Next and Finish controls: advance with Next question and finish with
      Finish session on the last question. (`PRACT-15`)
- [x] Optional report-question action: copy the question id or open a
      configured issue URL, only on explicit tap. (`PRACT-18`)
- [x] Presentation: US English, both themes, phone and tablet widths, screen
      reader usable, reduced motion respected, and any displayed mastery uses
      the bank-coverage definition. (`PRACT-34` to `PRACT-38`)
- [x] No network anywhere in the flow; practice events stay local. (`PRACT-26`,
      `PRACT-39`)

## Acceptance criteria

- A student with prior wrong answers sees those questions weighted back into
      rotation, per the selector unit tests from issue 004.
- Answer 5 of 20, force close, reopen: Resume practice restores position and
      prior answers read-only with their feedback.
- Complete a session: one question-result row per answered question and the
      domain aggregate updated in the same transaction; the session shows in
      history.
- Mastery percentage on screen matches the coverage definition and never
      exceeds 100.
- Whole flow runs with the browser offline; switching certs mid-session
      triggers the leave guard, never silent data loss.

## Out of scope

- Mock and study exam flows (issues 005 and 006).
- Dashboard rendering of mastery and the Next up action (issue 008); this
      issue only maintains the underlying rows.
