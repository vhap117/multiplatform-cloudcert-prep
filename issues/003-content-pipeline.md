# Issue 003: Bundled content, cert registry, and validator

## Context

The question bank ships inside the app. No runtime fetch, ever. This issue
bundles the three cert banks, ports the cert registry as the single source of
truth for exam logistics, and ports the web question validator so a malformed
question fails the build.

Spec: `../ionic-requirements/09-content-and-app-build.md`,
`../ionic-requirements/cert-banks/EXAM-ENGINE.md` (schema and validation
checklist).

Traces: `IONIC-12`, `CONT-1` to `CONT-30`, `CONT-34`, `CONT-50`, `CERT-1`,
`CERT-3`, `CERT-4`, `CERT-5`.

Depends on: 001.
Blocks: 004, 005, 006, 007.

## Tasks

- [ ] Copy the banks from `../ionic-requirements/cert-banks/banks/` into the
      app as bundled assets: `clf-c02` (4 domains), `aif-c01` (5 domains),
      `saa-c03` (4 placeholder domains). (`CONT-1`, `IONIC-12`, `CERT-4`)
- [ ] Port `reference/certifications.ts` into the app as the cert registry:
      code, provider, level, name, short name, exam question count, exam time,
      passing score, domains with proportions, and status. (`CERT-1`,
      `CONT-25`)
- [ ] Verify each active cert's `examProportion` values sum to 1.0. Add a
      unit test that fails the build otherwise. (EXAM-ENGINE.md registry
      rules)
- [ ] Implement the domain loader map with lazy, code-split imports per cert
      and domain. Each loaded question is stamped with its `domainId`. Cache
      loaded domains in memory for the session. (`CONT-26`, EXAM-ENGINE.md
      loading section)
- [ ] Confirm adding a cert requires exactly three changes: a registry entry,
      bundled domain files, and a loader entry. No database or scoring change.
      Prove it with a test-only fixture cert. (`CERT-5`, `CONT-27`, `CONT-28`)
- [ ] Mark `saa-c03` as coming soon: visible in the cert list as coming soon,
      never opening a broken flow. (`CERT-2`, `CONT-29`, `CERT-30`)
- [ ] Port `reference/validate-questions.mjs` into the app pipeline. It checks
      the full schema: required fields, unique ids per cert, option keys A to
      E, single and multi answer shapes, ordering permutations, matching
      pairings, explanation object coverage, non-empty `note`, no HTML or
      Markdown, no em or en dashes, no missing space after a period, no
      leading or trailing whitespace. (`CONT-16` to `CONT-24`)
- [ ] Wire the validator into `npm test` and the build so it runs offline and
      fails the build on any error. (`CONT-17`, `CONT-24`, `CONT-50`)
- [ ] Add a bundled content version per cert, updated when its bank changes,
      and expose it for the Settings screen. (`CONT-30`, `CONT-36`)
- [ ] Keep `type` optional and infer it from `isMultiAnswer` when absent, for
      backward compatibility. Allow optional `taskStatement`, `lastVerified`,
      and `services` fields. (`CONT-14`, `CONT-15`)

## Acceptance criteria

- `npm run build` fails when a question in a test fixture violates any
      validator rule, and passes on the three real banks.
- The app renders question content with zero network requests (verify with
      devtools offline mode).
- The registry is the only place that knows exam counts, times, passing
      scores, and domain proportions; a grep shows feature code importing it
      rather than hardcoding values.
- The coming-soon cert shows a coming-soon state and its start actions are
      inert but not broken.

## Out of scope

- Any exam, practice, or study UI that consumes the bank (issues 005 to 007).
- Optional remote content updates (`PRIV-26` to `PRIV-28`, `OFF-7` to
      `OFF-9`). Not planned; the bundled bank is the product.
