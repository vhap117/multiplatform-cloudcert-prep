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

## Platform scope

The active target is **Android only**. This host is Linux on WSL2, which cannot
build iOS at all. iOS is deferred, not cancelled:

- Code stays platform-neutral so iOS can be added later without a rewrite.
- No task in these issues depends on iOS being present.
- When iOS enters scope, it needs a macOS host or a macOS CI runner, plus a new
      issue for its verification pass.
- Any iOS-only requirement in `../ionic-requirements/` stays as documentation
      of intent until that issue exists.

Android native directories (`android/`) and `ios/` are listed in `.gitignore`,
so Capacitor regenerates them from config. If you later make manual native edits
(signing config, manifest permissions, custom icons), reverse that and commit
them; native hand-edits are source, not build output.

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
