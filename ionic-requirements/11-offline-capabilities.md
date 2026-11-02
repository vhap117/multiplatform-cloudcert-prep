# Offline capabilities

Scope: what the Ionic app can do with no network, which network uses are
optional, how data moves between devices, and the boundaries that keep the app
honest about being offline first.

## Offline baseline

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| OFF-1 | Every core study flow SHALL work in airplane mode: mock exams, study exams, domain practice, history, statistics, settings, and backup export. | Required | `IONIC-2` |
| OFF-2 | Starting the app with no network SHALL NOT show a network error or a spinner waiting for connectivity. | Required | This document |
| OFF-3 | The app SHALL NOT block startup on any network request. | Required | `PRIV-3` |
| OFF-4 | The question bank SHALL be bundled, so no content fetch is needed to study. | Required | `IONIC-12`, `09-content-and-app-build.md` |
| OFF-5 | Local reads and writes SHALL go to the device store only: Capacitor SQLite on device, IndexedDB in the browser. | Required | `01-local-data-and-device.md` |
| OFF-6 | A failed or missing network feature SHALL degrade to the local experience, never to an error on the study path. | Required | This document |

## Optional network uses

Any network use SHALL be an explicit opt-in addition. Nothing in this list is
required to study.

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| OFF-7 | Optional content updates, if added, SHALL be off by default and initiated by an explicit action. | Optional | `PRIV-26` |
| OFF-8 | A content update SHALL only fetch bank and asset content. It SHALL NOT upload study data. | Optional | `PRIV-27` |
| OFF-9 | A content update SHALL fail gracefully back to the bundled bank. | Optional | `PRIV-28` |
| OFF-10 | Share actions MAY use the system share sheet, which may transmit text to another app at the student's explicit request. The app itself SHALL NOT upload anything. | Optional | `PRIV-17` |
| OFF-11 | Report-a-question, if wired, MAY open a browser or compose an issue with the question id, only after an explicit tap. | Optional | `02-mock-exam.md` |
| OFF-12 | The app SHALL NOT include push notifications, sync daemons, or background uploads. | Required | `PRIV-5` |
| OFF-13 | If local study reminders are ever added, they SHALL use on-device scheduling and SHALL NOT require a server. | Optional | `PRIV-20` |

## Device to device transfer

There is no cloud. Moving data between phones is a manual export and import.

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| OFF-14 | The student SHALL be able to move their data to another device by exporting a backup on one device and importing it on the other. | Required | `DATA-24` to `DATA-30` |
| OFF-15 | Backup export and import SHALL work fully offline, through the device share sheet, file picker, or a connected cable. | Required | `DATA-26`, `PRIV-23` |
| OFF-16 | The export format SHALL be documented and stable across versions within a schema version. | Required | `DATA-25`, `DATA-29` |
| OFF-17 | Importing on a fresh install SHALL rebuild history, mastery, and in-progress sessions without a network connection. | Required | `DATA-30` |
| OFF-18 | The app SHALL NOT claim automatic cross-device sync. Any future sync SHALL be a separate, explicit, opt-in feature. | Required | `IONIC-18`, `PRIV-32` |
| OFF-19 | The app SHALL NOT silently merge two devices' data. A restore replaces the local data after explicit confirmation. | Required | `DATA-28` |
| OFF-20 | The app SHALL NOT keep a copy of the backup off device. | Required | `PRIV-21` |

## Lifecycle offline rules

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| OFF-21 | Closing and reopening the app SHALL restore the last state from the local store with no network dependency. | Required | `IONIC-7` |
| OFF-22 | A timed mock exam SHALL continue against the wall clock while the app is backgrounded or the device is offline. | Required | `02-mock-exam.md` |
| OFF-23 | An untimed study or practice session SHALL hold its state indefinitely until completed or discarded, within the one-session-per-cert rule. | Required | `10-study-exams.md`, `03-practice-by-subject.md` |
| OFF-24 | A device restart with an in-progress session SHALL offer resume on the next launch. | Required | `DATA-21` |
| OFF-25 | The app SHALL not expire in-progress sessions by time. A study exam SHALL NOT have a 24-hour expiry. | Required | This document |
| OFF-26 | The app SHALL not require the date and time to be online-corrected to function. Wall-clock timing uses the device clock. | Required | This document |

## Storage durability rules

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| OFF-27 | The browser IndexedDB store SHALL NOT be used as the primary store on a device. It exists for `ionic serve` development and tests. | Required | `DATA-9C` |
| OFF-28 | The app SHALL NOT depend on browser storage eviction. On device, the SQLite store is the source of truth. | Required | `IONIC-6` |
| OFF-29 | The app SHALL warn the student that clearing app data or uninstalling deletes study data, and SHALL point to the backup export. | Required | `PRIV-30` |
| OFF-30 | Backup export SHALL be available even when the local database is partially corrupted, by exporting the raw file or the valid subset, so data can still be recovered. | Optional | `ACC-40` |
| OFF-31 | Import SHALL tolerate and report unknown rows from a newer minor version while importing the compatible subset. | Optional | `DATA-29` |
| OFF-32 | Offline storage failures SHALL be visible and retryable, matching `08-accessibility-and-resilience.md`. | Required | `08-accessibility-and-resilience.md` |

## Single-user boundary

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| OFF-33 | There is one user on one install. There is no guest mode, no login, and no account switch. | Required | `IONIC-1`, `DATA-5` |
| OFF-34 | The app SHALL not show account-related UI: no sign-in, sign-up, profile, or sign-out. | Required | `06-certifications-and-navigation.md` |
| OFF-35 | If the phone is shared, the optional app lock is the only separation mechanism, and it does not create a second data profile. | Optional | `DATA-33` to `DATA-35` |
| OFF-36 | The app SHALL not adopt the web app's pending-attempt ownership rules because there is no second identity to protect against. | Required | `DATA-43` |
| OFF-37 | All features described across the Ionic requirements SHALL be available to the single local user with no network. | Required | `IONIC-18` |

## What the app does not do

- No accounts, no authentication, no server.
- No cloud backup, no sync, no leaderboards, no community stats.
- No cookies, no consent banner, no advertising, no analytics by default.
- No web SEO, no sitemaps, no Lighthouse.
- No calendar-based scheduling. The existing adaptive weighted selection is kept.
- No account lifecycle: no email verification, password reset, or account deletion.
- No cross-device continuity beyond manual export and import.

## Verification checklist

1. Install the app, enable airplane mode, and run every core flow.
2. Complete a study exam, close and reopen the app, and resume it.
3. Background a timed exam and return after the deadline passes.
4. Export a backup on one adapter, import it on the other, and compare history and mastery.
5. Clear app data, reinstall, import the backup, and confirm the dashboard.
6. Confirm Settings shows app version, content version, and schema version.
7. Confirm no account UI and no network requests during study.
