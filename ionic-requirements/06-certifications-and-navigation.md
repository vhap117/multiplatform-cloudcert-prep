# Certifications and navigation

Scope: the bundled certification registry and the mobile navigation model. URLs,
SEO routing, and web headers are replaced by Ionic tabs, stacks, hardware back
handling, and optional deep links.

## Certification registry

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| CERT-1 | The cert registry SHALL be bundled in the app and SHALL be the single source of truth for cert code, provider, level, name, short name, exam count, exam time, passing score, domains, and status. | Required | `09-content-and-app-build.md` |
| CERT-2 | Only active certs SHALL appear as practice destinations. Coming-soon certs SHALL be visible as coming soon and SHALL NOT open a broken flow. | Required | Web `CERT-2`, `CERT-8` |
| CERT-3 | The app SHALL support any number of domains per cert without code changes to scoring, dashboard, or history. | Required | Web `CERT-4` |
| CERT-4 | The app SHALL include CLF-C02 and AIF-C01 as active certs. SAA-C03 SHALL be coming soon until its bank is complete. | Required | Web `CERT-6` |
| CERT-5 | Adding a cert SHALL require a registry entry, bundled question files, and a loader entry. It SHALL NOT require a database or server change. | Required | Web `CERT-5` |
| CERT-6 | The cert switcher SHALL be available from the app header or the cert home screen. | Required | This document |
| CERT-7 | The cert switcher SHALL be hidden or simplified when only one cert is active. | Required | Web `CERT-7` |
| CERT-8 | Selecting a cert during an active mock exam or practice session SHALL route through the leave guard. | Required | Web `CERT-20` |

## Navigation model

Use a small, predictable mobile navigation structure. The exact labels may change,
but the destinations SHALL exist.

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| CERT-9 | The app SHALL provide a Home or Study tab that shows the selected cert dashboard. | Required | This document |
| CERT-10 | The app SHALL provide a Practice tab or screen that exposes mock exam, domain practice, and study exam entry points. | Required | This document |
| CERT-11 | The app SHALL provide a History or Progress tab that shows local history and local statistics. | Required | `05-progress-and-history.md` |
| CERT-12 | The app SHALL provide a Settings tab or screen for theme, reduced motion, backup export, import, reset, and app information. | Required | `01-local-data-and-device.md` |
| CERT-13 | The app SHALL use Ionic navigation primitives such as tabs, stack navigation, and modals rather than a web router with browser URLs. | Required | This document |
| CERT-14 | The app SHALL preserve the selected tab and cert across app restarts. | Required | This document |
| CERT-15 | The app SHALL show a clear back affordance in pushed screens. | Required | This document |
| CERT-16 | Android hardware back SHALL close an open modal first, then return one level in the navigation stack, and SHALL NOT exit the app from a nested screen. | Required | This document |
| CERT-17 | On iOS, the app SHALL support the platform back gesture where the navigation library allows it. | Required | This document |
| CERT-18 | The app SHALL use safe-area insets so content is not hidden by notches, status bars, or home indicators. | Required | `08-accessibility-and-resilience.md` |

## Cert switching and context

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| CERT-19 | The selected cert SHALL come from local settings and SHALL default to a valid active cert. | Required | Web `CERT-19` |
| CERT-20 | A cert-scoped screen SHALL show the active cert clearly so the student knows which bank they are studying. | Required | This document |
| CERT-21 | Switching certs SHALL update the dashboard, practice configuration, history scope, and mastery view. | Required | This document |
| CERT-22 | Switching certs SHALL NOT delete the previous cert's data. | Required | This document |
| CERT-23 | Starting a session while an in-progress session exists for another cert SHALL NOT silently replace it. | Required | `DATA-38` |
| CERT-24 | The app MAY support deep links such as a resume link or a specific cert dashboard. Any deep link SHALL be optional and SHALL NOT be required for normal use. | Optional | This document |

## Practice entry points

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| CERT-25 | The Practice screen SHALL list the active cert's practice exam, domain practice, and study exam actions. | Required | This document |
| CERT-26 | The Practice screen SHALL show the last session and a Resume action when a session is in progress. | Required | `DATA-21` |
| CERT-27 | A signed-in or guest distinction SHALL NOT exist in the navigation. | Required | `IONIC-1`, `DATA-5` |
| CERT-28 | The app SHALL NOT show a login, account, profile, or sign-out entry. | Required | `IONIC-1` |
| CERT-29 | The app SHALL provide a Browse certifications or All certs entry that opens the cert list. | Required | This document |
| CERT-30 | The app SHALL show a clear empty state if a cert has no available questions, rather than a broken start button. | Required | Web `PRACT-27` |

## Device and platform behaviour

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| CERT-31 | The app SHALL handle app pause, resume, lock, and force close on every screen without losing unsaved work. | Required | `IONIC-7` |
| CERT-32 | The app SHALL restore the last screen or a safe home screen on cold start. Restoring directly into a timed exam SHALL require a resume confirmation. | Required | This document |
| CERT-33 | The app SHALL NOT rely on browser history or a URL bar. | Required | This document |
| CERT-34 | The app SHALL provide an accessible app title and screen titles for assistive technology. | Required | `08-accessibility-and-resilience.md` |
| CERT-35 | The app SHALL keep the status bar and navigation bar readable in light and dark themes. | Required | `08-accessibility-and-resilience.md` |
| CERT-36 | The app SHALL use the platform share sheet or file picker for backup export and import rather than a web download. | Required | `01-local-data-and-device.md` |

## Removed web behaviour

- Astro routes and `build.format`.
- Canonical URLs, sitemaps, internal link graph, and SEO head checks.
- Browser back and `beforeunload` as primary navigation guards.
- Header and footer web chrome.
- Cloudflare Pages and server redirects.
