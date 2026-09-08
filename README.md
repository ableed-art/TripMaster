# TripMaster v1700-RC1

Local-first travel-planning PWA. This repository package is the cleaned GitHub form of v1700-RC1.

## Runtime structure
The runtime modules intentionally remain separate. Do not merge them back into `app.js` merely to reduce file count; the separation protects Today, Travel, Logistics, Finance, Operations and Intelligence behavior.

Core runtime files are the HTML/CSS/JS/manifest/icons at the repository root. QA lives under `qa/`.

## QA
Run from the repository root:

- `node qa/regression.mjs`
- `node qa/release-check.mjs`

Manual device checks: `qa/MANUAL-QA.md`.

The release gate covers syntax, i18n parity, version/cache consistency, precache coverage, manifest sanity, duplicate HTML IDs, SPCK operations-module load order, boot-watchdog invariants, and the static app.js-to-DOM ID contract.

## Amharic foundation
Amharic is prepared but intentionally inactive pending native review.

- Internal code: `am`
- Locale: `am-ET`
- Direction: LTR
- Primary travel calendar remains Gregorian
- Use `Intl.PluralRules('am-ET')` for plural-sensitive copy
- No partial activation: 100% reviewed translation parity is required
- No remote font dependency; bundle Noto Sans Ethiopic locally only for the reviewed activation release
- Native QA must include Android/Chrome PWA, Gboard Amharic, 100–200% font scale, offline, dark mode, backup/restore, language switching and TalkBack

## Frozen workstreams
Production backend and AI V2 are intentionally outside this client release train until the planned October integration work.

## Release history
See `CHANGELOG.md`.
