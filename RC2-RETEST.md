# TripMaster v3800-RC2: targeted recovery and large-text handoff

Date: 23 September 2026. Client/PWA only.

## Source and scope

Only input: `TripMaster-v3800-RC1-GITHUB-CLEAN.zip`.
Verified SHA-256: `e2c3f09e96e362da19603a4bca00dbb131bb097a26568f134796f41264c674c2`.
The input ZIP was preserved unchanged; all changes were made in a fresh extraction.
No older source, repository copy, backend, or partial RC2 build was used.

## Findings

| Finding | RC2 change | Executable evidence |
|---|---|---|
| F1 | Scan relevant persistent backup keys and compare the exact raw string. Do not overwrite a different payload if timestamps collide. Verify the backup still exists before recovery writes. | Real app booted 24 times with each of 307,200 and 1,468,006 corrupt characters. Every persistent key/value remained byte-identical after first boot; one preserved copy; valid UI Restore succeeds afterward. |
| F1 snapshot | Recovery metadata points to preserved corrupt bytes instead of embedding them again. Healthy replacement targets are still copied and the previous good safety snapshot is retained. Reuse identical recovery metadata. | Metadata under 4,000 characters in both large-corruption cases; reference resolves to exact original raw; healthy siblings and active evidence retained. Initial preservation failure and later missing preserved bytes block Restore. |
| F2 | Remove only invalid members of known arrays before structural validation. Preserve original bytes before permitting repairs. Keep non-array structures invalid. | Full boot/save/reboot tests for null/primitive/array trip, day, activity (`day.items`), stay, journey, expense, document and task rows. Three additional pre-save reloads prove no growth. Valid trips/unknown fields survive. Every known malformed non-array collection remains quarantined. Legacy Home migration is tested too. |
| F3 | Clear stale active pointers only when the canonical trip graph is readable. | Corrupt boots and all invalid collection cases retain `tm_active_trip`; healthy stale pointer still clears. |
| F4 | Use the existing device-language selection for unreadable settings. Match the early direction bootstrap. | Full boot with en-US, he-IL, ar-SA, am-ET and unsupported fr-FR. Expected language/direction; corrupt settings remain untouched. |
| F5 | Route `rollback_failed` to a partial-save message with a Data Safety Center button. | Actual UI Restore with a successful trip write, failed active-ID write, and failed trip rollback leaves the partial state visible in storage and displays the accurate message. Single-fault rollback retains the normal message. Session diagnostics and downloaded report contain the sanitized event without synthetic private data. |
| F6 | Scoped wrapping/min-width/flex-wrap/vertical button growth for Today and Planner hero. Fix measured Documents-card text overflow. | Chromium at 360px, root-font scaling 100/130/150/200%, English/Hebrew/Arabic, Today/Planner: 24 combinations. Document width, all scoped action bounds, touch dimensions and long text scroll bounds asserted. 200% screenshots inspected in English and Hebrew. |

F6 uses real rendered geometry, not static regex as a visual proof. Before the CSS
fix, the Planner document reached 398px at 200% and Directions extended beyond
360px. The long-token Today fixture reached 3,711px at 200%. After the fix all 24
combinations stay at 360px and tested critical actions remain inside the viewport.
Buttons retain at least 44px height (46px for hero actions); labels can wrap.
Intentional day/AI chip scrollers are outside the changed rules.

## Recovery snapshot reference format

`tm_recovery_raw_snapshot` now uses `snapshotVersion: 2`. Each `rawEntries` pair
contains either the healthy original string/null, or `{corruptBackupKey: "..."}`
for an unreadable value. Resolve that key in the same localStorage origin to get
its exact original bytes. App recovery checks equality against current raw bytes
before writing. The referenced raw entries are not automatically pruned. A prior
`tm_safety_snapshot` remains unchanged during corrupt-data Restore. This internal
recovery envelope does not change portable `backupVersion: 2` or its export schema.

No corrupt source or old backup is deleted to free quota. An installation already
filled by distinct or historical duplicate RC1 backups can still lack space for
healthy sibling snapshots. RC2 stops further identical-copy accumulation; it does
not claim to repair every already-exhausted quota without intervention.

## Non-regression evidence

- All RC1 regression and 22 behavioral hardening groups remain enabled.
- Full browser stable/missing/duplicate ID migration and cross-trip document link
  remapping; reboot leaves the resulting graph unchanged.
- Real two-window stale edit after another save, active-trip switch, and stale
  day-delete after external reorder. No stale write lands.
- Consecutive own saves, then Export -> Restore -> Export canonical equality.
- Diagnostics adversarial sanitization plus double-fault downloaded report privacy.
- Existing VM worker coverage includes exact-scope ownership, staging failure
  rollback, core digest mismatch, controller proof, activation retry, Back/focus,
  keyboard viewport and reduced motion contracts.
- Real Chromium worker install, controlled reload, offline cold navigation to a
  deep path with query/fragment. Worker algorithm and cache architecture are
  byte-identical to RC1 after removing the four release metadata constants.
- Release gate checks activities-first ordering, two-state Readiness, optional
  fields/Access invariants, seven-language parity, disabled AI V2 transport,
  canonical content-derived build/fingerprint/digests and exact file manifest.

All 970 pre-existing translation values in all seven languages remain unchanged.
One new key, `toast_storage_partial`, makes the release 971 keys x 7 languages.
No existing Amharic wording or intent vocabulary changed. New Amharic wording is
simple and requires native review. Hebrew and Arabic are RTL; am-ET remains LTR.

## Commands and reproducibility

Node 24.19.0 and local Chromium 153.0.8010.0 were used. Browser tests execute the
real shipped HTML and scripts without exposing test hooks in production code.
Storage fault injection, fixture data and font scaling exist only in the harness.
Each test owns a fresh browser context; repeated boots use the same origin/storage.
Browser tests use a temporary loopback HTTP server and synthetic data only.

Install Playwright and its browser in the QA environment (outside the clean tree):

```sh
npm install --prefix /tmp/tripmaster-qa playwright
node /tmp/tripmaster-qa/node_modules/playwright/cli.js install chromium
export NODE_PATH=/tmp/tripmaster-qa/node_modules
```

Run from the extracted release:

```sh
for file in *.js qa/*.mjs; do node --check "$file" || exit 1; done
node qa/regression.mjs
node qa/hardening.mjs --browser
node qa/release-check.mjs
```

`TM_CHROMIUM_EXECUTABLE` can select an already installed compatible Chromium.
`TM_QA_ARTIFACTS` can select an output folder outside the release directory. If it
is omitted, screenshots go into an OS temporary directory. Browser dependencies
and binaries are QA environment dependencies and are not bundled. The browser
suite fails rather than reporting a visual pass if its engine is unavailable.
Without `--browser`, hardening runs only the 22 Node behavioral groups.

## Release verification

- JS syntax: PASS, 15 runtime scripts plus 4 QA executable scripts.
- Regression: PASS.
- Hardening: PASS, 22 Node behavioral groups plus 42 real browser groups.
- Release Gate: PASS, 971 x 7 parity, 20 precache assets, exact hashes/identity.
- Final ZIP extracted to a new clean directory and the complete suite rerun.
- Exact package: 29 files, 23 at root and 6 in `qa/`. No extra wrapper directory.
- No screenshots, logs, browser binaries, dependencies, transient fixtures,
  temporary build scripts or scratch artifacts included.
- ZIP SHA-256 is reported with the delivered archive, outside the archive itself.

## Limits and next gate

No real Android, installed-PWA, Gboard, OS Back, TalkBack, Android font/display
scaling, physical touch, long suspension, device quota pressure or OEM browser QA.
Root-font scaling is a browser emulation, not a claim about native Android scaling.
Linux browser fonts lack some emoji glyphs; glyph appearance requires device QA.
No broad new real-browser re-test of every RC1 worker update/waiting/activation,
sibling deployment or same-version-different-byte scenario was performed; their
existing executable Node gates were rerun and their runtime code remains unchanged.
No native linguistic review of the new partial-save warning has been performed.

Next, independently re-test F1-F6 with Claude. If clean, proceed to the user's real
Android/installed-PWA QA. No feature development before that device QA unless a
blocker forces it.
