import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = f => fs.readFileSync(path.join(root,f),'utf8');

// RC2 exact release manifest: no generated QA outputs or dependency artifacts.
const expectedFiles=["CHANGELOG.md","README.md","app-ai-client.js","app-finance.js","app-intelligence.js","app-logistics.js","app-operations.js","app-today.js","app-travel.js","app.js","boot-guard.js","boot-watchdog.js","config.js","dir-boot.js","i18n.js","icon-192.png","icon-512-maskable.png","icon-512.png","index.html","manifest.json","qa/MANUAL-QA.md","qa/RC2-RETEST.md","qa/browser.mjs","qa/hardening.mjs","qa/regression.mjs","qa/release-check.mjs","styles.css","sw-register.js","sw.js"];
const shippedFiles=fs.readdirSync(root,{recursive:true}).filter(f=>fs.statSync(path.join(root,f)).isFile()).sort();
assert.deepEqual(shippedFiles,expectedFiles,'clean package contains exactly the 29 reviewed files');

const config = read('config.js');
const sw = read('sw.js');
const html = read('index.html');
const plannerOrderIds=['dayChips','heroCard','timelineCard','aiStripBtn','accessProfileStrip','dayHealthStrip','dayLogisticsStrip','plannerReadinessBtn','plannerOpsHub','plannerSecondaryTools'];
const plannerOrderPositions=plannerOrderIds.map(id=>({id,pos:html.indexOf(`id="${id}"`)}));
for(const item of plannerOrderPositions) assert.ok(item.pos>=0,`Planner activities-first element exists: ${item.id}`);
for(let i=1;i<plannerOrderPositions.length;i++) assert.ok(plannerOrderPositions[i-1].pos<plannerOrderPositions[i].pos,`Planner activities-first order keeps ${plannerOrderPositions[i-1].id} before ${plannerOrderPositions[i].id}`);


const version = config.match(/const APP_VERSION = "([^"]+)";/)?.[1];
const cacheVersion = sw.match(/const CACHE_VERSION = "([^"]+)";/)?.[1];
const shellFingerprint = sw.match(/const SHELL_FINGERPRINT = "([^"]+)";/)?.[1];
assert.ok(version, 'APP_VERSION found');
assert.ok(cacheVersion, 'CACHE_VERSION found');
assert.ok(shellFingerprint, 'SHELL_FINGERPRINT found');
const buildId=config.match(/const APP_BUILD_ID = "([^"]+)";/)?.[1];
assert.match(buildId||'',/^[a-f0-9]{16}$/,'explicit app build identity');
assert.ok(sw.includes(`const BUILD_ID = "${buildId}";`),'worker and page share build identity');
const coreDigests=JSON.parse(sw.match(/const CORE_DIGESTS = (.*);/)[1]);
for(const [asset,digest] of Object.entries(coreDigests))assert.equal(digest,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,asset))).digest('hex'),`verified deployed core bytes: ${asset}`);

const versionToken = version.toLowerCase().replace(/^v/,'').replace(/[^a-z0-9]+/g,'-');
assert.equal(cacheVersion, 'v' + versionToken, `cache version must match release token v${versionToken}`);
assert.ok(html.includes(`TripMaster ${version}`), 'About fallback version matches APP_VERSION');
assert.match(read('app.js'), /formatDateOnly\(d, \{ day: "numeric", month: "short" \}\)/, 'Planner header uses unambiguous abbreviated month formatting across locales');

const assetBlocks = [...sw.matchAll(/const (?:CORE|OPTIONAL)_ASSETS = \[([\s\S]*?)\];/g)].map(m=>m[1]).join('\n');
const assets = [...assetBlocks.matchAll(/"\.\/([^"]*)"/g)].map(m=>m[1]).filter(Boolean);

for(const core of [...sw.match(/const CORE_ASSETS = \[([\s\S]*?)\];/)[1].matchAll(/"(\.\/[^"]+)"/g)].map(x=>x[1]))assert.ok(coreDigests[core],`core digest present: ${core}`);
for (const asset of assets) assert.ok(fs.existsSync(path.join(root,asset)), `precache asset exists: ${asset}`);
const computedShellFingerprint=crypto.createHash('sha256');
for(const asset of assets){computedShellFingerprint.update(asset+'\0');computedShellFingerprint.update(fs.readFileSync(path.join(root,asset)));computedShellFingerprint.update('\0');}
const computedShellFingerprintHex=computedShellFingerprint.digest('hex').slice(0,16);
assert.equal(shellFingerprint,computedShellFingerprintHex,'SHELL_FINGERPRINT matches the exact shipped app-shell bytes; content changes require a new cache generation');
assert.match(sw,/CACHE_NAME = CACHE_PREFIX \+ CACHE_VERSION \+ "-" \+ SHELL_FINGERPRINT/,'cache identity includes the shell-content fingerprint');
assert.equal(new Set(assets).size,assets.length,'precache asset list has no duplicates');
const buildHash=crypto.createHash('sha256');
for(const asset of assets){buildHash.update(asset+'\0');buildHash.update(asset==='config.js'?config.replace(/const APP_BUILD_ID = "[^"]+";/,'const APP_BUILD_ID = "";'):fs.readFileSync(path.join(root,asset)));buildHash.update('\0');}
assert.equal(buildId,buildHash.digest('hex').slice(0,16),'build ID is derived from exact app-shell/config bytes');

const htmlRuntimeAssets=[
  ...[...html.matchAll(/<script\b[^>]*\bsrc="\.\/([^"]+)"/g)].map(m=>m[1]),
  ...[...html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="\.\/([^"]+)"/g)].map(m=>m[1]),
  ...[...html.matchAll(/<link\b[^>]*\brel="manifest"[^>]*\bhref="\.\/([^"]+)"/g)].map(m=>m[1])
];
for(const asset of htmlRuntimeAssets) assert.ok(assets.includes(asset),`HTML runtime dependency is precached: ${asset}`);
const rootEntries=fs.readdirSync(root,{withFileTypes:true});
const rootFileCount=rootEntries.filter(x=>x.isFile()).length;
assert.ok(rootFileCount<=30,`GitHub-clean root stays compact (got ${rootFileCount} files)`);
const shellBytes=assets.reduce((sum,asset)=>sum+fs.statSync(path.join(root,asset)).size,0);
assert.ok(shellBytes<2*1024*1024,`offline app shell stays under 2 MiB (got ${shellBytes} bytes)`);
assert.ok(fs.statSync(path.join(root,'app.js')).size<512*1024,'main app.js stays under 512 KiB until deliberate modularization');

// v2800 service-worker lifecycle: updates must wait for explicit user action,
// shell caching must stay scoped to TripMaster, and future private/API traffic
// must not become a runtime cache by accident.
assert.match(sw, /const CACHE_NAMESPACE = "tripmaster-shell"/, 'TripMaster uses a product-specific cache namespace');
assert.match(sw, /CACHE_SCOPE_TOKEN/, 'cache namespace is scoped per PWA registration path');
assert.match(sw, /LEGACY_CACHE_PREFIX = "tripmaster-v"/, 'legacy TripMaster caches are detected for the one-time bridge without being globally trimmed');
assert.match(sw, /TRIPMASTER_SKIP_WAITING/, 'waiting worker can be activated explicitly by the update UI');
assert.match(sw, /cache:\s*"reload"/, 'new app-shell generation bypasses stale HTTP cache during precache');
assert.match(sw, /INSTALL_CACHE_NAME/, 'install builds into an isolated staging cache');
assert.match(sw, /copyCacheContents\(INSTALL_CACHE_NAME, CACHE_NAME\)/, 'complete staging cache is promoted only after successful precache');
assert.doesNotMatch(sw, /precacheShell\(\)[\s\S]{0,300}caches\.delete\(CACHE_NAME\)/, 'precache does not delete the live release cache before staging succeeds');
assert.match(sw, /BACKUP_CACHE_NAME/, 'same-name promotion has a rollback copy');
const installBody = sw.match(/self\.addEventListener\("install",[\s\S]*?\n\}\);/)?.[0] || '';
assert.match(installBody, /needsLegacyLifecycleBridge\(\)/, 'install only auto-activates behind the one-time legacy lifecycle bridge');
assert.match(sw, /hasLegacy && !hasModern/, 'legacy lifecycle bridge becomes impossible after first modern shell cache');
assert.doesNotMatch(sw, /clients\.claim\s*\(/, 'updated worker does not claim already-running documents');
assert.match(sw, /request\.method !== "GET"/, 'service worker ignores non-GET requests');
assert.match(sw, /url\.origin !== scopeUrl\.origin/, 'service worker ignores cross-origin requests');
assert.match(sw, /if \(!SHELL_URLS\.has\(url\.href\)\) return;/, 'runtime interception is allowlisted to the app shell');
assert.match(sw, /responseMatchesAsset\(response,"\.\/index\.html"\)/, 'online navigation verifies canonical shell bytes before repair');
assert.match(sw, /canonicalPath[\s\S]{0,220}url\.pathname === shellUrl\.pathname/, 'canonical navigation comparison is pathname-based so query/fragment variants cannot loop');
assert.doesNotMatch(sw, /url\.href !== APP_SHELL_URL/, 'navigation does not compare full href against the shell URL');
assert.match(sw, /staleInstallCaches[\s\S]{0,500}caches\.delete\(name\)/, 'activation cleans interrupted install/rollback caches from older owned generations');
assert.match(sw, /\^v\[0-9\]\{4,\}[\s\S]{0,180}rc\[0-9\]/, 'cache ownership requires the TripMaster release-version shape and cannot absorb version-shaped sibling scope tokens');
assert.match(sw, /validateCoreCache\(CACHE_NAME\)/, 'promoted cache is validated for every core asset before install cleanup');
// Client security boundary: the PWA must not collect provider credentials,
// and CSP network access must stay aligned with the single configured legacy
// backend until the October server/provider work deliberately changes it.
assert.doesNotMatch(html, /global-apikey|apiKeyFieldWrap|Anthropic API Key|sk-ant-/i, 'no client API-key input or provider-key placeholder is shipped');
const securityAppCode = read('app.js');
assert.doesNotMatch(securityAppCode, /settings\.apiKey|global-apikey|apiKeyFieldWrap/, 'runtime has no active client API-key path');
assert.match(securityAppCode, /delete out\.apiKey/, 'legacy settings normalization discards historical apiKey values');
assert.match(securityAppCode, /delete copy\.apiKey/, 'persisted settings defensively omit historical apiKey values');
const configuredBackend = config.match(/const AGENT_API_BASE_URL = "([^"]+)";/)?.[1];
assert.ok(configuredBackend, 'configured Planner backend found');
const csp = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/i)?.[1] || '';
assert.ok(csp, 'Content-Security-Policy meta is present');
assert.match(csp, /default-src 'self'/, 'CSP defaults resources to same origin');
assert.match(csp, /script-src 'self'/, 'CSP does not allow remote or inline script execution');
assert.match(csp, /worker-src 'self'/, 'CSP restricts workers to TripMaster origin');
assert.match(csp, /object-src 'none'/, 'CSP disables plugin/object content');
assert.match(csp, /frame-src 'none'/, 'CSP prevents TripMaster from embedding external frames');
assert.match(csp, /form-action 'self'/, 'CSP prevents form submission to third-party origins');
assert.match(html, /<meta name="referrer" content="no-referrer" \/>/, 'external navigation does not leak a referrer');
assert.ok(csp.includes(`connect-src 'self' ${configuredBackend}`), 'CSP connect-src matches the configured Planner backend exactly');

const swRegister = read('sw-register.js');
assert.match(swRegister, /updateViaCache:\s*"none"/, 'service worker update checks bypass HTTP cache');
assert.match(swRegister, /TRIPMASTER_SKIP_WAITING/, 'register module applies a waiting worker only on request');
assert.match(swRegister, /UPDATE_CHECK_MIN_INTERVAL_MS/, 'long-lived PWA sessions have throttled update checks');
assert.match(swRegister, /tripmaster:reload-required/, 'controller/version mismatch raises a forced reload event');
assert.match(swRegister, /new RegExp\("-v" \+ token \+ "-\[a-f0-9\]\{16\}\$"\)\.test\(cacheName\)/, 'controller version comparison requires the exact app version followed directly by the live fingerprint');
assert.match(swRegister, /requestControllerVersion\(controller, 1200\)[\s\S]{0,240}if \(!result\)[\s\S]{0,120}requestControllerVersion\(controller, 1200\)/, 'controller-version query retries once for slow worker startup');
assert.match(swRegister, /previouslyRequired = status\.reloadRequired === true[\s\S]{0,220}status\.reloadRequired = true[\s\S]{0,220}publishStatus\(\)/, 'controlled pages are provisionally write-blocked while controller identity is unresolved');
assert.match(swRegister, /scopePath/, 'service-worker diagnostics expose only the registration scope path, not a full origin URL');
assert.match(swRegister, /controllerCheckDurationMs/, 'service-worker diagnostics measure controller proof latency for Android wake QA');
assert.match(swRegister, /controllerCheckAttempts/, 'service-worker diagnostics report controller proof retry count');
assert.match(swRegister, /controllerCheckTimedOut/, 'service-worker diagnostics report fail-closed controller proof timeouts');
assert.match(swRegister, /else \{[\s\S]{0,80}controllerMatchesApp = false[\s\S]{0,180}controllerMatchesApp !== true/, 'controlled pages fail closed when controller version cannot be proven');
assert.match(swRegister, /function startUpdateTimers\(\)/, 'SW update timers have a restartable lifecycle');
assert.match(swRegister, /pageshow[\s\S]{0,420}!periodicUpdateTimer[\s\S]{0,120}startUpdateTimers\(\)/, 'bfcache restore restarts periodic SW update checks');
assert.match(swRegister, /window\.addEventListener\("pagehide", stopUpdateTimers\)/, 'every pagehide stops SW update timers without one-shot loss');
const appUpdateCode = read('app.js');
assert.match(appUpdateCode, /_reloadRequiredForVersion/, 'stale-code reload state is tracked by the app');
assert.match(appUpdateCode, /toast_update_reload_required/, 'writes from a stale app version are blocked with an explicit reload message');
assert.match(appUpdateCode, /tripmaster:reload-required/, 'app listens for forced reload after controller mismatch');
assert.match(appUpdateCode, /tripmaster:apply-update/, 'Reload now asks the waiting service worker to activate');
assert.match(appUpdateCode, /reloadRequired === true && swStatus\.controllerMatchesApp === false/, 'only a proven controller mismatch latches permanent reload-required state');
assert.match(appUpdateCode, /reloadRequired === true && swStatus\.controllerMatchesApp == null[\s\S]{0,220}return false/, 'unresolved controller identity blocks a write without permanently latching reload-required state');
assert.match(appUpdateCode, /return raw\.filter\(\(trip\) => trip && typeof trip === \"object\"\);/, 'normalization preserves legacy trips with missing IDs for stable-ID repair instead of dropping them');
assert.match(appUpdateCode, /function guardPreferenceWrite\(kind\)/, 'settings/theme writes share the stale-version safety boundary');
assert.match(appUpdateCode, /commitSettings\(mutate\)[\s\S]{0,360}guardPreferenceWrite\("settings"\)/, 'settings writes are guarded before mutation');
assert.match(appUpdateCode, /themeBtn[\s\S]{0,260}guardPreferenceWrite\("theme"\)/, 'theme writes are guarded before persistence');
assert.match(appUpdateCode, /event\.key === KEY_THEME[\s\S]{0,160}_externalThemePending = true/, 'theme changes participate in cross-window storage sync');
assert.match(appUpdateCode, /detectMissedPreferenceChanges\(\)[\s\S]{0,350}_externalThemePending/, 'wake path detects missed settings/theme storage events');
assert.match(appUpdateCode, /function guardPreferenceStateBeforeDestructiveWrite\(\)/, 'destructive writes have a canonical preference freshness guard');
assert.match(appUpdateCode, /function doRestore\(backup\)[\s\S]{0,180}guardPreferenceStateBeforeDestructiveWrite\(\)/, 'Restore refuses stale cross-window preference state before snapshot/write');
assert.match(appUpdateCode, /confirmReset\(\(\) => \{[\s\S]{0,420}guardPreferenceStateBeforeDestructiveWrite\(\)/, 'Reset refuses stale cross-window preference state before snapshot/write');
assert.match(appUpdateCode, /const storedSettings = safeParseJSON\(KEY_SETTINGS, null\)[\s\S]{0,700}settings: settingsForStorage\(canonicalSettings\)/, 'full backup exports canonical persisted settings rather than stale window memory');

const scripts = fs.readdirSync(root).filter(f=>f.endsWith('.js'));
for (const file of scripts){
  const r=spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8'});
  assert.equal(r.status,0,`${file} syntax: ${r.stderr}`);
}

const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length,'no duplicate static HTML ids');
const labelFors=[...html.matchAll(/<label\b[^>]*\bfor="([^"]+)"/g)].map(m=>m[1]);
for (const target of labelFors) assert.ok(ids.includes(target), `label target exists: ${target}`);

// Static accessibility contract: every shipped button needs an accessible
// name, and dialog/control relationships must resolve to real elements.
const buttons=[...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)];
for(const [i,m] of buttons.entries()){
  const attrs=m[1]||'';
  const text=(m[2]||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  const named=!!text || /\baria-label="[^"]+"/.test(attrs) || /\bdata-i18n-aria-label="[^"]+"/.test(attrs) || /\btitle="[^"]+"/.test(attrs) || /\bdata-i18n-title="[^"]+"/.test(attrs);
  assert.ok(named,`static button ${i+1} has an accessible name`);
}
const ariaLabelled=[...html.matchAll(/\baria-labelledby="([^"]+)"/g)].map(m=>m[1]);
for(const target of ariaLabelled) assert.ok(ids.includes(target),`aria-labelledby target exists: ${target}`);
const ariaControls=[...html.matchAll(/\baria-controls="([^"]+)"/g)].map(m=>m[1]);
for(const target of ariaControls) assert.ok(ids.includes(target),`aria-controls target exists: ${target}`);

const i18nCode = read('i18n.js') + '\n;globalThis.__TM_TRANSLATIONS__ = TRANSLATIONS;globalThis.__TM_LANG_META__=LANG_META;globalThis.__TM_ACTIVE_LANGUAGES__=activeLanguages();';
const c=vm.createContext({console}); vm.runInContext(i18nCode,c,{filename:'i18n.js'});
const tables=c.__TM_TRANSLATIONS__;
// Freeze every pre-RC2 translation value, including all existing Amharic copy.
const existingCopy=Object.keys(tables).sort().map(lang=>[lang,Object.keys(tables[lang]).filter(k=>k!=="toast_storage_partial").sort().map(key=>[key,tables[lang][key]])]);
assert.equal(crypto.createHash('sha256').update(JSON.stringify(existingCopy)).digest('hex'),'d42b6c98bee105a5318fb710e9bf72d291e126d638294473b94d965679de14dc','all existing 970 x 7 translation values match the verified RC1 source');
const langMeta=c.__TM_LANG_META__;
const langs=[...c.__TM_ACTIVE_LANGUAGES__];
const base=Object.keys(tables.he).sort();

assert.equal(langMeta.am.lang,'am-ET','Amharic locale foundation is am-ET');
assert.equal(langMeta.am.dir,'ltr','Amharic foundation is LTR');
assert.equal(langMeta.am.active,true,'Amharic remains active in v3200');
assert.ok(langs.includes('am'),'Amharic is included in active languages');
assert.equal(langs.length,7,'v3200 exposes exactly seven active UI languages');
assert.equal(base.length,971,'RC2 retains 970 keys and adds the partial-save warning');
const dirBoot = read('dir-boot.js');
assert.match(dirBoot, /am:\s*\["am-ET",\s*"ltr"\]/, 'early dir boot knows Amharic locale/direction');
const appCode = read('app.js');
assert.match(appCode, /new Intl\.PluralRules\(meta\.lang\)/, 'locale-aware plural helper present');
const amRules = new Intl.PluralRules('am-ET');
assert.equal(amRules.select(0),'one','Amharic plural 0 => one');
assert.equal(amRules.select(1),'one','Amharic plural 1 => one');
assert.equal(amRules.select(2),'other','Amharic plural 2 => other');

for(const lang of langs){
  const keys=Object.keys(tables[lang]).sort();
  assert.equal(keys.length,base.length,`${lang} translation count`);
  assert.deepEqual(keys,base,`${lang} translation parity`);
  for(const k of keys) assert.notEqual(String(tables[lang][k]).trim(),'',`${lang}.${k} non-empty`);
}

const placeholders=(value)=>[...String(value).matchAll(/\{[^{}]+\}/g)].map(m=>m[0]).sort();
for(const lang of langs){
  for(const k of base){
    assert.deepEqual(placeholders(tables[lang][k]),placeholders(tables.en[k]),`${lang}.${k} placeholder parity`);
  }
}
const amValues=Object.values(tables.am);
const amEthiopicCount=amValues.filter(v=>/[\u1200-\u137F]/.test(String(v))).length;
assert.ok(amEthiopicCount>=850,`Amharic uses Ethiopic script broadly (${amEthiopicCount}/${amValues.length})`);
const amEnglishIdentityAllowlist=new Set(['access_title','tool_esim_label','day_logistics_checkout','day_logistics_checkin','today_checkout','today_checkin','ai_strip_title','ai_sheet_title','readiness_area_access']);
const amUnexpectedEnglishIdentity=base.filter(k=>String(tables.am[k])===String(tables.en[k])&&!amEnglishIdentityAllowlist.has(k));
assert.deepEqual(amUnexpectedEnglishIdentity,[],'Amharic has no accidental English identity fallbacks');
for(const k of amEnglishIdentityAllowlist) assert.equal(String(tables.am[k]),String(tables.en[k]),`Amharic deliberate product/industry term remains stable: ${k}`);
const bootWatchdog = read('boot-watchdog.js');
assert.match(bootWatchdog,/am:\s*\[/,'boot watchdog has an Amharic startup-failure copy');
const stylesAm = read('styles.css');
assert.match(stylesAm,/html\[lang\^="am"\]/,'Amharic has an Ethiopic-friendly local font stack');

// Every literal translation key referenced by runtime JS/HTML must exist.
// Parity alone can still PASS when all languages omit the same referenced key.
const referencedKeys=new Set();
for(const file of scripts){
  const code=read(file);
  for(const m of code.matchAll(/\b(?:t|tf|tfPlural)\(\s*["'`]([^"'`]+)["'`]\s*(?=[,)])/g)) referencedKeys.add(m[1]);
}
for(const m of html.matchAll(/\bdata-i18n(?:-[a-z-]+)?="([^"]+)"/g)) referencedKeys.add(m[1]);
const missingReferenced=[...referencedKeys].filter(k=>!Object.prototype.hasOwnProperty.call(tables.he,k)).sort();
assert.deepEqual(missingReferenced,[],`all literal runtime translation keys exist: ${missingReferenced.join(', ')}`);


assert.match(html, /<select id="budgetCurrency">/, 'budget uses a currency picker');
assert.match(html, /<select id="expenseCurrency">/, 'expenses use a currency picker');
assert.match(html, /id="bookingCenterFilters"/, 'Booking Center filters present');
assert.match(html, /id="moneyFilters"/, 'Money filters present');
assert.match(html, /id="documentsFilters"/, 'Documents filters present');
const styles = read('styles.css');
assert.match(styles, /\.compact-btn\{[^}]*width:auto/, 'compact buttons do not inherit full-width overlap behavior');
assert.match(styles, /\.header-inner\s*\{[^}]*min-height:\s*62px[^}]*height:\s*auto/s, 'header can grow under large text instead of clipping at a fixed height');
assert.match(styles, /\.btn\s*\{[^}]*min-height:\s*50px[^}]*height:\s*auto[^}]*white-space:\s*normal/s, 'primary buttons grow and wrap instead of clipping translated/large text');
assert.match(styles, /@supports \(height:\s*100dvh\)[\s\S]*?\.sheet[\s\S]*?80dvh/, 'bottom sheets use dynamic viewport units when supported');
assert.match(styles, /\.sheet\s*\{[^}]*overscroll-behavior-y:\s*contain/s, 'bottom sheets contain overscroll on mobile');
assert.match(styles, /\.ai-quick-prompt\{[^}]*min-height:44px/, 'AI quick prompts meet the 44px touch-target floor');
assert.match(styles, /\.readiness-area-btn\{[^}]*min-height:44px/, 'Readiness action buttons meet the 44px touch-target floor');
assert.match(styles, /\.filter-chip\{[^}]*min-height:44px/, 'filter chips meet the 44px touch-target floor');
assert.match(styles, /\.toast-action\s*\{[^}]*min-height:\s*44px/s, 'Undo/toast actions meet the 44px touch-target floor');
assert.match(styles, /@media \(forced-colors:\s*active\)/, 'forced-colors accessibility support is present');
assert.match(appCode, /if \(!already\) \{[\s\S]{0,420}el\.scrollTop = 0/, 'freshly opened sheets reset retained scroll position');

assert.match(html, /id="tripBoardSheet"/, 'Trip Board sheet present');

assert.match(html, /id="tripBriefSheet"/, 'Trip Brief sheet present');
assert.match(html, /id="plannerBriefQuick"/, 'Trip Brief planner entry present');
assert.match(appCode, /function tripBriefSafeText\(/, 'share-safe Trip Brief formatter present');
const briefMatch = appCode.match(/function tripBriefSafeText\(trip\)\{([\s\S]*?)\n    \}/);
assert.ok(briefMatch, 'Trip Brief safe formatter body found');
assert.doesNotMatch(briefMatch[1], /\.confirmation\b|\.reference\b|bookingUrl|private/i, 'share-safe Trip Brief does not include booking references/confirmations/private fields');
assert.match(appCode, /function attentionDetailRows\(/, 'actionable attention detail renderer present');
assert.match(html, /id="safetyCenterSheet"/, 'Data Safety Center present');
assert.match(html, /id="tripDuplicateBtn"/, 'trip duplication control present');
assert.match(html, /data-board-tab="attention"/, 'Trip Board attention tab present');
assert.match(html, /id="tripTaskDate"/, 'dated trip tasks present');
assert.match(html, /id="tripTaskPriority"/, 'task priority picker present');
assert.match(html, /id="dayDuplicateBtn"/, 'day duplication control present');
assert.match(html, /id="addDuplicateBtn"/, 'activity duplication control present');
assert.match(html, /id="tripArchiveBtn"/, 'trip archive control present');
assert.match(html, /id="tripExportBtn"/, 'single-trip export control present');
assert.match(html, /id="tripShareBtn"/, 'single-trip share control present');
assert.match(html, /id="tripImportBtn"/, 'single-trip import control present');
assert.match(html, /id="tripImportInput"/, 'single-trip import file input present');
assert.match(html, /id="tripTaskCancelEditBtn"/, 'checklist edit-cancel control present');
assert.match(appCode, /ensureStableTripGraphIds/, 'stable graph-id migration present');
assert.match(appCode, /stable-ID migration could not be persisted[\s\S]{0,160}saveTrips|saveTrips\(\)[\s\S]{0,160}stable-ID migration could not be persisted/, 'stable-ID migration persists graph without syncing stale active days');
assert.match(appCode, /importPortableTripPayload/, 'single-trip import workflow present');
assert.match(appCode, /renderTodayTasks/, 'Today task integration present');

// v2400 beta reliability / support pack.
assert.match(html, /id="betaHealthRunBtn"/, 'beta data-health control present');
assert.match(html, /id="betaDiagnosticsCopyBtn"/, 'beta diagnostics copy control present');
assert.match(html, /id="betaDiagnosticsDownloadBtn"/, 'beta diagnostics download control present');
assert.match(appCode, /function runBetaHealthAudit\(showToastAfter\)\{[\s\S]{0,220}readCanonicalTripState\(\)[\s\S]{0,260}Operations\.auditTripGraph/, 'local structural audit reads persisted canonical state');
assert.match(appCode, /Operations\.backupPayloadReport\(backup\)/, 'full backup validation is wired before restore');
assert.match(appCode, /file\.size>15\*1024\*1024/, 'full restore has a pre-read size ceiling');
assert.match(appCode, /function exportBackup\(\) \{[\s\S]{0,180}readCanonicalTripState\(\)/, 'full backups read persisted canonical trip state');
assert.match(appCode, /tripmaster-backup-[\s\S]{0,300}document\.body\.appendChild\(a\);a\.click\(\);a\.remove\(\);[\s\S]{0,120}setTimeout\(\(\)=>URL\.revokeObjectURL\(url\),0\)/, 'full backup uses Android-safe anchored deferred-revoke download');
assert.match(appCode, /function downloadIcsFallback\(\) \{[\s\S]{0,420}document\.body\.appendChild\(a\);a\.click\(\);a\.remove\(\);[\s\S]{0,120}setTimeout\(\(\)=>URL\.revokeObjectURL\(url\),0\)/, 'ICS fallback uses anchored deferred-revoke download');
const opsCode=read('app-operations.js');
assert.match(opsCode, /payload\.settings==null\) add\(warnings,"backup_settings_missing_legacy"\)/, 'legacy backups without settings remain compatible');
assert.match(opsCode, /backup_settings_invalid/, 'malformed present backup settings are still rejected');
assert.match(opsCode, /startsWith\("duplicate_"\)\)\.forEach\(code=>add\(warnings,code\)\)/, 'legacy duplicate stable IDs are warning-level and repairable during Restore');
assert.match(opsCode, /invalid_journey_date/, 'beta audit validates journey dates');
assert.match(opsCode, /journey_arrival_before_departure_date/, 'beta audit validates journey chronology');
assert.match(opsCode, /invalid_stay_date_range/, 'beta audit validates stay chronology');
assert.match(appCode, /function betaDiagnosticsObject\(/, 'sanitized diagnostic report builder present');
const aiClientCode=read('app-ai-client.js');
assert.match(aiClientCode, /contextFingerprintView/, 'AI stale-context fingerprint has a dedicated stable projection');
assert.match(aiClientCode, /v2TransportExpected/, 'future V2 transport explicitly declares when fail-closed schema validation applies');
assert.match(aiClientCode, /claim_truth_layer_invalid/, 'future V2 claims fail closed on unknown truth layers');
assert.ok(aiClientCode.includes('text.replace(/[^\\p{L}\\p{N}]+/gu, " "'), 'short AI intent matching tokenizes punctuation safely');
const diagStart=appCode.indexOf("function betaDiagnosticsObject(){");
const diagEnd=appCode.indexOf("function betaDiagnosticsText",diagStart);
assert.ok(diagStart>=0&&diagEnd>diagStart,'diagnostic builder body found');
const diagBody=appCode.slice(diagStart,diagEnd);
assert.doesNotMatch(diagBody, /\.name\b|\.title\b|\.location\b|\.note\b|\.reference\b|\.confirmation\b|\.amount\b|\.booking/i, 'diagnostic report excludes trip-content/private fields');
assert.match(appCode, /runtimeFaults:readRuntimeDiagnostics\(\)/, 'runtime fault breadcrumbs included in diagnostics');
assert.match(appCode, /armRuntimeDiagnostics\(\)/, 'post-boot runtime diagnostics are armed');
assert.match(appCode, /window\.addEventListener\("storage"/, 'cross-window storage change detection is wired');
assert.match(appCode, /event\.key === KEY_SETTINGS[\s\S]{0,180}_externalSettingsPending = true/, 'settings changes participate in cross-window sync');
assert.match(appCode, /function adoptExternalSettingsFromStorage\(\)[\s\S]{0,700}settings = normalizeSettings\(storedSettings\)/, 'external settings adoption normalizes canonical storage');
assert.match(appCode, /hadExternalSettings[\s\S]{0,900}adoptExternalSettingsFromStorage\(\)/, 'wake sync adopts pending external settings through the canonical helper');
assert.match(appCode, /function syncModalInert\(\)/, 'modal sheet accessibility inert manager is present');
assert.match(appCode, /document\.querySelectorAll\("\.sheet"\)[\s\S]{0,220}sheet !== top/, 'only the top sheet remains interactive for assistive technology');
assert.match(appCode, /function guardExternalStateBeforeWrite\(/, 'stale cross-window writes are guarded');
assert.match(appCode, /function failedWriteWasExternal\(\)/, 'direct-save callers can distinguish an external-state guard block from storage failure');
assert.match(appCode, /function createTrip\([\s\S]{0,900}failedWriteWasExternal\(\)[\s\S]{0,350}if \(!externalConflict\)/, 'new-trip conflict path never restores a stale snapshot over canonical external state');
assert.match(appCode, /function duplicateTrip\([\s\S]{0,650}failedWriteWasExternal\(\)[\s\S]{0,150}!externalConflict/, 'duplicate-trip conflict path preserves canonical external state');
assert.match(appCode, /function switchTrip\([\s\S]{0,700}failedWriteWasExternal\(\)[\s\S]{0,150}!externalConflict/, 'switch-trip conflict path preserves canonical external state');
assert.match(appCode, /function importPortableTripPayload\([\s\S]{0,900}failedWriteWasExternal\(\)[\s\S]{0,180}!externalConflict/, 'trip-import conflict path preserves canonical external state');
assert.ok(appCode.includes('function commitState(mutate, undoRecord) {\n      if(!guardExternalStateBeforeWrite())return false;'), 'ordinary trip mutations stop on external state conflicts');
assert.ok(appCode.includes('function saveTrips() {\n      if(!guardExternalStateBeforeWrite())return false;'), 'direct trip writes stop on external state conflicts');
assert.match(appCode, /confirmReset\(\(\) => \{[\s\S]{0,320}guardExternalStateBeforeWrite\(\)[\s\S]{0,320}writeSafetySnapshot\("reset"\)/, 'Reset guards external state before its safety snapshot');
assert.match(appCode, /function writeSafetySnapshot\(reason\) \{[\s\S]{0,2200}readCanonicalTripState\(\)/, 'safety snapshots are built from persisted canonical trip state');
assert.match(appCode, /function writeSafetySnapshot\(reason\)[\s\S]{0,2500}normalizeSettings\(safeParseJSON\(KEY_SETTINGS, null\)\)[\s\S]{0,420}settingsForStorage\(canonicalSettings\)/, 'safety snapshots use canonical persisted settings rather than stale window memory');
assert.match(appCode, /function reloadStateAfterWake\(\) \{[\s\S]{0,700}openSheetHasStaleTripToken\(\)[\s\S]{0,700}topOpenSheet\(\)[\s\S]{0,300}return false/, 'wake defers canonical state adoption while an editor sheet is open');
assert.match(appCode, /activeTripId = localStorage\.getItem\(KEY_ACTIVE_TRIP\)[\s\S]{0,420}_externalStatePending = false[\s\S]{0,420}ensureStableTripGraphIds\(\)/, 'wake clears adopted external-trip pending state before repair persistence to prevent recursion');
assert.match(appCode, /function guardExternalStateBeforeWrite\(\) \{[\s\S]{0,1800}openSheetHasStaleTripToken\(\)[\s\S]{0,1000}topOpenSheet\(\)[\s\S]{0,300}return false/, 'write guard blocks repeated saves from an editor whose canonical trip state changed');
assert.match(appCode, /dataset\.tripStateToken = canonicalTripStorageToken\(\)/, 'sheets capture the canonical trip-state token at open time');
assert.match(appCode, /function restampOpenSheetsAfterOwnTripWrite\(previousToken\)[\s\S]{0,520}Operations\.restampMatchingStateTokens\(datasets, previousToken, nextToken\)/, 'successful own writes advance surviving sheet tokens through the tested helper');
assert.match(appCode, /function persistState\(\)[\s\S]{0,700}restampOpenSheetsAfterOwnTripWrite\(previousToken\)/, 'ordinary own writes re-stamp surviving parent sheets');
assert.match(appCode, /CROSS-WINDOW-CLOSE-001[\s\S]{0,900}dataset\.tripStateToken !== currentToken[\s\S]{0,120}_externalStatePending = true/, 'closing a stale sheet preserves missed storage-event evidence before discarding its token');
assert.doesNotMatch(appCode, /let editingDayIndex|let editingItemIndex/, 'activity editor no longer retains mutable day/item indices as editor identity');
assert.match(appCode, /findActivityPositionByStableId\(editingDayId, editingItemUid\)/, 'activity saves resolve the current entity from stable IDs');
assert.doesNotMatch(appCode, /_editing(?:Stay|Journey|Expense|Document)Index/, 'logistics and operations editors no longer store positional editor indices');
assert.match(appCode, /rowIndexByStableId\(trip\.stays,_editingStayId\)/, 'stay editor resolves by stable ID at write time');
assert.match(appCode, /rowIndexByStableId\(trip\.journeys,_editingJourneyId\)/, 'journey editor resolves by stable ID at write time');
assert.match(appCode, /rowIndexByStableId\(trip\.expenses,_editingExpenseId\)/, 'expense editor resolves by stable ID at write time');
assert.match(appCode, /rowIndexByStableId\(trip\.documents,_editingDocumentId\)/, 'document editor resolves by stable ID at write time');
assert.match(appCode, /copy\.id=newTripId\("day"\);[\s\S]{0,80}copy\.date=targetDate/, 'Duplicate Day assigns a fresh stable day ID');
assert.match(appCode, /Operations\.repairTripGraphIds\(targetTrips/, 'runtime stable-ID migration uses the testable graph-wide repair helper');
assert.match(opsCode, /function repairTripGraphIds\(rawTrips, idFactory\)/, 'pure graph-wide stable-ID repair helper is present');
assert.match(opsCode, /function restampMatchingStateTokens\(records, previousToken, nextToken\)/, 'pure own-write sheet-token convergence helper is present');
for (const kind of ['trip','day','activity','stay','journey','expense','document','task']) assert.ok(opsCode.includes(kind+':new Set()'), `stable-ID repair tracks duplicate ${kind} IDs`);
assert.match(appCode, /repairStableTripGraphIds\(nextTrips\)[\s\S]{0,600}writeAll\(/, 'Restore repairs legacy duplicate/missing IDs before its first destructive storage write');
assert.doesNotMatch(appCode, /days\.push\(\{ date:/, 'new day creation never persists a day without a stable ID');
assert.doesNotMatch(appCode, /const idx = ids\.lastIndexOf\(id\);\s*if \(idx === -1\) return;/, 'sheet close cannot skip deferred sync/update hooks');
assert.match(appCode, /function undoStorageSignature\(\)/, 'Undo validity is bound to persisted storage state');
assert.match(appCode, /validAgainst:\s*undoStorageSignature\(\)/, 'Undo records capture their post-action storage signature');
assert.match(appCode, /currentUndoSignature[\s\S]{0,220}!== _undo\.validAgainst/, 'Undo refuses a snapshot when persisted state changed after creation');
assert.match(appCode, /window\.addEventListener\("storage"[\s\S]{0,900}invalidateUndoAfterExternalState\(\)/, 'external storage events invalidate whole-state Undo immediately');
assert.match(appCode, /function reloadStateAfterWake\(\) \{[\s\S]{0,3200}hadExternalState[\s\S]{0,500}invalidateUndoAfterExternalState\(\)/, 'wake adoption invalidates stale Undo before clearing external-state pending');
assert.match(appCode, /function deleteTrip\(tripId\)[\s\S]{0,1800}guardExternalStateBeforeWrite\(\)[\s\S]{0,180}writeSafetySnapshot\("trip-delete"\)/, 'trip delete guards external state before overwriting the safety snapshot');
assert.match(appCode, /betaHealthRunBtn[\s\S]{0,180}runBetaHealthAudit\(true\);renderSafetyCenter\(\)/, 'running beta health refreshes the Safety Center grid from canonical state');

// v2500-RC1 Access/readiness contract: Access is profile-driven, not activity-maintained.
assert.doesNotMatch(html, /id="addAccessStatus"|id="addAccessNote"|id="editAccessQuick"/, 'activity form has no user-managed Access classification fields');
const applyActivityMatch=appCode.match(/function applyActivityFieldsFromForm\(item\) \{([\s\S]*?)\n    \}/);
assert.ok(applyActivityMatch, 'activity form mapper found');
assert.doesNotMatch(applyActivityMatch[1], /delete item\.access(?:Status|Note)|item\.access(?:Status|Note)\s*=/, 'normal activity edits preserve stored legacy Access evidence');
assert.match(appCode, /function openAccessProfile\(trip\)/, 'Access profile navigation helper present');
const readinessAreaMatch=appCode.match(/function openReadinessArea\(area, trip\) \{([\s\S]*?)\n    \}/);
assert.ok(readinessAreaMatch, 'openReadinessArea body found');
assert.match(readinessAreaMatch[1], /area === "access"\) \{ openAccessProfile\(trip\); return; \}/, 'Access routing opens the Access profile instead of an activity field');
const readinessEntriesMatch=appCode.match(/function readinessEntries\(trip\) \{([\s\S]*?)\n    \}/);
assert.ok(readinessEntriesMatch, 'readinessEntries body found');
assert.doesNotMatch(readinessEntriesMatch[1], /st\.accessNeedsCheck|st\.accessIssues|st\.taskOtherOpen|st\.missingBase/, 'readiness excludes unchecked Access, undated open tasks and optional base details');
assert.match(readinessEntriesMatch[1], /st\.missingDayDates/, 'readiness catches missing trip dates');
assert.match(readinessEntriesMatch[1], /st\.invalidDayDates/, 'readiness catches invalid trip dates');
assert.match(readinessEntriesMatch[1], /st\.duplicateDayDates/, 'readiness catches duplicate trip dates');
assert.doesNotMatch(readinessEntriesMatch[1], /add\("check"|st\.missingDestination|st\.missingTimezone|st\.plannedStays|st\.plannedJourneys|st\.plannedActivityBookings|st\.paymentAttention/, 'Readiness 3.0 has no check severity, optional metadata warnings, or duplicated booking attention');
assert.match(readinessEntriesMatch[1], /add\("action"[\s\S]*st\.bookingAttention/, 'booking follow-up is one neutral action source');
assert.match(readinessEntriesMatch[1], /st\.journeyDataProblems/, 'Readiness catches journey date/time chronology problems');
const readinessStateMatch=appCode.match(/function tripReadiness\(trip\) \{([\s\S]*?)\n    \}/);
assert.ok(readinessStateMatch, 'tripReadiness body found');
assert.match(readinessStateMatch[1], /const level = issues \? "issue" : "ready"/, 'Readiness top-level state is binary');
assert.doesNotMatch(readinessStateMatch[1], /"check"/, 'Readiness top-level check state removed');
assert.doesNotMatch(appCode, /readiness\.level==="check"\?"\?"/, 'Planner readiness no longer renders the question-mark state');
assert.match(readinessAreaMatch[1], /area === "setup"[\s\S]{0,500}stats\.missingDayDates[\s\S]{0,500}openFirstDaySheet\(\)/, 'missing trip dates route to first-day creation instead of a dead-end details sheet');
assert.match(appCode, /Logistics\.overnightDates\(tripDays\.map\(day => day && day\.date\)\)/, 'stay readiness uses overnight dates instead of treating the final trip date as another night');
assert.match(appCode, /function scheduleRelevantItems\(day\)[\s\S]{0,220}status !== "cancelled"/, 'cancelled activities are excluded from schedule-health calculations');
assert.match(appCode, /DayIntel\.analyzeDay\(scheduleRelevantItems\(day\)\)/, 'Readiness/day health uses the cancelled-filtered schedule projection');
assert.match(appCode, /function flowPairText\(/, 'direction-aware flow-pair renderer is present for RTL route/time/date strings');
assert.match(readinessAreaMatch[1], /area === "logistics"[\s\S]{0,220}openMissingStayEditor\(trip\)/, 'logistics readiness CTA can open the direct missing-stay repair flow');
assert.match(appCode, /function openMissingStayEditor\(trip, preferredDate\)[\s\S]{0,900}openStaySheet\(null\)[\s\S]{0,300}stayStartDate[\s\S]{0,300}stayEndDate/, 'missing-stay repair opens Add Stay and pre-fills the gap range');
assert.doesNotMatch(appCode, /tf\("day_health_access_checks"|tf\("overview_access_to_check/, 'unchecked Access is absent from user-facing health/readiness rendering');
const todayCode=read('app-today.js');
assert.doesNotMatch(todayCode, /access_needs_check/, 'Today does not turn unchecked Access into attention noise');
assert.doesNotMatch(todayCode, /add\("check"/, 'Today operational follow-ups use action, not check severity');
assert.match(todayCode, /add\("action","booking_planned"/, 'Today planned booking follow-up is an action');
assert.match(appCode, /openOpts\.focusField \|\| "addTravelMode"/, 'advanced editor supports targeted focus fields');

// Static DOM contract: every $("id") reference in app.js must exist in index.html.
const staticIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
const staticRefs = [...new Set([...appCode.matchAll(/\$\("([A-Za-z0-9_-]+)"\)/g)].map(m=>m[1]))];
const missingStaticRefs = staticRefs.filter(id=>!staticIds.has(id));
assert.deepEqual(missingStaticRefs,[],`static DOM ids referenced by app.js must exist: ${missingStaticRefs.join(', ')}`);

// v2700 AI V2 client foundation must remain client-only and backward-compatible.
assert.ok(assets.includes('app-ai-client.js'), 'AI V2 client module is precached');
assert.match(html, /<script src="\.\/app-ai-client\.js"><\/script>/, 'AI V2 client module is loaded by index.html');
assert.ok(html.indexOf('./app-ai-client.js') < html.indexOf('./app.js'), 'AI V2 client module loads before app.js');
assert.match(config, /const AI_CLIENT_CONTRACT_VERSION = 2;/, 'AI client contract version is explicit');
assert.match(config, /const AI_V2_TRANSPORT_ENABLED = false;/, 'AI V2 server transport remains disabled until backend work resumes');
assert.match(aiClientCode, /type:\s*"USER_QUESTION"/, 'USER_QUESTION envelope contract present');
assert.match(aiClientCode, /type:\s*"TRIP_EVENT"/, 'TRIP_EVENT envelope contract present');
assert.match(aiClientCode, /booking_reference/, 'AI privacy manifest excludes booking references');
assert.match(aiClientCode, /providerSecretsIncluded:\s*false/, 'AI privacy manifest excludes provider secrets');
assert.match(aiClientCode, /validateV2Response/, 'future evidence fail-closed validator present');
assert.match(aiClientCode, /execution_receipt_missing/, 'future external-truth responses require successful execution receipts');
assert.match(aiClientCode, /executionReceiptsRequiredForExternalTruth:\s*true/, 'V2 request tells the future server execution receipts are required');
assert.match(aiClientCode, /validateOutboundContext/, 'future AI transport has client-side forbidden-key privacy validation');
assert.match(aiClientCode, /clientValidationPassed/, 'V2 privacy manifest records client validation result');
assert.match(appCode, /reportVersion:5/, 'Beta Diagnostics schema v5 includes device-QA lifecycle telemetry');
assert.match(appCode, /lifecycleTimeline:readLifecycleDiagnostics\(\)/, 'Beta Diagnostics includes the sanitized session lifecycle timeline');
assert.match(appCode, /writeSafety:\{reloadRequiredForVersion:/, 'Beta Diagnostics includes sanitized write-gate state');
assert.match(appCode, /navigation:\{canonicalPath:/, 'Beta Diagnostics records URL shape without exporting the URL itself');
assert.match(appCode, /LIFECYCLE_EVENT_TYPES = new Set/, 'lifecycle diagnostics use a fixed event-type allowlist');
const betaDiagnosticsCode = appCode.match(/function betaDiagnosticsObject\(\)[\s\S]*?function betaDiagnosticsText\(\)/)?.[0] || '';
assert.ok(betaDiagnosticsCode, 'Beta Diagnostics builder is present');
assert.doesNotMatch(betaDiagnosticsCode, /navigator\.userAgent/, 'Beta Diagnostics does not export browser user-agent fingerprint data');
assert.doesNotMatch(betaDiagnosticsCode, /location\.href/, 'Beta Diagnostics does not export the full current URL');
assert.match(appCode, /displayMode:/, 'Beta Diagnostics records browser vs installed-standalone runtime mode');
assert.match(appCode, /controllerMatchesApp/, 'Beta Diagnostics can expose sanitized page/service-worker generation mismatch');
assert.doesNotMatch(appCode, /window\.open\([^\n;]+,[ ]*["']_blank["']\s*\)(?:;|\))/,'external blank-window opens must use noopener');
assert.match(appCode, /includeActivityAccess:p\.includeActivityAccess === true/, 'legacy Planner context omits activity Access evidence unless relevant');
assert.match(appCode, /if \(p\.includeMoney !== true\) delete context\.money;/, 'legacy Planner context omits budget totals unless the question is money-related');
assert.match(appCode, /if \(p\.includeBookingSummary !== true\)[\s\S]{0,180}delete context\.bookingAttentionCount[\s\S]{0,120}delete context\.documentAttentionCount/, 'legacy Planner omits booking/document attention counts unless relevant');
assert.match(appCode, /if \(p\.includeAccess === true\)/, 'Access profile is scoped to relevant AI questions');
const accessProjection=appCode.match(/context\.access\s*=\s*\{([\s\S]{0,1200}?)\n\s*\};/);
assert.ok(accessProjection, 'structured Access AI projection found');
assert.doesNotMatch(accessProjection[1], /\bnotes\s*:/, 'raw Access notes are never projected into AI context');
assert.match(accessProjection[1], /hasCustomRequirements/, 'Access projection may expose only a boolean that custom requirements exist');
assert.match(appCode, /if \(p\.includeMobility === true\)/, 'Mobility profile is scoped to relevant AI questions');
assert.match(appCode, /if \(p\.includeToday === true\)/, 'Today context is scoped to relevant AI questions');
assert.match(appCode, /Today\.sanitizedContext\(model, \{ includeAccess:p\.includeAccess === true \}\)/, 'Today AI context omits legacy Access evidence unless Access is relevant');
assert.match(appCode, /currentAIContextFingerprint/, 'AI response has context-fingerprint stale guard');
assert.match(appCode, /readCanonicalTripState\(\)/, 'AI stale guard can compare against canonical persisted trip state');
assert.match(appCode, /body: JSON\.stringify\(\{ tripContext, request:req\.prompt, mode:"auto" \}\)/, 'current Planner transport body is unchanged');
assert.doesNotMatch(appCode, /fetch\([^\n]*\/v2\//, 'PWA does not call a speculative AI V2 server endpoint');

assert.ok(assets.includes('app-operations.js'), 'operations module is precached');
const htmlText = html;
const opScript = htmlText.indexOf('<script src="./app-operations.js"></script>');
const appScript = htmlText.indexOf('<script src="./app.js"></script>');
assert.ok(opScript >= 0, 'operations module is loaded by index.html');
assert.ok(appScript >= 0 && opScript < appScript, 'operations module loads before app.js');


// Boot reliability hardening: watchdog must load before app.js and use progress-aware state.
assert.ok(html.indexOf('./boot-watchdog.js') < html.indexOf('./app.js'), 'boot watchdog loads before app.js');
const watchdog = read('boot-watchdog.js');
assert.match(watchdog, /__tmBootProgress/, 'progress-aware boot watchdog present');
assert.match(watchdog, /STALL_MS\s*=\s*15000/, 'watchdog uses a generous stall threshold');
assert.doesNotMatch(watchdog, /setTimeout\(showFailure,\s*4000\)/, 'old fixed 4-second boot failure removed');
assert.match(appCode, /__tmBootProgress\("core-ready"\)[\s\S]*dataset\.tmBoot = "ready"[\s\S]*tripmaster:ready/, 'core usable render marks boot ready');
assert.ok(appCode.indexOf('__tmBootProgress("core-ready")') < appCode.indexOf('__tmBootProgress("post-boot-complete")'), 'ready boundary precedes non-critical post-boot completion');
assert.match(read('app.js'), /__tmBootFail\(err, "app-init"\)/, 'app startup exceptions report to watchdog');

const manifest=JSON.parse(read('manifest.json'));
assert.equal(manifest.name,'TripMaster');
assert.equal(manifest.short_name,'TripMaster');
assert.equal(manifest.id,'./','manifest identity is deployment-relative rather than hard-coded to one GitHub Pages path');
assert.equal(manifest.scope,'./');
assert.equal(manifest.start_url,'./index.html');
assert.equal(manifest.display,'standalone','manifest launches as standalone PWA');
assert.equal(manifest.orientation,'any','manifest does not force a device orientation');
assert.equal(manifest.prefer_related_applications,false,'web PWA remains the preferred install target');
const manifestMainBase='https://example.test/TripMaster/manifest.json';
const manifestSiblingBase='https://example.test/TripMaster-beta/manifest.json';
assert.equal(new URL(manifest.id,manifestMainBase).pathname,'/TripMaster/','relative manifest id resolves to the production deployment root');
assert.equal(new URL(manifest.id,manifestSiblingBase).pathname,'/TripMaster-beta/','relative manifest id stays unique for sibling/staging deployments');
const resolvedScope=new URL(manifest.scope,manifestMainBase);
const resolvedStart=new URL(manifest.start_url,manifestMainBase);
assert.ok(resolvedStart.pathname.startsWith(resolvedScope.pathname),'manifest start_url remains inside scope');
assert.ok(Array.isArray(manifest.icons)&&manifest.icons.length>=3,'manifest provides install icons including maskable');
function pngDimensions(file){const b=fs.readFileSync(path.join(root,file));assert.equal(b.toString('hex',0,8),'89504e470d0a1a0a',`${file} is a PNG`);return {width:b.readUInt32BE(16),height:b.readUInt32BE(20)};}
for(const icon of manifest.icons){
  assert.match(icon.src,/^\.\//,'manifest icon paths are deployment-relative');
  const file=icon.src.replace(/^\.\//,'');
  assert.ok(assets.includes(file),`manifest icon is precached: ${file}`);
  const declared=String(icon.sizes||'').match(/^(\d+)x(\d+)$/);assert.ok(declared,`manifest icon has an exact size: ${file}`);
  const actual=pngDimensions(file);assert.equal(actual.width,Number(declared[1]),`manifest icon width matches PNG: ${file}`);assert.equal(actual.height,Number(declared[2]),`manifest icon height matches PNG: ${file}`);
}
assert.ok(manifest.icons.some(x=>String(x.purpose||'').split(/\s+/).includes('maskable')&&x.sizes==='512x512'),'manifest has a 512x512 maskable icon');
assert.match(styles,/html\s*\{[^}]*color-scheme:\s*light/s,'native controls receive light color-scheme metadata');
assert.match(styles,/html\[data-theme="dark"\]\s*\{[^}]*color-scheme:\s*dark/s,'native controls receive dark color-scheme metadata');

// v2800 repository/performance budgets: fail the release before the clean PWA
// silently grows back into a large artifact dump or monolithic runtime.
const budgetRootEntries=fs.readdirSync(root,{withFileTypes:true});
const rootFiles=budgetRootEntries.filter(x=>x.isFile());
const allFiles=[];
(function walk(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,ent.name);if(ent.isDirectory())walk(full);else if(ent.isFile())allFiles.push(full);}})(root);
assert.ok(rootFiles.length<=24,`GitHub-clean root file budget: ${rootFiles.length}/24`);
assert.ok(allFiles.length<=30,`GitHub-clean total file budget: ${allFiles.length}/30`);
assert.ok(fs.statSync(path.join(root,'app.js')).size<=450*1024,'app.js stays below the beta monolith budget');
assert.ok(fs.statSync(path.join(root,'i18n.js')).size<=550*1024,'i18n bundle stays below its seven-language beta size budget');
assert.ok(fs.statSync(path.join(root,'styles.css')).size<=120*1024,'styles bundle stays below its beta size budget');
const rootBytes=rootFiles.reduce((n,ent)=>n+fs.statSync(path.join(root,ent.name)).size,0);
assert.ok(rootBytes<=1500*1024,`root runtime/package budget: ${rootBytes} bytes`);

// v2800 brand/accessibility contrast budget for the primary text pairs.
function contrastRatio(a,b){
  const lum=(hex)=>{const rgb=hex.replace('#','').match(/../g).map(x=>parseInt(x,16)/255).map(v=>v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4));return 0.2126*rgb[0]+0.7152*rgb[1]+0.0722*rgb[2];};
  const x=lum(a),y=lum(b),hi=Math.max(x,y),lo=Math.min(x,y);return (hi+0.05)/(lo+0.05);
}
assert.ok(contrastRatio('#FFFFFF','#0E7490')>=4.5,'light primary CTA contrast remains WCAG AA');
assert.ok(contrastRatio('#0B2239','#14B8A6')>=4.5,'light accent/navy contrast remains WCAG AA');
assert.ok(contrastRatio('#EAF1F7','#0F2033')>=4.5,'dark body/card contrast remains WCAG AA');
assert.ok(contrastRatio('#0B2239','#14B8A6')>=4.5,'dark primary CTA contrast remains WCAG AA');



// v2800 accessibility regression guard: icon-only controls need a stable
// accessible name and every visible form control needs an associated label/name.
assert.match(html, /id="themeBtn"[^>]*data-i18n-aria-label="header_theme_title"/, 'theme icon button has a localized accessible name');
assert.match(html, /id="aiBtn"[^>]*data-i18n-aria-label="ai_open_aria"/, 'AI icon button has a localized accessible name');
const accessibleLabelFors=new Set([...html.matchAll(/<label\b[^>]*\bfor="([^"]+)"/g)].map(m=>m[1]));
for(const m of html.matchAll(/<(input|select|textarea)\b([^>]*)>/g)){
  const attrs=m[2]||'';
  if(/type="hidden"|style="[^"]*display\s*:\s*none/i.test(attrs)) continue;
  const id=(attrs.match(/\bid="([^"]+)"/)||[])[1];
  if(!id) continue;
  const wrappedByLabel=new RegExp(`<label\\b[^>]*>[\\s\\S]*?\\bid="${id}"[\\s\\S]*?<\\/label>`).test(html);
  const named=/\baria-label(?:ledby)?="[^"]+"|\bdata-i18n-aria-label="[^"]+"/.test(attrs)||accessibleLabelFors.has(id)||wrappedByLabel;
  assert.ok(named,`visible form control has accessible label: ${id}`);
}

assert.match(html, /rel="apple-touch-icon" href="\.\/icon-192\.png"/, 'iOS home-screen icon is declared');
assert.match(html, /name="mobile-web-app-capable" content="yes"/, 'mobile standalone capability meta is declared');
assert.match(html, /Content-Security-Policy/, 'PWA ships a client CSP');
assert.match(html, /script-src 'self'/, 'CSP blocks third-party script execution');
assert.ok(csp.includes(`connect-src 'self' ${configuredBackend}`), 'CSP allows only the exact configured Planner backend plus same-origin connections');
assert.match(html, /object-src 'none'/, 'CSP blocks object embedding');
assert.match(html, /base-uri 'none'/, 'CSP blocks injected base URL changes');

console.log(`TripMaster release gate: PASS — ${version}`);
console.log(`Translations: ${base.length} keys × ${langs.length} languages`);
console.log(`Precache: ${assets.length} referenced local assets verified`);
console.log(`JavaScript: ${scripts.length} root scripts syntax-checked`);
