# Issue 001: App scaffold, navigation skeleton, and theme tokens

## Context

There is no app yet. This issue creates the Ionic + Angular + Capacitor
project, wires the design tokens from `DESIGN.md` into Ionic CSS variables, and
stands up the four-tab shell with placeholder pages. Everything else builds on
this skeleton.

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

- [ ] Create the project: Ionic + Angular (standalone components) + Capacitor,
      with the Android platform added. iOS is deferred (see the platform scope
      note in `000-index.md`). (`IONIC-4`, `CONT-31`)
- [ ] Configure tooling: TypeScript strict mode, ESLint, and a unit test
      runner for pure functions so `npm test` works from day one. (`CONT-42`)
- [ ] Add a content and copy lint check that fails on em dashes and en dashes
      in `src/` and docs. (`IONIC-14`, `CONT-13`, `CONT-19`)
- [ ] Map every colour token in `DESIGN.md` to Ionic CSS variables as RGB
      channel triplets, for both `theme-light` and `theme-dark`. (`IONIC-16`,
      `ACC-14`)
- [ ] Add typography, spacing, radius, shadow, and motion tokens as CSS
      custom properties, exactly as specified in `DESIGN.md`. System font
      stack only; no web-font loading anywhere. (`IONIC-15`)
- [ ] Implement theme service: respect the system preference on first launch,
      apply the theme class before first paint (no flash), and expose an
      explicit override hook that Settings will use later. (`ACC-15`,
      `ACC-16`, `ACC-17`)
- [ ] Honour `prefers-reduced-motion`: when active, entrance animations
      collapse to plain fades. (`IONIC-16`, `ACC-21`, `ACC-22`)
- [ ] Build the four-tab shell with placeholder pages: Home, Practice,
      History, Settings. Phone layout uses the fixed bottom tab bar; tablet
      width switches to a sidebar and centres content at 720 px. (`CERT-9` to
      `CERT-12`, `DESIGN.md` layout section)
- [ ] Apply safe-area insets on every shell surface so content never sits
      under the status bar, notch, or home indicator. (`IONIC-5`, `ACC-26`)
- [ ] Set the baseline tap target at 44 px minimum and 90 ms press feedback
      using the `ease-press` curve. (`ACC-19`, `ACC-20`)
- [ ] Add Lucide icons, mapped through the Ionic icon component, with
      decorative icons hidden from assistive technology. (`DESIGN.md` icons)
- [ ] Verify the build is self-contained: no SEO head, no sitemap, no
      `_headers`, no Cloudflare or Netlify config, no Supabase keys, no
      secrets in the repo. (`CONT-38`, `CONT-39`, `CONT-40`)

## Acceptance criteria

- `ionic serve` starts the app in a browser and the four tabs render with
  placeholder content in both light and dark themes.
- Toggling the system theme restyles the app without a flash of the wrong
  theme.
- With reduced motion on, pressing and navigating shows no entrance animation.
- `npm test` runs green (even if it only covers the theme service).
- The dash lint check fails a commit that adds an em dash or en dash.
- `npx cap sync android` completes.

## Out of scope

- Real pages, routing guards, cert switching, and back behaviour (issue 010).
- Any storage or data layer (issue 002).
- Any question content or engine code (issues 003 and 004).
