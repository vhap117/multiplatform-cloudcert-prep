# Issue 013: Accessibility, offline, and release hardening

## Context

This is the closing pass. It is not new features; it is the systematic
verification and fixing of the guarantees every other issue promised:
accessibility, lifecycle resilience, storage failure behaviour, offline
operation, and the device release checklist. Work the checklist top to bottom,
fix what fails, and re-run until it holds.

Spec: `../ionic-requirements/08-accessibility-and-resilience.md` (all of it),
`../ionic-requirements/11-offline-capabilities.md` (all of it),
`../ionic-requirements/07-privacy-and-telemetry.md` (audit checklist), and the
verification expectations in `../ionic-requirements/README.md`.

Traces: `ACC-1` to `ACC-53`, `OFF-1` to `OFF-37`, `CONT-45` to `CONT-47`,
`IONIC-7`, `IONIC-17`.

Depends on: 005, 006, 007, 008, 009, 010, 011, 012.
Blocks: nothing. This is the release gate.

## Tasks

- [ ] Screen reader pass with TalkBack: screen titles, question text,
      options, feedback, progress bars, filter states, and modal focus all
      announce correctly; focus returns to the trigger when a modal closes.
      (`ACC-1` to `ACC-10`)
- [ ] External keyboard pass on Android: every focusable element shows a
      visible focus indicator. (`ACC-11`)
- [ ] Large text pass: honour the system font size setting; nothing clips,
      overflows, or needs horizontal scrolling on any screen. (`ACC-12`,
      `ACC-29`)
- [ ] Contrast pass: 4.5:1 normal text and 3:1 large text in both themes on
      every screen, using the tokens from DESIGN.md. (`ACC-13`, `ACC-14`,
      `ACC-18`)
- [ ] Motion pass: reduced motion collapses entrances and staggers to plain
      fades; press feedback stays within 90 ms; gestures are never the only
      path to an action. (`ACC-20` to `ACC-25`)
- [ ] Keyboard avoidance: inputs are never obscured by the soft keyboard on
      either platform. (`ACC-30`)
- [ ] Layout pass: safe areas, portrait first, landscape and tablet usable,
      long lists virtualized or paginated, status and navigation bars readable
      in both themes. (`ACC-26` to `ACC-28`)
- [ ] Lifecycle gauntlet on a real device for every session kind: background,
      screen lock, force close, phone restart, and app upgrade during an
      active session each restore correctly; a timed exam ended by the wall
      clock while backgrounded shows results on return. (`ACC-34` to
      `ACC-37`, `IONIC-7`)
- [ ] Storage failure drills: full disk, interrupted write, corrupted row,
      migration failure, and failed bank load each produce a visible,
      retryable, recoverable error without corrupting other data and without
      advancing state as if saved. (`ACC-38` to `ACC-47`)
- [ ] Offline gauntlet in airplane mode: install, study exam, mock exam,
      domain practice, history, statistics, settings, backup export and
      import, and app restart with no network, with zero network errors and
      zero spinners waiting on connectivity. (`OFF-1` to `OFF-6`,
      `OFF-21` to `OFF-26`, `OFF-32`)
- [ ] Runtime health sweep: no unexpected console errors in normal flows, no
      broken icons or images, skeletons or labelled spinners instead of blank
      screens, quick cold start, no polling or background loops, no network
      requests during study. (`ACC-48` to `ACC-53`)
- [ ] Privacy audit: airplane-mode use of every core flow, no third-party SDK
      calls in the network log, share sheet only after explicit tap, no
      answer or question content in logcat or the system log, privacy
      statement reachable from Settings, no unnecessary permissions in the
      installed manifest. (`07-privacy-and-telemetry.md` audit checklist)
- [ ] Release build: a reproducible Android package with embedded banks and
      assets, documented permissions only, and signing and publishing secrets
      outside the repository. (`CONT-31` to `CONT-35`, `CONT-40`, `CONT-41`)
- [ ] Regression gate: the full unit and contract test suites pass in CI
      alongside the content validator, for both storage adapters. (`CONT-42`
      to `CONT-44`, `CONT-50`)
- [ ] Document the hardening results: a short report listing each checklist
      item with pass, fixed, or known limitation, so the next release starts
      from evidence instead of memory.

## Acceptance criteria

- The two verification checklists from `08-accessibility-and-resilience.md`
      and `11-offline-capabilities.md` pass on a real phone without skipped
      items, or every skipped item is reported as a named known limitation
      with a reason.
- The privacy audit checklist from `07-privacy-and-telemetry.md` passes with
      no unanswered items.
- A clean install on the target phone followed by the ten verification steps
      in `README.md` passes end to end.
- CI is green: unit tests, contract tests against both adapters, content
      validator, and the em-dash lint from issue 001.

## Out of scope

- New features. Anything discovered here that needs new behaviour gets its
      own issue instead of growing this one.
- App store submission itself; this issue produces the release-ready build
      and the evidence, publishing stays a separate human decision.
