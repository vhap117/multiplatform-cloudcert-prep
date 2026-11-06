# Issue 010: Navigation shell, cert switching, and back behaviour

## Context

The skeleton from issue 001 becomes the real navigation model: tabs, pushed
stacks, modals, the cert switcher, and platform back semantics. URLs and SEO
routing are gone; Ionic primitives own navigation.

Spec: `../ionic-requirements/06-certifications-and-navigation.md` (all of it,
replacing the placeholder tabs from issue 001).

Traces: `CERT-1` to `CERT-36`, `ACC-31`, `ACC-32`.

Depends on: 001, 005, 006, 007, 008 (the leave guards and the dashboard
surface).
Blocks: 013 (navigation is part of the hardening pass).

## Tasks

- [x] Wire the four tabs from issue 001 to real pages: Home tab shows the
      cert dashboard, Practice lists mock exam, domain practice, and study
      exam entry points, History shows history and statistics, Settings holds
      theme, motion, backup, reset, and app info. (`CERT-9` to `CERT-12`)
- [x] Cert switcher in the app header or cert home screen, showing all certs:
      active ones as destinations, coming-soon ones visible as coming soon
      with no broken flow. (`CERT-2`, `CERT-6`)
- [x] Switcher hides or simplifies when only one cert is active. (`CERT-7`)
- [x] Selected cert persists in settings and defaults to a valid active cert;
      switching updates dashboard, practice configuration, history scope, and
      mastery view without deleting any cert's data. (`CERT-19`, `CERT-21`,
      `CERT-22`)
- [x] Practice screen lists the active cert's three entry points and shows
      the last in-progress session with a Resume action. A Browse
      certifications or All certs entry opens the cert list. (`CERT-25`,
      `CERT-26`, `CERT-29`)
- [x] Switching certs during an active mock exam or practice session routes
      through the issue 005 or 007 leave guard. Starting a session while
      another cert has one in progress never silently replaces it. (`CERT-8`,
      `CERT-23`)
- [x] Pushed screens show a clear back affordance. In-app back pops one level
      in the stack and closes an open modal first. The Android hardware back
      handler is deferred to the native phase; the navigation service must
      expose one back entry point so the native handler can call it without
      touching screen code. (`CERT-15` to `CERT-17`, `ACC-31`)
- [x] Preserve the selected tab and cert across app restarts. (`CERT-14`)
- [x] Cold start restores the last screen or a safe home screen; restoring
      directly into a timed exam requires a resume confirmation first.
      (`CERT-32`)
- [x] Screen titles and the app title are accessible to assistive technology;
      the status bar and navigation bar stay readable in both themes.
      (`CERT-34`, `CERT-35`, `ACC-18`)
- [x] No login, account, profile, or sign-out entry anywhere in the
      navigation. (`CERT-27`, `CERT-28`)
- [x] Empty state for a cert with no available questions instead of a broken
      start button. (`CERT-30`)
- [x] No reliance on browser history or a URL bar anywhere; Ionic navigation
      primitives only. (`CERT-13`, `CERT-33`)

## Acceptance criteria

- Switching certs updates every cert-scoped surface and leaves the previous
      cert's data intact (verified against a fixture with two certs' worth of
      history).
- In-app back during a mock exam opens the leave modal; closing the modal
      then pressing back pops the screen.
- Force close on the Practice tab: reopening lands on the Practice tab with
      the same cert selected, and a timed exam requires a resume confirmation
      before showing.
- A coming-soon cert renders a coming-soon state with no tappable flow that
      leads anywhere broken.
- A screen reader announces every screen change and title.

## Out of scope

- Deep links are optional and deferred; if implemented they must never be
      required for normal use. (`CERT-24`)
- Backup, reset, theme, and motion controls (issues 011 and 012); this issue
      only routes to their placeholder screens.
