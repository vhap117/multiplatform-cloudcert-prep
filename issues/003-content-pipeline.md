# Issue 003: Bundled content, cert registry, and validator

## Context

The question bank ships inside the app. No runtime fetch, ever. This issue
bundles the three cert banks, ports the cert registry as the single source of
truth for exam logistics, and ports the web question validator so a malformed
question fails the same pipeline that fails a broken build.

Spec: `../ionic-requirements/09-content-and-app-build.md`,
`../ionic-requirements/cert-banks/EXAM-ENGINE.md` (schema and validation
checklist).

Traces: `IONIC-12`, `CONT-1` to `CONT-30`, `CONT-34`, `CONT-50`, `CERT-1`,
`CERT-3`, `CERT-4`, `CERT-5`.

Depends on: 001.
Blocks: 004, 005, 006, 007.

## Tasks

- [x] Copy the banks from `../ionic-requirements/cert-banks/banks/` into the
      app as bundled assets: `clf-c02` (4 domains, 1,050 questions), `aif-c01`
      (5 domains, 419 questions), `saa-c03` (4 placeholder domains, 20
      questions). (`CONT-1`, `IONIC-12`, `CERT-4`)
- [x] Port `reference/certifications.ts` into the app as the cert registry:
      code, provider, level, name, short name, exam question count, exam time,
      passing score, domains with proportions, status, and task statements.
      (`CERT-1`, `CONT-25`)
- [x] Verify each active cert's `examProportion` values sum to 1.0. Add a
      unit test that fails the build otherwise. (EXAM-ENGINE.md registry
      rules)
- [x] Implement the domain loader map with lazy, code-split imports per cert
      and domain. Each loaded question is stamped with its `domainId`. Cache
      loaded domains in memory for the session. (`CONT-26`, EXAM-ENGINE.md
      loading section)
- [x] Confirm adding a cert requires exactly three changes: a registry entry,
      bundled domain files, and a loader entry. `validateLoaderCoverage`
      asserts both directions, so a missing loader or an orphan loader fails
      the build. (`CERT-5`, `CONT-27`, `CONT-28`)
- [x] Mark `saa-c03` as coming soon: visible in the cert list as coming soon,
      never opening a broken flow. (`CERT-2`, `CONT-29`, `CERT-30`)
- [x] Port the question validator into the app pipeline. It checks the full
      schema: required fields, unique ids per cert, option keys A to E, single
      and multi answer shapes, ordering permutations, matching pairings,
      explanation object coverage, non-empty `note`, no HTML or Markdown, no em
      or en dashes, no missing space after a period, no leading or trailing
      whitespace. (`CONT-16` to `CONT-24`)
- [x] Wire the validator into `npm test` and the build. The gate is
      `banks.spec.ts`, which validates the real bundled banks rather than
      fixtures, so it runs in the normal test command. (`CONT-17`, `CONT-24`,
      `CONT-50`)
- [x] Add a bundled content version per cert, updated when its bank changes,
      and expose it for the Settings screen. (`CONT-30`, `CONT-36`)
- [x] Keep `type` optional and infer it from `isMultiAnswer` when absent, for
      backward compatibility. Allow optional `taskStatement`, `lastVerified`,
      and `services` fields. (`CONT-14`, `CONT-15`)

## Acceptance criteria

- [x] The content gate fails on any validator error and passes on the three
      real banks.
- [x] The app renders question content with zero network requests: the bank is
      imported, not fetched, and the storage boundary lint forbids `fetch`.
- [x] The registry is the only place that knows exam counts, times, passing
      scores, and domain proportions; `cert-registry.spec.ts` asserts the
      invariants and the loader coverage test ties the registry to the files.
- [x] The coming-soon cert reports `isActiveCert === false` and exposes no
      content version, so no flow can open against it.

## Out of scope

- Any exam, practice, or study UI that consumes the bank (issues 005 to 007).
- Optional remote content updates (`PRIV-26` to `PRIV-28`, `OFF-7` to
  `OFF-9`). Not planned; the bundled bank is the product.

## Log

L1 (verbatim): "proceed with issue 3, if you need to delete files or folders
from /tmp feel free to do so"

### Evidence

| Moment | Result |
|---|---|
| TDD RED | `ng test` failed: cannot resolve `./cert-registry`, `./content-versions`, `./question-loader`, `./validate-question` |
| TDD GREEN | first run caught 10 real content errors in aif-c01, which the validator fix resolved |
| Final tests | 10 files, 104 tests passing |
| ESLint | "All files pass linting" |
| Dash lint | clean |
| Bank drift | clean, 13 files, 2 certs |
| Build | exit 0, initial total 529.41 kB, unchanged from issue 001 |
| Lazy-load probe | importing the loader produced a separate chunk containing bank text while the initial bundle stayed at 529.41 kB, then the probe was removed |
| Drift negative test | tampering one bundled file produced `content differs from the reference`, exit 1 |

### Decisions and findings

1. **The reference `types.ts` is stale.** It declares `explanation: string`,
   while all 1,489 bundled questions use an object with `summary` and an
   `options` map, matching CONT-9. The banks and the requirements agree; the
   reference type does not. The question schema here follows the banks. Worth
   fixing in the reference so the next port does not copy the wrong shape.
2. **CONT-7 and CONT-8 do not match the shipped bank.** Both say ordering and
   matching questions carry "an unused empty `answer`", and EXAM-ENGINE.md
   shows `"answer": ""`. The bank omits the field entirely on all ten such
   questions. The validator accepts absent, `''`, and `[]`, and rejects any
   populated value, which matches the rule's intent without editing validated
   upstream content.
3. **The "missing space after a period" rule needed calibration, not blind
   implementation.** The naive pattern produced 8 false positives in the real
   bank (URLs, `Node.js`, `.NET`). The shipped rule only flags a period
   followed by a capital letter after a word of two or more letters, which
   yields 0 hits on real content and still catches "ends.Next". It is a
   warning, not an error, because it is heuristic by nature.
4. **The registry is generated from the reference, not retyped.** A script
   extracted codes, domains, proportions, and all 33 task statements, then
   emitted the TypeScript. Two hand-transcription errors were possible in 190
   lines; the generator made them impossible. Verified afterwards: the banks
   use 14 AIF-C01 task statements and 2 CLF-C02 ones, all present in the
   registry.
5. **Bank drift is a build failure, not a hope.** `scripts/check-bank-drift.mjs`
   hashes the 13 JSON files against the reference copy and recomputes content
   versions from the freshest `lastVerified` per cert. It was verified by
   tampering with one file and watching it fail.
6. **SAA-C03 claims no content version, on purpose.** Its 20-question
   placeholder carries no `lastVerified` date, so `CONTENT_VERSIONS` has no
   entry and `contentVersionFor` returns null. Inventing a date would assert a
   freshness that does not exist; the Settings screen must render "not yet
   published" instead.
7. **The banks are not in the app bundle yet, and that is correct.** Nothing in
   the app imports the loader, so the bundler tree-shakes it. A temporary probe
   proved that once something imports it, the bank lands in its own lazy chunk
   and the initial bundle does not grow. Features in issues 005 to 007 are what
   pull it in.
8. **My own dash lint fired on my validator.** The entity alternatives
   (`&mdash;`, `&ndash;`) appeared as literal text inside the detection regex.
   The rule was right, so the code changed: the pattern is now a group,
   `&(?:mdash|ndash);`, which contains no literal forbidden sequence. The check
   still catches both entities, re-verified.
