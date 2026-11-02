# Accessibility and resilience

Scope: mobile accessibility, touch and focus behaviour, theme handling, and how
the app behaves when the device, storage, or app lifecycle fails. This topic
replaces the web accessibility and resilience requirements.

## Accessibility baseline

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| ACC-1 | Every screen SHALL be usable with a screen reader. The target readers are VoiceOver on iOS and TalkBack on Android. | Required | This document |
| ACC-2 | Every interactive element SHALL have an accessible name. Decorative icons SHALL be hidden from assistive technology. | Required | `DESIGN.md` |
| ACC-3 | Screen titles and screen changes SHALL be announced to the screen reader. | Required | `06-certifications-and-navigation.md` |
| ACC-4 | Question grids, progress bars, and session controls SHALL expose their state through accessibility properties, not colour alone. | Required | `10-study-exams.md`, `02-mock-exam.md` |
| ACC-5 | Progress bars SHALL expose the progressbar role with current, minimum, maximum, and a value text. | Required | `10-study-exams.md` |
| ACC-6 | Correct and incorrect feedback SHALL include text, not colour alone. | Required | `03-practice-by-subject.md`, `10-study-exams.md` |
| ACC-7 | Error and success notices SHALL be announced to the screen reader. | Required | This document |
| ACC-8 | Modals SHALL trap focus, expose a dialog role and label, and return focus to the trigger on close. | Required | This document |
| ACC-9 | Form fields SHALL have labels, hints, and clear error text. | Required | `DESIGN.md` |
| ACC-10 | The selected state of filter chips and segments SHALL be exposed to the screen reader. | Required | `05-progress-and-history.md` |
| ACC-11 | The app SHALL support external keyboards where the platform does, with a visible focus indicator on every focusable element. | Required | This document |
| ACC-12 | Large text SHALL not clip or overflow. The app SHALL honour the system font size setting where the platform supports it. | Required | This document |

## Contrast and themes

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| ACC-13 | Text contrast SHALL meet at least 4.5:1 for normal text and 3:1 for large text in both themes. | Required | `DESIGN.md` |
| ACC-14 | The light and dark themes SHALL be complete themes, not an inversion, using the tokens in `DESIGN.md`. | Required | `DESIGN.md` |
| ACC-15 | The app SHALL respect the system light or dark preference on first launch. | Required | `DESIGN.md` |
| ACC-16 | The student SHALL be able to override the theme explicitly in Settings. The choice SHALL persist locally. | Required | `DESIGN.md` |
| ACC-17 | Theme switching SHALL apply without a flash of the wrong theme. | Required | `DESIGN.md` |
| ACC-18 | Status bar, toolbar, and tab bar text SHALL remain readable in both themes. | Required | `06-certifications-and-navigation.md` |

## Touch and motion

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| ACC-19 | Tap targets SHALL be at least 44 px on both platforms. | Required | `DESIGN.md` |
| ACC-20 | Press feedback SHALL arrive within 90 ms of the touch. | Required | `DESIGN.md` |
| ACC-21 | The app SHALL respect `prefers-reduced-motion` and SHALL offer an in-app reduced-motion override. | Required | `IONIC-16` |
| ACC-22 | When reduced motion is active, entrances, staggers, and reveal animations SHALL be replaced by instant or plain fades. | Required | `DESIGN.md` |
| ACC-23 | Motion SHALL be subtle and non-bouncy, using the named curves and durations from `DESIGN.md`. | Required | `DESIGN.md` |
| ACC-24 | Swipe gestures SHALL NOT be the only way to complete a task. Every swipeable action SHALL have a button alternative. | Required | This document |
| ACC-25 | Haptic feedback, if used, SHALL be additive and SHALL respect the system haptics setting. | Optional | This document |

## Layout and platform conventions

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| ACC-26 | Content SHALL respect safe-area insets for the notch, status bar, and home indicator. | Required | `06-certifications-and-navigation.md` |
| ACC-27 | The app SHALL be designed for portrait phones and SHALL remain usable in landscape and on tablets. | Required | This document |
| ACC-28 | Long lists SHALL virtualize or paginate so scrolling stays smooth. | Required | `05-progress-and-history.md` |
| ACC-29 | No screen SHALL require horizontal scrolling to read content. | Required | `DESIGN.md` |
| ACC-30 | The keyboard SHALL not obscure inputs. The app SHALL use proper keyboard avoidance on both platforms. | Required | This document |
| ACC-31 | The Android hardware back button SHALL behave as defined in `06-certifications-and-navigation.md`. | Required | `06-certifications-and-navigation.md` |
| ACC-32 | On iOS, the swipe back gesture SHALL work where the navigation stack has a parent screen. | Required | `06-certifications-and-navigation.md` |
| ACC-33 | The app SHALL use the system font stack and SHALL NOT load web fonts. | Required | `IONIC-15`, `DESIGN.md` |

## App lifecycle resilience

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| ACC-34 | The app SHALL survive backgrounding, screen lock, and force close without losing study data. | Required | `IONIC-7` |
| ACC-35 | An in-progress session SHALL be restored on reopen, with a resume confirmation for a timed exam. | Required | `06-certifications-and-navigation.md` |
| ACC-36 | The mock exam timer SHALL be derived from wall-clock time and SHALL continue while the app is backgrounded. | Required | `02-mock-exam.md` |
| ACC-37 | The app SHALL handle a system-initiated shutdown as gracefully as a normal close, by persisting before or during the shutdown. | Required | `01-local-data-and-device.md` |
| ACC-38 | The app SHALL recover from an interrupted write on next launch without corrupting other data. | Required | `DATA-10`, `DATA-12` |
| ACC-39 | A migration failure SHALL leave prior data intact and show a recoverable error. | Required | `DATA-12` |
| ACC-40 | A corrupted or unknown local row SHALL be ignored or quarantined, never crash the app. | Required | `DATA-23` |

## Storage and data failures

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| ACC-41 | A full disk or unavailable database SHALL surface a visible, retryable error on the affected screen. | Required | `DATA-13` |
| ACC-42 | A failed write SHALL NOT advance the session as if the answer were saved. | Required | `10-study-exams.md` |
| ACC-43 | The IndexedDB development store SHALL behave like the native store for error handling, so bugs surface during `ionic serve` testing. | Required | `01-local-data-and-device.md` |
| ACC-44 | A failed bank load SHALL show a retryable error and re-enable the start action. | Required | `03-practice-by-subject.md` |
| ACC-45 | A failed history or statistics read SHALL show an inline retry, not fabricated numbers. | Required | `05-progress-and-history.md` |
| ACC-46 | A crash in a screen SHALL show a recoverable message with a way back, not a stuck splash screen. | Required | This document |
| ACC-47 | The app SHALL not loop on a failing background operation. A retry budget or manual retry SHALL stop runaway work. | Required | This document |
| ACC-48 | The app SHALL be battery-aware: no polling, no background network, and no long-running loops. | Required | `07-privacy-and-telemetry.md` |

## Runtime health

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| ACC-49 | No screen SHALL emit an unexpected console error during normal flows. | Required | This document |
| ACC-50 | No screen SHALL show broken or missing icons or images. | Required | This document |
| ACC-51 | Loading states SHALL show a skeleton or a labelled spinner, not a blank screen. | Required | `05-progress-and-history.md` |
| ACC-52 | The app SHALL start quickly from a cold start and from resume, on the target hardware. | Required | This document |
| ACC-53 | The app SHALL keep the question bank bundled so screens render without waiting on storage reads beyond the local database. | Required | `09-content-and-app-build.md` |

## Verification

Before a UI change ships, verify:

1. VoiceOver and TalkBack announce screen titles, questions, options, feedback, and progress.
2. Large text and landscape do not clip or overflow.
3. Both themes meet contrast on every screen.
4. Reduced motion disables entrances and preserves usability.
5. Background and force-close during each session type restores correctly.
6. Airplane mode produces no network error on any core screen.
7. A corrupted row and a full disk each produce a recoverable error.
8. Hardware back and keyboard focus behave correctly on Android and iOS.
