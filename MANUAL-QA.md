# v3800-RC2 targeted re-test - 23 September 2026

Current release procedure and F1-F6 evidence: see [RC2-RETEST.md](RC2-RETEST.md).
Run syntax, regression, hardening (including `--browser`) and release-check before
packaging, then repeat all from a fresh final-ZIP extraction. This release contains
29 files (23 root files, 6 QA files). Generated logs, screenshots and browser
binaries belong outside the release directory and are not shipped.

The older sections below are historical checklists, not claims of RC2 device QA.
The next gate is independent Claude F1-F6 re-test, then real user Android and
installed-PWA QA. Do not resume feature work before that gate unless blocked.

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


# v3500-RC1 — deployment portability + installability hardening

1. Serve/install the current build from the production-style `/TripMaster/` path. In browser app/manifest inspection, verify the resolved app identity and scope are `/TripMaster/`, and launch from the installed icon into `index.html` inside that scope.
2. If practical, serve the same package from a sibling path such as `/TripMaster-beta/`. Verify its resolved manifest identity is the sibling path rather than `/TripMaster/`; installing/testing one deployment must not take ownership of the other's scope/cache.
3. Inspect installability: name/short name are TripMaster, display is standalone, all three icons load, the 192×192 and 512×512 regular icons render, and the 512×512 maskable icon is accepted without a broken/missing image.
4. Install/relaunch in both portrait and landscape. The manifest must not force a single orientation; the UI should remain usable after rotation.
5. Switch light ↔ dark theme and inspect native controls (selects, date/time inputs, checkboxes where present). They should follow the current light/dark scheme without illegible browser-default chrome.
6. After one successful online install/load, go offline and relaunch from the installed icon. Manifest icons and the normal app shell must already be available from the current precache.
7. In Beta Diagnostics, verify `scopePath` matches the actual deployment path being tested and no full URL/user-agent/private trip content appears.
8. Re-run the v3400 100–200% text-scale, keyboard/bottom-sheet, touch-target and Android Back checks after install/relaunch.

# v3400-RC1 — mobile accessibility + large-text resilience

1. Test Android font/display scaling at 100%, 150% and 200% in Home, Planner, Today, Logistics, Money, Documents, Trip Board and confirmation sheets. Primary buttons may grow/wrap but must never clip their label or overlap adjacent controls.
2. At large text, verify the sticky header can grow vertically while Menu/Language/Theme/Home controls remain usable and the trip name/date area does not overlap them.
3. Open a long sheet, scroll near the bottom, close it, then reopen it. A fresh open must start at the top. Re-rendering an already-open sheet must not unexpectedly jump to the top.
4. With the Android keyboard open in Add/Edit Activity, Stay, Journey, Expense, Document and Task flows, verify the active bottom sheet remains scrollable and action controls can be reached.
5. Try overscrolling at the top/bottom of a sheet. The sheet should contain the gesture instead of dragging the page behind it.
6. Verify Undo/toast action, AI quick prompts, Readiness actions, filter chips and day-strip action buttons have comfortable touch targets at narrow widths.
7. Check very long labels in all seven languages. Sheet titles and buttons may wrap; the 44px close button must remain visible and tappable.
8. With an OS/browser forced-colors or high-contrast mode if available, verify interactive boundaries and selected states remain distinguishable.
9. Re-run reduced-motion, focus trap/return, stacked-sheet inertness and Android Back smoke tests.
10. Re-run v3300 Beta Diagnostics after background/foreground and keyboard/sheet use; the lifecycle report must remain privacy-minimal.

# v3300-RC1 — device-QA diagnostics + supportability

1. Open Beta Diagnostics after a normal launch. The JSON must report `reportVersion: 4`, app version, language/direction, aggregate record counts, Service Worker state and a `lifecycleTimeline`, but must not contain trip names, places, notes, booking references, money amounts, full URLs or a browser user-agent string.
2. Background and foreground the app, then reopen diagnostics. Confirm the timeline contains only safe event names/details such as visibility, pageshow/pagehide and state-sync flags.
3. Toggle offline/online and verify the timeline records those transitions without adding network addresses.
4. With a matching Service Worker, inspect `controllerCheckDurationMs`, `controllerCheckAttempts`, `controllerCheckTimedOut` and `scopePath`. On normal wake the proof should complete and writes should become available.
5. During the short fail-closed controller-proof window, attempt a disposable Trip/Theme/Settings write. Diagnostics should show a sanitized `write_blocked` event with scope/reason only. No typed form content may appear in the report.
6. Open two windows, make a change in A and let B converge. Diagnostics in B should show `storage_change`/`state_sync` categories only, with no IDs or trip content.
7. Exercise an update-ready / reload-required flow if available. The timeline should record update state, and existing v3200 stale-write/data-integrity protections must remain intact.
8. Copy and download the diagnostics report and inspect both outputs before sharing. They should be equivalent and privacy-minimal.

# v3200-RC3 — final targeted re-test before device QA

1. **Cross-trip duplicate-ID links:** seed/import two trips that historically share trip/stay/journey/activity IDs. After boot repair, verify the second trip receives fresh IDs and its own Money/Document links still resolve to its own entities.
2. **Ambiguous same-trip duplicates:** if the same linkable old ID occurs twice inside one trip, verify repair does not guess/remap the link to the later duplicate.
3. **Missing trip ID:** seed one otherwise-valid trip with no `id`; boot must preserve it, assign a fresh stable trip ID and keep all trip content.
4. **Backup round-trip:** restore legacy duplicate-ID data, export a fresh backup, restore it again and verify all records and valid links remain stable.
5. **Version-proof window:** immediately after load/pageshow, attempt a Trip and Theme/Settings write while controller identity is still unresolved. The write must be blocked temporarily, but once the matching controller reply arrives, the next write must work without requiring a reload.
6. **Real mismatch:** with a genuinely different controller version, writes must remain blocked and Reload required must stay latched.
7. **Sibling scope cache:** on one origin, simulate `/TripMaster/`, `/TripMaster-beta/` and `/TripMaster-v2/`; updating the main app must not delete either sibling's shell or install caches.
8. Re-run the v3200-RC2 hub sequential-save, stale-window, offline fragment/deep-link, broken-update rollback and exact-version scenarios below.

# v3200-RC2 — Android/PWA lifecycle + preference convergence

1. **Offline deep navigation:** after one successful online install/load, go offline and navigate to a same-scope non-canonical path such as `/TripMaster/some/deep`. The Service Worker must canonicalize to `index.html` and the full local app shell must boot, not the boot-failure watchdog.
2. **Theme cross-window:** open two windows. Toggle Theme in A. B must converge without a reload. Toggle once in B and confirm it changes from the converged state rather than appearing to do nothing.
3. **Missed Theme event:** background/freeze A, change Theme in B, then foreground A. A must adopt B's canonical Theme before another local Theme write.
4. **Missed Settings event:** background/freeze A, change language or Access/Mobility preference in B, then foreground A. A must adopt B's canonical Settings and must not overwrite them with a stale whole-settings save.
5. **Open-sheet preference deferral:** leave a sheet open in A, change Theme/Settings in B, foreground A. The underlying page must not silently rewrite preference state underneath the open sheet; after the sheet closes, state must converge.
6. **Stale-version preference write:** activate a waiting update in A while B remains on the old page generation. B must show Reload required and both Theme and Settings/Language writes must be refused until reload.
7. **Exact controller version:** verify diagnostics after an update show controller/app match only for the exact release token; a similarly prefixed RC must not count as a match.
8. **Interrupted install cleanup:** simulate/inspect an older scoped `-install` or `-install-backup` cache, activate the current worker, and verify stale staging caches are removed without deleting the current shell or retained predecessors.
9. **Backup/Reset/Restore canonical preferences:** change language/Access/Mobility in B while A is stale. A full backup must contain B's persisted Settings. Reset/Restore in A must first converge/refuse the stale attempt and require a fresh confirmation.
10. Re-run v3100 two-window stable-identity scenarios, offline cold boot, background/foreground, Android Back, installed-PWA relaunch and update/reload.

# v3100-RC1 — Stable identity / cross-window close hardening

1. Create a trip with one day and at least two activities. Use **Duplicate Day** twice. Export a backup and run Beta Health. The trip must remain valid and each day must have a distinct stable ID in the exported JSON.
2. Restore or seed a disposable trip containing two different days with the same historical `day.id`, then reload. The app must boot, preserve both days/content, repair the duplicate ID, and remain exportable.
3. Open an existing activity, change its time so it sorts to a different position, save, reopen it, and confirm the same activity was edited rather than a neighbor. Repeat with duplicate activity and delete-from-editor.
4. In Logistics, create several stays and journeys whose displayed sort order differs from insertion order. Edit and delete the middle visible row in each list. Only the tapped stable entity may change.
5. Repeat the sorted-row test in Money and Documents. Expense/document save and delete must affect the tapped entity, not the original array position.
6. Two-window stale-close test: Window A opens a delete confirmation or editor. Window B changes the same trip. Return to A after backgrounding/suspending it, then close/confirm in A. A must not overwrite B; the latest canonical state must reload or the write must be blocked.
7. Re-run the v3000-RC2 cross-window editor corruption scenarios, Android Back sheet unwinding, update-required write block, offline cold boot and Settings synchronization.
8. Re-run text scaling/TalkBack smoke at 100–200% and Hebrew/Arabic RTL plus Amharic/English LTR. This build changes no translation copy; Amharic native linguistic review is still pending.

# v3000-RC2 — Amharic / settings-sync / accessibility hardening

1. Switch Menu → Language to **አማርኛ**. Verify the document remains LTR, the selected language persists after reload, and core Planner/Home/Today/Menu/Readiness/Booking/Money/Documents/Access/Checklist/AI surfaces show Amharic rather than raw keys or fallback English.
2. On a clean profile/device whose preferred browser language is Amharic, verify first run opens in Amharic with no RTL flash. On an unsupported device language, first run must still fall back to English.
3. In Amharic, create/edit a trip, day, activity, stay, journey, task, expense and document. User-entered content must remain exactly as typed and must never be translated or rewritten.
4. In Amharic, check mixed Ethiopic + Latin identifiers: flight/train numbers, eSIM, TripMaster AI, dates, currency codes, addresses and URLs must remain readable and in the correct order.
5. Test 100%, 150% and 200% Android font scaling. Sheets, primary CTAs and day/activity rows must remain usable without clipped controls.
6. Run offline after one successful load, switch to Amharic, reload, and verify the full local shell still boots and the language remains selected.
7. Open TripMaster in two windows. Change language/preferences in A. In B with no sheet open, the newest canonical settings should be adopted. With a settings sheet open in B, the change should defer; attempting a stale settings save must be blocked and the canonical settings reloaded instead of overwriting A.
8. Open a sheet, then a nested confirmation sheet. With TalkBack/screen-reader navigation, only the top sheet should be reachable. Closing it should restore the underlying sheet and focus correctly.
9. Navigate away/back using browser bfcache, keep the PWA session open, and verify periodic Service Worker update checks resume after `pageshow` rather than stopping permanently.
10. Run full backup/restore and single-trip import/export while Amharic is selected. Language remains a device setting, old backups remain compatible, and no historical `apiKey` field becomes active or is re-persisted.
11. Re-run the v2800-RC2 two-window stale-save regression and Service Worker reload-required flow. The new settings synchronization must not weaken trip-state write protection.
12. Native-language quality review is still required before general availability. Record unnatural or ambiguous Amharic wording as linguistic QA, not as a runtime fallback workaround.

13. **Missed-storage-event defence:** With an editor open in B, suspend/freeze B if the platform allows it, change trip state in A, then resume B. Save must still detect the sheet's stale canonical token and refuse the write even if no visible storage event was delivered.
14. **Same-version shell guard:** Any changed app-shell bytes must require an updated Service Worker shell fingerprint. `node qa/release-check.mjs` must fail if an app-shell file is edited without refreshing that fingerprint.
15. **Amharic header dates:** In Chromium/Android WebView with `am-ET`, a trip spanning 8–11 Oct must render the header using an abbreviated month name, not ambiguous numeric `10/8–10/11`.
16. **Multi-night journey stay coverage:** A non-cancelled journey leaving 9 Oct and arriving 11 Oct covers nights 9 and 10. Readiness must not request a hotel for either night; cancelling the journey should restore both missing-night gaps if no stay covers them.

## v2900-RC1 — Activities-first Planner

1. Open a trip with several activities. After the day strip, the current/next activity and timeline must appear before Access preferences, day-health/logistics, Readiness and Planner operation cards.
2. Confirm TripMaster AI remains directly below the activity area.
3. Scroll below TripMaster AI and confirm Access preferences (when configured), day health/logistics, Readiness and all Planner operation cards still render and remain clickable.
4. Verify the fixed bottom **Add Activity** control is unchanged and does not cover the last lower card.
5. Repeat in Hebrew RTL and English LTR, plus a day with no activities, to ensure the reordered DOM does not create blank spacing or broken navigation.

## v2800-RC2 — Independent-audit / Service Worker / cross-window hardening

1. **Upgrade bridge:** Install/load v2700-RC2 once, then deploy v2800-RC2 without clearing site data. Keep the old app open. The one-time bridge may activate the new worker, but the app must never enter a reload loop, blank/black screen, or lose trip data. After reload, About must show v2800-RC2.
2. **Normal future-style update:** With v2800-RC2 already controlling the page, simulate/deploy a newer worker. The new version should install and wait. Tap **Later** and continue using a disposable trip. Nothing should reload merely because the worker is waiting.
3. Reopen/reload while an update is waiting. The update must remain discoverable. Tap **Reload now** and verify activation/reload completes once and all trip data survives.
4. **Two-window controller mismatch:** Open two TripMaster tabs/windows, activate an update from A, and leave B open. If B's controller no longer matches its page version, B must show the non-dismissable reload requirement and refuse trip writes until reloaded. No stale tab may silently save.
5. **Cross-window data-loss regression (C1/H1):** In B open an existing activity editor (or Stay/Journey/Expense/Document editor). In A delete or insert a sibling record, or switch the active trip. Return to B and tap Save. The save must stay blocked while the editor remains open, including on repeated taps. Close the editor; only then may canonical state reload. Reopen by the record's current location and verify no untouched record was overwritten or deleted.
6. Repeat the stale-write scenario with Duplicate Trip, Switch Trip/import where practical. A blocked stale write must not restore an older whole-state snapshot over newer storage.
7. After one successful v2800-RC2 load, go offline and cold-open/reload the installed PWA. Home, Today, Planner, Trip Board, Booking Center, Money, Documents and local data must boot without network.
8. **Failed same-version install:** If possible, redeploy a changed `sw.js` while one core shell asset is unavailable. The failed install must not delete the currently usable live cache. With the server then unavailable, the previously installed build must still cold-open offline.
9. Return online, background/foreground the app, restore a page from browser history/BFCache if possible, and leave it open long enough for update checks. No visible reload should happen without an activation/reload action or a mandatory stale-version reload gate.
10. Run/download Beta Diagnostics. `runtime.serviceWorkerLifecycle` may contain lifecycle booleans/cache version/check time/error class and `reloadRequired`, but no trip/private content.
11. If the same origin hosts another test PWA/repository/cache, update TripMaster and verify the unrelated deployment/cache still works. TripMaster cache cleanup must be scope-specific.
12. While offline, try TripMaster AI. Only the AI call should fail with the normal offline message; the local PWA must remain usable. Return online and run one normal Planner request. It must still reach the existing Replit backend under the CSP.
13. Open Maps from Today/activity navigation and Google Calendar export if used. External navigation must still work. Re-test full-backup/ICS downloads under the CSP.
14. Restore/import a disposable older settings/backup payload that contains a historical `apiKey` field if available. TripMaster must not show/use the value, and the next exported/persisted settings payload must omit it.
15. Re-run Android Back, backup/restore, single-trip import/export, cross-window edits and installed-PWA relaunch after the update.

### v2800-RC2 — Claude audit regression scenarios

1. **AI minute boundary (A1):** Ask a Today question such as **“what is next today?”** just before the minute changes. A valid answer arriving after the minute boundary must not be discarded solely because the clock changed. Actual trip-state changes must still invalidate a stale answer.
2. **AI punctuation intent (A2):** Try **“what now?”**, **“need a taxi?”** and **“how much does it cost?”**. The first must receive Today context, the second Mobility context and the third Money context. Natural punctuation must not downgrade them to generic trip context.
3. **Overnight journey stay coverage (R1):** Create a journey departing late on 6 Sep and arriving 7 Sep, with a stay beginning 7 Sep. Readiness must not demand a hotel night for 6 Sep when the journey explicitly spans that night.
4. **Sparse itinerary coverage (R2):** Create itinerary days 1, 2, 5 and 6 of the same trip span with no stay covering nights 3–4. Readiness must still inspect the intervening calendar nights rather than only dates with day records.
5. **Cancelled conflict (R3):** Put a cancelled booked activity and its replacement at the same time. The cancelled item must remain visible as history where appropriate but must not create a Readiness/day-health schedule conflict.
6. **RTL journey flow (U1):** In Hebrew, inspect origin→destination, time ranges and stay date ranges. The visual direction must read naturally from departure/start toward arrival/end; times must not appear reversed by bidi layout.
7. **V2 future gate (L2, automated-first):** Keep `AI_V2_TRANSPORT_ENABLED` off for normal device QA. Automated regression must prove that if V2 transport is later enabled, a missing V2 schema, invalid truth layer, missing execution receipt/evidence or wrong operational truth layer fails closed instead of silently rendering.
8. **Duplicate-ID restore:** A hand-edited full backup containing duplicate entity IDs must be rejected before destructive restore. A normal older backup with missing IDs must remain migratable.
9. **Cross-kind link clone:** Duplicate/import a disposable trip whose legacy source IDs collide across entity kinds if such a fixture is available. Typed expense/document links must still target the correct cloned entity.
10. **AI timeout:** A deliberate/real 60-second timeout must not automatically start a second full 60-second attempt. Background/resume retry behavior may still operate under its bounded policy.

## v2700-RC2 — Stay readiness / direct repair
1. Create or use a trip dated 8–11 Oct with one stay dated 8–11 Oct. Readiness must report no missing-stay night, even if 11 Oct is not manually typed as a Departure day.
2. Remove coverage for one real overnight date. Readiness must report exactly that missing night.
3. Tap the Logistics “review/fix” CTA for that gap. Add Stay must open directly, with start/end dates pre-filled for the missing contiguous gap.
4. Cancel the editor. The app must return cleanly without a stacked Overview/Trip Board sheet.
5. Save the stay and confirm Readiness refreshes to remove the resolved gap.

## v2700-RC2 — AI V2 client foundation

1. Open TripMaster AI on a normal trip and ask one ordinary question. The current Planner must still answer through the existing service; there must be no new login/key/setup step and no change to bookings or itinerary.
2. Use the quick prompts for **What matters now**, **Bookings**, **Tell me about a place**, and **Something went wrong**. Each should still submit normally after selection/editing.
3. Ask a hotel question such as **“What do you know about my hotel?”**. The request must not require the Access Profile or Mobility settings to be populated. The client must remain usable whether those profiles are empty or configured.
4. Ask an Access question after configuring an Access Profile. The request must still work and use the structured Access preferences; normal activity Add/Edit must remain free of manual accessibility fields.
5. Ask **“What should I do now?”** on a normal trip. It should use Today/chronology context without presenting itself as verified live-provider information merely because the word “now” was used.
6. Ask a planning question such as **“Plan my itinerary for the week”** with Mobility preferences configured. The Planner should remain able to use those travel preferences without needing or sending the Access Profile.
7. Start an AI request in window A, change the active trip data in window B before the answer returns, then let A receive the response. A must not render an answer based on the stale trip context; it should ask for the question again.
8. Background/foreground Android during one AI request. Existing bounded resume/retry behavior must still work, and a changed trip must not receive the old answer.
9. Run/download Beta Diagnostics after an AI request. `aiClient` may contain intent, scopes, counts/status/duration, but must contain no prompt text, trip names, hotel/activity names, Access details, booking references, confirmation codes, notes, URLs or money amounts.
10. Switch all seven active languages and open TripMaster AI. The updated privacy copy and any client error/source headings must be localized with no raw translation keys.
11. Run the app offline after a prior successful load. The PWA shell, Today, Trip Board and other local features must continue to work; TripMaster AI should show its normal offline error only.
12. Re-run Android Back/sheet focus, full backup/restore, single-trip import/export, SPCK cold boot and update/reload. The added AI module must not regress boot or offline precache behavior.

**Server boundary:** `AI_V2_TRANSPORT_ENABLED` remains off in this build. No V2 backend endpoint should be called before the October server campaign.

## v2600-RC1 — Readiness 3.0 / operational actions

1. Use a trip that previously showed **0 issues · N checks**. Planner Readiness must now be green/positive with **Looks good** and a neutral **Open actions: N** line. There must be no orange top-level state and no `?` icon.
2. Leave Destination and Timezone blank on an otherwise valid trip. They may show as unset facts, but must not create a Readiness issue/action.
3. Create one activity booking that is both `Planned` and `Unpaid`. Booking Center may explain both reasons, but Readiness must count it only once as one booking follow-up action.
4. Create a trip with no dated days. Readiness must show **Needs attention** and its CTA must open first-day creation.
5. Create overlapping activities, an invalid time range, insufficient entered transfer time, a stay overlap/gap, an exceeded active budget, or an overdue checklist item. Each must keep Readiness in **Needs attention**.
6. Add a due-today task, a Needed document, or start tracking a transfer without duration. These must remain visible as neutral actions and must not turn a no-issue trip orange/red.
7. Open Overview and Trip Board. Issue groups use **Review & fix**; action-only groups use **Open**. Every CTA must reach the correct surface without stacked sheets.
8. Open Today on a day with a planned booking/unpaid payment/needed linked document. The label must be **Action**, not **Check**. Proven schedule/stay conflicts must still be **Issue**.
9. Verify Home and Trip Brief use the same issue/action counts and never show the obsolete Check readiness state.
10. Restore/import a disposable malformed journey or stay if available (arrival before departure, invalid date/time). Readiness/Beta Health must flag it without crashing or exposing private content in diagnostics.
11. Re-run Android Back, SPCK cold boot, offline reload, language switching, full backup/restore, trip import/export and update/reload behavior.

## v2500-RC1 — Access / Readiness signal quality

1. Open Add Activity and Edit Activity → More options. Verify there is no Activity accessibility selector, Accessibility note, or Access quick button.
2. Restore/use a disposable legacy activity that already has `accessStatus` / `accessNote`, edit only its title, save, export the trip/backup, and verify the legacy Access values are still present in data.
3. With an Access Profile active and ordinary activities that have no Access status, verify Planner Readiness, Trip Board Attention and Today do not create an accessibility warning.
4. If a legacy activity is `needscheck`, verify it does not appear as a user task badge. A legacy verified/problem badge may remain read-only context.
5. Create an open checklist task with no due date. It must remain visible in Checklist but must not increase Readiness checks.
6. Leave the optional trip base blank. It must not increase Readiness checks.
7. Start tracking a transfer (mode/note) but leave its duration empty. This should still create a check because the tracking was explicitly started.
8. Create a trip with no days. Readiness should flag missing trip dates; Review & fix should open first-day creation, not Trip Details.
9. On a healthy trip with no actionable issue, verify Readiness can show the positive “Looks good” state.
10. From any Access-profile CTA, verify the source readiness/overview sheet closes before Menu → TripMaster Access opens. No stacked sheets.
11. Re-run Android Back, offline reload, language switching, full backup/restore and SPCK cold boot.

## v2400-RC3 — stale Undo / snapshot regression

- Two windows, no sheet open: create an Undo record in A, write trip state in B, wait for auto-sync, then tap any still-visible Undo control in A. Newer B data must survive and the old Undo must not replay.
- Background/foreground: create Undo in A, background A, write in B, resume A, then attempt Undo. Newer B data must survive.
- Restore blast-radius case: Restore in A, write a new trip in B, allow A to adopt it, then attempt Undo in A. The external trip must survive.
- With a pre-existing safety snapshot, leave A stale via an open sheet, write in B, then attempt trip deletion in A. The delete must be refused before the old snapshot is overwritten.
- In one open Data Safety Center sheet, change trip count externally, run Data Health, and verify both the health summary and visible grid show the same canonical trip count.

# v1700-RC1 — Focused Manual QA

1. **SPCK boot** — open the app cold; no fatal boot screen may appear after the UI is already usable.
2. **Trip Board > Attention** — verify issues/checks match Readiness and each Review action opens the correct surface.
3. **Checklist due date + priority** — add a task with a due date and High priority; verify Open/Done/All filters and persistence after reload.
4. **Overdue task** — set a task date before today; it should be highlighted and appear as a Readiness issue.
5. **Today tasks** — a task due today should appear in Today and be completable there.
6. **Duplicate day plan** — duplicate a day from Day details; verify it lands on the next free date, has fresh activity IDs, and copied booking confirmations/payment state are reset.
7. **Duplicate activity** — duplicate an existing activity; verify the copy opens for editing and the original remains untouched.
8. **Archive trip** — archive a non-critical test trip; it should disappear from normal Home sections and appear under Archived trips. Restore it and confirm data is intact.
9. **Archived active trip** — archiving the active trip should return to Home without deleting it.
10. **Back + persistence** — close sheets with Android Back, close/reopen the app, and confirm tasks/archive/duplicates persist.
11. **Offline reload** — after one successful load, reload offline and confirm Trip Board/Today/archive data remain available.
12. **Language switch** — switch one existing language and back; no new keys should leak in another language.

AI/backend remains outside this QA cycle.


## v1800-RC1 — portability / IDs / checklist edit
- Export one active trip from Data Safety Center and verify the rest of the local trips remain unchanged.
- Import that file on the same device: it must create a second trip rather than overwrite the original.
- Verify documents/expenses linked to activities/stays still target the imported entities.
- Try importing a normal full backup as a trip file: it must be rejected.
- Edit an existing checklist task title/date/priority, cancel once, then save once. Completion state must not be reset.
- Open an old backup with activities lacking UIDs if available, reload, and confirm data remains present after the additive stable-ID migration.

## v2000-RC1 focused checks
1. Planner → Trip Brief opens and shows trip/readiness/logistics/tasks/money sections.
2. Copy/share Trip Brief and confirm confirmation codes, booking references, private notes and exact budget/expense amounts are absent from the shared text.
3. Create two overlapping timed activities; Trip Board → Attention should name both items and open the affected day when tapped.
4. Create a stay gap/overlap and an overdue task; Attention should show exact detail rows.
5. Home cards: verify upcoming countdown, active Day X of Y/final-day copy, and past-trip elapsed copy.
6. Import a normal single-trip package; existing trips remain untouched and imported IDs are regenerated.

## v2400-RC1 focused beta reliability checks
1. Data Safety Center → Run data check on a normal trip set: expect Healthy, with aggregate trip/day/activity counts only.
2. Copy/download Beta Diagnostics and inspect the file: there must be no trip names, activity titles, places, notes, booking/confirmation references, URLs, or money amounts.
3. Corrupt a duplicate ID / orphan link in a disposable test dataset: health check must warn/error without crashing or rewriting data.
4. Try restore with a non-TripMaster JSON file, future `backupVersion`, malformed nested collections, and >15 MB file: all must be rejected before destructive restore.
5. Valid full backup restore still creates the pre-restore local safety snapshot and preserves the currently selected UI language.
6. Open TripMaster in two tabs/windows. Change trip data in A while a sheet is open in B: B must warn/defer. Attempt to save stale data in B: save must be blocked and latest state reloaded.
7. Repeat with B having no sheet open: external state should converge automatically after a short debounce.
8. Trigger a disposable runtime exception in devtools/test harness after boot, then export diagnostics: breadcrumb may show error type/source/line but must not include exception message or user content.
9. Re-run offline refresh, Android Back/sheet focus, backup/restore, Today, Trip Board, Booking/Money/Documents and SPCK boot regression from earlier sections.
## v2400-RC2 — independent audit regression checks
1. Open the same origin in two windows. Keep Data Safety Center open in A, add/change a trip in B, then try Reset in A. First Reset must be refused; newest state must load. A second deliberate Reset may proceed, and the safety snapshot must contain the newest B-side trip.
2. In the same deferred-state setup, export a full backup from A before closing the sheet. The file must contain the newest B-side trip even though A still has a pending editor conflict.
3. Run Beta Health in the deferred-state setup. Counts must come from current persisted storage, not stale A memory.
4. Background A, change data in B, foreground A, then perform one normal write. The first write must succeed without the stale-state block toast.
5. Create an Undo state in A, then change trip data in B. Undo in A must not be able to replay the stale whole-state snapshot over B's newer data.
6. Mark an activity completed in Today in all seven active languages. No raw `toast_done` key may appear.
7. Restore a disposable legacy backup with `settings` omitted; it should be accepted with defaults while a malformed present `settings: []` payload is rejected.
8. On Android Chrome/SPCK, verify full-backup download and ICS fallback both produce usable files.


## v3200-RC2 — targeted Claude regression

1. In one window, open Logistics. Add Stay A, keep the Logistics hub open, then add Stay B. Both saves must succeed with no external-state conflict toast. Repeat with two Tasks in Trip Board, two Journeys, two Expenses and two Documents.
2. With two windows, open an editor in A, mutate/reorder/delete the collection in B, then Save A three times. Every stale attempt must remain blocked until the sheet closes; no other record may change.
3. Restore a disposable pre-v3100 backup containing duplicate day IDs plus duplicate activity/stay/journey/expense/document/task IDs. Restore must be accepted, all records preserved, and Data Health after restore must show no duplicate stable-ID errors.
4. After the restore above, edit the second formerly-duplicate stay/activity/expense. Only the record opened by the user may change.
5. Simulate a frozen tab receiving external legacy data with missing IDs, then foreground it. The UI must not freeze/recurse; repaired IDs should persist once canonical state is adopted.
6. On the same origin, install `/TripMaster/` and a sibling `/TripMaster-beta/` build. Updating the main app must never delete the sibling cache or break its offline boot.
7. Open `index.html?x=1#frag` and a deep path such as `/sub/page?x=1#frag`. The canonical shell must boot without redirect loops online and after a successful offline install.
8. With a controlled stale page, delay the controller-version reply beyond 1.2 s. Trip, Settings and Theme writes must be blocked while identity is unresolved and remain blocked if both attempts time out.
9. Verify a controller named for `v3200-RC2-FIX1`, `v3200-RC20` or another suffix does not count as an exact `v3200-RC2` match.
10. Interrupt a newer Service Worker install while an older worker activates. Promotion must either validate a complete core shell or fail without damaging the currently live offline cache.
