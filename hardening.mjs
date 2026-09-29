import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const ctx=vm.createContext({console:{warn(){}},Date,JSON,Map,Set,performance});
vm.runInContext(fs.readFileSync(path.join(root,'app-operations.js'),'utf8'),ctx);
const Ops=ctx.TripMasterOperations;
let checks=0;
function test(name,fn){fn();checks++;console.log('PASS '+name);}
function fn(name){const start=app.indexOf('    function '+name+'(');assert.ok(start>=0,name);const end=app.indexOf('\n    }',start);return app.slice(start,end+6);}
function run(code){return vm.runInContext(code,ctx);}
function storage(initial={}){const map=new Map(Object.entries(initial));return{map,get length(){return map.size},key(i){return [...map.keys()][i]??null},writes:0,failKey:null,getItem(k){return map.get(k)??null;},setItem(k,v){if(this.failKey===k)throw new Error('QuotaExceededError');this.writes++;map.set(k,String(v));},removeItem(k){map.delete(k);}};}
const local=storage({trips:'[]',active:''});
Object.assign(ctx,{localStorage:local,KEY_TRIPS:'trips',KEY_ACTIVE_TRIP:'active',KEY_DAYS:'days',window:{},document:{querySelectorAll:()=>[]},recordLifecycleEvent:()=>{},showToast:()=>{},t:x=>x,showUpdateBanner:()=>{},topOpenSheet:()=>null,reloadStateAfterWake:()=>{ctx.reloads++},reloads:0});
run('const _unreadableStorageKeys=new Map(),_corruptBackupRaw=new Map(),_storageHealth={};let _observedTripToken="[]\\n", _externalStatePending=false, _stateWriteBlockReason="", _reloadRequiredForVersion=false;');
for(const name of ['findPreservedCorruptKey','preserveCorruptRaw','repairStoredCollectionRows','canonicalTripStorageToken','openSheetHasStaleTripToken','guardExternalStateBeforeWrite','writeAll'])run(fn(name));
test('unchanged keys do not consume writes; successful state writes advance observed token',()=>{assert.equal(run('writeAll([[KEY_TRIPS,"[]"],[KEY_ACTIVE_TRIP,""]])'),true);assert.equal(local.writes,0);assert.equal(run('writeAll([[KEY_TRIPS,"[1]"]])'),true);assert.equal(run('_observedTripToken'), '[1]\n');});
test('quota failure rolls back changed keys without claiming success',()=>{local.failKey='active';assert.equal(run('writeAll([[KEY_TRIPS,"[2]"],[KEY_ACTIVE_TRIP,"new"]])'),false);assert.equal(local.getItem('trips'),'[1]');assert.equal(run('_observedTripToken'),'[1]\n');local.failKey=null;});
test('missed storage event blocks a no-sheet stale writer before mutation',()=>{local.setItem('trips','[3]');assert.equal(run('guardExternalStateBeforeWrite()'),false);assert.equal(ctx.reloads,1);assert.equal(local.getItem('trips'),'[3]');});
test('open stale sheet blocks repeated writes; matching controller proof allows legitimate retries',()=>{run('_externalStatePending=false;_observedTripToken=canonicalTripStorageToken()');ctx.document.querySelectorAll=()=>[{dataset:{tripStateToken:'older'}}];ctx.topOpenSheet=()=>({});assert.equal(run('guardExternalStateBeforeWrite()'),false);assert.equal(run('guardExternalStateBeforeWrite()'),false);ctx.document.querySelectorAll=()=>[];ctx.topOpenSheet=()=>null;run('_externalStatePending=false');ctx.window.__TM_SW_STATUS__={reloadRequired:true,controllerMatchesApp:null};assert.equal(run('guardExternalStateBeforeWrite()'),false);ctx.window.__TM_SW_STATUS__={reloadRequired:false,controllerMatchesApp:true};assert.equal(run('guardExternalStateBeforeWrite()'),true);assert.equal(run('guardExternalStateBeforeWrite()'),true);});
test('repair reserves IDs belonging to later rows and is idempotent',()=>{let n=0;const graph=[{days:[]},{id:'trip-existing',days:[]}];Ops.repairTripGraphIds(graph,()=>++n===1?'trip-existing':'trip-fresh');assert.equal(graph[1].id,'trip-existing');assert.equal(graph[0].id,'trip-fresh');assert.equal(Ops.repairTripGraphIds(graph,()=>{throw Error('not idempotent')}).changed,false);});
test('malformed/null rows cannot crash stable identity repair',()=>{const graph=[{days:[null,{items:[null]}]}];let n=0;assert.doesNotThrow(()=>Ops.repairTripGraphIds(graph,()=>`safe-${++n}`));});
test('partial modern backups cannot silently fall back to a legacy empty restore',()=>{for(const payload of [{trips:{},days:[]},{trips:[],homeDays:{}},{trips:[],homeDays:[{items:'bad'}]},{trips:[],activeTripId:{}}])assert.equal(Ops.backupPayloadReport(payload).valid,false);});
test('repaired graph survives export-restore-export with relationships and unknown fields',()=>{const graph=[{id:' t ',days:[{id:'day',date:'2026-10-08',items:[{uid:'a',title:'fixture'}]}],stays:[{id:'s',startDate:'2026-10-08',endDate:'2026-10-11'}],documents:[{id:'d',linkedType:'stay',linkedId:'s'}],future:{x:1}}];Ops.repairTripGraphIds(graph,()=>{throw Error('unexpected allocation')});const payload={app:'TripMaster',backupVersion:2,trips:graph,activeTripId:'t',homeDays:[]};assert.equal(Ops.backupPayloadReport(payload).valid,true);const copy=JSON.parse(JSON.stringify(payload));assert.equal(Ops.repairTripGraphIds(copy.trips,()=>{throw Error('unexpected allocation')}).changed,false);assert.equal(JSON.stringify(copy),JSON.stringify(payload));});
test('persistence retains live day identity across repeated saves',()=>{Object.assign(ctx,{trips:[{id:'t',days:[]}],days:[{id:'d',items:[{uid:'a'}]}],activeTripId:'t',getActiveTrip:()=>ctx.trips[0],restampOpenSheetsAfterOwnTripWrite:()=>{}});run(fn('persistState'));assert.equal(run('persistState()'),true);assert.equal(ctx.trips[0].days,ctx.days);ctx.days[0].items[0].title='second';assert.equal(run('persistState()'),true);assert.equal(JSON.parse(local.getItem('trips'))[0].days[0].items[0].title,'second');});
test('corrupt storage is protected until explicit recovery with preserved raw bytes',()=>{
  run('_unreadableStorageKeys.set(KEY_TRIPS,"bad");_corruptBackupRaw.clear()');
  assert.equal(run('writeAll([[KEY_TRIPS,"[]"]])'),false);
  assert.equal(run('writeAll([[KEY_TRIPS,"[]"]],{recovery:true})'),false);
  assert.equal(run('preserveCorruptRaw(KEY_TRIPS,"bad")'),true);
  assert.equal(run('writeAll([[KEY_TRIPS,"[]"]],{recovery:true})'),true);
  assert.equal(run('_unreadableStorageKeys.size'),0);
});
const session=storage();Object.assign(ctx,{sessionStorage:session,Operations:Ops,KEY_SETTINGS:'settings',KEY_THEME:'theme',KEY_SAFETY_SNAPSHOT:'snapshot'});
run('const LIFECYCLE_DIAG_KEY="lifecycle",RUNTIME_DIAG_KEY="runtime",LIFECYCLE_DIAG_LIMIT=40,LIFECYCLE_EVENT_TYPES=new Set(["boot_ready","write_blocked","migration","transfer","storage_write"]);');
for(const name of ['safeParseJSON','safeDiagnosticTimestamp','safeDiagnosticError','safeRuntimeFault','sanitizeLifecycleDetail','readLifecycleDiagnostics','recordLifecycleEvent','readRuntimeDiagnostics','recordRuntimeFault','readBootDiagnosticSafe','clearBetaDiagnostics','storageDiagnostics','diagnosticCacheGeneration'])run(fn(name));
test('malformed collection storage preserves exact raw bytes and blocks normalization writes',()=>{
 local.setItem('trips','{"private":"fixture"}');assert.equal(run('safeParseJSON(KEY_TRIPS,[])').length,0);assert.equal(local.getItem('trips'),' {"private":"fixture"}'.trim());assert.equal(run('_unreadableStorageKeys.has(KEY_TRIPS)'),true);assert.equal(run('writeAll([[KEY_TRIPS,"[]"]])'),false);
 local.setItem('trips','[]');run('safeParseJSON(KEY_TRIPS,[])');assert.equal(run('_unreadableStorageKeys.has(KEY_TRIPS)'),false);
});
test('diagnostic readers discard hostile content even if session records were externally injected',()=>{
 const at='2026-09-22T12:00:00.000Z';session.setItem('lifecycle',JSON.stringify([{at,type:'write_blocked',detail:{scope:'trip',reason:'external',note:'PRIVATE'}},{at:'PRIVATE',type:'boot_ready'},{at,type:'PRIVATE'}]));
 session.setItem('runtime',JSON.stringify([{at,kind:'PRIVATE',type:'PRIVATE',source:'app.js?secret=PRIVATE',line:1,col:2,notes:'PRIVATE'},{at,source:'PRIVATE',type:'TypeError'}]));
 session.setItem('tm_boot_diag',JSON.stringify({at:'PRIVATE',phase:'PRIVATE',reason:'PRIVATE',error:'PRIVATE'}));
 const report=run('JSON.stringify([readLifecycleDiagnostics(),readRuntimeDiagnostics(),readBootDiagnosticSafe()])');assert.equal(report.includes('PRIVATE'),false);assert.equal(run('readRuntimeDiagnostics()[0].source'),'app.js');
 assert.equal(run('diagnosticCacheGeneration("private-scope-v3700-rc1-0123456789abcdef")'),'v3700-rc1-0123456789abcdef');
});
test('bounded local log and clear action do not alter trip storage',()=>{
 const original=local.getItem('trips');for(let i=0;i<80;i++)run(`recordLifecycleEvent("migration",{result:"repaired",repairs:${i},note:"PRIVATE"})`);
 assert.equal(run('readLifecycleDiagnostics().length'),40);assert.equal(session.getItem('lifecycle').includes('PRIVATE'),false);run('clearBetaDiagnostics()');assert.equal(run('readLifecycleDiagnostics().length'),0);assert.equal(run('readRuntimeDiagnostics().length'),0);assert.equal(local.getItem('trips'),original);
});
// Repeatable synthetic serialization benchmark. CPU/heap proxy, NOT Android or actual localStorage timings.
const sample=Array.from({length:30},(_,t)=>({id:`t${t}`,days:Array.from({length:30},(_,d)=>({id:`d${t}-${d}`,items:Array.from({length:12},(_,i)=>({uid:`a${t}-${d}-${i}`,title:'Synthetic activity',note:'x'.repeat(80)}))}))}));
const activeDays=sample[0].days;const bench=fn=>{const a=performance.now();for(let i=0;i<20;i++)fn();return Math.round((performance.now()-a)*100)/100;};
console.log(JSON.stringify({benchmark:'20 synthetic snapshots',storeBytes:Buffer.byteLength(JSON.stringify(sample)),beforeMs:bench(()=>JSON.stringify({trips:sample,days:activeDays})),afterMs:bench(()=>JSON.stringify({trips:sample})),snapshotBytesSaved:Buffer.byteLength(JSON.stringify(activeDays))+8}));
console.log(`TripMaster hardening: PASS (${checks} behavioral groups)`);

// v3800: execute real worker and registration functions with controlled host APIs.
const {webcrypto}=await import('node:crypto');
const workerSource=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const registerSource=fs.readFileSync(path.join(root,'sw-register.js'),'utf8');
function workerContext(scope,extra={}){const c=vm.createContext({URL,Request,Response,Uint8Array,crypto:webcrypto,console:{warn(){}},self:{registration:{scope},addEventListener(){},skipWaiting(){}},...extra});vm.runInContext(workerSource,c);return c;}
test('case and punctuation-distinct scopes have disjoint cache ownership',()=>{
 const scopes=['/TripMaster/','/tripmaster/','/A-B/','/A/B/','/A_B/'];const contexts=scopes.map(p=>workerContext('https://example.test'+p));const names=contexts.map(c=>vm.runInContext('CACHE_NAME',c));assert.equal(new Set(names).size,scopes.length);
 for(let i=0;i<contexts.length;i++)for(let j=0;j<names.length;j++){contexts[i].candidate=names[j];assert.equal(vm.runInContext('isOwnedCache(candidate)',contexts[i]),i===j);}
});
{
 const c=workerContext('https://example.test/TripMaster/');c.response=new Response(fs.readFileSync(path.join(root,'index.html')));assert.equal(await vm.runInContext('responseMatchesAsset(response,"./index.html")',c),true);c.response=new Response('new deployment under old filename');assert.equal(await vm.runInContext('responseMatchesAsset(response,"./index.html")',c),false);checks++;console.log('PASS missing-core network repair rejects bytes from another deployment');
}
{
 const stores=new Map();let wrong=true;
 const cacheApi={keys:async()=>[...stores.keys()],has:async name=>stores.has(name),delete:async name=>stores.delete(name),open:async name=>{
  if(!stores.has(name))stores.set(name,new Map());const m=stores.get(name);
  const put=async(req,res)=>m.set(typeof req==='string'?req:req.url,res.clone());
  return{keys:async()=>[...m.keys()].map(u=>new Request(u)),match:async req=>m.get(typeof req==='string'?req:req.url)?.clone(),put,add:async()=>{},addAll:async requests=>{for(const req of requests){const file=new URL(req.url).pathname.split('/').pop();await put(req,new Response(wrong&&file==='app.js'?'wrong bytes':fs.readFileSync(path.join(root,file))));}}};
 }};
 const c=workerContext('https://example.test/TripMaster/',{caches:cacheApi});const live=vm.runInContext('CACHE_NAME',c),stage=vm.runInContext('INSTALL_CACHE_NAME',c);stores.set(live,new Map([['https://example.test/TripMaster/index.html',new Response('previous live shell')]]));
 await assert.rejects(vm.runInContext('precacheShell()',c),/integrity/);assert.equal(await stores.get(live).get('https://example.test/TripMaster/index.html').clone().text(),'previous live shell');assert.equal(stores.has(stage),false);
 wrong=false;await vm.runInContext('precacheShell()',c);assert.equal(await vm.runInContext('validateCoreCache(CACHE_NAME)',c),true);checks++;console.log('PASS mixed-byte install rejects staging, preserves live cache, then retries successfully');
}
function registerFn(name){const start=registerSource.indexOf('  function '+name+'(');const asyncStart=registerSource.indexOf('  async function '+name+'(');const a=start>=0?start:asyncStart;assert.ok(a>=0);return registerSource.slice(a,registerSource.indexOf('\n  }',a)+4);}
{
 let closed=0;class Channel{constructor(){this.port1={onmessage:null,close(){closed++;}};this.port2={close(){closed++;}};Channel.last=this;}}
 const c=vm.createContext({MessageChannel:Channel,window:{setTimeout,clearTimeout},controller:{postMessage(){queueMicrotask(()=>Channel.last.port1.onmessage({data:{ok:true}}));}}});vm.runInContext(registerFn('requestControllerVersion'),c);
 assert.equal((await vm.runInContext('requestControllerVersion(controller,20)',c)).ok,true);assert.equal(closed,2);c.controller={postMessage(){}};assert.equal(await vm.runInContext('requestControllerVersion(controller,1)',c),null);assert.equal(closed,4);c.controller={postMessage(){throw Error('dead controller')}};assert.equal(await vm.runInContext('requestControllerVersion(controller,1)',c),null);assert.equal(closed,6);checks++;console.log('PASS controller reply/timeout/send failure close both message ports');
}
{
 let listeners=new Set(),reloads=0,failed=0;const worker={state:'installed',addEventListener(_t,fn){listeners.add(fn)},removeEventListener(_t,fn){listeners.delete(fn)},postMessage(){throw Error('dead worker')}};
 const c=vm.createContext({registration:{waiting:worker},applyRequested:false,status:{},publishStatus(){},checkForUpdate(){},CustomEvent:class{constructor(type){this.type=type}},window:{setTimeout,clearTimeout,location:{reload(){reloads++}},dispatchEvent(){failed++}}});vm.runInContext(registerFn('applyWaitingUpdate'),c);vm.runInContext('applyWaitingUpdate()',c);assert.equal(failed,1);assert.equal(listeners.size,0);assert.equal(c.status.applying,false);
 worker.postMessage=()=>{worker.state='activated';for(const fn of [...listeners])fn()};vm.runInContext('applyWaitingUpdate()',c);assert.equal(reloads,1);assert.equal(listeners.size,0);checks++;console.log('PASS activation send failure recovers controls and successful retry removes listeners');
}
test('reload reuses Back guard and lower sheets cannot claim delayed focus',()=>{
 let pushed=0;const h={state:null,replaceState(state){this.state=state},pushState(state){pushed++;this.state=state}};ctx.history=h;ctx.window.history=h;run('let _backGuardArmed=false');run(fn('armBackGuard'));run('armBackGuard();armBackGuard();armBackGuard()');assert.equal(pushed,1);
 // Focus assertion here is structural; UI ordering still needs independent browser QA.
 assert.match(fn('openSheetEl'),/topOpenSheet\(\) !== el/);
});
test('keyboard viewport preserves pinch zoom and only scrolls an obscured active field',()=>{
 const props=new Map();let scrolled=0;const input={tagName:'TEXTAREA',getBoundingClientRect:()=>({top:600,bottom:640}),scrollIntoView(){scrolled++}};ctx.document.documentElement={style:{setProperty:(k,v)=>props.set(k,v),removeProperty:k=>props.delete(k)}};ctx.document.activeElement=input;ctx.topOpenSheet=()=>({contains:x=>x===input,getBoundingClientRect:()=>({top:40,bottom:400})});ctx.window.visualViewport={height:400,offsetTop:0,scale:1};ctx.window.innerHeight=800;run(fn('syncKeyboardViewport'));run('syncKeyboardViewport()');assert.equal(props.get('--tm-keyboard-bottom'),'400px');assert.equal(scrolled,1);ctx.window.visualViewport.scale=2;run('syncKeyboardViewport()');assert.equal(props.size,0);assert.equal(scrolled,1);
 ctx.window.matchMedia=()=>({matches:true});run(fn('preferredScrollBehavior'));assert.equal(run('preferredScrollBehavior()'),'auto');
});
console.log(`TripMaster cumulative hardening: PASS (${checks} behavioral groups)`);
test('corrupt-key Restore preserves healthy sibling keys and keeps an earlier good snapshot',()=>{
 const goodTrips='[{"id":"healthy","days":[]}]';local.setItem('trips',goodTrips);local.setItem('settings','bad json');local.setItem('snapshot','earlier good snapshot');run('_unreadableStorageKeys.set(KEY_SETTINGS,"bad json");preserveCorruptRaw(KEY_SETTINGS,"bad json")');run(fn('writeSafetySnapshot'));
 assert.equal(run('writeSafetySnapshot("restore")'),true);const backup=JSON.parse(local.getItem('tm_recovery_raw_snapshot'));assert.equal(new Map(backup.rawEntries).get('trips'),goodTrips);assert.equal(local.getItem(new Map(backup.rawEntries).get('settings').corruptBackupKey),'bad json');assert.equal(local.getItem('tm_recovery_raw_snapshot').includes('bad json'),false);assert.equal(local.getItem('snapshot'),'earlier good snapshot');local.failKey='tm_recovery_raw_snapshot';local.setItem('trips','[]');assert.equal(run('writeSafetySnapshot("restore")'),false);local.failKey=null;run('_unreadableStorageKeys.clear()');
});
test('day-delete confirmation follows its stable ID after a reorder',()=>{
 const elements=new Map();ctx.$=id=>{if(!elements.has(id))elements.set(id,{});return elements.get(id);};ctx.tf=k=>k;ctx.formatDateForTitle=x=>x;ctx.openConfirmSheet=()=>{};ctx.days=[{id:'first',date:'2026-10-08',items:[]},{id:'second',date:'2026-10-09',items:[]}];ctx.currentDayIndex=0;let selected=null;ctx.deleteDay=index=>{selected=ctx.days[index].id;};run('let _pendingDeleteDay=null');run(fn('requestDeleteDay'));run('requestDeleteDay(0)');ctx.days.reverse();run('_pendingDeleteDay()');assert.equal(selected,'first');
});
console.log(`TripMaster final hardening: PASS (${checks} behavioral groups)`);

// Optional full-browser hardening, including real multi-boot storage tests.
if(process.argv.includes('--browser'))await import('./browser.mjs');
