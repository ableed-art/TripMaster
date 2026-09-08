import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = f => fs.readFileSync(path.join(root,f),'utf8');
const config = read('config.js');
const sw = read('sw.js');
const html = read('index.html');

const version = config.match(/const APP_VERSION = "([^"]+)";/)?.[1];
const cache = sw.match(/const CACHE_NAME = "([^"]+)";/)?.[1];
assert.ok(version, 'APP_VERSION found');
assert.ok(cache, 'CACHE_NAME found');
const versionToken = version.toLowerCase().replace(/^v/,'').replace(/[^a-z0-9]+/g,'-');
assert.ok(cache.includes(versionToken), `cache name must contain release token ${versionToken}`);
assert.ok(html.includes(`TripMaster ${version}`), 'About fallback version matches APP_VERSION');

const assetBlocks = [...sw.matchAll(/const (?:CORE|OPTIONAL)_ASSETS = \[([\s\S]*?)\];/g)].map(m=>m[1]).join('\n');
const assets = [...assetBlocks.matchAll(/"\.\/([^"]*)"/g)].map(m=>m[1]).filter(Boolean);
for (const asset of assets) assert.ok(fs.existsSync(path.join(root,asset)), `precache asset exists: ${asset}`);

const scripts = fs.readdirSync(root).filter(f=>f.endsWith('.js'));
for (const file of scripts){
  const r=spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8'});
  assert.equal(r.status,0,`${file} syntax: ${r.stderr}`);
}

const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length,'no duplicate static HTML ids');

const i18nCode = read('i18n.js') + '\n;globalThis.__TM_TRANSLATIONS__ = TRANSLATIONS;globalThis.__TM_LANG_META__=LANG_META;globalThis.__TM_ACTIVE_LANGUAGES__=activeLanguages();';
const c=vm.createContext({console}); vm.runInContext(i18nCode,c,{filename:'i18n.js'});
const tables=c.__TM_TRANSLATIONS__;
const langMeta=c.__TM_LANG_META__;
const langs=[...c.__TM_ACTIVE_LANGUAGES__];
const base=Object.keys(tables.he).sort();

assert.equal(langMeta.am.lang,'am-ET','Amharic locale foundation is am-ET');
assert.equal(langMeta.am.dir,'ltr','Amharic foundation is LTR');
assert.equal(langMeta.am.active,false,'Amharic remains gated until native-reviewed copy');
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


assert.match(html, /<select id="budgetCurrency">/, 'budget uses a currency picker');
assert.match(html, /<select id="expenseCurrency">/, 'expenses use a currency picker');
assert.match(html, /id="bookingCenterFilters"/, 'Booking Center filters present');
assert.match(html, /id="moneyFilters"/, 'Money filters present');
assert.match(html, /id="documentsFilters"/, 'Documents filters present');
const styles = read('styles.css');
assert.match(styles, /\.compact-btn\{[^}]*width:auto/, 'compact buttons do not inherit full-width overlap behavior');

assert.match(html, /id="tripBoardSheet"/, 'Trip Board sheet present');
assert.match(html, /id="safetyCenterSheet"/, 'Data Safety Center present');
assert.match(html, /id="tripDuplicateBtn"/, 'trip duplication control present');
assert.match(html, /data-board-tab="attention"/, 'Trip Board attention tab present');
assert.match(html, /id="tripTaskDate"/, 'dated trip tasks present');
assert.match(html, /id="tripTaskPriority"/, 'task priority picker present');
assert.match(html, /id="dayDuplicateBtn"/, 'day duplication control present');
assert.match(html, /id="addDuplicateBtn"/, 'activity duplication control present');
assert.match(html, /id="tripArchiveBtn"/, 'trip archive control present');
assert.match(appCode, /renderTodayTasks/, 'Today task integration present');

// Static DOM contract: every $("id") reference in app.js must exist in index.html.
const staticIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
const staticRefs = [...new Set([...appCode.matchAll(/\$\("([A-Za-z0-9_-]+)"\)/g)].map(m=>m[1]))];
const missingStaticRefs = staticRefs.filter(id=>!staticIds.has(id));
assert.deepEqual(missingStaticRefs,[],`static DOM ids referenced by app.js must exist: ${missingStaticRefs.join(', ')}`);

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
assert.ok(appCode.indexOf('__tmBootProgress("core-ready")') < appCode.indexOf('post-boot-complete'), 'ready boundary precedes non-critical post-boot completion');
assert.match(read('app.js'), /__tmBootFail\(err, "app-init"\)/, 'app startup exceptions report to watchdog');

const manifest=JSON.parse(read('manifest.json'));
assert.equal(manifest.name,'TripMaster');
assert.equal(manifest.scope,'./');
assert.equal(manifest.start_url,'./index.html');

console.log(`TripMaster release gate: PASS — ${version}`);
console.log(`Translations: ${base.length} keys × ${langs.length} languages`);
console.log(`Precache: ${assets.length} referenced local assets verified`);
console.log(`JavaScript: ${scripts.length} root scripts syntax-checked`);
