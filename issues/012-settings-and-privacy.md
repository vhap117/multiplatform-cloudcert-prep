# Issue 012: Settings screen and privacy statement

## Context

Settings is the one place where the student controls how the app behaves and
sees what the app does with their data. The core promise to surface here: all
data stays on the device, nothing is uploaded, and deleting the app deletes
the data.

Spec: `../ionic-requirements/07-privacy-and-telemetry.md` (all of it, with the
permission and privacy rows PRIV-14 to PRIV-34) and the device protection rows
in `../ionic-requirements/01-local-data-and-device.md` (DATA-33 to DATA-35).

Traces: `PRIV-14` to `PRIV-34`, `DATA-22`, `DATA-33` to `DATA-35`,
`ACC-16`, `IONIC-16`.

Depends on: 001 (theme service), 002 (settings store).
Blocks: 013 (Settings is part of the hardening pass).

## Tasks

- [ ] Build the Settings screen: theme choice, reduced-motion override, data
      management (backup export, import, reset from issue 011), app info, and
      the privacy statement. (`CERT-12`)
- [ ] Theme control: system default, light, or dark, persisted in the local
      settings store; explicit choice overrides the system preference.
      (`ACC-16`, `DATA-22`)
- [ ] Reduced-motion control: in-app override mirroring the system
      preference, persisted the same way. (`IONIC-16`, `ACC-21`)
- [ ] App info: app version, content version, and database schema version,
      all visible in Settings. (`CONT-36`, `CONT-37`, `PROG-15`)
- [ ] Privacy statement, reachable from Settings, stating that all data stays
      on the device, nothing is uploaded, and deleting the app deletes the
      data; pointing at the backup export as the way to keep data across
      reinstalls. (`PRIV-29`, `PRIV-30`)
- [ ] No cookie consent banner, no cloud backup claim, no sync claim, no
      account recovery claim, and no server-side community statistics
      anywhere. (`PRIV-31` to `PRIV-33`)
- [ ] Permission hygiene: declare only permissions the app uses; no camera,
      microphone, contacts, location, or storage-wide access; access only the
      app's private data directory through the repository adapter. Verify the
      installed manifest. (`PRIV-14` to `PRIV-16`)
- [ ] Share and clipboard rules: the share sheet opens only on an explicit
      tap; the app never reads the clipboard automatically; copy actions only
      on explicit tap. (`PRIV-17`, `PRIV-18`)
- [ ] Optional device lock: if offered, a biometric or passcode gate that is
      purely local, is not an account identity, never creates a remote
      profile, and falls back cleanly to no-lock when unavailable without
      corrupting data. (`DATA-33` to `DATA-35`)
- [ ] Optional diagnostics: off by default, exportable by the student for
      inspection and deletion, excluding answers, question text, and study
      content by default. If skipped, do not ship any diagnostic capture.
      (`PRIV-9`, `PRIV-10`)
- [ ] Log hygiene: error logs are trimmed and contain no PII, answers, or
      per-question data; study content never reaches the system console or
      crash output. (`PRIV-11`, `PRIV-12`, `DATA-36`)
- [ ] Copy rules across the screen: US English, no em dashes or en dashes,
      both themes, accessible. (`PRIV-34`)

## Acceptance criteria

- Settings shows all three version numbers and they match the build's actual
      versions.
- Choosing dark, light, and system each persists across app restarts, with
      system following the device preference live.
- The installed Android manifest declares no camera,
      microphone, contacts, location, or storage-wide permission.
- A code grep shows no clipboard read API and no telemetry or analytics SDK
      import anywhere in the app.
- The privacy statement is reachable offline from Settings and makes all four
      promises from PRIV-29 to PRIV-32.
- If the optional lock is implemented: disabling or failing biometrics
      leaves the app usable with study data intact.

## Out of scope

- Content updates and reminders (`PRIV-26` to `PRIV-28`, `PRIV-20`):
      explicitly not planned; the app ships the bundled bank only.
- Crash-reporting SDKs (`PRIV-13`): only ever opt-in, and there is no plan to
      add one.
