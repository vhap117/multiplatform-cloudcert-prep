# Issue 011: Backup export, import, and reset integration

## Context

The device is the source of truth, so the backup file is the student's only
bridge to a new phone and the only protection against accidental data loss.
Export, import, and the destructive reset and delete-all actions all live
here, fully offline.

Spec: `../ionic-requirements/01-local-data-and-device.md` (backup and restore
rows DATA-24 to DATA-32), `../ionic-requirements/11-offline-capabilities.md`
(device-to-device rows OFF-14 to OFF-20), and
`../ionic-requirements/07-privacy-and-telemetry.md` (backup privacy rows
PRIV-21 to PRIV-25).

Traces: `DATA-24` to `DATA-32`, `DATA-9D`, `IONIC-8`, `OFF-14` to `OFF-20`,
`PRIV-21` to `PRIV-25`, `CONT-49`, `CERT-36`.

Depends on: 002 (repository and schema).
Blocks: 013 (export and import are in the hardening pass).

## Tasks

- [ ] Export action writes one backup file containing schema version, export
      timestamp, app version, settings, attempts, question results, domain
      progress, per-question mastery, and any in-progress sessions. The format
      is human-readable JSON or a documented archive containing JSON.
      (`DATA-24`, `DATA-25`)
- [ ] Define a backup transport interface with two responsibilities: write a
      backup file and read a backup file. The web implementation downloads a
      file and reads one through a file input. The native implementation, when
      it arrives, uses the Capacitor Filesystem and Share plugins behind the
      same interface. No screen may call a download API or a Capacitor plugin
      directly. (`DATA-26`, `CERT-36`, `PRIV-19`, `IONIC-20`)
- [ ] Degrade gracefully when the transport is unavailable: if a write or read
      cannot start, surface a clear local error instead of failing silently.
      (`PRIV-19`)
- [ ] Import validates schema version and contents before touching anything;
      an incompatible version or malformed file is rejected with the existing
      database untouched. (`DATA-27`, `DATA-29`)
- [ ] Import replaces local data only after an explicit confirmation that
      names what will be replaced; it never silently merges two devices'
      data. (`DATA-28`, `OFF-19`)
- [ ] Restore rebuilds history, dashboard, mastery, and in-progress session
      state with no network request, including the resume card on the next
      launch. (`DATA-30`, `OFF-17`)
- [ ] Browser and native adapters interoperate: a backup exported from
      IndexedDB imports into SQLite and the reverse, subject to schema
      compatibility. Prove it with a round-trip contract test. (`DATA-9D`,
      `CONT-49`)
- [ ] Import tolerates and reports unknown rows from a newer minor version
      while importing the compatible subset, if implemented. Optional.
      (`OFF-31`)
- [ ] Export works even when the database is partially corrupted, by
      exporting the raw file or the valid subset so data can still be
      recovered. Optional. (`OFF-30`)
- [ ] Implement per-cert reset and delete-all local data in Settings under
      Data, both gated by explicit destructive confirmations that name the
      scope. Neither removes the bundled question bank or the app itself.
      (`DATA-31`, `DATA-32`, `PROG-29` to `PROG-34`)
- [ ] Privacy guarantees: the backup contains no advertising identifiers,
      crash logs, or device identifiers beyond schema and app versions; the
      app never stores a copy of the backup off device; import never triggers
      a network request; imported data is treated as the student's own local
      data. (`PRIV-22` to `PRIV-24`, `OFF-20`, `PRIV-21`)
- [ ] The Settings screen warns plainly that clearing app data or uninstalling
      deletes study data and points to the backup export. (`OFF-29`,
      `PRIV-30`)

## Acceptance criteria

- Export from one browser profile, wipe, import into a fresh profile:
      history, mastery, settings, and an in-progress study exam all match after
      restore. Repeat the same round trip once the SQLite adapter lands.
- Importing a malformed file or a newer incompatible schema version leaves
      the existing database byte-for-byte unchanged and shows a clear error.
- The replace confirmation names exactly what will be overwritten before any
      write happens.
- Reset for one cert leaves other certs intact; delete-all empties study data
      but the app and the question bank keep working offline.
- The entire export and import flow completes with the browser offline.

## Out of scope

- Any automatic cloud backup or sync claim. Explicitly rejected by `OFF-18`
      and `PRIV-32`; the app must state this in Settings.
- The optional diagnostic export (`PRIV-9`, `PRIV-10`), deferred to issue 012
      if pursued at all.
