# Issue 013: Web accessibility, offline, and quality hardening

Status: complete for the web scope. Evidence and deferred items are in
[013-hardening-report.md](./013-hardening-report.md).

## Context

This is the closing pass for the web-only phase. It is not new features; it is
the systematic verification and fixing of the guarantees every other issue
promised, in the environment we are actually building for: Chrome, `ng serve`
or `ionic serve`, with the IndexedDB adapter.

Device and native checks are deliberately absent. They belong to a future
native phase, described in the scope note in `000-index.md`. What stays here is
what can be proven honestly in a browser: accessibility semantics, keyboard
operation, contrast, browser-offline behaviour, storage failure handling, and
runtime health.

Spec: `../ionic-requirements/08-accessibility-and-resilience.md`,
`../ionic-requirements/11-offline-capabilities.md`, and
`../ionic-requirements/07-privacy-and-telemetry.md`.

Traces: `ACC-1` to `ACC-30`, `ACC-38` to `ACC-53`, `OFF-1` to `OFF-6`,
`OFF-21` to `OFF-26`, `OFF-32`, `CONT-42` to `CONT-47`, `CONT-50`.

Depends on: 005, 006, 007, 008, 009, 010, 011, 012.
Blocks: nothing. This is the web release gate.

## Tasks

- [x] Accessibility semantics audit: every interactive element has an
      accessible name, decorative icons are hidden from assistive technology,
      screen titles and route changes are announced, and modals expose a dialog
      role, a label, focus trapping, and return focus to their trigger.
      (`ACC-1` to `ACC-10`)
- [x] Question and feedback semantics: grids, progress bars, and session
      controls expose state through ARIA, not colour; correct and incorrect
      feedback always carries text; error and success notices are announced.
      (`ACC-4` to `ACC-7`)
- [x] Automated accessibility scan with axe (or equivalent) across every
      screen in both themes, with zero violations at the configured rule set.
      (supports `ACC-1` to `ACC-13`)
- [x] Keyboard-only pass: reach and operate every action with Tab, Shift+Tab,
      Enter, Space, and Escape; visible focus indicator on every focusable
      element; focus order follows reading order. (`ACC-11`, `ACC-2`)
- [x] Large text pass: browser zoom to 200 percent and a bumped root font size
      clip nothing, overflow nothing, and require no horizontal scrolling on
      any screen. (`ACC-12`, `ACC-29`)
- [x] Contrast pass: 4.5:1 normal text and 3:1 large text in both themes on
      every screen, using the DESIGN.md tokens. (`ACC-13`, `ACC-14`, `ACC-18`)
- [x] Motion pass: the reduced-motion override collapses entrances and
      staggers to plain fades; press feedback stays within 90 ms; no gesture is
      the only path to an action. (`ACC-20` to `ACC-25`)
- [x] Responsive layout pass: phone width, tablet width, and the 720 px capped
      content column; long lists virtualized or paginated; nothing extends
      under a simulated safe area. (`ACC-26` to `ACC-28`)
- [x] Storage failure drills: quota exceeded, interrupted write, corrupted or
      unknown row, migration failure, and failed bank load each produce a
      visible, retryable, recoverable error without corrupting other data and
      without advancing state as if saved. (`ACC-38` to `ACC-47`)
- [x] Browser-offline gauntlet with devtools offline mode: mock exam, study
      exam, domain practice, history, statistics, settings, and backup export
      and import all succeed with zero network errors and zero spinners
      waiting on connectivity. (`OFF-1` to `OFF-6`, `OFF-21` to `OFF-26`,
      `OFF-32`)
- [x] Network audit: confirm zero requests during study flows in the devtools
      network panel, and that a reload with the network blocked still starts
      into a usable app. (`OFF-2`, `OFF-3`, `PRIV-3`)
- [x] Runtime health sweep: no unexpected console errors in normal flows, no
      broken icons or images, skeletons or labelled spinners instead of blank
      screens, fast first paint, no polling or background loops.
      (`ACC-48` to `ACC-53`)
- [x] Privacy audit for the web scope: no third-party analytics or SDK calls
      in the network log, share and clipboard only on explicit user action, no
      answer or question content in the console, privacy statement reachable
      from Settings, no unnecessary browser permission requests.
      (`07-privacy-and-telemetry.md` audit checklist, `PRIV-14` to `PRIV-19`)
- [x] Production web build: `ng build --configuration production` succeeds,
      embeds the banks and assets, contains no secrets, and contains no
      web-only leftovers rejected by `CONT-38`. (`CONT-34` to `CONT-41`)
- [x] Regression gate in CI: unit tests, repository contract tests against
      IndexedDB, the content validator, the em-dash lint, and the
      accessibility scan all run and pass. (`CONT-42` to `CONT-47`, `CONT-50`)
- [x] Document the hardening results: one report listing each checklist item as
      pass, fixed, or deferred with a reason, so the native phase starts from
      evidence instead of memory.

## Acceptance criteria

- Every checklist item above passes in Chrome, or is recorded as deferred with
  a named reason. No item stays silently unchecked.
- The axe scan reports zero violations on every screen in both themes.
- With devtools offline mode on, every core flow completes and the network
  panel shows no failed requests and no unexpected successful ones.
- Storage drills reproduce each failure and each one surfaces a retryable,
  recoverable state rather than a crash or a false success.
- The production build succeeds and CI is green.

## Deferred to the native phase

These are named here so nobody mistakes their absence for an oversight:

- TalkBack and VoiceOver passes on hardware.
- Android hardware back, iOS back gesture, safe-area insets on a real device.
- Force close, phone restart, and app upgrade during an active session.
- Airplane-mode behaviour and the installed permission manifest.
- Capacitor SQLite adapter and its side of the contract suite.
- Native packaging, signing, and store submission.

## Out of scope

- New features. Anything discovered here that needs new behaviour gets its own
  issue instead of growing this one.
- Publishing. This issue produces a verified web build and the evidence;
  deploying it stays a separate human decision.
