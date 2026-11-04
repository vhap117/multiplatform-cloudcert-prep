# CloudCertPrep Ionic requirements

This folder is the requirements set for a personal, offline-first Ionic
application derived from the existing CloudCertPrep web app.

The target product is a single-user study app for one phone. It has no login, no
account, no server runtime, no community features, and no web SEO surface. The
student opens the app, studies when they have a moment, and closes it without
losing progress.

The web requirements in `../requirements/` remain the reference for the learning
behaviour: question formats, scoring, domain practice, study exams, progress,
accessibility, and content rules. This folder adapts those requirements to an
Ionic and Capacitor application whose data lives on the device.

## Topic index

| File | Topic | Scope |
|---|---|---|
| [01-local-data-and-device.md](./01-local-data-and-device.md) | Local data and device identity | Single-user model, local storage, migrations, backup and restore, app lock, no accounts |
| [02-mock-exam.md](./02-mock-exam.md) | Mock exam | Timed exam, scoring, results, local persistence, resume and lifecycle |
| [03-practice-by-subject.md](./03-practice-by-subject.md) | Practice by subject | Domain practice, instant feedback, local save, mobile navigation |
| [04-spaced-repetition.md](./04-spaced-repetition.md) | Spaced repetition and mastery | Local per-question history, weighted selection, mastery, next domain |
| [05-progress-and-history.md](./05-progress-and-history.md) | Progress and history | Local dashboard, history, attempt review, reset, local statistics |
| [06-certifications-and-navigation.md](./06-certifications-and-navigation.md) | Certifications and navigation | Bundled cert registry, tabs, cert switching, Android back behaviour, deep links |
| [07-privacy-and-telemetry.md](./07-privacy-and-telemetry.md) | Privacy and telemetry | No PII, no default analytics, local diagnostics, network policy, backup export |
| [08-accessibility-and-resilience.md](./08-accessibility-and-resilience.md) | Accessibility and resilience | Mobile accessibility, touch targets, safe areas, themes, lifecycle, storage failures |
| [09-content-and-app-build.md](./09-content-and-app-build.md) | Content and app build | Question schema, validation, bundled assets, Capacitor build, versioning |
| [10-study-exams.md](./10-study-exams.md) | Study exams | Untimed study mode, per-option feedback, three progress bars, save and resume |
| [11-offline-capabilities.md](./11-offline-capabilities.md) | Offline capabilities | What works with no network, optional updates, import and export, single-user boundaries |
| [DESIGN.md](./DESIGN.md) | Design reference | Visual language, colour and motion tokens, typography, component mapping, themes, accessibility |
| [cert-banks/EXAM-ENGINE.md](./cert-banks/EXAM-ENGINE.md) | Exam engine and banks | Exam creation, question schema, scoring, study exams, local persistence, Angular and Ionic porting guide, plus all cert banks and reference source |

## Relationship to the web requirements

| Web topic | Ionic topic | Change |
|---|---|---|
| Authentication and accounts | Local data and device identity | Accounts, OAuth, email, Turnstile, and Supabase Auth are removed. The device is the identity. |
| Mock exam | Mock exam | Same exam behaviour, now saved locally and restored after app lifecycle events. |
| Practice by subject | Practice by subject | Same practice behaviour, now local and offline. |
| Spaced repetition and mastery | Spaced repetition and mastery | Same weighted selection model, now driven by local history. |
| Progress and history | Progress and history | Server tables become local tables. Community stats are removed. |
| Certifications and navigation | Certifications and navigation | URLs and SEO routing become Ionic tabs, stacks, and optional deep links. |
| Analytics and privacy | Privacy and telemetry | No analytics by default, no cookies, no consent gate. Data stays on device. |
| Accessibility and resilience | Accessibility and resilience | Web WCAG checks become mobile accessibility and app lifecycle requirements. |
| Content, SEO, and build | Content and app build | SEO, Lighthouse, CSP, and Cloudflare are removed. Bundled data, validation, and Capacitor builds remain. |
| Study exams | Study exams | Same study mode, local-only, with guest adoption removed. |
| Guest features | Offline capabilities | There is no guest or account distinction. Every feature is single-user and offline. |

## Global constraints

| ID | Constraint |
|---|---|
| IONIC-1 | The app SHALL be single-user. There SHALL be no login, registration, account, password, email, OAuth, or server-side identity. |
| IONIC-2 | The app SHALL work fully offline after installation. Core study flows SHALL NOT require a network connection. |
| IONIC-3 | All student data SHALL be stored on the device. No student data SHALL be sent to a server by default. |
| IONIC-4 | The app SHALL be built with Ionic and Capacitor and SHALL ship as a native mobile application, not a website. |
| IONIC-5 | The app SHALL be mobile first: touch targets, safe areas, system bars, keyboard behaviour, and platform back navigation SHALL be designed for phones. |
| IONIC-6 | The app SHALL use a platform-adaptive local store behind one repository interface: Capacitor SQLite on native devices and IndexedDB in the browser during `ionic serve` development and testing. Browser localStorage SHALL NOT be the primary store for attempts, answers, mastery, or active sessions. |
| IONIC-7 | Data SHALL survive app backgrounding, force close, device restart, and ordinary app upgrades. |
| IONIC-8 | The app SHALL provide a local export and import path so the student can back up and restore their data. |
| IONIC-9 | The app SHALL not require a network permission for core study. Any network use SHALL be explicit and optional. |
| IONIC-10 | The app SHALL collect no PII. There is no account identity beyond a locally chosen display name if one is offered. |
| IONIC-11 | No third-party analytics, advertising, tracking, or crash reporting SDK SHALL be enabled by default. |
| IONIC-12 | The question bank SHALL be bundled with the app, not fetched from a remote API at runtime. |
| IONIC-13 | The app SHALL use US English spelling in UI copy and content. |
| IONIC-14 | There SHALL be no em dashes or en dashes in code, content, docs, or UI copy. |
| IONIC-15 | System fonts only. No web-font loading. |
| IONIC-16 | The app SHALL respect reduced motion and the device light or dark preference, with an explicit in-app override. |
| IONIC-17 | The app SHALL meet mobile accessibility expectations: screen reader labels, focus order, contrast, and scalable text. |
| IONIC-18 | The app SHALL be local-first. Any future sync or multi-device feature SHALL be an explicit opt-in addition, not a hidden dependency. |
| IONIC-19 | The native Capacitor SQLite adapter and the web IndexedDB adapter SHALL implement the same repository contract and SHALL share the same schema and migrations. |
| IONIC-20 | Feature code SHALL NOT call Capacitor SQLite directly. It SHALL use the repository interface so the same flows run on a device and in `ionic serve`. |

## Non-goals

- User accounts, profiles, authentication, or cloud identity.
- Server-side persistence, RLS, Supabase, or any backend database.
- Community statistics, leaderboards, or social features.
- Web SEO, sitemaps, canonical tags, structured data for search, or Lighthouse web scores.
- Cookies, consent banners, or advertising.
- Email verification, password reset, account deletion, or data export from a server.
- A web deployment of the Ionic app as the primary product.

## Primary user journeys

1. Open the app, see the active cert and a resume card for an unfinished session.
2. Start an untimed study exam, answer questions, see per-option feedback, and
   close the app. Reopen it later and continue from the exact same state.
3. Start a timed mock exam, finish it, see the score and per-domain results, and
   find it later in history.
4. Practice one domain, get instant feedback, and see mastery change.
5. Review local progress, reset a cert, or export a backup file.
6. Use the entire app in airplane mode without an error or a blank screen.

## Data ownership model

The device is the source of truth. There is one local student profile. The app
stores attempts, answers, per-question history, session state, and settings in a
local database. The app may keep a separate small key-value store for preferences
and a file-based export for backup.

There is no concept of a guest or a signed-in user. A "new install" is simply an
empty local database. A "restore" is an explicit import. This removes the entire
account lifecycle and the web app's cross-account contamination risks.

## Terminology: exams, attempts, and practice

- **certCode** is the certification identifier from the bundled registry, for
  example `clf-c02` or `aif-c01`. Dashboard exam metrics are scoped to the
  selected certCode.
- **Certification exam** is a full-length assessment of a certification,
  delivered only as a timed mock exam or an untimed study exam. A completed
  exam produces exactly one exam attempt.
- **Exam attempt** is a completed mock exam or study exam. Exam attempts are
  the only records used for pass rate, average score, best score, and the
  recent exam attempts list.
- **Practice session** is a short adaptive drill scoped to one exam domain. It
  is not an exam and does not create an exam attempt. Practice data feeds
  domain coverage, mastery, and the Next up recommendation only.

Implementation note: a completed mock exam, study exam, or practice session is
persisted as one `AttemptRow` whose `kind` is `mock`, `study`, or `practice`.
An exam attempt is an `AttemptRow` filtered to `mock` or `study`; a practice
session is an `AttemptRow` with `kind: 'practice'`. Practice sessions keep their
per-domain scores in that row, so the dashboard can derive practice domain
strength without a separate table or schema change.

## Migration position

The web app's question bank and scoring rules are the starting point. The Ionic
app should reuse:

- the question JSON schema, with its explanation object and note,
- the answer formats and all-or-nothing grading,
- percentage scoring and per-domain scores,
- the domain mastery definition,
- the study-exam progress bars and feedback rules,
- the accessibility and copy constraints.

The Ionic app should replace:

- Supabase Auth and every account flow with local storage,
- server tables with local tables,
- history and dashboard reads with local queries,
- analytics and consent with no analytics by default,
- Astro routes and SEO with Ionic navigation,
- build and deploy guards with app build, data validation, and device testing.

## Verification expectations

A change to the Ionic app should be verified with:

1. A clean install on the target phone.
2. Airplane-mode use for every core flow.
3. App background, force close, and reopen during an active session.
4. A restart of the phone with an in-progress session.
5. Export, wipe, and import of a backup.
6. Screen reader pass and large-text pass.
7. Light and dark theme pass.
8. Android hardware back and iOS swipe or back behaviour where applicable.
9. A check that no network request is required to study.
10. A check that a failed local write is visible and recoverable.
