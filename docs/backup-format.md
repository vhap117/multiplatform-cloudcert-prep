# CloudCertPrep backup format

The app exports study data as a single JSON file and restores it from the same
format. Export and import are fully local (DATA-24 to DATA-30, OFF-14 to OFF-20).

## File shape

```json
{
  "format": "cloudcertprep-backup",
  "schemaVersion": 1,
  "appVersion": "0.0.0",
  "exportedAt": 1730000000000,
  "settings": {
    "theme": "dark",
    "motion": "system",
    "selectedCert": "clf-c02",
    "lastTab": "home"
  },
  "attempts": [],
  "questionResults": [],
  "certProgress": [],
  "questionMastery": [],
  "sessions": []
}
```

| Field | Type | Meaning |
|---|---|---|
| `format` | string | Always `cloudcertprep-backup`. Identifies the file. |
| `schemaVersion` | number | Storage schema the rows were written with (DATA-11). |
| `appVersion` | string | Version of the app that produced the file. |
| `exportedAt` | number | Export time, milliseconds since the Unix epoch. |
| `settings` | object | Local preferences as string key/value pairs (DATA-22). |
| `attempts` | array | Completed attempts (DATA-16). |
| `questionResults` | array | One row per answered question, practice rows have `attemptId: null` (DATA-17, DATA-18). |
| `certProgress` | array | Per-domain aggregates (DATA-19). |
| `questionMastery` | array | Per-question mastery state (DATA-20). |
| `sessions` | array | In-progress session state for resume (DATA-21). |

The row shapes match the storage contract in
`src/app/core/storage/types.ts`. The format is stable across app versions that
share a schema version (OFF-16).

## What the file never contains

Only the fields above. There are no advertising identifiers, crash logs,
device identifiers, answers embedded in diagnostics, or telemetry (PRIV-22,
DATA-36). The app never keeps a copy of the backup off device (PRIV-21,
OFF-20); the student chooses where the file goes.

## Import rules

- **Structural problems reject the whole file, nothing is written:** invalid
  JSON, a missing or unexpected `format`, a missing `schemaVersion`, a
  `schemaVersion` other than the one this app reads, non-object settings, or a
  missing data section (DATA-27, DATA-29).
- **Row-level problems are quarantined:** a row that does not match its
  expected shape is counted and skipped, and the compatible subset imports. The
  confirmation shows how many rows will be skipped (DATA-23, OFF-31).
- **Unknown top-level fields are ignored**, so a file from a newer minor app
  version still imports its compatible parts (OFF-31).
- Import **replaces** local study data; it never merges two devices
  (DATA-28, OFF-19). The confirmation names exactly what will be overwritten.
- Settings are applied only for known preference names. Unknown setting names
  from a newer app version are ignored.

## Export when the database is partially corrupted

Export reads through the repository, which validates rows on read. A corrupted
row is skipped, so the export still produces a usable file with the valid
subset instead of failing entirely (OFF-30, DATA-23).
