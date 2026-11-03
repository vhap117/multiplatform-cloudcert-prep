# Issue 001: App scaffold, navigation skeleton, and theme tokens

## Context

There is no app yet. This issue creates the Ionic + Angular project, wires the
design tokens from `DESIGN.md` into Ionic CSS variables, and stands up the
four-tab shell with placeholder pages. Everything else builds on this skeleton.

Spec: `../ionic-requirements/DESIGN.md` (all of it),
`../ionic-requirements/README.md` (global constraints),
`../ionic-requirements/06-certifications-and-navigation.md` (tab layout only;
full navigation behaviour is issue 010).

Traces: `IONIC-4`, `IONIC-5`, `IONIC-13`, `IONIC-14`, `IONIC-15`, `IONIC-16`,
`CONT-31`, `CONT-35`, `CERT-9` to `CERT-12` (placeholders only), `ACC-15`,
`ACC-17`, `ACC-19`, `ACC-26`.

Depends on: nothing.
Blocks: every other issue.

## Tasks

- [x] Create the project: Ionic + Angular (standalone components). Capacitor
      dependencies may be installed, but no native platform is added. See the
      scope note in `000-index.md`. (`IONIC-4`, `CONT-31`)
- [x] Configure tooling: TypeScript strict mode, ESLint, and vitest (already
      the Angular 21 default) so `npm test` works from day one. (`CONT-42`)
- [x] Add a content and copy lint check that fails on em dashes and en dashes
      in `src/` and docs. (`IONIC-14`, `CONT-13`, `CONT-19`)
- [x] Map every colour token in `DESIGN.md` to Ionic CSS variables as RGB
      channel triplets, for both `theme-light` and `theme-dark`. (`IONIC-16`,
      `ACC-14`)
- [x] Add typography, spacing, radius, shadow, and motion tokens as CSS
      custom properties, exactly as specified in `DESIGN.md`. System font
      stack only; no web-font loading anywhere. (`IONIC-15`)
- [x] Implement theme service: respect the system preference on first launch,
      apply the theme class before first paint (no flash), and expose an
      explicit override hook that Settings will use later. (`ACC-15`,
      `ACC-16`, `ACC-17`)
- [x] Honour `prefers-reduced-motion`: when active, entrance animations
      collapse to plain fades. (`IONIC-16`, `ACC-21`, `ACC-22`)
- [x] Build the four-tab shell with placeholder pages: Home, Practice,
      History, Settings. (`CERT-9` to `CERT-12`, `DESIGN.md` layout section)
- [x] Apply safe-area insets on every shell surface so content never sits
      under the status bar, notch, or home indicator. (`IONIC-5`,
      `ACC-26`)
- [x] Set the baseline tap target at 44 px minimum and 90 ms press feedback
      using the `ease-press` curve. (`ACC-19`, `ACC-20`)
- [x] Add Lucide icons for the tab bar, with decorative icons hidden from
      assistive technology. (`DESIGN.md` icons)
- [x] Verify the build is self-contained: no SEO head, no sitemap, no
      `_headers`, no Cloudflare or Netlify config, no Supabase keys, no
      secrets in the repo. (`CONT-38`, `CONT-39`, `CONT-40`)

### Moved to issue 010

- [ ] Tablet sidebar. `DESIGN.md` asks for a bottom tab bar on phones and a
      sidebar on tablets. The bar currently spans all widths and the content
      column is already capped at 720 px. The responsive sidebar is navigation
      layout, which is exactly what issue 010 owns.

## Acceptance criteria

- [x] `ng serve` serves the app and the four tabs render in Chrome.
- [x] Toggling the system theme restyles the app without a flash of the wrong
      theme.
- [x] With reduced motion on, pressing and navigating shows no entrance
      animation.
- [x] `npm test` runs green.
- [x] The dash lint check fails a commit that adds an em dash or en dash.
- [x] `npx ng build` succeeds with no errors.

## Out of scope

- Real pages, routing guards, cert switching, and back behaviour (issue 010).
- Any storage or data layer (issue 002).
- Any question content or engine code (issues 003 and 004).

## Log

L1 (verbatim): "work on the first issue once finish let me know how are you
documenting the progress ?"

L2 (scope, earlier): development and verification target the web platform only
for now. No Capacitor platform, no SQLite adapter, no device checks.

L3 (correction, 2026-11-03): `ionic serve` could not run. The app was
Ionic in components but not an Ionic project: no `ionic.config.json`, and the
Angular project was named `cloudcertprep` while the Ionic CLI hardcodes
`app:serve` (Angular 21 no longer supports `defaultProject`, which the CLI used
to read). Fixed by running `ionic init` with type `angular-standalone` and
renaming the Angular project key to `app`, with `outputPath` pinned to
`dist/cloudcertprep` so artifacts stay where they were. No Capacitor platform
was added. The icon set stays `lucide-angular` rather than the scaffold's
`ionicons`.

### Evidence

| Moment | Result |
|---|---|
| Scaffold | `ng new` under Node 24.22.2, exit 0, 53 s |
| TDD RED | `ng test` exit 1, unresolved `ThemeService` and `MotionService` |
| TDD GREEN | 3 files, 15 tests passing |
| Final tests | 3 files, 14 tests passing (one placeholder test replaced) |
| Dash lint | `dash lint: clean` |
| Build | `ng build` exit 0, initial bundle 529.41 kB |
| Render check | headless Chrome: `ion-app`, `ion-tabs`, tab bar, 4 tab buttons, 4 Lucide SVGs, all labels |
| Route check | `/tabs/practice` renders practice content, tab bar stays, home content absent |
| Theme check | `--force-dark-mode` yields `class="theme-dark ..."` |
| Strict mode | `tsconfig.json` `"strict": true` |

### Decisions and findings

1. **Node 24 pin matters.** Angular 21 rejects the Node 26 line with an
   unsupported warning. Capsule: project tooling runs on Node 24.22.2 via
   `.nvmrc`; Pi itself stays on Node 26.
2. **Ionic 9 moved the standalone API to the package root.** The conventional
   `@ionic/angular/standalone` subpath does not exist in 9.0.10; the root
   `@ionic/angular` export is already the standalone surface. This cost one
   build cycle and is recorded so it is not rediscovered.
3. **Lucide's Angular component is not standalone.** It must be imported
   through `LucideAngularModule`. Confirmed by the compiler, not by guesswork.
4. **Spec inconsistency in DESIGN.md.** The colour table maps both `link`
   (`0 115 187` light, `68 156 214` dark) and `text-muted`
   (`84 91 100` light, `141 153 168` dark) to `--ion-color-medium`, which
   cannot hold two values. Resolution: `--ion-color-medium` carries
   `text-muted` because it is far more widely used, and `link` keeps its own
   `--ccp-link` token with a `.ccp-link` utility. Worth fixing in the spec
   before more surfaces depend on it.
5. **Bundle budget raised to 800 kB warning / 1.2 MB error.** The Ionic plus
   Angular plus Lucide initial bundle is 529 kB, which is normal for this
   stack but 29 kB over the Angular default. The budget is raised with intent,
   not removed, so future regressions still fail.
6. **ESLint must match the workspace major.** `ng add @angular-eslint/schematics`
   installs angular-eslint v22, which targets Angular 22 and refuses this
   workspace. The working command is `ng add angular-eslint@21`. Recorded so
   the next workspace does not repeat the two failed attempts.
7. **Verify is one command.** `npm run verify` chains the dash lint, ESLint,
   the vitest suite, and a production build. Issue 013 will add this to CI.
