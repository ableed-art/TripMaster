# TripMaster Changelog
Consolidated release history. Runtime source remains unchanged from v1700-RC1.

---

# TripMaster v1700-RC1 — Beta Productivity & Trip Lifecycle

Baseline: v1500-RC3 SPCK root-fix. PWA/client only; backend and AI V2 remain frozen.

## Trip Board 2.0
- Added an Attention tab that consolidates Readiness issues/checks in one operational surface.
- Checklist tasks now support due dates and Low/Normal/High priority.
- Added All/Open/Done checklist filters.
- Overdue and due-today tasks are highlighted and sorted ahead of ordinary work.
- Overdue tasks become Readiness issues; due-today tasks become Readiness checks.

## Today operations
- Dated checklist work now surfaces in Today.
- Live Today includes due-today and overdue tasks; preview mode shows tasks for the previewed date.
- Tasks can be completed directly from Today.

## Itinerary productivity
- Added Duplicate day plan from Day details.
- Copies to the next free date, regenerates activity IDs, resets completion state and strips booking/payment confirmations from the copy.
- Travel-Day arrival dates retain their relative offset when a day plan is duplicated.
- Added Duplicate activity from Edit Activity; the copy gets a new ID and resets completion/confirmation state.

## Trip lifecycle
- Added Archive / Restore from archive.
- Archived trips are removed from normal active/upcoming/past selection and shown in a dedicated Home section.
- Archiving the active trip safely returns to Home without deleting data.
- Duplicating an archived trip creates a normal unarchived copy.

## QA hardening
- Added a static DOM contract test that verifies every `$()` id referenced by app.js exists in index.html.
- Regression coverage expanded for dated tasks, overdue/due-today states and archive semantics.
- Existing SPCK module-load root fix, boot watchdog, offline shell, backup/recovery, i18n and overnight regressions remain protected.
- Amharic review source regenerated against the new full translation-key set; Amharic remains inactive pending native review.

---

# TripMaster v1500-RC3 — SPCK startup root-cause fix

- Fixed the actual SPCK startup blocker: `app.js` requires `TripMasterOperations`, but `index.html` did not load `app-operations.js`.
- `app-operations.js` now loads before `app.js`.
- Release QA now asserts that the operations module is both precached and actually referenced by `index.html` in the correct order.
- Version/cache bumped so the corrected shell can replace the previous cached build.
- No backend or AI changes.

---

# TripMaster v1500-RC2

## SPCK boot reliability
- BOOT-STATE-003 moves the fatal/usable boot boundary to the first successful core render.
- Once storage, active trip resolution, event wiring and the first UI render have completed, TripMaster is marked ready immediately.
- Non-critical post-render work (toast/lifecycle/reminder setup) can no longer cover a usable app with the fatal boot recovery screen.
- Existing boot diagnostics and stalled-start watchdog remain in place for genuine pre-render startup failures.
- No server or AI changes.

---

# TripMaster v1500-RC1 — Internationalization Foundation + Boot Reliability

- Carries forward v1400-RC2 progress-aware boot watchdog hardening.
- Adds Amharic locale foundation: `am` / `am-ET` / LTR, intentionally inactive pending native review.
- Early dir boot now recognizes Amharic devices without an RTL first-frame mismatch.
- Adds locale-aware plural foundation using `Intl.PluralRules`, additive to current six-language behavior.
- Release QA now derives active languages from `LANG_META` instead of a hard-coded six-language list.
- Adds Amharic runtime/CLDR foundation tests and native-review source exporter.
- Search normalization now uses Unicode NFC before locale-aware case normalization.
- Adds Ethiopic-friendly local/system font stack without adding a network font dependency.
- No AI/backend changes.

---

# TripMaster v1400-RC2 — Boot Reliability Hardening

- Replaced the fixed 4-second boot watchdog with progress-aware startup monitoring.
- Added explicit startup exception capture and fail UI only for genuine failed/stalled initialization.
- Watchdog now loads early enough to observe dependency/runtime startup failures.
- Added session-only boot diagnostics for QA; no trip/user data is added to diagnostics.
- Keeps the existing reload recovery path.

No backend or AI changes.

---

# TripMaster v1400-RC1 — Development Train Release Notes

Baseline: v1100-RC2
Scope: PWA/client only. Backend and AI V2 are intentionally unchanged/frozen.

## v1200 — Trip Board / Whole-trip operations
- Added Trip Board as a first-class trip surface.
- Whole-trip agenda across trip dates using existing Today/Logistics models.
- Search across activities, locations, stays, journeys, providers and service numbers.
- Added local traveller checklist/tasks per trip.
- Checklist progress, add/complete/reopen/delete actions.
- Open checklist tasks participate in Trip Readiness.
- Trip Board available from Planner and Home.
- Added pure app-operations.js module and precached it offline.

## v1300 — Multi-trip productivity
- Added full trip duplication with regenerated opaque IDs.
- Regenerates activity, stay, journey, expense, document and task IDs.
- Remaps linked expense/document references to cloned entities.
- Past trips are separated on Home from current/upcoming work.
- Trip Board is directly reachable from Home trip cards.

## v1400 — Beta reliability + Today operations
- Added Data Safety Center.
- Displays app version, online/offline state, localStorage write health, Service Worker control, trip count and active trip.
- Shows browser storage quota usage when supported.
- Exposes the existing local safety snapshot as a real recovery feature.
- Create a safety snapshot manually.
- Restore the latest local snapshot through the existing guarded restore path.
- Download a portable backup from the same center.
- Trip deletion now creates a recoverable local snapshot before destructive commit.
- Added Today progress bar based on completed activities.
- Added one-tap Mark done / Mark open actions directly in Today.

## Preserved from v1100-RC2
- Trip Readiness 2.0.
- Mobile/browser Back state handling.
- Overnight activities, journeys and Travel Days.
- Booking Center 2.0, Money 2.0, Documents 2.0.
- Currency chooser with localized name/symbol/code.
- Money/Documents main-trip shortcuts.
- Access note visibility.
- PWA update banner and controlled reload flow.
- Landscape support, contrast improvements and accessibility hardening.
- Offline shell, backup/restore compatibility and guarded storage writes.

## QA performed in this environment
- Root JavaScript syntax check: PASS.
- Deterministic regression suite: PASS.
- Release gate: PASS.
- i18n parity: 831 keys × 6 languages.
- Service Worker precache: 20 local assets verified.
- Duplicate static HTML IDs: none.
- Manifest sanity: PASS.
- Trip Board task/search pure-model tests: PASS.
- Overnight travel regression: PASS.
- ZIP integrity: PASS after packaging.

## Runtime limitation
A real local Chromium smoke was attempted, but this execution environment blocks both localhost and file:// navigation with ERR_BLOCKED_BY_ADMINISTRATOR. No browser/device PASS is claimed from that attempt. Android/SPCK remains the external manual gate.

## Explicitly not changed
- Production Replit backend.
- AI V2 development checkpoint.
- Live flight/train/weather provider work.
- Planner Platform / marketplace / collaboration.

---

# TripMaster v1100-RC2

## Beta Operations Pack

This release advances the non-AI PWA toward a serious beta while keeping the production AI/backend frozen.

### Booking Center 2.0
- Added an operational summary with total, attention and paid counts.
- Added All / Needs attention filters.
- Attention rows are visually distinct and keep direct links to the original stay, journey or activity.
- Provider information is surfaced when already stored.

### Money 2.0
- Replaced free-text currency entry with a localized currency picker using readable currency names plus ISO codes.
- Existing/legacy currency codes remain selectable.
- Added budget progress, payment-attention summary and top category totals for the primary/budget currency.
- Added All / Needs attention filtering for expenses.

### Documents 2.0
- Added a total/needed summary.
- Added All / Needed filtering.
- Needed document references are visually emphasized.

### Mobile layout hardening
- Fixed the root compact-button width inheritance that caused action buttons to cover text in several sheets.
- Readiness actions stack safely on narrow screens instead of overlapping content.

### QA
- Expanded regression coverage for Booking, Money and Documents operational helpers.
- Existing v1100 checks for overnight timing, Back handling, i18n, cache/version parity and precache integrity remain.

### Explicitly unchanged
- No backend or production AI changes.
- No AI V2 publish.
- No storage technology rewrite.

---

# TripMaster v1100-RC1

## Scope

This release is an application-side beta-foundation push. It does not change the Replit backend or the frozen AI V2 development branch.

## Product changes

- Readiness 2.0: actionable readiness center grouped by Schedule, Stays & Journeys, Bookings, Money, Documents, Access, and Trip Details.
- Mobile/browser Back handling: Back unwinds the top sheet, then Today, then Planner, then Home, before leaving the app.
- Overnight activity, Journey, and Travel Day behavior remains first-class and is protected by deterministic regression tests.
- The redundant 26px hero-map overlay control was removed; the full-size Directions action remains.
- Existing v1090-RC4-FIX3 work is retained: PWA update banner, Today notification permission flow, Access-note visibility, stronger contrast, landscape support, Money/Documents discovery, arrival-date support, and service-worker navigation fallback.
- New release QA scripts require no package manager or bundler.

## Automated gates

Run from the project root:

- `node qa/regression.mjs`
- `node qa/release-check.mjs`

The release gate checks JavaScript syntax, translation parity, version/cache consistency, precache coverage, duplicate static IDs, and manifest basics.

## Manual/device gate still required

Before this becomes a permanent stable baseline, verify on Android/SPCK or installed PWA:

1. Hardware Back: sheet -> Today -> Planner -> Home -> exit.
2. Readiness Center actions open the correct destination.
3. Overnight activity and journey remain visible after midnight.
4. PWA update banner survives real install/update behavior.
5. Backup/restore round-trip.
6. Offline reload after one successful online load.
