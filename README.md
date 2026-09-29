# v3800-RC2 - 23 September 2026

Targeted recovery and large-text corrections F1-F6 only. The only source was
`TripMaster-v3800-RC1-GITHUB-CLEAN.zip`, SHA-256 `e2c3f09e96e362da19603a4bca00dbb131bb097a26568f134796f41264c674c2`.
The original archive is unchanged. No v3900, new features, server, or AI transport work.

- **F1:** Find byte-identical corrupt backups in persistent storage across boots.
  Preserve distinct raw values without overwriting same-millisecond backups.
  Recovery snapshots reference verified corrupt copies and retain healthy sibling
  values; an earlier good safety snapshot stays intact. Missing/failed raw
  preservation blocks replacement. Identical recovery metadata is reused.
- **F2:** Filter null, primitive and array members from known row arrays before
  validation. Preserve exact original bytes before allowing repair. Non-array
  collection shapes still quarantine; unknown fields and valid rows survive.
- **F3:** Keep persisted active-trip evidence while trips are unreadable. Healthy
  stale-pointer normalization continues.
- **F4:** Unreadable settings use supported device locale or English, both at
  early direction boot and full app boot; unreadable settings are not overwritten.
- **F5:** Rollback failure gets a distinct calm partial-save warning and a Safety
  Center action. Existing sanitized `rollback_failed` diagnostic records remain.
- **F6:** Reflow Today rows/actions/long tokens and Planner hero actions. Fix the
  additional measured Planner Documents-card overflow. Scope wrapping to affected
  content; intentional horizontal chip scrollers retain their behavior.

Validation: Node regression, 22 existing behavioral hardening groups, release gate,
and 42 real Chromium browser groups (including 24 layout combinations) passed.
The full suite is repeated from a newly extracted final ZIP. See
`qa/RC2-RETEST.md` for evidence, reproduction commands and limitations.

All 970 existing translation keys/values remain unchanged across all 7 languages;
one partial-save message is added in each language, producing **971 x 7** parity.
Amharic remains `am-ET`/LTR. Native review of the new Amharic message is pending.
The Service Worker algorithm and cache architecture are unchanged; only release,
content-derived build ID, fingerprint and asset digest constants change.

Next: short independent Claude re-test of F1-F6, then user Android/installed-PWA QA
if clean. No further feature development before device QA unless a blocker forces it.

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


# TripMaster v3500-RC1

Local-first travel-planning PWA. This repository package is the cleaned GitHub form of v3500-RC1.


## v3500-RC1 deployment portability + installability hardening

This release hardens the web-app install surface before later physical-device QA. The Web App Manifest now uses a deployment-relative identity (`./`) so `/TripMaster/`, staging and sibling deployments do not claim the same installed-app identity, while `start_url` and `scope` remain deployment-relative. Release QA now resolves the manifest against production-like and sibling paths, validates that start URL stays inside scope, checks actual PNG dimensions against declared icon sizes, requires a 512×512 maskable icon, and requires every manifest icon to be in the app-shell precache. Native form controls also receive explicit light/dark `color-scheme` metadata, and the manifest permits either device orientation rather than forcing one. No backend, AI transport or Amharic wording changes are included.

## v3400-RC1 mobile accessibility + large-text resilience

This release hardens the existing mobile UI before physical-device QA. Generic buttons can grow and wrap instead of clipping at large text sizes, the sticky header can expand beyond its normal 62px floor, bottom sheets use dynamic viewport sizing/contained overscroll where supported, every newly opened sheet starts at its top, and the remaining small interactive controls are raised to the 44px touch-target floor. Sheet headings can wrap beside a fixed close target, and forced-colors users retain visible interactive boundaries and selected states.

## v3300-RC1 device-QA diagnostics + supportability

This release prepares the client for later Android/device QA without changing product data or backend behavior. Beta Diagnostics schema v4 adds a sanitized, session-only lifecycle timeline for boot readiness, visibility/background transitions, bfcache-style pageshow/pagehide, online/offline changes, Service Worker lifecycle state, update/reload events, external-state convergence and blocked-write reasons. Service Worker diagnostics also expose controller proof duration/attempts/timeouts plus the registration scope path so slow wake/update issues can be diagnosed without exporting a full URL, user-agent string, trip names, places, notes, booking references or money amounts.

## v3200-RC3 migration/link integrity re-test hardening

This release closes the final v3200 targeted re-test blocker before Android/device QA. Stable-ID repair now preserves unambiguous per-trip links when globally duplicated historical IDs are re-issued, including trip/stay/journey/activity links used by Money and Documents. Trips missing `trip.id` are preserved long enough for migration repair instead of being silently filtered out. The Service Worker cache ownership matcher is tightened against version-shaped sibling deployments, and provisional controller-version checks still fail closed without permanently latching a false reload requirement when the controller later proves compatible.

## v3200-RC2 Targeted QA hardening

This release closes the v3200 targeted-audit findings before Android/device QA: own-write sheet token convergence, legacy duplicate-ID backup repair, exact sibling-safe cache ownership, fail-closed controller-version checks, wake-path recursion protection, fragment-safe navigation, full stable-ID repair across entity types, and promoted-cache core validation.

## v3200-RC1 foundation carried forward

- Offline/non-canonical deep navigations are redirected to the canonical cached `index.html`, preventing relative JS/CSS paths from resolving below an arbitrary deep URL.
- Theme now converges across open TripMaster windows and after frozen/discarded-tab wake, alongside Settings.
- Settings and Theme writes are blocked when the page is behind the active Service Worker generation; stale pages must reload before changing preferences.
- Wake processing compares persisted Settings/Theme tokens so missed `storage` events cannot silently turn into last-writer-wins preference loss. Reset/Restore require canonical preference freshness, and full backup reads persisted Settings rather than stale window memory.
- Service Worker activation removes interrupted `-install` / `-install-backup` caches from older generations within the exact PWA scope.
- Controller-version matching now uses exact cache-token boundaries, avoiding false matches such as RC1 versus RC10.
- No backend/AI transport changes and no unreviewed Amharic intent-keyword expansion.

## v3100-RC1 stable identity + cross-window close hardening

- Every newly created day now receives a stable `day.id` immediately, including first-day creation and implicit day creation while adding or moving an activity.
- Duplicate Day now always creates a fresh day ID instead of copying the source ID.
- Boot-time stable-ID migration repairs historical duplicate day IDs created by older Duplicate Day behavior. Day IDs are safe to repair because they are not booking/document link targets.
- Activity editing tracks the activity UID + day ID instead of retaining mutable list indices across the edit lifecycle.
- Stay, journey, expense and document editors resolve the record by stable entity ID when saving or deleting; sorted list position is no longer the editor identity.
- Closing a sheet now preserves stale canonical-state evidence before discarding its open-state token. This protects close-then-confirm flows even if a frozen/discarded tab missed the original `storage` event.
- No backend transport, provider integration, AI V2 enablement or Amharic wording expansion is included in this batch. Amharic native linguistic review remains pending.

## v3000-RC2 audit hardening

- Cross-window editors cannot adopt a newer canonical trip state while a sheet is open; stale saves remain blocked until the editor closes and state converges.
- Service Worker cache generations are tied to a release version plus an exact app-shell content fingerprint verified by the release gate.
- Amharic header date ranges use abbreviated month names to avoid numeric date-order ambiguity across browser ICU implementations.
- Multi-night train/ferry/flight journeys cover every night spent in transit for stay-readiness purposes.
- Amharic free-text AI intent terms remain intentionally deferred until native review; quick prompts keep explicit intent hints.

## Runtime structure
The runtime modules intentionally remain separate. Do not merge them back into `app.js` merely to reduce file count; the separation protects Today, Travel, Logistics, Finance, Operations and Intelligence behavior.

Core runtime files are the HTML/CSS/JS/manifest/icons at the repository root. QA lives under `qa/`.

## QA
Run from the repository root:

- `node qa/regression.mjs`
- `node qa/release-check.mjs`

Manual device checks: `qa/MANUAL-QA.md`.

The release gate covers syntax, i18n parity, version/cache consistency, precache coverage, manifest sanity, duplicate HTML IDs, SPCK operations-module load order, boot-watchdog invariants, and the static app.js-to-DOM ID contract.

## Amharic beta language
Amharic is active in v3000 as the seventh UI language. The runtime and release gates require full key/placeholder parity, while the copy remains explicitly beta pending native linguistic review.

- Internal code: `am`
- Locale: `am-ET`
- Direction: LTR
- 970/970 active UI keys present with placeholder parity
- Primary travel calendar remains Gregorian
- `Intl.PluralRules('am-ET')` is used as the locale reference for plural-sensitive copy
- No remote font dependency; the UI uses an Ethiopic-friendly local/system font stack
- First-run device-language detection, early direction boot and boot-failure copy include Amharic
- Native QA should cover Android/Chrome PWA, Gboard Amharic, 100–200% font scale, offline, dark mode, backup/restore, language switching and TalkBack

## Frozen workstreams
Production backend/Replit code remains intentionally untouched until the planned October integration work. v3500-RC1 preserves the PWA client contract for AI V2 without enabling any new server transport.

## Release history
See `CHANGELOG.md`.





## v3000-RC2 Amharic + client hardening

- Activates Amharic (`am` / `am-ET`) as the seventh UI language with full 970-key and placeholder parity.
- Keeps Amharic LTR and extends first-run language detection, early direction boot, boot-failure copy and release gates to the new locale.
- Adds Ethiopic-friendly local/system font fallback without introducing a network font dependency.
- Makes settings/language changes converge across TripMaster windows and blocks stale whole-settings saves from overwriting newer external preferences.
- Makes modal sheets inert behind the top sheet so TalkBack/screen-reader navigation cannot wander into hidden background UI.
- Restarts Service Worker update timers after bfcache restoration so long-lived sessions do not silently stop checking for updates.
- Backend/Replit/AI transport remains unchanged.

## v2900-RC1 activities-first planner

- Reordered the Planner so the selected day activities are reached immediately after the day strip.
- TripMaster AI remains directly after the activity area.
- Access profile, day health/logistics, Readiness and Planner operation/navigation cards now follow the activities/AI instead of preceding them.
- No data model, backend or AI transport behavior changed in this release.

## v2800-RC2 independent-audit hardening

- Fixes a confirmed cross-window stale-save data-loss path: when another window changes canonical state, a blocked direct save now keeps the freshly reloaded canonical state instead of restoring the stale pre-action snapshot.
- Blocks writes in a tab whose active Service Worker no longer matches the page version and requires a reload before editing can continue.
- Makes app-shell installation failure-safe with an isolated staging cache and rollback copy; a failed same-version install no longer deletes the live offline shell.
- Scopes Service Worker cache names to the registration path so sibling GitHub Pages deployments cannot trim each other's caches.
- Removes wall-clock time from the AI stale-context fingerprint while keeping the trip/date context stable, preventing Today answers from being discarded merely because the minute changed.
- Makes short intent keywords punctuation-safe (for example `what now?`, `taxi?`, `cost?`).
- Treats an explicit overnight journey as accommodation for its departure night and expands sparse itinerary dates into the full overnight calendar span.
- Excludes cancelled activities from Readiness/day-health schedule-conflict calculations.
- Makes visible route/time/date flows direction-aware in RTL using bidi isolation and a left-pointing flow arrow.
- Tightens future V2 response validation: when V2 transport is explicitly expected, a missing V2 schema fails closed; V2 claims require a known truth layer.
- Prevents a timeout-aborted Planner request from automatically consuming a second full timeout, and ignores Enter while an IME composition is active.
- Hardens portable graph cloning against cross-entity ID collisions and rejects duplicate entity IDs in full backups.

## v2800-RC1 service-worker / PWA reliability

- Service-worker updates now wait for explicit user approval instead of calling `skipWaiting()` during install.
- Includes a one-time legacy lifecycle bridge so the existing v2700 client can transition into the new waiting-worker protocol without getting stuck; after a modern shell cache exists, automatic activation is disabled.
- “Reload now” activates the waiting worker and reloads only after activation; “Later” leaves the current coherent build running.
- Update checks bypass HTTP cache, run on load/wake/online with throttling, and also run periodically in long-lived installed sessions.
- App-shell precache requests use `cache: reload` so a new service worker cannot accidentally package stale HTTP-cached JS/CSS.
- Core precache is failure-clean: a broken install deletes its partial release cache before retry, preserving the legacy migration path and preventing half-built shells from looking valid.
- Fetch interception is allowlisted to same-origin app-shell GET requests only. Cross-origin traffic, POST/API calls and unknown same-origin resources are never runtime-cached.
- Cache cleanup is restricted to TripMaster-owned cache prefixes and retains recent predecessors to reduce mixed-version risk for older open tabs.
- Beta Diagnostics report version 3 includes sanitized service-worker lifecycle/controller-version state.
- Regression gates now exercise cache isolation, explicit update activation and non-interception of API/private traffic.
- Client security boundary is tighter: the obsolete hidden Anthropic/API-key input path is removed, legacy `apiKey` settings are purged on load/persist, CSP permits connections only to same-origin plus the currently configured Planner backend, limits form submission to same-origin, external `_blank` windows use `noopener`, and external navigation sends no referrer.

## v2700-RC2 stay readiness and direct repair
- Accommodation readiness is night-based: the final itinerary date is checkout/departure and no longer creates a false missing-stay issue when a stay ends that day.
- A stay-gap Readiness CTA opens Add Stay directly with the missing date range pre-filled.
- Trip Board gap details use the same repair flow, and Readiness cross-surface navigation closes the source sheet first.

## v2700-RC2 AI V2 client foundation
- Adds a dedicated `app-ai-client.js` module with versioned `USER_QUESTION` and `TRIP_EVENT` envelopes for the future production AI V2 backend.
- Keeps `AI_V2_TRANSPORT_ENABLED=false`; the live Planner still uses the existing `/v1/agent/query` endpoint and request body. No backend or Replit code is modified.
- Adds client-side context policy hints and privacy scoping. Access, Mobility, Today and budget context are no longer attached to every AI question; for example, a hotel-research question excludes those profiles and budget totals. Planning questions can still receive relevant mobility preferences without receiving the Access Profile.
- Adds a versioned `tripmaster-context-v2` projection with stable entity IDs, entity hints, stored-fact truth-layer metadata and privacy manifests. Entity-focused research/live requests are narrowed by Stay, Journey or Activity focus instead of duplicating unrelated itinerary sections.
- Preserves public operational identifiers useful for future provider resolution, including journey arrival date, provider and service number, while confirmation/booking references remain excluded.
- Adds a context fingerprint so an answer generated against stale trip state is discarded rather than rendered after a cross-window change.
- Adds forward-compatible evidence/provenance rendering and a V2 response gate. A future research/live-data response cannot render without a successful tool execution receipt, verified evidence, verified identity, valid freshness, claim-to-evidence linkage and the correct operational truth layer. Canonical entity-research and explicit live-status requests also cannot silently downgrade just because a V2 server response forgets to set its research/live flag. “What should I do now?” does not by itself claim live operational data is required.
- Adds privacy-safe AI client observability to Beta Diagnostics: intent hint, selected scopes, entity-hint count, attempt/status/duration and evidence-gate result. Prompt text and trip content are not logged. A forbidden-key validator also marks future V2 envelopes unsafe if booking confirmations, notes, documents, itemized expenses or other protected key classes leak into the outbound context.
- Adds deterministic QA for privacy scoping, hotel entity focus, envelope contracts, event contracts, context fingerprints, evidence fail-closed behavior and backward-compatible legacy transport.


## v2600-RC1 Readiness 3.0 and Today action semantics
- Readiness now has only two top-level states: **Looks good** or **Needs attention**. The old orange Check state is gone.
- Operational follow-ups are neutral **actions**. They stay visible and navigable without making the whole trip look unhealthy.
- Optional destination/timezone gaps are no longer Readiness warnings. Missing trip dates, invalid/duplicate dates, hard schedule conflicts, accommodation gaps/overlaps, budget exceedance and overdue tasks remain real issues.
- Booking follow-up is deduplicated through Booking Center attention rows, so one booking cannot inflate Readiness because it is both Planned and unpaid/partial.
- Planner, Home, Overview, Trip Board and Trip Brief now report issues separately from open actions.
- Today uses **Action** rather than **Check** for planned bookings, tracked payments/documents and explicitly tracked transfers that still need completion.
- Readiness and Beta Health now catch invalid or impossible restored/imported stay and journey date/time chronology.
- Access remains profile-driven and activity Access fields remain hidden while legacy stored evidence is preserved.
- Backend/Replit/AI remain unchanged. Repository structure remains GitHub-clean and modular.


## v2500-RC1 readiness signal quality
- Add/Edit Activity no longer asks travellers to classify venue accessibility or maintain an accessibility note. Existing stored `accessStatus` / `accessNote` values remain untouched for backward compatibility and future research use.
- Unchecked Access state is no longer a Readiness or Today warning, and legacy `needscheck` no longer appears as a user task badge.
- Readiness now distinguishes explicit action from optional detail: undated open checklist items and an optional trip base do not create warning noise.
- Essential trip-date integrity is stronger: missing trip dates are actionable, while invalid or duplicate trip dates are issues.
- A trip with no meaningful problem can surface the positive `Looks good` state.
- Access navigation now targets the Access Profile, never a removed activity field.
- Readiness setup for a trip with no dates opens first-day creation instead of a dead-end Trip Details screen.
- Today, Overview and day-health surfaces no longer nag about unresearched activity accessibility.
- Release QA locks the new Access/readiness contract while preserving the existing 25-file GitHub-clean structure.


## v2400-RC2 audit fixes
- Reset/safety snapshots are protected against stale multi-window state.
- Full backup and Beta Health Check read the persisted local source of truth.
- Wake/background recovery clears resolved external-state conflicts.
- Literal runtime translation references are checked against the i18n tables.
- Legacy backups without a settings object remain restorable; malformed settings are still rejected.
- Full-backup and ICS downloads use the safer attached-anchor/deferred-revoke pattern.

## v2400 beta reliability
- Local Beta Health Check audits TripMaster graph structure, stable IDs, date/time shapes and link integrity without uploading trip content.
- Beta Diagnostics can be copied/downloaded as a privacy-minimized support report with app/runtime health, aggregate record counts, audit codes and session-only fault breadcrumbs.
- Full backup restore is validated before destructive restore and large files are rejected before FileReader loads them.
- Cross-window state changes are detected. Ordinary writes are blocked until the newest local state is adopted, reducing stale-tab overwrite risk.
- Feedback templates include version plus health/fault counts but no trip content.

## v2000 beta command center
- Trip Brief: a compact local summary with copy/share output that deliberately omits booking references, confirmation codes, private notes and exact financial amounts.
- Trip Board Attention now expands schedule, stay-gap/overlap and overdue-task problems into exact actionable rows.
- Home trip cards show a clearer trip phase: countdown, current trip day, final day or days since completion.
- Single-trip import now validates nested collection shapes and rejects pathological record counts before cloning into local state.

## v1800 portability
The Data Safety Center can export/share one trip and import it as a new local trip without replacing the rest of the device state. Imported graph IDs are regenerated to prevent collisions.

## v2400-RC4 Access navigation fix

Historical RC4 behavior fixed a stacked-sheet dead end by routing Access Readiness to an activity field. v2500-RC1 supersedes that product model: activity-level accessibility is no longer user-maintained, and Access navigation now targets the Access Profile instead.

## v2400-RC3 beta safety fixes

RC3 closes the remaining cross-window stale-Undo data-loss path found in independent Chromium QA. Undo records now expire on any external trip-state write and are also validated against a persisted-state signature before replay. Trip deletion now checks cross-window freshness before overwriting the single safety snapshot slot, and the Data Safety Center refreshes its visible counters after a health check.

