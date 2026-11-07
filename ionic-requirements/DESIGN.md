# Design for the CloudCertPrep Ionic app

This document defines the visual language for the Ionic version of CloudCertPrep.
The goal is to keep the same look and feel as the web app while adopting Ionic
and native conventions for touch, motion, and platform affordances.

The web app's design system is the source of truth for tokens. The Ionic app
maps those tokens onto Ionic CSS variables so the same brand colours, motion
curves, and typography are preserved on the phone.

## Principles

- The brand is AWS orange (`#FF9900`) on a cool squid-ink surface. Dark mode
  stays within the same squid-ink tier.
- Motion is Apple-style: quick, subtle, never bouncy. Every entrance, exit, and
  press has a named curve and duration.
- Touch first. Every interactive surface answers within 90 ms on press and
  reaches its final state within 250 ms.
- Typography uses the system font stack only. No web fonts.
- Light and dark are full themes, not an inversion. Each has its own surface
  and text tiers.
- Accessibility is non-negotiable. Contrast, tap target size, motion respect,
  and screen reader clarity are checked on every screen.

## Tokens

### Colour

| Token | Light | Dark | Ionic variable | Use |
|---|---|---|---|---|
| brand | `255 153 0` | `255 153 0` | `--ion-color-primary` | Primary CTA, active state, accents |
| brand-hover | `236 114 17` | `236 114 17` | `--ion-color-primary-shade` | Brand hover and pressed state |
| brand-text | `180 83 9` | `255 153 0` | `--ccp-brand-text` | Brand-coloured text and icons on surfaces, AA safe |
| on-brand | `22 25 31` | `22 25 31` | `--ion-color-primary-contrast` | Text on brand fills |
| cta | `22 29 38` | `244 246 248` | `--ion-color-secondary` | Secondary CTA and solid buttons |
| on-cta | `255 255 255` | `22 25 31` | `--ion-color-secondary-contrast` | Text on CTA fills |
| bg-dark | `248 249 250` | `22 25 31` | `--ion-background-color` | Page background |
| bg-card | `255 255 255` | `28 35 47` | `--ion-color-light` | Cards and raised surfaces |
| bg-card-hover | `250 251 252` | `35 47 62` | `--ion-color-light-shade` | Card hover and active states |
| header-bg | `255 255 255` | `22 25 31` | `--ion-toolbar-background` | Toolbar and header background |
| on-header | `22 25 31` | `244 246 248` | `--ion-toolbar-color` | Header text |
| border | `233 235 237` | `50 60 73` | `--ion-border-color` | Hairline separators and card borders |
| link | `0 115 187` | `68 156 214` | `--ion-color-medium` | Inline links and accents |
| success | `22 101 52` | `74 222 128` | `--ion-color-success` | Correct answers and pass states |
| danger | `185 28 28` | `248 113 113` | `--ion-color-danger` | Incorrect answers and destructive actions |
| on-danger | `255 255 255` | `22 25 31` | `--ion-color-danger-contrast` | Text on danger fills |
| warning | `154 69 9` | `251 191 36` | `--ion-color-warning` | Flagged state and caution text |
| warning-fill | `217 119 6` | `251 191 36` | `--ion-color-warning-shade` | Solid bar and meter fills |
| text-primary | `22 25 31` | `244 246 248` | `--ion-text-color` | Primary body text |
| text-muted | `84 91 100` | `141 153 168` | `--ion-color-medium` | Secondary text and labels |

All colours are stored as RGB channels so the Ionic variables can use
`rgb(var(--token) / alpha)` with opacity.

### Typography

The font stack is the system stack in both themes:

```
-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue",
Helvetica, Arial, sans-serif
```

The monospace stack for timers and IDs is `ui-monospace, SFMono-Regular, Menlo, monospace`.

| Use | Size | Weight | Tracking | Line height |
|---|---|---|---|---|
| Display heading | `1.75rem` mobile, `2.25rem` tablet | `600` | `-0.02em` | `1.15` |
| Section heading | `1.25rem` mobile, `1.5rem` tablet | `600` | `-0.01em` | `1.25` |
| Card heading | `1rem` mobile, `1.125rem` tablet | `600` | `-0.01em` | `1.3` |
| Body | `1rem` mobile, `1.0625rem` tablet | `400` | `0` | `1.5` |
| Small | `0.875rem` | `400` | `0` | `1.4` |
| Caption | `0.75rem` | `500` | `0.02em` | `1.3` |
| Mono (timer, ID) | `0.875rem` | `500` | `0` | `1.3` |
| Kicker | `0.75rem` | `600` | `0.2em` | `1` |

The kicker uses a 22 px brand bar on the leading side and uppercase mono
lettering, matching the web app's editorial voice.

### Spacing

Spacing follows an 8 px grid with these steps:

- `xs` = 4 px
- `sm` = 8 px
- `md` = 12 px
- `base` = 16 px
- `lg` = 24 px
- `xl` = 32 px
- `2xl` = 48 px
- `3xl` = 64 px

Cards use `16 px` padding on mobile and `24 px` on wider surfaces. The page
gutter is `16 px` on mobile and `24 px` on tablets.

### Radius

| Surface | Radius |
|---|---|
| Card | `16 px` |
| Input, chip | `12 px` |
| Pill, button | `999 px` |
| Inner element | `8 px` |

### Shadow

| Token | Light | Dark |
|---|---|---|
| card | `0 1px 3px rgb(15 25 35 / 0.06), 0 1px 2px rgb(15 25 35 / 0.04)` | none |
| card-hover | `0 8px 24px -8px rgb(15 25 35 / 0.14), 0 2px 8px -2px rgb(15 25 35 / 0.08)` | `0 0 0 1px rgb(255 255 255 / 0.08), 0 10px 30px -5px rgb(0 0 0 / 0.55)` |
| overlay | `0 24px 64px -16px rgb(15 25 35 / 0.24)` | `0 0 0 1px rgb(255 255 255 / 0.08), 0 24px 64px -16px rgb(0 0 0 / 0.7)` |

Dark cards use a 1 px hairline border and no base shadow. The hover shadow adds
elevation feedback in both themes.

### Motion

| Name | Curve | Duration | Use |
|---|---|---|---|
| ease-out | `cubic-bezier(0.16, 1, 0.3, 1)` | varies | Entrances, settles, lifts |
| ease-inout | `cubic-bezier(0.45, 0, 0.15, 1)` | varies | Indicator slides, tab underline |
| ease-press | `cubic-bezier(0.2, 0, 0, 1)` | 90 ms | Button and tap press |
| ease-exit | `cubic-bezier(0.4, 0, 1, 1)` | 180 ms | Dismissals |

| Name | Duration | Use |
|---|---|---|
| press | 90 ms | `:active` compress |
| fast | 180 ms | Exits and dismissals |
| base | 200 ms | Colour and border transitions |
| gentle | 250 ms | Lift settle, press release, disclosure |
| slow | 350 ms | Popovers, menus, slide-up notices |
| reveal | 520 ms | Scroll reveal and modal open |
| settle | 600 ms | Progress fill and image zoom |

All motion respects `prefers-reduced-motion`. When reduced motion is active, all
durations collapse to near-zero and entrance animations are disabled.

On phones, stagger and rise entrances are replaced by a single quiet fade to
avoid content popping in line by line on every screen change.

## Component mapping

| Web component | Ionic component | Notes |
|---|---|---|
| `Button` primary | `ion-button` `color="primary"` | Brand fill, pill shape, minimum 44 px tap target |
| `Button` secondary | `ion-button` `fill="outline"` or `fill="solid"` with secondary color | CTA fill in dark, outline on light |
| `Button` danger | `ion-button` `color="danger"` | Destructive actions |
| `Button` ghost | `ion-button` `fill="clear"` | Inline actions and tertiary controls |
| `Alert` success / danger / warning | Custom card with success, danger, or warning tint and left border | Ionic alerts are modal; inline alerts stay custom |
| `Card` | `ion-card` with custom shadow class | Apply design token shadow and border |
| `Input` | `ion-input` with custom wrapper | Match 12 px radius and 44 px min height |
| Password input | `ion-input` `type="password"` with toggle | Use system password visibility affordance |
| Checkbox | `ion-checkbox` with brand colour | Match the web brand tint |
| Radio | `ion-radio` with brand colour | Same |
| Modal | `ion-modal` with sheet presentation on phones, centered on tablets | Use `breakpoints` for sheet variants |
| Action sheet | `ion-action-sheet` | For destructive confirmations on phones |
| Tab bar | `ion-tabs` | Use the four-tab layout from the navigation requirements |
| Toolbar | `ion-toolbar` inside `ion-header` / `ion-footer` | Use header token and safe-area insets |
| Fab | `ion-fab` | Optional for a primary action on the dashboard |
| Toast | `ion-toast` | For retryable errors and success notices |
| Badge | Custom pill | Ionic badges are for counts; domain pills use the brand token |
| Progress bar | `ion-progress-bar` | Custom tint for mastery and study bars |
| Chip | `ion-chip` | Filter chips use `fill="outline"` when inactive and brand fill when active |
| Segment | `ion-segment` | Filter rows such as all, passed, failed |
| List | `ion-list` and `ion-item` | For history rows and settings lists |
| Menu | `ion-menu` or bottom sheet on phones | Replace the web Practice disclosure |

## Theme switching

The app uses the Ionic theme system with two classes on the root element:

- `theme-light` for light mode.
- `theme-dark` for dark mode.

The system preference is respected on first launch. The user's explicit choice
is stored in the local settings store and takes priority. Switching themes is
instant, with no flash, by applying the class before the first paint.

Ionic provides `--ion-color-*` variables that the app overrides with the design
tokens. Both themes must pass WCAG AA contrast for text and UI components.

## Layout

The app uses a fixed bottom tab bar on phones and a sidebar on tablets and
wider windows. The tab bar has four items:

- Home, with a cert name subtitle.
- Practice, which opens a stack with mock exam, domain practice, and study exam.
- History, with local statistics and attempt review.
- Settings, with theme, reduced motion, backup, reset, and app info.

Every screen respects safe-area insets for the status bar, notch, home
indicator, and any software navigation bar. Content never extends under these
areas.

Cards use the full width with 16 px side gutters on phones. On tablets the
content area is capped at 720 px and centred.

## Icons

Icons come from a single library. The app uses Lucide for consistency with the
web version, mapped to Ionic's icon component where it makes sense. Decorative
icons carry no label and are hidden from assistive technology. Action icons
carry an accessible label.

## Accessibility

- Minimum tap target: 44 px.
- Minimum contrast: 4.5:1 for normal text, 3:1 for large text.
- Focus rings use the brand colour with a 2 px offset.
- Screen reader announcements use `ion-toast` or live regions, not visual-only
  cues.
- Progress bars expose `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and
  a text value.
- Reduced motion is respected at the system level and mirrored in the app.

## Platform differences

iOS uses native sheet modals, swipe-back gestures, and SF symbols where the app
uses its own icons. Android uses full-screen modals on phones, hardware back
navigation, and Material-style ripples. The design tokens are the same on both
platforms; only the native affordances change.

## Copy and content

- US English spelling only.
- No em dashes or en dashes in UI copy, content, or code.
- No emojis for UI actions or feature illustration.
- Kicker labels use the mono uppercase style with a brand bar on the leading
  side.
- The "Your dashboard" kicker uses the same layout as the web cert dashboard.
