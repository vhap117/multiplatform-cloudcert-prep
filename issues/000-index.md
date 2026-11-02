# CloudCertPrep Ionic: issue roadmap

This folder is the build plan for the Ionic app. Each numbered file is one
issue: a meaty, reviewable feature with an ordered task checklist inside. Every
task cites the requirement IDs it implements, so nothing is built from memory.

Source of truth:

- Requirements: `../ionic-requirements/*.md`
- Design tokens: `../ionic-requirements/DESIGN.md`
- Engine porting guide: `../ionic-requirements/cert-banks/EXAM-ENGINE.md`
- Reference code to port: `../ionic-requirements/cert-banks/reference/`
- Question banks: `../ionic-requirements/cert-banks/banks/`

Global rules that apply to every issue: `IONIC-1` to `IONIC-20` in
`../ionic-requirements/README.md`. Read them before starting any issue.

## Scope: web platform only, for now

All development and all verification currently target the **web platform**:
the app running in Chrome through `ng serve` or `ionic serve`, with the
IndexedDB storage adapter. Nothing in this plan requires a phone, an emulator,
or a native build to proceed.

Consequences, stated plainly so no task waits on something we are not doing:

- **No Capacitor platforms are added.** No `android/`, no `ios/`, no
  `npx cap add` in any task. The Capacitor dependencies can be installed, but
  platform wiring waits.
- **No SQLite adapter yet.** IndexedDB is the only implemented store. The
  repository interface is still defined now, so feature code never binds to
  IndexedDB directly and swapping in SQLite later stays a one-module change.
- **No device verification.** TalkBack, hardware back, force-close, phone
  restart, airplane mode, and installed-manifest checks are all deferred.
- **Accessibility is still built, not tested on hardware.** ARIA roles, labels,
  focus order, and contrast are implemented and checked in the browser and with
  automated tooling. Real screen-reader passes come with the native phase.
- **Offline is verified through the browser**, using devtools offline mode and
  the absence of network requests, not airplane mode on a handset.
- **Lenses stay platform-neutral.** Navigation, safe-area insets, and the
  storage contract are written so Android can be added later without a rewrite.

When the native phase starts it gets its own issues: add the platforms, port
SQLite behind the existing interface, run the contract suite against both
adapters, then the device checklist. Until then, `android/` and `ios/` stay in
`.gitignore` and unused.

## Phases and dependency order

| Phase | Issue | Title | Depends on |
|---|---|---|---|
| 0 Foundation | [001](./001-app-scaffold-and-theme.md) | App scaffold, navigation skeleton, theme tokens | none |
| 0 Foundation | [002](./002-local-data-layer.md) | Local data layer and repository contract | 001 |
| 0 Foundation | [003](./003-content-pipeline.md) | Bundled content, cert registry, validator | 001 |
| 0 Foundation | [004](./004-exam-engine-core.md) | Exam engine core, pure functions | 003 |
| 1 Study core | [005](./005-mock-exam.md) | Mock exam feature | 002, 004 |
| 1 Study core | [006](./006-study-exam.md) | Study exam feature | 002, 004 |
| 1 Study core | [007](./007-domain-practice.md) | Domain practice with adaptive selection | 002, 004 |
| 2 Progress | [008](./008-dashboard.md) | Cert dashboard and resume card | 002, 004 |
| 2 Progress | [009](./009-history-and-statistics.md) | History, attempt review, local statistics | 002, 005 |
| 3 Shell and data | [010](./010-navigation-shell.md) | Navigation, cert switching, back behaviour | 001, 005 |
| 3 Shell and data | [011](./011-backup-restore-reset.md) | Backup export, import, reset | 002 |
| 3 Shell and data | [012](./012-settings-and-privacy.md) | Settings screen and privacy statement | 001, 002 |
| 4 Hardening | [013](./013-hardening-and-release.md) | Accessibility, offline, release checklist | 005, 006, 007, 008, 009, 010, 011, 012 |

Issues inside a phase can run in parallel. Phase 0 must finish before anything
else: every feature touches the repository contract and the question bank.

## How to work an issue

1. Read the issue file, then read every requirement row it cites. The cited
   requirement file is the spec; the issue is only a map.
2. Work the task checklist in order. Check a box only when its acceptance
   evidence exists (tests, device check, or a cited verification step).
3. Keep the engine pure (`004`): feature screens call services, services call
   pure functions, and storage goes through the repository interface. Never
   call Capacitor SQLite from feature code (`IONIC-20`).
4. One commit per task group is a good default. Keep commits reviewable.
5. Copy rules: US English, no em dashes or en dashes, system fonts only.

## What is deliberately not here

Accounts, login, servers, analytics, community stats, SEO, and every removed
web behaviour listed at the end of each requirement file. If a task seems to
need one of those, stop and reread `IONIC-1` to `IONIC-20`.

## Definition of done for the whole project

The verification lists in `../ionic-requirements/README.md`,
`07-privacy-and-telemetry.md`, `08-accessibility-and-resilience.md`, and
`11-offline-capabilities.md` all pass on a real phone. Issue 013 collects them.
