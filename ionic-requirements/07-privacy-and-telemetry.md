# Privacy and telemetry

Scope: what the Ionic app does with data, what it never sends anywhere, which
device permissions it needs, and how backups and diagnostics behave. This topic
replaces the web app's analytics and consent requirements.

## Core position

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| PRIV-1 | The app SHALL be private by default. Study data, answers, scores, and usage SHALL stay on the device. | Required | `IONIC-3` |
| PRIV-2 | The app SHALL NOT collect or transmit PII. There is no account, no email, no name requirement, and no advertising identifier. | Required | `IONIC-10` |
| PRIV-3 | The app SHALL NOT require a network connection for any core study flow. | Required | `IONIC-2`, `IONIC-9` |
| PRIV-4 | The app SHALL NOT enable third-party analytics, advertising, tracking, or crash reporting SDKs. | Required | `IONIC-11` |
| PRIV-5 | The app SHALL NOT send telemetry by default. | Required | This document |
| PRIV-6 | The app SHALL work the same way in airplane mode as it does online. | Required | `11-offline-capabilities.md` |

## Local counters and diagnostics

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| PRIV-7 | The app MAY keep local counters for the local statistics view: attempts, answered questions, accuracy, and study time per cert. | Optional | `05-progress-and-history.md` |
| PRIV-8 | Local counters SHALL be derived from local rows only and SHALL never be uploaded. | Required | `IONIC-3` |
| PRIV-9 | The app MAY offer optional, explicit diagnostic export for the student to inspect and delete. It SHALL be off by default. | Optional | This document |
| PRIV-10 | Any diagnostic export SHALL exclude answers, question text, and other study content by default. | Required | This document |
| PRIV-11 | The app SHALL NOT log study answers, backup contents, or per-question data to the system console or crash output. | Required | `01-local-data-and-device.md` `DATA-36` |
| PRIV-12 | Error logs SHALL be trimmed and SHALL NOT include PII or answer data. | Required | This document |
| PRIV-13 | Crash reporting, if ever added, SHALL be opt-in and SHALL be separate from the offline core. | Optional | `IONIC-11` |

## Device permissions

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| PRIV-14 | The app SHALL request only the permissions it actually uses. | Required | This document |
| PRIV-15 | The app SHALL NOT request camera, microphone, contacts, location, or storage-wide access. | Required | This document |
| PRIV-16 | The app SHALL access its own private data directory only, through the local store adapter. | Required | `01-local-data-and-device.md` |
| PRIV-17 | Sharing an export file SHALL use the device share sheet or file picker, invoked by an explicit student action. Nothing SHALL be shared without that action. | Required | `01-local-data-and-device.md` |
| PRIV-18 | The app SHALL NOT read the clipboard automatically. Copying a question id or result text SHALL happen only on an explicit copy action. | Required | This document |
| PRIV-19 | If a share sheet is unavailable, the share action SHALL degrade to saving or copying locally without an error. | Required | This document |
| PRIV-20 | The app SHALL NOT send notifications to a server to enable reminders. Any future local reminders SHALL use on-device scheduling only. | Optional | This document |

## Backup privacy

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| PRIV-21 | A backup export SHALL be a local file the student chooses to store or share. The app SHALL NOT store a copy off device by itself. | Required | `01-local-data-and-device.md` |
| PRIV-22 | The backup SHALL NOT include advertising identifiers, crash logs, or other device identifiers beyond the schema version and app version. | Required | `01-local-data-and-device.md` |
| PRIV-23 | Importing a backup SHALL NOT trigger a network request. | Required | `IONIC-2` |
| PRIV-24 | Imported data SHALL be treated as the student's own local data and SHALL NOT be uploaded or shared. | Required | `IONIC-3` |
| PRIV-25 | The student SHALL be able to delete the local database and any diagnostic or backup files created by the app. | Required | `DATA-31`, `DATA-32` |

## Optional content updates

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| PRIV-26 | If the app ever offers remote content updates, they SHALL be off by default and SHALL be initiated by an explicit action. | Optional | `11-offline-capabilities.md` |
| PRIV-27 | A content update SHALL only fetch the question bank and assets. It SHALL NOT upload study data. | Optional | This document |
| PRIV-28 | The app SHALL continue to work from the bundled bank when no content update is available or when the network is unreachable. | Required | `IONIC-12`, `11-offline-capabilities.md` |

## Privacy statement and controls

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| PRIV-29 | The app SHALL include a short privacy statement that says all data stays on the device and nothing is uploaded. | Required | This document |
| PRIV-30 | The app SHALL state plainly that deleting the app deletes the data, and SHALL point to the backup export as the way to keep data across reinstalls. | Required | `01-local-data-and-device.md` |
| PRIV-31 | The app SHALL not show a cookie consent banner. Cookies and web tracking do not apply to the native app. | Required | This document |
| PRIV-32 | The app SHALL NOT claim cloud backup, sync, or account recovery. | Required | `IONIC-18` |
| PRIV-33 | The app SHALL NOT present server-side community statistics or any data derived from other users. | Required | `05-progress-and-history.md` |
| PRIV-34 | US English copy only, with no em dashes or en dashes in the privacy statement or any other UI copy. | Required | `IONIC-13`, `IONIC-14` |

## Audit checklist

Before a release, verify:

1. Airplane mode with every core flow succeeds and produces no network errors.
2. No third-party SDK calls appear in the network log during normal use.
3. The share sheet only opens after an explicit tap.
4. No answer or question content appears in the device logcat or system log.
5. The privacy statement is reachable from Settings.
6. Export, wipe, and import behave as documented.
7. No unnecessary permission appears in the installed app manifest.
8. The app functions identically with all optional network features disabled.
