// Real Chromium hardening: unmodified HTML/scripts, real DOMContentLoaded,
// localStorage shared across full reloads, UI Restore/Export and measured layout.
// npm install playwright; npx playwright install chromium
// Optional: TM_CHROMIUM_EXECUTABLE=/path/to/chromium
// Optional: TM_QA_ARTIFACTS=/outside/release/directory
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const artifacts=process.env.TM_QA_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'tripmaster-qa-'));
assert.ok(!path.resolve(artifacts).startsWith(root+path.sep),'QA artifacts must stay outside the release tree');
fs.mkdirSync(artifacts,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'};
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const file=path.join(root,pathname==='/'||!path.extname(pathname)?'index.html':pathname);
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 try{res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:process.env.TM_CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']}).catch(error=>{server.close();throw error;});
const date=new Date().toISOString().slice(0,10);
const tomorrow=new Date(Date.now()+86400000).toISOString().slice(0,10);
const trip=()=>({id:'t',name:'PRIVATE_TRIP',destination:'PRIVATE_DESTINATION',timezone:'UTC',future:{preserve:true},days:[{id:'d',date,items:[{uid:'a',title:'Museum visit',time:'23:30',endTime:'23:59',location:'LongAddressWithoutBreaks'.repeat(10),note:'PRIVATE_NOTE',booking:{status:'planned',reference:'PRIVATE_BOOKING',confirmationCode:'PRIVATE_CONFIRMATION'}}]},{id:'tomorrow',date:tomorrow,items:[{uid:'b',title:'Market visit',time:'11:00'}]}],stays:[{id:'s',name:'City hotel',location:'LongAddressWithoutBreaks'.repeat(10),startDate:date,endDate:tomorrow}],documents:[{id:'doc',title:'PRIVATE_DOCUMENT',linkedType:'activity',linkedId:'a',url:'https://private.example/?secret=PRIVATE_CREDENTIAL'}],expenses:[{id:'expense',amount:987654.32,currency:'EUR'}],tasks:[{id:'task',title:'Check booking',date,done:false}]});
const seed=(trips=[trip()],settings={language:'en'},active='t')=>({tm_trips:JSON.stringify(trips),tm_active_trip:active,tm_settings_clean:JSON.stringify(settings),tm_days_clean:'[]',tm_theme_clean:'light'});
const backup=()=>({app:'TripMaster',backupVersion:2,trips:[{id:'restored',name:'Restored trip',days:[{id:'restored-day',date,items:[{uid:'restored-a',title:'Restored activity',time:'23:30'}]}]}],activeTripId:'restored',homeDays:[],settings:{language:'en'},theme:'light'});
let groups=0;
const pass=name=>{groups++;console.log('PASS browser '+name)};
async function fresh(initial,locale='en-US',workers='block',failPreservation=false){
 const context=await browser.newContext({viewport:{width:360,height:800},locale,serviceWorkers:workers,reducedMotion:'reduce',acceptDownloads:true});
 await context.addInitScript(values=>{if(sessionStorage.getItem('qa-seeded'))return;sessionStorage.setItem('qa-seeded','1');for(const [k,v]of Object.entries(values))localStorage.setItem(k,v)},initial);
 if(failPreservation)await context.addInitScript(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(this===localStorage&&k.includes('_corrupt_backup_'))throw new DOMException('injected','QuotaExceededError');return original.call(this,k,v)}});
 const page=await context.newPage();page.setDefaultTimeout(7000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin);await ready(page);assert.deepEqual(errors,[]);
 return {context,page,errors};
}
async function ready(page){await page.waitForSelector('html[data-tm-boot="ready"]',{state:'attached'});}
async function stored(page){return page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)])));}
const usage=values=>Object.entries(values).reduce((n,[k,v])=>n+2*(k.length+v.length),0);
async function restore(page,value=backup()){
 await page.locator('#restoreInput').setInputFiles({name:'fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});
 await page.locator('#confirmRestoreOk').click();
}
async function exportFile(page){
 // Trigger the shipped control even when the Safety Center sheet is closed.
 const download=page.waitForEvent('download');await page.locator('#safetyBackupDownloadBtn').dispatchEvent('click');
 const file=await download;return JSON.parse(fs.readFileSync(await file.path(),'utf8'));
}
function canonical(payload){const copy=structuredClone(payload);delete copy.exportedAt;delete copy.createdAt;return copy;}
try {
 console.log('Chromium '+browser.version());
 // F1: independent document globals on each real reload; persistent bytes shared.
 for(const size of [300*1024,Math.round(1.4*1024*1024)]){
  const raw='{'+ 'x'.repeat(size-1), initial=seed();initial.tm_trips=raw;initial.tm_active_trip='evidence-id';initial.tm_safety_snapshot=JSON.stringify({app:'TripMaster',snapshotVersion:1,reason:'manual',createdAt:new Date().toISOString(),trips:backup().trips,activeTripId:'restored',homeDays:[],settings:{language:'en'},theme:'light'});
  const {context,page}=await fresh(initial);
  assert.equal(await page.locator('#safetySnapshotRestoreBtn').isEnabled(),true);
  const first=await stored(page),bytes=usage(first);
  for(let boot=1;boot<24;boot++){await page.reload();await ready(page);assert.deepEqual(await stored(page),first,`boot ${boot+1}: exact persistent bytes unchanged`);}
  const copies=Object.keys(first).filter(k=>k.startsWith('tm_trips_corrupt_backup_'));
  assert.equal(copies.length,1);assert.equal(first[copies[0]],raw);assert.equal(first.tm_active_trip,'evidence-id');
  await restore(page);
  const after=await stored(page);assert.equal(JSON.parse(after.tm_trips)[0].id,'restored');assert.equal(after.tm_safety_snapshot,initial.tm_safety_snapshot);
  const snapshot=JSON.parse(after.tm_recovery_raw_snapshot),ref=new Map(snapshot.rawEntries).get('tm_trips');
  assert.equal(after[ref.corruptBackupKey],raw);assert.ok(after.tm_recovery_raw_snapshot.length<4000);assert.equal(new Map(snapshot.rawEntries).get('tm_active_trip'),'evidence-id');
  pass(`F1/F3 ${size} chars, 24 boots, ${bytes} UTF-16 bytes fixed, Restore succeeds without raw duplication`);
  await context.close();
 }
 // An already preserved historical copy must be used, including full-quota boots.
 {
  const raw='{broken',initial=seed();initial.tm_trips=raw;initial.tm_trips_corrupt_backup_1=raw;
  const {context,page}=await fresh(initial);assert.equal(Object.keys(await stored(page)).filter(k=>k.startsWith('tm_trips_corrupt_backup_')).length,1);
  await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(this===localStorage&&k.includes('_corrupt_backup_'))throw new DOMException('injected','QuotaExceededError');return original.call(this,k,v)}});
  await restore(page);assert.equal(JSON.parse((await stored(page)).tm_trips)[0].id,'restored');
  pass('F1 reuses an existing preserved raw copy without requesting a new write');await context.close();
 }
 // F2: actual boot + UI save + second boot, never isolated repair helper tests.
 for(const member of ['trip','day','activity','stay','journey','expense','document','task']){
  const graph=[trip(),{id:'other',name:'Other trip',days:[]}];
  const list=member==='trip'?graph:member==='day'?graph[0].days:member==='activity'?graph[0].days[0].items:graph[0][({stay:'stays',journey:'journeys',expense:'expenses',document:'documents',task:'tasks'})[member]]||(graph[0].journeys=[]);
  list.push(null,42,'bad',false,[]);
  const initial=seed(graph),{context,page}=await fresh(initial);
  assert.equal(await page.locator('#safetyCenterSheet').isVisible(),false);assert.equal(await page.locator('#heroDoneBtn').isVisible(),true);
  const preserved=await stored(page);assert.ok(Object.entries(preserved).some(([k,v])=>k.startsWith('tm_trips_corrupt_backup_')&&v===initial.tm_trips));
  for(let boot=0;boot<3;boot++){await page.reload();await ready(page);assert.deepEqual(await stored(page),preserved);}
  await page.locator('#heroDoneBtn').click();
  const repaired=await stored(page),parsed=JSON.parse(repaired.tm_trips);assert.equal(parsed.length,2);assert.equal(parsed[0].days.length,2);assert.equal(parsed[0].days[0].items.length,1);assert.equal(parsed[0].stays.length,1);assert.deepEqual(parsed[0].future,{preserve:true});
  await page.reload();await ready(page);assert.deepEqual(await stored(page),repaired);
  await page.locator('#homeNavBtn').click();assert.ok((await page.locator('#homeDashboardBody').innerText()).includes('Other trip'));
  pass(`F2 invalid ${member} members repaired via full boot/save/reboot; both trips remain`);await context.close();
 }
 for(const collection of ['days','items','stays','journeys','expenses','documents','tasks']){
  const graph=[trip()];if(collection==='items')graph[0].days[0].items={};else graph[0][collection]={};
  const initial=seed(graph),{context,page}=await fresh(initial);
  assert.equal(await page.locator('#safetyCenterSheet').isVisible(),true);assert.equal((await stored(page)).tm_trips,initial.tm_trips);assert.equal((await stored(page)).tm_active_trip,'t');
  pass(`F2/F3 non-array ${collection} stays quarantined with active evidence intact`);await context.close();
 }
 // Failed preservation must block recovery, including after a copy disappears.
 {
  const initial=seed();initial.tm_trips='{unreadable';const {context,page}=await fresh(initial);
  await page.evaluate(()=>{for(const k of Object.keys(localStorage))if(k.includes('_corrupt_backup_'))localStorage.removeItem(k)});
  await restore(page);assert.equal((await stored(page)).tm_trips,initial.tm_trips);assert.ok((await page.locator('#toast').innerText()).includes('local safety copy'));
  pass('F1 missing preserved bytes fail closed despite a successful earlier in-memory preservation');await context.close();
 }
 // A storage fault on the initial preservation attempt must not turn a
 // repairable graph into writable empty data or allow a destructive Restore.
 for(const raw of ['{unreadable',JSON.stringify([trip(),null])]){
  const initial=seed();initial.tm_trips=raw;const {context,page}=await fresh(initial,'en-US','block',true);
  assert.equal(await page.locator('#safetyCenterSheet').isVisible(),true);assert.equal((await stored(page)).tm_active_trip,'t');
  await restore(page);assert.equal((await stored(page)).tm_trips,raw);assert.equal(Object.keys(await stored(page)).filter(k=>k.includes('_corrupt_backup_')).length,0);
  pass('F1/F2 failed initial raw preservation quarantines safely and refuses Restore');await context.close();
 }
 {
  const initial=seed();initial.tm_days_clean=JSON.stringify([null,{id:'legacy-day',date,items:[null,{uid:'legacy-a',title:'Legacy visit',time:'10:00'}]}]);
  const {context,page}=await fresh(initial);const first=await stored(page);assert.equal(first.tm_days_clean,'[]');const graph=JSON.parse(first.tm_trips);assert.ok(graph.some(t=>t.days.some(d=>d.items.some(a=>a.uid==='legacy-a'))));
  await page.reload();await ready(page);assert.deepEqual(await stored(page),first);pass('F2 legacy Home rows migrate once through real boot and remain idempotent');await context.close();
 }
 // F3 healthy stale pointer cleanup still works.
 {
  const {context,page}=await fresh(seed([trip()],{language:'en'},'deleted'));
  assert.equal((await stored(page)).tm_active_trip,'');pass('F3 readable graph still normalizes a stale active pointer');await context.close();
 }
 for(const [locale,lang,dir] of [['en-US','en','ltr'],['he-IL','he','rtl'],['ar-SA','ar','rtl'],['am-ET','am-ET','ltr'],['fr-FR','en','ltr']]){
  const initial=seed();initial.tm_settings_clean='{broken';const {context,page}=await fresh(initial,locale);
  assert.equal(await page.locator('html').getAttribute('lang'),lang);assert.equal(await page.locator('html').getAttribute('dir'),dir);assert.equal((await stored(page)).tm_settings_clean,'{broken');
  pass(`F4 corrupt Settings fallback ${locale} -> ${lang}/${dir}, raw retained`);await context.close();
 }
 // F5: trip write succeeds, active-ID write fails; restoring old trip bytes fails.
 for(const doubleFault of [false,true]){
  const initial=seed(),{context,page}=await fresh(initial);
  await page.evaluate(({oldTrips,doubleFault})=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(this===localStorage&&((k==='tm_active_trip'&&v==='restored')||(doubleFault&&k==='tm_trips'&&v===oldTrips)))throw new DOMException('PRIVATE_NOTE PRIVATE_CREDENTIAL','QuotaExceededError');return original.call(this,k,v)}},{oldTrips:initial.tm_trips,doubleFault});
  await restore(page);
  const result=await stored(page),toast=await page.locator('#toast').innerText();
  if(doubleFault){assert.equal(JSON.parse(result.tm_trips)[0].id,'restored');assert.equal(result.tm_active_trip,'t');assert.match(toast,/Some changes may have been saved/);assert.doesNotMatch(toast,/not applied/);await page.locator('#toast .toast-action').click();assert.equal(await page.locator('#safetyCenterSheet').isVisible(),true);
   const diagnosticDownload=page.waitForEvent('download');await page.locator('#betaDiagnosticsDownloadBtn').click();
   const report=fs.readFileSync(await (await diagnosticDownload).path(),'utf8');assert.match(report,/rollback_failed/);assert.doesNotMatch(report,/PRIVATE_|987654\.32|private\.example/);
   const logs=await page.evaluate(()=>Object.fromEntries(Object.keys(sessionStorage).filter(k=>k!=='qa-seeded').map(k=>[k,sessionStorage.getItem(k)])));
   assert.match(JSON.stringify(logs),/rollback_failed/);assert.doesNotMatch(JSON.stringify(logs),/PRIVATE_|987654\.32|private\.example/);
  }else{assert.equal(result.tm_trips,initial.tm_trips);assert.match(toast,/not applied/);}
  assert.equal(JSON.parse(result.tm_safety_snapshot).trips[0].id,'t');
  pass(`F5 ${doubleFault?'double fault exposes partial state, actionable warning, sanitized event':'single write fault rolls back and retains ordinary message'}`);await context.close();
 }
 {
  const {context,page}=await fresh(seed());
  // Two consecutive legitimate writes must persist through the same document.
  await page.locator('#heroDoneBtn').click();await page.locator('#heroDoneBtn').click();assert.equal(JSON.parse((await stored(page)).tm_trips)[0].days[0].items[0].completed,false);
  const first=await exportFile(page);await restore(page,first);const second=await exportFile(page);assert.deepEqual(canonical(second),canonical(first));
  pass('healthy repeated saves and Export -> Restore -> Export canonical round-trip');await context.close();
 }
 // Full-boot identity migration and relationship remapping.
 {
  const first=trip(),second=structuredClone(first);second.name='Second duplicate';first.days.push({date:tomorrow,items:[{title:'Missing IDs'}]});
  const {context,page}=await fresh(seed([first,second]));const saved=await stored(page),graph=JSON.parse(saved.tm_trips);
  assert.notEqual(graph[0].id,graph[1].id);assert.notEqual(graph[0].stays[0].id,graph[1].stays[0].id);assert.notEqual(graph[0].days[0].items[0].uid,graph[1].days[0].items[0].uid);
  assert.equal(graph[1].documents[0].linkedId,graph[1].days[0].items[0].uid);assert.ok(graph[0].days[2].id);assert.ok(graph[0].days[2].items[0].uid);
  await page.reload();await ready(page);assert.deepEqual(await stored(page),saved);
  pass('real boot stable/missing/duplicate IDs and cross-trip document remapping, second boot unchanged');await context.close();
 }
 for(const change of ['save','active-switch','reorder-delete']){
  const initial=seed(change==='active-switch'?[trip(),{id:'other',name:'Other trip',days:[]}]:[trip()]);const {context,page}=await fresh(initial);const other=await context.newPage();await other.goto(origin);await ready(other);
  if(change==='reorder-delete')await page.locator('#deleteDayBtn').click();else {await page.locator('#heroEditBtn').click();await page.locator('#addTitle').fill('STALE_EDIT');}
  if(change==='save')await other.locator('#heroDoneBtn').click();
  else if(change==='active-switch'){await other.locator('#homeNavBtn').click();await other.locator('.home-other-pick').filter({hasText:'Other trip'}).click();assert.equal((await stored(other)).tm_active_trip,'other');}
  else await other.evaluate(()=>{const graph=JSON.parse(localStorage.getItem('tm_trips'));graph[0].days.reverse();localStorage.setItem('tm_trips',JSON.stringify(graph))});
  const canonical=await stored(other);
  if(change==='reorder-delete')await page.locator('#confirmDeleteDayOk').click();else await page.locator('#addSaveBtn').click();
  assert.deepEqual(await stored(page),canonical);assert.ok(!(await stored(page)).tm_trips.includes('STALE_EDIT'));
  pass(`real two-window protection after ${change}`);await context.close();
 }
 // Real rendered text measurements. Root-font scaling is browser emulation,
 // not Android OS font scaling. Long tokens retained in full, never truncated.
 for(const lang of ['en','he','ar']){
  const {context,page}=await fresh(seed([trip()],{language:lang}));
  for(const view of ['planner','today']){
   if(view==='today'){await page.locator('#plannerTodayQuick').click();await page.locator('#todayView').waitFor({state:'visible'});}
   for(const scale of [1,1.3,1.5,2]){
    await page.evaluate(s=>document.documentElement.style.fontSize=(16*s)+'px',scale);
    const metrics=await page.evaluate(view=>{
     const el=document.getElementById(view==='today'?'todayView':'heroCard');
     const rect=e=>{const r=e.getBoundingClientRect();return {id:e.id,text:e.textContent.trim().slice(0,50),left:r.left,right:r.right,width:r.width,height:r.height,scroll:e.scrollWidth,client:e.clientWidth}};
     const controls=[...el.querySelectorAll('button')].filter(e=>e.getClientRects().length&&!e.hidden).map(rect);
     const texts=[...el.querySelectorAll(view==='today'?'.today-item-sub,.today-hero-sub,.today-item-title':'.hero-location,.hero-title')].filter(e=>e.getClientRects().length).map(rect);
     return {width:innerWidth,scroll:document.documentElement.scrollWidth,controls,texts};
    },view);
    assert.ok(metrics.scroll<=metrics.width+1,`${lang}/${view}/${scale}: page overflow ${JSON.stringify(metrics)}`);
    assert.ok(metrics.controls.length>0);
    for(const r of metrics.controls){assert.ok(r.left>=-1&&r.right<=361,`${lang}/${view}/${scale}: offscreen control ${JSON.stringify(r)}`);assert.ok(r.height>=43&&r.width>=43,`${lang}/${view}/${scale}: touch target ${JSON.stringify(r)}`);assert.ok(r.scroll<=r.client+1,`${lang}/${view}/${scale}: clipped control text ${JSON.stringify(r)}`);}
    for(const r of metrics.texts)assert.ok(r.scroll<=r.client+1,`${lang}/${view}/${scale}: long token overflow ${JSON.stringify(r)}`);
    if(scale===2)await page.screenshot({path:path.join(artifacts,`${lang}-${view}-200.png`),fullPage:true});
   }
   pass(`F6 ${lang} ${view}: 360px at 100/130/150/200%, page/action/token bounds`);
  }
  await context.close();
 }
 // Actual service worker cold/offline boot with final exact digest bytes.
 {
  const {context,page}=await fresh(seed(),'en-US','allow');
  await page.evaluate(async()=>{await navigator.serviceWorker.ready});await page.reload();await ready(page);
  await page.waitForFunction(()=>navigator.serviceWorker.controller);
  await context.setOffline(true);await page.goto(origin+'/deep/path?qa=1#fragment');await ready(page);
  assert.equal(await page.locator('#heroDoneBtn').isVisible(),true);
  pass('real service worker install, controlled reload, offline deep/query/fragment cold navigation');await context.close();
 }
 console.log(`TripMaster browser hardening: PASS (${groups} groups). Artifacts: ${artifacts}`);
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
