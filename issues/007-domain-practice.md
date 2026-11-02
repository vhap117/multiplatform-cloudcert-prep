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

## Tasks

- [ ] Entry points: cert dashboard and Practice tab both reach the domain
      list for the selected cert, each domain with a practice action. A deep
      link naming a domain preselects it on the config screen. (`PRACT-1`,
      `PRACT-2`, `PRACT-3`)
- [ ] Session size control: 10 to 50 questions in steps of 5, default 20,
      with accessible increase and decrease labels and disabled states at the
      bounds. (`PRACT-4`, `PRACT-5`, `SR-41`)
- [ ] Selection: load the domain bank locally and call
      `selectPracticeQuestions` once at session start. With no history this
      degenerates to uniform random; never reuse the exam selector here.
      (`PRACT-6`, `SR-4`)
- [ ] Resume rule: starting a session with an in-progress practice session for
      the same cert requires an explicit resume-or-discard choice, and the
      session state is saved before the first question renders. (`PRACT-7`,
      `PRACT-8`)
- [ ] Question flow: Question N of M label, a progress bar that advances the
      moment the current question is answered, and all four question types
      with all-or-nothing grading. (`PRACT-9` to `PRACT-12`)
- [ ] Instant feedback after grading: correct or incorrect, the explanation
      summary, and the per-option explanations relevant to the student's
      answer. (`PRACT-13`, `PRACT-14`)
- [ ] Answered questions are read-only for the rest of the session; returning
      to one shows the same answer and feedback. (`PRACT-19`, `PRACT-20`)
- [ ] Multi-answer guard: warn on an incomplete response instead of silently
      grading it wrong. (`PRACT-17`)
- [ ] Save every answer and its derived counters immediately in the shared
      transactional write; recompute mastery for the session's domains on
      completion. (`PRACT-16`, `PRACT-22`, `SR-42`, `SR-43`)
- [ ] Completion screen: Practice session complete with score and summary;
      the session appears in local history. (`PRACT-21`, `PRACT-23`)
- [ ] Failure handling: failed save shows a visible retryable error; failed
      bank or session load shows a retryable error and re-enables Start.
      (`PRACT-24`, `PRACT-25`)
- [ ] Leave practice guard: Android hardware back and in-app back open a Leave
      practice confirmation; Keep practicing dismisses it; confirming Leave
      preserves the session for resume. Switching certs routes through the
      same guard. (`PRACT-27` to `PRACT-30`)
- [ ] Lifecycle: backgrounding preserves the session and current answer;
      force close and reopen offers Resume practice. Practice never sets the
      timed-exam active state and never locks unrelated navigation.
      (`PRACT-31` to `PRACT-33`)
- [ ] Next and Finish controls: advance with Next question and finish with
      Finish session on the last question. (`PRACT-15`)
- [ ] Optional report-question action: copy the question id or open a
      configured issue URL, only on explicit tap. (`PRACT-18`)
- [ ] Presentation: US English, both themes, phone and tablet widths, screen
      reader usable, reduced motion respected, and any displayed mastery uses
      the bank-coverage definition. (`PRACT-34` to `PRACT-38`)
- [ ] No network anywhere in the flow; practice events stay local. (`PRACT-26`,
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
- Whole flow runs in airplane mode; switching certs mid-session triggers the
      leave guard, never silent data loss.

## Out of scope

- Mock and study exam flows (issues 005 and 006).
- Dashboard rendering of mastery and the Next up action (issue 008); this
      issue only maintains the underlying rows.
