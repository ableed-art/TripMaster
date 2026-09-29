# v3800-RC2 - 23 September 2026

- Fix persistent corrupt-backup deduplication and reference preserved raw values
  from recovery snapshots. Verify actual preserved bytes before destructive writes.
- Repair invalid array members on the real boot/load path while retaining raw
  evidence; reject unusable collection shapes without erasing them.
- Preserve active-trip evidence during unreadable trip recovery.
- Use locale fallback for unreadable settings, including early language/direction.
- Add localized partial-save warning with Safety Center action after rollback failure.
- Fix measured large-text Today, Planner hero and secondary-card overflow; allow
  vertical growth and long-token wrapping in affected content.
- Add `qa/browser.mjs` with full browser boot/load, Restore/Export, injected faults,
  multitab, migration, large-text and offline-worker tests. Enable with
  `node qa/hardening.mjs --browser`.
- Retain all existing translation wording; 971 keys x 7 languages after one new key.
- Refresh version/build/fingerprint/digests, without changing worker behavior.
- Device, installed-PWA and native linguistic QA remain pending.

# v3800-RC1 - 22 September 2026

Production/PWA hardening batch, based only on the extracted verified v3700 checkpoint.
- Final follow-up: recovery snapshots preserve healthy sibling keys as well as corrupt raw values; prior good snapshots remain intact. Back guard is reused across reloads.
- Final validation: 22 executable hardening groups plus regression and release gate, repeated after final ZIP extraction. No browser/device pass claimed.
- Cache namespaces encode the exact case-sensitive registration path without lossy slug collisions. Earlier ambiguous slug caches are retained, not deleted speculatively. New exact-scope caches retain current plus two predecessors.
- Core precache bytes are SHA-256 checked before promotion and after promotion. Recovery fetches for missing core assets must match this worker's shipped digests, preventing a mixed old/new offline shell. Incomplete or mismatched installs reject and preserve the prior generation.
- Page and worker additionally prove an explicit content-derived build ID, catching changed bytes even under the same release label. Shell fingerprint and core digests are independently checked by the release gate.
- Controller MessageChannels close on success, timeout and send failure. Foreground return rechecks identity. Update activation listeners/timer are cleaned on success, redundant state, timeout or postMessage failure; duplicate activation attempts are ignored.
- VisualViewport constrains open sheets above the keyboard, with pinch zoom left to the user; focused fields scroll inside the sheet. Lower stacked sheets cannot steal delayed focus from the top sheet.
- Explicit smooth scrolling respects reduced motion; transition delays are removed. Wrapping strengthened for safety/health and task controls. Existing manifest/CSP/no-referrer and icon checks remain.
Untested on real Android: installed cold/offline launch, Gboard, long suspension, OS Back/exit, controller updates across multiple windows, TalkBack, 100/130/150/200% text and dark/light visual contrast. No claim of browser visual QA: local server was blocked by the cloud browser.
TWA/APK work remains deferred: this is a PWA client checkpoint, not a signed Android package. No server, Replit, live-provider or community work. Native Amharic review remains pending.
Independent QA priority: exact-scope cache collisions and rollback; mixed deployment hashes; same-version/different-build controller mismatch; corrupt JSON/shape recovery and interrupted restore; missed-event no-sheet writes and stable-ID delete confirmations; diagnostics hostile-input privacy; keyboard/Back/focus/large-font runtime behavior.


# v3700-RC1 - 22 September 2026

Beta operations, privacy and recovery batch, based only on the extracted verified v3600 checkpoint.
- Session-only lifecycle ring bounded to 40 entries; new migration, write-failure and restore/import result events. Clear action removes lifecycle/runtime/boot logs without touching trips.
- Re-sanitize persisted diagnostic records when reading them. Fixed filename-query and arbitrary error-name leakage; unknown fields/strings are discarded. Boot watchdog no longer persists raw exception messages.
- Report schema 5 includes local storage UTF-16 size estimate, snapshot duplication size, latest write timing/outcome, migration and transfer outcomes. Cache identity exposes only release/fingerprint, not a deployment path. No remote telemetry.
- Corrupt JSON or unusable trip collection shapes are preserved raw and blocked from ordinary replacement writes. Explicit validated Restore can recover only after raw preservation succeeds. Existing good safety snapshot is retained during corrupt-data recovery.
- Corrupt storage opens Data Safety Center and receives a structural error, not a healthy empty graph. Added a direct Restore action there. Offline status is informational; offline readiness requires controller proof.
- 13 behavioral hardening groups plus existing regression and release gate. Diagnostic injection/privacy and corruption/quota tests execute real functions in a Node VM; these are not browser/device tests.
Amharic strings and intent vocabulary unchanged, 970-key parity retained; Clear reuses its existing localized label. Native linguistic review remains pending.
Rollback: keep prior ZIPs intact; deploy one entire clean package, never mix runtime files. Keep a portable backup before device testing. Schema remains backupVersion 2 and unknown trip fields survive; application downgrade is not a substitute for restoring a backup. Do not unregister workers or delete all site data as the default recovery advice.


# v3600-RC1 - 22 September 2026

Data integrity and storage batch. Fresh extraction of the SHA-verified v3500 source.
- Every guarded trip write compares the canonical token even without an open sheet; wake adoption and successful own writes advance it.
- Tasks resolve IDs when toggling/deleting; day and hero-delete confirmations retain identity. New relationship options never use array-position fallback.
- ID allocation reserves identifiers in later rows. Null legacy day rows no longer crash ID repair. Unknown fields remain intact; dates/orphan links are reported, not guessed.
- Restore rejects malformed explicit modern trips, invalid legacy/home-day shapes and non-string active IDs. Active pointer normalization precedes ID lookup.
- Persistence keeps days aliased to the active trip; undo snapshots no longer duplicate the entire active itinerary; unchanged storage values skip writes.
- Added qa/hardening.mjs with executable behavior tests and a synthetic serialization benchmark. Existing regression and release gate retained.
Measured fixture: 30 trips x 30 days x 12 activities, 1,508,451 UTF-8 bytes. Removing duplicate snapshot data saves 50,009 bytes for this active trip. CPU numbers are synthetic Node timings, not Android/localStorage measurements.
Limits: localStorage multi-key writes have synchronous rollback on exceptions, not crash-atomic transactions or compare-and-swap across simultaneously running tabs. Safety snapshot precedes destructive restore; do not promise immunity to process termination mid-write. No storage-engine rewrite.
Browser runtime QA unavailable: cloud browser rejected the local test server with ERR_BLOCKED_BY_CLIENT. No real-device QA. Recheck cross-window edits, restore/undo and large stores in independent browser QA.


# TripMaster v3500-RC1 — Deployment Portability + Installability Hardening

- Changed the Web App Manifest `id` from a hard-coded production path to deployment-relative `./`, preserving the `/TripMaster/` identity while giving sibling/staging deployments their own install identity.
- Kept `start_url` and `scope` deployment-relative and added release-gate URL-resolution checks that start URL stays inside the resolved scope.
- Added actual PNG dimension validation against every manifest icon declaration and require a 512×512 maskable install icon.
- Added release-gate coverage requiring every manifest icon to remain in the offline app-shell precache.
- Declared `orientation: any` so the installed PWA does not unnecessarily lock the user's device orientation.
- Added explicit light/dark `color-scheme` metadata so native browser/form controls follow TripMaster's current theme more reliably.
- Preserved v3400 mobile/large-text hardening and v3300 device-QA diagnostics unchanged.
- No backend/server changes, AI V2 enablement or unreviewed Amharic wording changes.

# TripMaster v3400-RC1 — Mobile Accessibility + Large-text Resilience

- Replaced fixed-height primary buttons with a minimum-height/wrapping model so long translated labels and large text cannot be clipped.
- Made the sticky header grow beyond its normal 62px baseline instead of enforcing a hard height under text scaling.
- Added dynamic-viewport (`dvh`) sizing, contained overscroll and safe scroll padding for bottom sheets on modern mobile browsers.
- Freshly opened sheets now reset retained scroll position, so long hubs/forms do not reopen halfway down from a previous visit.
- Hardened sheet headings for long/mixed-script labels while preserving a fixed 44px close target.
- Raised remaining small interactive targets (Undo/toast, AI quick prompts, Readiness actions, filters and narrow day-strip controls) to the 44px mobile floor.
- Added forced-colors support for interactive boundaries/selection state.
- Added release-gate checks for the new large-text/touch-target/mobile-sheet invariants.
- v3300 diagnostics/supportability remains intact; backend/AI transport remains unchanged.

# TripMaster v3300-RC1 — Device QA Diagnostics + Supportability

- Added Beta Diagnostics schema v4 with a sanitized, session-only lifecycle timeline for boot-ready timing, visibility, pageshow/pagehide persistence, online/offline state, Service Worker status, update/reload events, blocked writes, storage-change categories and canonical-state convergence.
- Added Service Worker controller-proof telemetry: scoped registration path, proof duration, retry count and timeout state, specifically to diagnose slow Android wake/update behavior.
- Added sanitized write-gate state and navigation-shape diagnostics without exporting the current URL, browser user-agent, trip names, places, notes, booking references or money amounts.
- Added release-gate assertions that the diagnostics schema remains allowlisted/minimal and that Service Worker proof telemetry remains available.
- No backend/AI transport changes; AI V2 remains disabled; Amharic native wording review remains pending.

# TripMaster v3200-RC3 — Migration Link Integrity + Final Re-test Hardening

- Fixed the remaining legacy stable-ID repair blocker: when an entity ID changes only because the same historical ID exists in another trip, that trip's own typed Money/Document links now follow the repaired trip/stay/journey/activity ID.
- Same-trip duplicate targets remain deliberately ambiguous and are not guessed/remapped.
- Link auditing now resolves targets per trip, so an ID in another trip can no longer hide an orphaned local link.
- Historical trip objects missing `trip.id` are preserved through normalization so stable-ID migration can repair them instead of silently dropping them from the UI.
- Tightened Service Worker cache ownership against sibling deployment names such as `/TripMaster-v2/`.
- Provisional Service Worker version verification continues to block writes, but no longer permanently latches a false reload requirement if the controller subsequently proves to match.
- Added regression/release checks for cross-trip link remapping, missing trip-ID recovery, sibling cache isolation and the non-latching provisional version gate.
- Backend/server behavior remains unchanged; AI V2 transport remains disabled; Amharic native wording review remains pending.

# TripMaster v3200-RC2 — Targeted QA Hardening

## Targeted audit fixes
- Fixed false self-conflicts after a successful save inside an open hub by re-stamping only sheets that were current before the app's own write.
- Legacy/full backups with duplicate stable IDs are accepted as repairable and repaired before Restore persistence.
- Stable-ID migration now repairs duplicates across trips, days, activities, stays, journeys, expenses, documents and tasks.
- Wake adoption clears the external-trip pending flag before repair persistence, preventing recursive reload/write loops.
- Service-worker cache ownership no longer collides with sibling deployments such as `/TripMaster-beta/`.
- Controller version checks retry and fail closed when a controlled page cannot prove an exact version match.
- Canonical navigation compares pathname rather than full href, preventing query/fragment redirect loops.
- Promoted app-shell caches are validated for all core assets before install cleanup.

- Fixed offline/non-canonical deep navigation boot by redirecting controlled navigations to the canonical cached shell URL before relative assets load.
- Added cross-window Theme synchronization and missed-event recovery for Settings/Theme after frozen/discarded-tab wake. Reset/Restore now refuse stale preference state before their safety snapshot, and full backup exports canonical persisted Settings.
- Blocked Settings and Theme writes from stale page generations when the active Service Worker requires a reload.
- Added exact controller cache-version matching instead of substring matching.
- Cleaned orphaned scoped install/rollback caches from interrupted older Service Worker generations.
- Extended release/manual QA coverage for deep-link boot, preference convergence, stale-version preference writes and cache cleanup.
- Preserved v3100 stable-identity hardening, 7-language parity and the backend/AI V2 boundary.

# TripMaster v3100-RC1 — Stable Identity + Cross-Window Close Hardening

- Fixed Duplicate Day carrying the source `day.id`; duplicates now receive a fresh stable day ID.
- Added stable day IDs to every current day-creation path, including first-day creation and implicit day creation from activity add/move flows.
- Added safe boot-time repair for historical duplicate day IDs from older builds.
- Hardened Activity editing to resolve the current record from stable day/activity identifiers instead of retaining editor indices.
- Hardened Stay, Journey, Expense and Document editors to save/delete by stable entity ID rather than list position.
- Preserved stale cross-window token evidence when a sheet closes, preventing a missed `storage` event from becoming a close-then-write corruption path.
- Added release-gate coverage for the identity and stale-close invariants.
- Backend/server behavior remains unchanged; AI V2 transport remains disabled; Amharic native wording review remains pending.

# TripMaster v3000-RC2 — Audit Hardening

- Closed the remaining cross-window editor corruption path: open sheets pin the canonical trip-state token, wake/pageshow never adopts external trip/settings state underneath an editor, and repeated stale Save attempts stay blocked until the sheet closes and canonical state is safely reloaded.
- Added release-gate coverage for the editor/wake invariant so QA can no longer assert the old unsafe behavior.
- Added a content fingerprint to the Service Worker cache identity; the release gate recomputes it from the exact shipped app-shell bytes so a same-version content redeploy cannot silently reuse the live generation.
- Changed Planner header date ranges to abbreviated month names to avoid browser-dependent numeric am-ET month/day ambiguity.
- Multi-night journeys now cover every calendar night in transit, not only the departure night.
- Kept Amharic intent keyword expansion deferred pending native linguistic review; quick prompts remain explicitly routed and the backend transport remains unchanged.

# TripMaster v3000-RC2 — Amharic + Client Hardening

- Activated Amharic (`am` / `am-ET`) as the seventh UI language with complete 970-key parity and placeholder validation.
- Kept Amharic LTR, added first-run/device-locale selection, early direction boot, localized boot-failure copy and Ethiopic-friendly local/system font fallback.
- Extended the release gate so Amharic is treated exactly like every other active language for key parity, placeholder parity, locale metadata and script coverage.
- Added cross-window Settings convergence: language/preferences changed in another window are adopted from canonical storage, while stale whole-settings saves are blocked instead of overwriting newer values.
- Added modal `inert` management so only the top sheet remains exposed to assistive technology while nested sheets are open.
- Fixed Service Worker periodic update checks after bfcache restore by restarting timers on `pageshow`.
- Preserved the v2900 activities-first layout and all v2800-RC2 independent-audit hardening.
- Backend/Replit/AI transport remains unchanged.

# TripMaster v2900-RC1 — Activities-First Planner

- Moved the Planner's secondary overview stack below the activity area so travellers reach the day plan first.
- TripMaster AI remains immediately below the activities.
- Access preferences, day health/logistics, Readiness, Booking/Stays/Today cards and secondary Money/Documents/Board/Brief tools remain available below the primary planning content.
- Added a release-order regression guard so future markup changes cannot silently move the overview stack back above activities.
- Preserved all v2800-RC2 Service Worker, cross-window, Readiness, AI-client and audit hardening.

# TripMaster v2800-RC2 — Independent Audit Hardening

- Fixed confirmed cross-window stale-save data loss after an external-state guard block.
- Added stale Service Worker/page mismatch protection: affected tabs must reload before further writes.
- Reworked app-shell install into staging + rollback promotion and scoped caches by registration path.
- Fixed AI Today fingerprint minute churn and punctuation-sensitive short intent matching.
- Fixed false missing-stay warnings for explicit overnight journeys and sparse itinerary spans.
- Excluded cancelled activities from schedule-health conflict calculations.
- Added RTL-safe flow rendering for route/time/date pairs.
- Tightened future V2 fail-closed validation and removed duplicate timeout retries.
- Hardened portable ID remapping and duplicate-ID backup validation.

# TripMaster v2800-RC1 — Service Worker & PWA Reliability

- Closed two remaining icon-only accessibility gaps: Theme and AI launch controls now expose localized accessible names, with a release gate covering visible form labels and those icon controls.
- Added GitHub-clean/performance release budgets for root/total file counts and the current app.js, i18n, CSS and root-package size envelopes so future feature work fails loudly before repository/runtime bloat returns.

- Replaced automatic service-worker `skipWaiting()` with user-controlled activation from the existing update banner.
- Added a one-time guarded v2700 → v2800 lifecycle bridge because the legacy client cannot message a waiting worker; after the first modern shell cache exists, future updates use the user-controlled protocol only.
- “Reload now” now asks the waiting worker to activate, waits for activation, then reloads; a failed activation restores the action instead of leaving a dead button.
- Added throttled update checks on load, foreground, online recovery and long-lived installed sessions, with `updateViaCache: "none"`.
- Precache fetches use `cache: reload` to avoid packaging stale HTTP-cached shell files into a fresh worker.
- Failed core precache now deletes its partial release cache before the install rejects, so retries cannot mistake a half-built v2800 cache for a completed migration.
- Service-worker fetch interception is now strictly limited to same-origin app-shell GET requests. Future API/private/cross-origin traffic is never runtime-cached by the shell worker.
- Cache cleanup now touches only TripMaster-owned cache namespaces and retains the current plus two recent predecessors.
- Navigation remains app-shell cache-first for deterministic offline boot after a successful install.
- Added sanitized service-worker lifecycle/controller-version telemetry to Beta Diagnostics report v3.
- Added executable regression coverage for unrelated-cache preservation, explicit activation and API/private-request non-interception.
- Removed the obsolete hidden Anthropic/API-key client path. Historical `settings.apiKey` values are accepted only for backward compatibility, then dropped and never persisted again.
- Added a client CSP with exact current Planner-backend connectivity, same-origin scripts/workers, no embedded frames/objects, same-origin form submission, `noopener` enforcement for external blank-window navigation and a no-referrer policy.
- Backend/Replit/AI transport remains unchanged.

# TripMaster v2700-RC2 — Stay Readiness + Direct Fix CTA

- Fixed the accommodation off-by-one: the final itinerary date is checkout/departure, not an extra night requiring a stay.
- Stay coverage now uses all valid itinerary dates except the final chronological date, even when the last day was not manually classified as Departure.
- Readiness “review/fix” for a real stay gap now opens Add Stay directly and pre-fills the missing contiguous date range.
- Trip Board stay-gap detail rows use the same direct repair path.
- Readiness navigation closes its source sheet before opening another product surface, preventing stacked-sheet dead ends.
- Stay-gap copy now describes missing nights rather than missing trip days.
- AI V2 client foundation from RC1 is unchanged. Backend/Replit remains untouched.

## Client contract and server boundary
- Added `app-ai-client.js` as a dedicated client-only AI V2 contract module.
- Added versioned `USER_QUESTION` and `TRIP_EVENT` envelope builders, stable entity hints, context fingerprints, locale metadata, capability metadata and privacy manifests.
- Added explicit `AI_CLIENT_CONTRACT_VERSION = 2` and `AI_V2_TRANSPORT_ENABLED = false`. The production backend/Replit server is unchanged and the current Planner still posts the same legacy body to `/v1/agent/query`.

## Context selection and privacy
- Access Profile, Mobility preferences, Today context and budget aggregates are now attached to the current Planner request only when the question policy actually needs them.
- Activity-level legacy Access evidence is omitted from normal AI context unless the question is Access-related. Stored legacy values remain untouched in trip data.
- Added a minimized `tripmaster-context-v2` projection for the future backend. Entity-focused research/live questions narrow context by entity class: hotel → Stays, train/flight → Journeys, attraction → activity/day candidates, instead of shipping unrelated itinerary sections.
- Documents, confirmation codes, booking URLs, free-form notes, itemized expenses, payment secrets and provider secrets remain excluded by default. V2 Money context keeps only budget/aggregate totals.
- Access free-form notes are not sent; the client exposes only structured functional requirements and whether custom requirements exist. General Today context also omits legacy activity Access evidence unless the question is Access-related.
- Added a recursive forbidden-key privacy validator to the future V2 envelope. It records whether client validation passed and marks unsafe envelopes as not transport-eligible.
- Planning requests can include Mobility preferences without dragging in the Access Profile.

## Entity and operational preparation
- AI context now preserves stable day IDs in addition to existing trip/activity/stay/journey IDs.
- Journey context now carries arrival date, public provider name and service number for future entity/live-provider resolution while still excluding confirmation codes.
- Added entity hints for Stay, Journey and Activity objects, all marked as `STORED_TRIP_FACT`. Entity focus also applies to live/booking requests, so a train-delay question hints `JOURNEY` and an attraction-booking question hints `ACTIVITY`.
- Tightened live-data hints: the word “now” alone does not imply operational truth. Weather, delay/status and open-now signals do.
- Added a metadata-only `TRIP_EVENT` contract ready for future app-open/trip/entity mutation delivery once the server event endpoint exists.

## Evidence and stale-answer safety
- Added a future V2 response validator that fails closed when research/live-data responses lack a successful tool execution receipt, verified evidence, verified entity identity, freshness, claim-level evidence linkage, or `VERIFIED_OPERATIONAL` evidence for live operational claims. Canonical `ENTITY_RESEARCH` and explicit live-status hints cannot silently downgrade if a V2 response omits its own research/live flag.
- Added optional verified-source rendering when a future V2 response carries evidence observations.
- Added context-fingerprint comparison against canonical persisted state so a response cannot render after relevant trip state changed in another window.

## Observability / QA
- Beta Diagnostics schema is now report version 2 and includes a sanitized in-memory AI client trace containing only contract version, intent/scopes, entity-hint count, attempt/status/duration and evidence-gate status. It never stores prompt text or trip content.
- Added regression/release gates for context minimization, envelope schemas, privacy exclusions, hotel entity focus, stable fingerprints, event envelopes, evidence fail-closed behavior, module load/precache order, disabled V2 transport and unchanged legacy Planner transport.

# TripMaster v2600-RC1 — Readiness 3.0 & Operational Actions

## Readiness model
- Removed the user-facing orange `Check` readiness state. Top-level Readiness is now binary: `Looks good` or `Needs attention`.
- Added neutral operational `action` rows so useful follow-ups remain visible without degrading the trip's health state.
- Optional destination/timezone metadata no longer creates Readiness noise.
- Missing trip dates, invalid/duplicate trip dates, schedule conflicts, insufficient entered transfer time, stay overlaps/date problems/gaps, budget exceedance and overdue tasks are treated as real issues.

## Operational follow-up quality
- Booking follow-up now comes from `bookingAttentionEntries()` once, preventing one Planned + unpaid booking from being counted twice in Readiness.
- Needed documents, due-today checklist items and explicitly tracked incomplete transfer duration remain neutral actions.
- Planner, Home, Overview, Trip Board and Trip Brief now separate issues from actions and do not show the old `?` readiness state.
- Readiness CTAs use a neutral Open label for action-only groups and Review & fix only when an actual issue is present.

## Today
- Reclassified planned booking, tracked payment, needed document and incomplete tracked-transfer notices from `check` to `action`.
- Today keeps proven timing/stay conflicts as issues, while normal follow-up work is labelled Action instead of Check.

## Data integrity
- Readiness detects restored/imported journey records with invalid dates/times or impossible arrival chronology.
- Beta Health now audits stay dates/times and journey dates/times/chronology in addition to the existing trip/day/activity graph checks.

## QA / scope
- Added regression and release-gate assertions that the top-level Readiness state cannot become `check`, optional destination/timezone do not feed Readiness, booking attention is deduplicated, and Today no longer emits `check` severity.
- Client/PWA only. Backend, Replit and AI V2 are unchanged.
- Existing module split and GitHub-clean package discipline are preserved.

# TripMaster v2500-RC1 — Readiness Signal Quality & Access Profile

## Access workflow
- Removed Activity accessibility status and Accessibility note from Add/Edit Activity.
- Preserves existing `accessStatus` / `accessNote` data on normal edits and restores; no destructive migration.
- Removed the Edit Activity Access quick shortcut and all field-focus routing to the retired controls.
- Access routing now opens the Access Profile after closing the source readiness sheet, preserving the RC4 stacked-sheet safety contract.
- Unchecked / `needscheck` activities no longer create Readiness, Today or day-health warnings. Legacy verified/problem evidence can still render as read-only context.

## Readiness signal-to-noise
- Readiness no longer treats undated open checklist items or an optional trip base as warnings.
- Explicitly tracked but incomplete transfers remain actionable; Day Intelligence already counts only transfers the traveller opted into tracking.
- Missing trip dates now create an actionable setup check. Invalid and duplicate trip dates are issues.
- A no-problem trip now uses a positive “Looks good” readiness label.
- The setup CTA for a trip with no dates opens first-day creation instead of Trip Details.
- Existing explicit action states remain: schedule conflicts, invalid times, insufficient entered transfer time, stay overlaps/date errors/gaps, planned bookings/journeys/stays, tracked unpaid/partial payments, needed documents, budget exceedance, overdue/due-today tasks, missing destination and missing timezone.

## QA / scope
- Added release-gate assertions that activity Access fields stay absent, legacy Access data is not deleted by the activity mapper, Today does not create `access_needs_check`, and optional/unresearchable states stay out of Readiness.
- Added deterministic Today regression for an Access-active trip containing a `needscheck` activity.
- Backend/Replit/AI implementation is unchanged.
- Repository remains GitHub-clean with the existing runtime module split.

# TripMaster v2400-RC4 — Access Readiness Navigation Fix

- Fixed Android/Chrome runtime bug where the Access “Review & fix” CTA opened the Menu sheet behind the still-open Overview sheet, leaving the visible CTA effectively dead.
- Access readiness now opens the highest-priority activity directly in Edit Activity, expands advanced options and focuses the Access status field.
- Known Access problems are prioritized before unchecked / needs-check activities.
- Added a defensive fallback to Access preferences if no review target remains by tap time.
- Advanced Edit Activity shortcuts can now focus a specific field instead of always landing on Travel mode.

# TripMaster v2400-RC3 — Beta Undo Integrity Fix

- Invalidates whole-state Undo immediately when another TripMaster window writes trip state.
- Binds every Undo record to the exact persisted state that existed after the undoable action; Undo fails closed if storage changed later, even after auto-sync or wake cleared the pending flag.
- Prevents stale Undo after Restore from erasing newer cross-window state.
- Moves the trip-delete external-state guard ahead of the single-slot safety snapshot so a refused delete cannot overwrite an older recovery snapshot.
- Refreshes Data Safety Center grid values after a manual health check.
- Extends translation-reference QA to include `tfPlural()` and adds release gates for the cross-window Undo contract.

# TripMaster v2400-RC2 — Independent Beta Audit Fix Campaign

Independent read-only Chromium QA on v2400-RC1 found one blocking stale-window reset path, one high-risk stale backup/health path, and several smaller beta-hardening gaps. RC2 addresses the verified client findings without changing backend/AI behavior.

## Cross-window data safety
- Reset now runs the same external-state guard used by Restore before any safety snapshot or destructive write. A stale window must adopt the newest persisted trip state and require a fresh deliberate Reset attempt.
- Safety snapshots are built from persisted canonical trip state rather than the current window's potentially stale in-memory array.
- Full backups and Beta Health Check read persisted canonical trip state without clearing a pending editor conflict.
- Successful wake/background recovery now clears the external-state pending flag and queued sync timer, preventing the first legitimate post-wake write from being falsely rejected.
- Undo snapshots are invalidated when a newer external state exists so a second Undo press cannot replay a stale whole-state snapshot over newer data.
- Sheet close no longer skips deferred state-sync/update hooks merely because no focus-return record exists.

## i18n / QA
- Added the missing `toast_done` translation to all six active languages.
- Release QA now verifies that every literal `t()` / `tf()` / `data-i18n*` key referenced by runtime code actually exists, not only parity between language tables.

## Backup compatibility and downloads
- Backups with no historical `settings` object are accepted as legacy-compatible with a warning; malformed present settings are still rejected.
- Full backup and ICS fallback downloads now use an attached anchor and deferred object-URL revocation, matching the newer Android-safe export paths.

## QA
- Regression and release gates cover the RC2 fixes above.
- Client-only scope remains in force; backend/AI are unchanged.

---

# TripMaster v2400-RC1 — Beta Reliability & Support

## Local data integrity
- Added a pure structural audit for trips, days, activities, stays, journeys, expenses, documents and tasks.
- Detects duplicate/missing stable IDs, malformed collections, stale active-trip pointers, invalid calendar/time shapes and unresolved entity links.
- Audit output is structural only and does not echo trip names, IDs, places, notes, booking references or amounts.
- Data Safety Center now exposes a user-facing Beta Health Check and summary.

## Privacy-minimized beta diagnostics
- Added copy/download diagnostic report actions to Data Safety Center.
- Reports app version, locale/direction, online/offline state, Service Worker control, storage writability, aggregate record counts, audit result codes and session-only runtime fault breadcrumbs.
- Runtime breadcrumbs record only error type/source file/line/column; exception messages and user trip content are not persisted.
- Beta feedback template now includes structural health and runtime-fault counts.

## Restore hardening
- Full backup files are rejected above 15 MB before FileReader loads them.
- Added deterministic backup shape/version/app validation before restore and again at the destructive restore boundary.
- Foreign, future-unsupported, malformed and pathological backup payloads fail closed.
- Existing pre-restore local safety snapshot remains mandatory.

## Multi-window stale-write protection
- TripMaster now listens for local trip-state changes made by another tab/PWA window.
- If a sheet is open, the external change is deferred until the user exits the sheet.
- Ordinary state mutations, direct trip writes, Undo and Restore refuse to overwrite a known newer external state; the newest local state is loaded first.

## QA
- Regression tests cover healthy/corrupt graph audits, orphan links, duplicate IDs, future/foreign/malformed backups.
- Release gate verifies diagnostics privacy contract, restore size ceiling/validator wiring, cross-window write guard, i18n parity and all existing boot/offline/module/DOM contracts.
- Backend/AI remain frozen and unchanged.

---

# TripMaster v2000-RC1 — Beta Command Center

## Trip Brief
- Added a compact in-app trip summary from the Planner.
- Copy/share output is privacy-hardened: no booking references, confirmation codes, private notes or exact financial amounts.
- The local on-screen brief still shows operational counts and the recorded budget summary for the traveller.

## Actionable Attention
- Trip Board Attention now expands high-level schedule counts into exact overlap, invalid-time and insufficient-transfer rows.
- Stay overlaps/gaps and overdue checklist tasks get concrete detail rows.
- Tapping a day-level schedule detail returns directly to the affected Planner day; other details route to the relevant operational area.

## Home trip phase
- Upcoming trips keep the countdown.
- Active trips show Day X of Y and flag the final day.
- Past trips show how many days ago they ended.

## Import hardening
- Single-trip transfer now validates nested data shapes before import.
- Pathological collection counts are rejected before cloning/persisting, reducing freeze/memory risk from malformed transfer files.

## QA
- Regression coverage expanded for trip-transfer structural limits.
- Release gate now verifies Trip Brief presence, share-safe field exclusions and actionable attention wiring.
- Existing boot/SPCK module-order, i18n, offline, version/cache, DOM ID and syntax gates remain.

---

# TripMaster Changelog
Consolidated release history.

---

# TripMaster v1800-RC1 — Portability & Data Integrity

Baseline: v1700-RC1 GitHub-clean. PWA/client only; backend and AI V2 remain frozen.

## Single-trip transfer
- Export the current trip as a versioned TripMaster JSON package.
- Share the trip file through the native Web Share sheet when file sharing is supported; otherwise download it.
- Import a TripMaster trip package as a NEW trip without replacing any other local trips.
- Imported/duplicated trip graphs regenerate trip, day, activity, stay, journey, expense, document and task IDs. Linked expense/document references are remapped to the cloned entities.
- Import rejects malformed/wrong package types and caps files at 10 MB.

## Data integrity
- One-time additive migration fills missing stable IDs on legacy days, activities, stays, journeys, expenses, documents and tasks. Existing IDs are never rewritten.
- Trip duplication now uses the same graph-clone primitive as portable import.

## Checklist 2.1
- Existing checklist tasks can now be edited in place, including title, due date and priority.
- Edit mode has an explicit cancel action and preserves completion state.

## QA
- Added deterministic tests for trip-envelope validation, graph cloning and linked-ID remapping.
- Release gate now requires portability controls, import input, stable-ID migration and checklist edit wiring.

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
