import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ctx = vm.createContext({ console });
function load(name){
  const code = fs.readFileSync(path.join(root, name), 'utf8');
  vm.runInContext(code, ctx, { filename:name });
}
['app-intelligence.js','app-logistics.js','app-finance.js','app-travel.js','app-today.js','app-operations.js','app-ai-client.js'].forEach(load);

const L = ctx.TripMasterLogistics;
const F = ctx.TripMasterFinance;
const T = ctx.TripMasterTravel;
const Today = ctx.TripMasterToday;
const Ops = ctx.TripMasterOperations;
const AI = ctx.TripMasterAIClient;
assert.ok(L && F && T && Today && Ops && AI, 'pure model modules loaded');

const trip = {
  id:'trip-regression', name:'Regression', timezone:'Asia/Jerusalem',
  days:[
    { date:'2026-09-06', dayType:'departure', travelDay:{origin:'TLV',destination:'LHR',mode:'flight',reference:'BA164',departureTime:'23:30',arrivalTime:'01:00',arrivalDate:'2026-09-07'}, items:[
      { uid:'a1', title:'Late event', time:'23:00', endTime:'01:30', endNextDay:true, location:'Terminal' }
    ]},
    { date:'2026-09-07', dayType:'arrival', items:[] }
  ],
  journeys:[
    { id:'j1', date:'2026-09-06', arrivalDate:'2026-09-07', mode:'flight', origin:'TLV', destination:'LHR', departureTime:'23:30', arrivalTime:'01:00', provider:'British Airways', serviceNumber:'BA164', status:'confirmed' }
  ]
};

assert.equal(L.journeyInfo(trip.journeys[0]).arrivalDate, '2026-09-07');
assert.equal(L.journeysTouchingDate(trip,'2026-09-06').length, 1);
assert.equal(L.journeysTouchingDate(trip,'2026-09-07').length, 1);
assert.deepEqual(T.travelDayInfo(trip.days[0]).arrivalDate, '2026-09-07');
assert.deepEqual(Array.from(L.overnightDates(['2026-10-08','2026-10-09','2026-10-10','2026-10-11'])), ['2026-10-08','2026-10-09','2026-10-10'], 'stay readiness counts nights and excludes the final checkout date');
const eilatStayTrip={days:[{date:'2026-10-08'},{date:'2026-10-09'},{date:'2026-10-10'},{date:'2026-10-11'}],stays:[{id:'eilat-stay',name:'Hotel',startDate:'2026-10-08',endDate:'2026-10-11',status:'confirmed'}]};
assert.equal(L.uncoveredDates(eilatStayTrip,L.overnightDates(eilatStayTrip.days.map(d=>d.date))).length,0,'8–11 Oct stay covers all three nights without a false 11 Oct gap');
const realGapTrip={days:eilatStayTrip.days,stays:[{id:'gap-stay',name:'Hotel',startDate:'2026-10-08',endDate:'2026-10-10',status:'confirmed'}]};
assert.deepEqual(Array.from(L.uncoveredDates(realGapTrip,L.overnightDates(realGapTrip.days.map(d=>d.date))),x=>x),['2026-10-10'],'real uncovered overnight date remains actionable');

const overnightJourneyStayTrip={days:[{date:'2026-09-06'},{date:'2026-09-07'},{date:'2026-09-08'},{date:'2026-09-09'}],stays:[{id:'night-hotel',name:'Hotel',startDate:'2026-09-07',endDate:'2026-09-09',status:'confirmed'}],journeys:[{id:'night-flight',date:'2026-09-06',arrivalDate:'2026-09-07',mode:'flight',origin:'TLV',destination:'JFK',status:'confirmed'}]};
assert.equal(L.overnightJourneyCoversDate(overnightJourneyStayTrip,'2026-09-06'),true,'explicit overnight journey covers its departure night');
assert.equal(L.uncoveredDates(overnightJourneyStayTrip,L.overnightDates(overnightJourneyStayTrip.days.map(d=>d.date))).length,0,'overnight flight does not create a false missing-stay warning');
const multiNightTransitTrip={days:[{date:'2026-10-09'},{date:'2026-10-10'},{date:'2026-10-11'}],journeys:[{id:'night-ferry',date:'2026-10-09',arrivalDate:'2026-10-11',mode:'other',origin:'A',destination:'B',status:'confirmed'}],stays:[{id:'tracking-only',name:'Cancelled',startDate:'2026-10-09',endDate:'2026-10-11',status:'cancelled'}]};
assert.equal(L.overnightJourneyCoversDate(multiNightTransitTrip,'2026-10-09'),true,'multi-night journey covers departure night');
assert.equal(L.overnightJourneyCoversDate(multiNightTransitTrip,'2026-10-10'),true,'multi-night journey covers intermediate night');
assert.equal(L.uncoveredDates(multiNightTransitTrip,L.overnightDates(multiNightTransitTrip.days.map(d=>d.date))).length,0,'multi-night transit covers every night before arrival');
const cancelledMultiNightTransit=JSON.parse(JSON.stringify(multiNightTransitTrip));cancelledMultiNightTransit.journeys[0].status='cancelled';
assert.deepEqual(Array.from(L.uncoveredDates(cancelledMultiNightTransit,L.overnightDates(cancelledMultiNightTransit.days.map(d=>d.date)))),['2026-10-09','2026-10-10'],'cancelled multi-night transit restores both stay gaps');
assert.deepEqual(Array.from(L.overnightDates(['2026-10-01','2026-10-02','2026-10-05','2026-10-06'])),['2026-10-01','2026-10-02','2026-10-03','2026-10-04','2026-10-05'],'sparse itinerary dates expand to the full overnight calendar span');

const range = Today.tripDateRange(trip);
assert.equal(range.first, '2026-09-06');
assert.equal(range.last, '2026-09-07');

const depEvents = Today.buildEvents(trip,'2026-09-06');
const arrEvents = Today.buildEvents(trip,'2026-09-07');
assert.ok(depEvents.some(e => e.kind==='journey' && e.source.id==='j1'), 'journey visible on departure date');
assert.ok(arrEvents.some(e => e.kind==='journey' && e.source.id==='j1'), 'journey visible on arrival date');
assert.ok(arrEvents.some(e => e.kind==='activity' && e.source.id==='a1' && e.endMin===90), 'overnight activity carries into next day');
const travelOnly = { id:'trip-travelday', days:[trip.days[0], trip.days[1]], journeys:[] };
const travelArrival = Today.buildEvents(travelOnly,'2026-09-07');
assert.ok(travelArrival.some(e => e.kind==='travelday' && e.endMin===60), 'Travel Day carries into arrival day when no canonical Journey duplicates it');



const opsTrip = {
  id:'trip-ops', timezone:'UTC', days:[{date:'2026-09-08',items:[{uid:'op-a1',title:'Museum',booking:{status:'planned',paymentStatus:'unpaid'}}]}],
  stays:[{id:'s1',name:'Hotel',startDate:'2026-09-08',endDate:'2026-09-10',status:'confirmed',paymentStatus:'paid'}],
  expenses:[
    {id:'e1',title:'Hotel',amount:500,currency:'EUR',category:'accommodation',paymentStatus:'paid'},
    {id:'e2',title:'Museum',amount:40,currency:'EUR',category:'attraction',paymentStatus:'unpaid'}
  ],
  budget:{amount:1000,currency:'EUR'},
  documents:[{id:'d1',label:'Museum voucher',type:'voucher',status:'needed'}]
};
assert.equal(F.bookingAttentionEntries(opsTrip,L).length,1,'booking attention isolates planned/unpaid work');
assert.equal(F.expensePaymentAttention(opsTrip).length,1,'money attention isolates unpaid/partial expenses');
assert.equal(F.expenseCategoryTotals(opsTrip,'EUR')[0].category,'accommodation','category totals sort largest first');
assert.equal(F.budgetSummary(opsTrip).remaining,460,'budget summary uses matching currency only');
assert.equal(F.documentNeedsAttention(opsTrip).length,1,'needed documents remain operational');
const opsToday=Today.buildToday(opsTrip,{now:'2026-09-08T09:00:00Z'});
assert.ok(opsToday.attention.some(x=>x.code==='booking_planned'&&x.level==='action'),'planned booking is a neutral Today action');
assert.equal(opsToday.attention.some(x=>x.level==='check'),false,'Today no longer exposes a check severity');


const accessNoiseTrip={id:'trip-access-noise',timezone:'UTC',days:[{date:'2026-09-08',items:[{uid:'ax1',title:'Museum',time:'10:00',accessStatus:'needscheck'}]}]};
const accessNoiseToday=Today.buildToday(accessNoiseTrip,{now:'2026-09-08T09:00:00Z',accessActive:true});
assert.equal(accessNoiseToday.attention.some(x=>x.code==='access_needs_check'),false,'unchecked Access is not a Today warning');
const todayContextWithoutAccess=Today.sanitizedContext(accessNoiseToday);
assert.equal(Object.prototype.hasOwnProperty.call(todayContextWithoutAccess.todayItems[0],'accessStatus'),false,'general Today AI context omits legacy Access evidence');
const todayContextWithAccess=Today.sanitizedContext(accessNoiseToday,{includeAccess:true});
assert.equal(todayContextWithAccess.todayItems[0].accessStatus,'needscheck','Access-scoped Today context can retain stored legacy Access evidence');

const taskTrip={tasks:[{id:'t1',title:'Buy museum tickets',done:false,date:'2026-09-06',priority:'high'},{id:'t2',title:'Check transfer',done:true},{id:'t3',title:'Call hotel',done:false,date:'2026-09-07',priority:'normal'}]};
const taskStats=Ops.taskStats(taskTrip,'2026-09-07'); assert.equal(taskStats.total,3); assert.equal(taskStats.done,1); assert.equal(taskStats.open,2); assert.equal(taskStats.overdue,1); assert.equal(taskStats.dueToday,1);
assert.equal(Ops.taskDueState(taskTrip.tasks[0],'2026-09-07'),'overdue','dated checklist detects overdue work');
assert.equal(Ops.taskDueState(taskTrip.tasks[2],'2026-09-07'),'today','dated checklist detects due-today work');
assert.equal(Ops.sortedTasks(taskTrip,'2026-09-07')[0].info.id,'t1','overdue checklist items sort first');
assert.equal(Ops.isArchivedTrip({archived:true}),true,'archived trip lifecycle flag recognized');
assert.equal(Ops.matchesText('museum',['Buy museum tickets','London']),true,'Trip Board search matches trip text');
assert.equal(Ops.matchesText('rome',['Buy museum tickets','London']),false,'Trip Board search rejects unrelated text');


// AI V2 client foundation: privacy-scoped context, envelopes and fail-safe response contracts.
const aiTrip={
  id:'trip-ai',name:'AI trip',destination:'Lisbon',timezone:'Europe/Lisbon',
  days:[{id:'day-ai',date:'2026-10-04',items:[{uid:'act-ai',title:'Museum',time:'10:00',location:'Lisbon',accessStatus:'needscheck',booking:{status:'planned',paymentStatus:'unpaid'}}]}],
  stays:[{id:'stay-ai',name:'Example Hotel',location:'Lisbon',startDate:'2026-10-04',endDate:'2026-10-08',status:'confirmed',paymentStatus:'paid'}],
  journeys:[{id:'journey-ai',date:'2026-10-04',arrivalDate:'2026-10-04',mode:'flight',origin:'TLV',destination:'LIS',departureTime:'06:00',arrivalTime:'09:30',provider:'Example Air',serviceNumber:'EA123',status:'confirmed'}],
  budget:{amount:1000,currency:'EUR'}
};
const fullAIContext=F.buildTripContext(aiTrip,{includeSensitive:false,includeActivityAccess:true});
assert.equal(fullAIContext.days[0].id,'day-ai','AI context preserves stable day IDs');
assert.equal(fullAIContext.journeys[0].arrivalDate,'2026-10-04','AI context preserves journey arrival date');
assert.equal(fullAIContext.journeys[0].serviceNumber,'EA123','AI context preserves public service number for future live resolution');
const minimizedLegacy=F.buildTripContext(aiTrip,{includeSensitive:false,includeActivityAccess:false});
assert.equal(Object.prototype.hasOwnProperty.call(minimizedLegacy.days[0].activities[0],'accessStatus'),false,'legacy AI projection can omit activity Access evidence');
const hotelPolicy=AI.questionPolicy('What do you know about my hotel?','');
assert.equal(hotelPolicy.intent,'ENTITY_RESEARCH','hotel question produces entity-research hint');
assert.equal(hotelPolicy.includeAccess,false,'hotel question excludes Access profile');
assert.equal(hotelPolicy.includeMobility,false,'hotel question excludes Mobility profile');
assert.equal(hotelPolicy.includeToday,false,'hotel question excludes Today context');
assert.equal(hotelPolicy.researchLikely,true,'hotel question is marked as likely research');
assert.equal(hotelPolicy.entityFocus,'STAY','hotel research focuses the stored stay entity');
const accessPolicy=AI.questionPolicy('האם המקום נגיש לכיסא גלגלים?','');
assert.equal(accessPolicy.intent,'ACCESS','Access question produces Access hint');
assert.equal(accessPolicy.includeAccess,true,'Access question includes Access profile');
assert.equal(accessPolicy.includeMobility,true,'Access question may include functional mobility preferences');
const nowPolicy=AI.questionPolicy('מה חשוב עכשיו?','WHAT_NOW');
assert.equal(nowPolicy.includeToday,true,'What-now prompt includes Today context');
assert.equal(nowPolicy.liveDataLikely,false,'What-now alone does not incorrectly require live operational truth');
const trainStatusPolicy=AI.questionPolicy('Is my train delayed?','');
assert.equal(trainStatusPolicy.liveDataLikely,true,'train delay question is marked as live-data likely');
assert.equal(trainStatusPolicy.entityFocus,'JOURNEY','live train question carries a journey entity-focus hint');
const vagueRecoveryPolicy=AI.questionPolicy('Something went wrong','RECOVERY');
assert.equal(vagueRecoveryPolicy.liveDataLikely,false,'generic recovery does not claim live operational truth before the problem is known');
const cancelledFlightPolicy=AI.questionPolicy('My flight was cancelled','');
assert.equal(cancelledFlightPolicy.liveDataLikely,true,'explicit cancellation is marked as live-data likely');

const punctuatedNowPolicy=AI.questionPolicy('what now?','');
assert.equal(punctuatedNowPolicy.intent,'WHAT_NOW','short intent keyword survives trailing punctuation');
assert.equal(punctuatedNowPolicy.includeToday,true,'punctuated WHAT_NOW request includes Today context');
const taxiPunctuationPolicy=AI.questionPolicy('need a taxi?','');
assert.equal(taxiPunctuationPolicy.includeMobility,true,'punctuated mobility keyword still selects mobility scope');
const v2TrainContext=AI.buildContextV2(fullAIContext,{today:{x:1},mobility:{noSelfDrive:true}},trainStatusPolicy);
assert.equal(v2TrainContext.journeys.length,1,'live journey question keeps journey candidates');
assert.equal(v2TrainContext.days.length,0,'live journey question removes unrelated day payload');
assert.equal(v2TrainContext.stays.length,0,'live journey question removes unrelated stay payload');
const attractionBookingPolicy=AI.questionPolicy('Do I need to book this attraction?','');
assert.equal(attractionBookingPolicy.researchLikely,true,'attraction booking question is marked as likely public research');
assert.equal(attractionBookingPolicy.entityFocus,'ACTIVITY','attraction booking question carries an activity entity-focus hint');
const v2AttractionBookingContext=AI.buildContextV2(fullAIContext,{},attractionBookingPolicy);
assert.equal(v2AttractionBookingContext.days.length,1,'activity research keeps activity candidates');
assert.equal(v2AttractionBookingContext.stays.length,0,'activity research removes unrelated stays');
assert.equal(v2AttractionBookingContext.journeys.length,0,'activity research removes unrelated journeys');
const planningPolicy=AI.questionPolicy('Plan my itinerary for the week','');
assert.equal(planningPolicy.intent,'PLANNING','planning request receives a planning hint');
assert.equal(planningPolicy.includeMobility,true,'planning request receives relevant mobility preferences');
const v2HotelContext=AI.buildContextV2(fullAIContext,{today:{x:1},access:{wheelchair:'manual'},mobility:{noSelfDrive:true}},hotelPolicy);
assert.equal(v2HotelContext.schema,'tripmaster-context-v2');
assert.equal(v2HotelContext.contextVersion,2,'V2 context carries an explicit contract version');
const safeHotelOutbound=AI.validateOutboundContext(v2HotelContext);
assert.equal(safeHotelOutbound.safe,true,'V2 hotel context passes client privacy-key validation');
assert.equal(safeHotelOutbound.unsafeKeys.length,0,'V2 hotel context has no forbidden outbound keys');
assert.equal(AI.validateOutboundContext({stay:{confirmation:'secret'}}).safe,false,'client privacy validator rejects booking confirmation fields');
assert.equal(Object.prototype.hasOwnProperty.call(v2HotelContext,'access'),false,'V2 hotel context excludes Access profile');
assert.equal(Object.prototype.hasOwnProperty.call(v2HotelContext,'mobility'),false,'V2 hotel context excludes Mobility preferences');
assert.equal(Object.prototype.hasOwnProperty.call(v2HotelContext,'today'),false,'V2 hotel context excludes Today payload');
assert.equal(v2HotelContext.days.length,0,'hotel research V2 context does not ship unrelated day activities');
assert.equal(v2HotelContext.journeys.length,0,'hotel research V2 context does not ship unrelated journeys');
assert.equal(v2HotelContext.stays.length,1,'hotel research V2 context keeps the stay target');
const moneyPolicy=AI.questionPolicy('What is my budget?','MONEY');
const v2MoneyContext=AI.buildContextV2(fullAIContext,{},moneyPolicy);
assert.ok(v2MoneyContext.money,'money intent keeps aggregate budget context');
assert.equal(Object.prototype.hasOwnProperty.call(v2MoneyContext.money,'expenses'),false,'V2 money context never includes itemized expenses by default');
const aiEnvelope=AI.buildUserQuestionEnvelope({prompt:'What do you know about my hotel?',policy:hotelPolicy,context:v2HotelContext,requestId:'req-ai',idempotencyKey:'idem-ai',appVersion:'v3500-RC1',locale:{language:'en',locale:'en',direction:'ltr'}});
assert.equal(aiEnvelope.type,'USER_QUESTION');
assert.equal(aiEnvelope.contractVersion,2);
assert.equal(aiEnvelope.trip.id,'trip-ai');
assert.ok(aiEnvelope.entityHints.some(x=>x.entityType==='STAY'&&x.tripEntityId==='stay-ai'),'V2 envelope exposes stable stay entity hint');
assert.ok(aiEnvelope.privacy.excludedCategories.includes('access_profile'),'privacy manifest records omitted Access profile');
assert.equal(aiEnvelope.privacy.clientValidationPassed,true,'USER_QUESTION envelope records passing client privacy validation');
assert.equal(aiEnvelope.privacy.transportAllowed,true,'safe USER_QUESTION envelope is eligible for future V2 transport');

const stableTodayA={...v2HotelContext,today:{date:'2026-10-04',clock:{date:'2026-10-04',time:'10:00',timezone:'Europe/Lisbon'},now:{title:'A'}}};
const stableTodayB={...v2HotelContext,today:{date:'2026-10-04',clock:{date:'2026-10-04',time:'10:01',timezone:'Europe/Lisbon'},now:{title:'B'}}};
assert.equal(AI.fingerprint(AI.contextFingerprintView(stableTodayA)),AI.fingerprint(AI.contextFingerprintView(stableTodayB)),'AI stale guard ignores wall-clock minute/now-next churn');
const expectedV2Envelope=AI.buildUserQuestionEnvelope({prompt:'What do you know about my hotel?',policy:hotelPolicy,context:v2HotelContext,requestId:'req-ai-v2',appVersion:'v3500-RC1',v2TransportExpected:true,locale:{language:'en',locale:'en',direction:'ltr'}});
const missingV2Schema=AI.validateV2Response({result:{summary:'legacy-looking'}},expectedV2Envelope);
assert.equal(missingV2Schema.ok,false,'future V2 transport fails closed when a V2 schema is missing');
assert.equal(missingV2Schema.code,'v2_schema_missing','missing V2 schema has an explicit gate code');
const downgradedResearch=AI.validateV2Response({schema:'tripmaster-ai-response-v2',result:{summary:'generic'}},aiEnvelope);
assert.equal(downgradedResearch.ok,false,'canonical ENTITY_RESEARCH cannot silently downgrade to an unresearched V2 answer');
assert.equal(downgradedResearch.code,'execution_receipt_missing','client research expectation requires execution proof even if server forgets its research flag');
assert.equal(AI.fingerprint({a:1,b:2}),AI.fingerprint({b:2,a:1}),'context fingerprint is key-order stable');
assert.notEqual(AI.fingerprint({a:1}),AI.fingerprint({a:2}),'context fingerprint changes with relevant context');
const eventEnvelope=AI.buildTripEventEnvelope({eventId:'evt1',eventName:'ACTIVITY_UPDATED',tripId:'trip-ai',tripFingerprint:'fp',entityType:'activity',entityId:'act-ai',changedFields:['time'],appVersion:'v3500-RC1'});
assert.equal(eventEnvelope.type,'TRIP_EVENT');
assert.equal(eventEnvelope.event.name,'ACTIVITY_UPDATED');
assert.equal(eventEnvelope.privacy.rawTripStateIncluded,false,'event envelope is metadata-only by default');
const blockedV2=AI.validateV2Response({schema:'tripmaster-ai-response-v2',researchRequired:true,evidenceBundle:{verified:false}},aiEnvelope);
assert.equal(blockedV2.ok,false,'V2 client fail-closes research response without execution proof/evidence');
assert.equal(blockedV2.code,'execution_receipt_missing','research response is blocked first when no successful tool receipt exists');
const acceptedV2=AI.validateV2Response({schema:'tripmaster-ai-response-v2',researchRequired:true,toolReceipts:[{receiptId:'r1',tool:'research_entity',provider:'official',status:'SUCCESS'}],evidenceBundle:{verified:true,identityVerified:true,freshnessPassed:true,contradictionsUnresolved:false,observations:[{evidenceId:'ev1',truthLayer:'PUBLIC_RESEARCHED_FACT',provider:'official'}]},result:{claims:[{claimId:'c1',truthLayer:'PUBLIC_RESEARCHED_FACT',evidenceIds:['ev1'],allowedToRender:true}]}},aiEnvelope);
assert.equal(acceptedV2.ok,true,'V2 client accepts verified fresh identity-grounded research response');

const invalidTruthLayer=AI.validateV2Response({schema:'tripmaster-ai-response-v2',researchRequired:true,toolReceipts:[{receiptId:'r2',tool:'research_entity',provider:'official',status:'SUCCESS'}],evidenceBundle:{verified:true,identityVerified:true,freshnessPassed:true,observations:[{evidenceId:'ev2',truthLayer:'PUBLIC_RESEARCHED_FACT'}]},result:{claims:[{claimId:'c2',truthLayer:'MYSTERY_LAYER',evidenceIds:['ev2'],allowedToRender:true}]}},expectedV2Envelope);
assert.equal(invalidTruthLayer.ok,false,'V2 claim with unknown truth layer fails closed');
assert.equal(invalidTruthLayer.code,'claim_truth_layer_invalid','unknown truth layer is explicitly rejected');
const trainEnvelope=AI.buildUserQuestionEnvelope({prompt:'Is my train delayed?',policy:trainStatusPolicy,context:v2TrainContext,requestId:'req-train',appVersion:'v3500-RC1',locale:{language:'en',locale:'en',direction:'ltr'}});
const downgradedLive=AI.validateV2Response({schema:'tripmaster-ai-response-v2',result:{summary:'looks on time'}},trainEnvelope);
assert.equal(downgradedLive.ok,false,'explicit live-status request cannot silently downgrade to non-operational V2 truth');
const blockedOperational=AI.validateV2Response({schema:'tripmaster-ai-response-v2',liveDataRequired:true,toolReceipts:[{receiptId:'r-live-public',tool:'get_live_status',provider:'operator',status:'SUCCESS'}],evidenceBundle:{verified:true,identityVerified:true,freshnessPassed:true,observations:[{evidenceId:'ev-public',truthLayer:'PUBLIC_RESEARCHED_FACT'}]},result:{claims:[{claimId:'c-public',truthLayer:'PUBLIC_RESEARCHED_FACT',evidenceIds:['ev-public'],allowedToRender:true}]}},trainEnvelope);
assert.equal(blockedOperational.ok,false,'operational claim cannot pass with public-research truth only');
const acceptedOperational=AI.validateV2Response({schema:'tripmaster-ai-response-v2',liveDataRequired:true,toolReceipts:[{receiptId:'r-live',tool:'get_live_status',provider:'operator',status:'SUCCESS'}],evidenceBundle:{verified:true,identityVerified:true,freshnessPassed:true,observations:[{evidenceId:'ev-live',truthLayer:'VERIFIED_OPERATIONAL',provider:'operator'}]},result:{claims:[{claimId:'c-live',truthLayer:'VERIFIED_OPERATIONAL',evidenceIds:['ev-live'],allowedToRender:true}]}},trainEnvelope);
assert.equal(acceptedOperational.ok,true,'verified operational claim passes only with operational evidence');


const source = fs.readFileSync(path.join(root,'app.js'),'utf8');
assert.match(source, /item\.endNextDay === true/, 'overnight activity semantics retained');
assert.match(source, /arrivalDate/, 'arrival-date semantics retained');
assert.match(source, /tripmasterGuard/, 'hardware/browser Back guard present');
assert.match(source, /readiness_center_title/, 'Readiness center present');
assert.match(source, /COMMON_CURRENCIES/, 'currency chooser foundation present');
assert.match(source, /data-booking-filter/, 'Booking Center attention filters wired');
assert.match(source, /data-money-filter/, 'Money attention filters wired');
assert.match(source, /data-documents-filter/, 'Documents attention filters wired');
assert.match(source, /function duplicateTrip\(/, 'trip duplication workflow present');
assert.match(source, /home_past_trips/, 'past-trip Home grouping present');
assert.match(source, /openTripBoardSheet/, 'Trip Board is wired into product navigation');
const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.doesNotMatch(html, /id="addAccessStatus"|id="addAccessNote"|id="editAccessQuick"/, 'activity form no longer asks users to classify venue accessibility');
assert.match(source, /function openAccessProfile\(trip\)/, 'Access routing is profile-based');
assert.match(source, /area === "access"\) \{ openAccessProfile\(trip\); return; \}/, 'Access readiness route targets the profile, not an activity field');
const readinessBody=source.match(/function readinessEntries\(trip\) \{([\s\S]*?)\n    \}/)?.[1]||'';
assert.doesNotMatch(readinessBody, /st\.accessNeedsCheck|st\.accessIssues|st\.taskOtherOpen|st\.missingBase|st\.missingDestination|st\.missingTimezone/, 'readiness signal excludes optional/unresearchable metadata');
assert.doesNotMatch(readinessBody, /add\("check"|st\.plannedStays|st\.plannedJourneys|st\.plannedActivityBookings|st\.paymentAttention/, 'readiness no longer exposes the old check layer or duplicate booking categories');
assert.match(readinessBody, /add\("action"[\s\S]*st\.bookingAttention/, 'booking follow-up is represented once as a neutral action');
assert.match(readinessBody, /st\.journeyDataProblems/, 'readiness detects restored/imported journey chronology problems');
assert.match(readinessBody, /st\.missingDayDates\) add\("issue"/, 'missing essential trip dates are a real issue');
const readinessStateBody=source.match(/function tripReadiness\(trip\) \{([\s\S]*?)\n    \}/)?.[1]||'';
assert.match(readinessStateBody, /const level = issues \? "issue" : "ready"/, 'top-level readiness is binary: issue or ready');
assert.doesNotMatch(readinessStateBody, /"check"/, 'check is not a top-level readiness state');

assert.match(source, /renderTripBoardAttention/, 'Trip Board attention center is wired');
assert.match(source, /duplicateCurrentDayPlan/, 'day-plan duplication workflow present');
assert.match(source, /duplicateEditingActivity/, 'activity duplication workflow present');
assert.match(source, /setTripArchived/, 'trip archive lifecycle workflow present');
assert.match(source, /renderTodayTasks/, 'dated trip tasks surface in Today');
assert.match(source, /function duplicateTrip\(/, 'trip duplication workflow present');
assert.match(source, /writeSafetySnapshot\("trip-delete"\)/, 'trip deletion creates a safety snapshot');
assert.match(source, /function undoStorageSignature\(\)/, 'Undo is bound to a persisted storage signature');
assert.match(source, /validAgainst:\s*undoStorageSignature\(\)/, 'Undo records remember the state they are valid against');
assert.match(source, /invalidateUndoAfterExternalState\(\)/, 'external state changes invalidate stale Undo');
assert.match(source, /function deleteTrip\(tripId\)[\s\S]{0,1800}guardExternalStateBeforeWrite\(\)[\s\S]{0,180}writeSafetySnapshot\("trip-delete"\)/, 'trip delete guards before consuming the single safety snapshot slot');
assert.match(source, /openSafetyCenter/, 'Data Safety Center is wired');
assert.match(source, /renderTodayProgress/, 'Today progress is wired');
assert.match(source, /tripBriefSafeText/, 'Trip Brief share-safe summary wired');
assert.match(source, /attentionDetailRows/, 'Trip Board detailed attention diagnostics wired');
assert.match(source, /home_trip_day_progress/, 'Home trip phase progress wired');
assert.doesNotMatch(source, /id="heroMapBtn"/, 'redundant small hero map control removed');



// v1800 portability: envelope validation + collision-safe graph cloning.
const portableSource = {
  id:'trip-old', name:'Portable', archived:true, archivedAt:'2026-09-01T00:00:00Z',
  days:[{id:'day-old',date:'2026-10-01',items:[{uid:'act-old',title:'Museum'}]}],
  stays:[{id:'stay-old',name:'Hotel'}], journeys:[{id:'journey-old',mode:'train'}],
  expenses:[{id:'expense-old',title:'Hotel',linkedId:'stay-old'}],
  documents:[{id:'doc-old',label:'Voucher',linkedId:'act-old'}], tasks:[{id:'task-old',title:'Pack',done:true}]
};
const envelope = Ops.portableTripEnvelope(portableSource,{appVersion:'v1800-RC1',exportedAt:'2026-09-09T00:00:00Z'});
assert.equal(envelope.packageType,'trip');
assert.equal(Ops.tripFromPortableEnvelope(envelope).name,'Portable');
assert.equal(Ops.tripFromPortableEnvelope({app:'TripMaster',packageType:'backup',packageVersion:1,trip:portableSource}),null);
let seq=0; const cloned=Ops.cloneTripGraph(portableSource,(kind)=>`${kind}-new-${++seq}`,{name:'Imported',unarchive:true});
assert.equal(cloned.name,'Imported');
assert.notEqual(cloned.id,portableSource.id);
assert.notEqual(cloned.days[0].id,portableSource.days[0].id);
assert.notEqual(cloned.days[0].items[0].uid,portableSource.days[0].items[0].uid);
assert.equal(cloned.archived,undefined);
assert.equal(cloned.expenses[0].linkedId,cloned.stays[0].id,'expense link follows remapped stay id');
assert.equal(cloned.documents[0].linkedId,cloned.days[0].items[0].uid,'document link follows remapped activity uid');
assert.equal(cloned.tasks[0].done,true,'task completion survives trip transfer');

const collisionSource={id:'trip-collision',days:[{id:'d1',date:'2026-10-01',items:[{uid:'same-id',title:'Activity'}]}],stays:[{id:'same-id',name:'Stay'}],expenses:[{id:'e1',linkedType:'stay',linkedId:'same-id'}],documents:[{id:'doc1',linkedType:'activity',linkedId:'same-id'}]};
let cseq=0;const collisionClone=Ops.cloneTripGraph(collisionSource,(kind)=>`${kind}-collision-${++cseq}`);
assert.equal(collisionClone.expenses[0].linkedId,collisionClone.stays[0].id,'typed stay link survives cross-kind source-ID collision');
assert.equal(collisionClone.documents[0].linkedId,collisionClone.days[0].items[0].uid,'typed activity link survives cross-kind source-ID collision');
assert.equal(Ops.portableTripShapeValid(portableSource),true,'normal portable trip shape accepted');
const tooManyDays={...portableSource,days:Array.from({length:Ops.PORTABLE_LIMITS.days+1},(_,i)=>({date:`2027-01-${String((i%28)+1).padStart(2,'0')}`,items:[]}))};
assert.equal(Ops.portableTripShapeValid(tooManyDays),false,'portable import rejects pathological day counts');
assert.equal(Ops.tripFromPortableEnvelope({...envelope,trip:tooManyDays}),null,'oversized structured trip envelope rejected before cloning');
const badItems={...portableSource,days:[{date:'2026-10-01',items:{not:'an array'}}]};
assert.equal(Ops.portableTripShapeValid(badItems),false,'portable import rejects malformed nested item collections');

// v2400 beta health audit + backup validation. Reports must be structural only.
const healthyAudit=Ops.auditTripGraph([{id:'trip-a',days:[{id:'day-a',date:'2026-10-01',items:[{uid:'act-a',time:'10:00'}]}],stays:[{id:'stay-a'}],journeys:[{id:'journey-a'}],expenses:[{id:'expense-a',linkedType:'stay',linkedId:'stay-a'}],documents:[{id:'doc-a',linkedType:'activity',linkedId:'act-a'}],tasks:[{id:'task-a',date:'2026-09-30'}]}],'trip-a');
assert.equal(healthyAudit.status,'ok','healthy local graph passes beta audit');
assert.equal(healthyAudit.errors.length,0);
assert.equal(healthyAudit.warnings.length,0);
const badAudit=Ops.auditTripGraph([{id:'trip-a',days:[{id:'day-a',date:'2026-99-99',items:[{uid:'dup',time:'99:99'},{uid:'dup'}]}],stays:[{id:'stay-bad',startDate:'2026-10-10',endDate:'2026-10-09',checkInTime:'77:00'}],journeys:[{id:'journey-bad',date:'2026-10-10',arrivalDate:'2026-10-09',departureTime:'18:00',arrivalTime:'17:00'}],expenses:[{id:'e1',linkedType:'stay',linkedId:'missing'}]}],'missing-active');
assert.equal(badAudit.status,'error','duplicate ids / stale active pointer produce error status');
assert.ok(badAudit.errors.includes('duplicate_activity_id'));
assert.ok(badAudit.errors.includes('active_trip_missing'));
assert.ok(badAudit.warnings.includes('invalid_day_date'));
assert.ok(badAudit.warnings.includes('invalid_activity_time'));
assert.ok(badAudit.warnings.includes('orphan_link_reference'));
assert.ok(badAudit.warnings.includes('invalid_stay_date_range'),'beta audit catches impossible stay chronology');
assert.ok(badAudit.warnings.includes('invalid_stay_checkin_time'),'beta audit catches malformed stay time');
assert.ok(badAudit.warnings.includes('journey_arrival_before_departure_date'),'beta audit catches impossible journey date chronology');
assert.equal(Object.values(badAudit).some(v=>JSON.stringify(v).includes('missing-active')),false,'audit report never echoes concrete ids');

const backupGood={app:'TripMaster',backupVersion:2,settings:{language:'en'},trips:[{id:'trip-b',days:[{id:'day-b',date:'2026-10-01',items:[]}]}]};
assert.equal(Ops.backupPayloadReport(backupGood).valid,true,'normal full backup shape accepted');
assert.equal(Ops.backupPayloadReport({...backupGood,backupVersion:999}).valid,false,'future unsupported backup version rejected');
assert.equal(Ops.backupPayloadReport({app:'Other',settings:{},trips:[]}).valid,false,'foreign backup app rejected');
const legacyNoSettings=Ops.backupPayloadReport({app:'TripMaster',backupVersion:2,trips:[]});
assert.equal(legacyNoSettings.valid,true,'legacy backup without settings remains restorable');
assert.ok(legacyNoSettings.warnings.includes('backup_settings_missing_legacy'),'missing legacy settings is surfaced as a warning');
assert.equal(Ops.backupPayloadReport({app:'TripMaster',backupVersion:2,settings:[],trips:[]}).valid,false,'malformed present settings are rejected');

// Own-write sheet convergence: advance only sheets that were current before
// the write; a genuinely stale sheet must retain its conflict evidence.
{
  const tokens=[{tripStateToken:'A'},{tripStateToken:'A'},{tripStateToken:'STALE'}];
  const changed=Ops.restampMatchingStateTokens(tokens,'A','B');
  assert.equal(changed,2,'own write advances every still-current open sheet token');
  assert.deepEqual(tokens.map(x=>x.tripStateToken),['B','B','STALE'],'own write never erases pre-existing stale-sheet evidence');
}

const duplicateIdBackup={app:'TripMaster',backupVersion:2,settings:{language:'en'},trips:[{id:'dup-trip',days:[{id:'same-day',date:'2026-10-01',items:[]},{id:'same-day',date:'2026-10-02',items:[]}]}]};
const duplicateIdReport=Ops.backupPayloadReport(duplicateIdBackup);
assert.equal(duplicateIdReport.valid,true,'legacy backup with duplicate stable IDs remains restorable');
assert.ok(duplicateIdReport.warnings.includes('duplicate_day_id'),'repairable duplicate-ID condition is surfaced as a warning');

// v3500-RC1 legacy identity repair: every stable-ID namespace is made unique
// before editing/restoring, while ambiguous historical links remain attached
// to the first occurrence instead of being guessed onto a later duplicate.
{
  const graph=[{id:'trip-dup',days:[
    {id:'day-dup',date:'2026-10-01',items:[{uid:'act-dup',title:'A'}]},
    {id:'day-dup',date:'2026-10-02',items:[{uid:'act-dup',title:'B'}]}
  ],stays:[{id:'S-dup',name:'First'},{id:'S-dup',name:'Second'}],journeys:[{id:'J-dup'},{id:'J-dup'}],expenses:[{id:'E-dup',linkedType:'stay',linkedId:'S-dup'},{id:'E-dup'}],documents:[{id:'D-dup',linkedType:'activity',linkedId:'act-dup'},{id:'D-dup'}],tasks:[{id:'T-dup',title:'One'},{id:'T-dup',title:'Two'}]}];
  const counters={};
  const result=Ops.repairTripGraphIds(graph,(kind)=>`${kind}-fresh-${counters[kind]=(counters[kind]||0)+1}`);
  assert.equal(result.changed,true,'duplicate graph repair reports a mutation');
  assert.ok(result.repairs>=6,'duplicate graph repair replaces every later duplicate namespace');
  assert.equal(graph[0].days[0].id,'day-dup','first duplicate day keeps its historical ID');
  assert.notEqual(graph[0].days[1].id,'day-dup','later duplicate day receives a fresh ID');
  assert.equal(graph[0].stays[0].id,'S-dup','first duplicate row keeps its ID');
  assert.notEqual(graph[0].stays[1].id,'S-dup','later duplicate row receives a fresh ID');
  assert.equal(graph[0].expenses[0].linkedId,'S-dup','ambiguous legacy link remains on first historical target');
  const repairedAudit=Ops.auditTripGraph(graph,'trip-dup');
  assert.equal(repairedAudit.errors.some(code=>String(code).startsWith('duplicate_')),false,'repaired graph has no duplicate stable-ID errors');
}

// v3500-RC1: when an ID changes only because the same historical ID exists
// in another trip, links owned by that trip must follow the repaired target.
// Same-trip duplicates stay ambiguous and are intentionally not guessed.
{
  const graph=[
    {id:'T-shared',days:[{id:'D1',date:'2026-10-01',items:[{uid:'A-shared',title:'A1'}]}],stays:[{id:'S-shared'}],journeys:[{id:'J-shared'}],expenses:[],documents:[]},
    {id:'T-shared',days:[{id:'D2',date:'2026-10-02',items:[{uid:'A-shared',title:'A2'}]}],stays:[{id:'S-shared'}],journeys:[{id:'J-shared'}],expenses:[
      {id:'E2a',linkedType:'trip',linkedId:'T-shared'},
      {id:'E2b',linkedType:'stay',linkedId:'S-shared'},
      {id:'E2c',linkedType:'journey',linkedId:'J-shared'}
    ],documents:[{id:'DOC2',linkedType:'activity',linkedId:'A-shared'}]}
  ];
  const counters={};
  const result=Ops.repairTripGraphIds(graph,(kind)=>`${kind}-rc3-${counters[kind]=(counters[kind]||0)+1}`);
  const second=graph[1];
  assert.notEqual(second.id,'T-shared','cross-trip duplicate trip ID is repaired');
  assert.notEqual(second.stays[0].id,'S-shared','cross-trip duplicate stay ID is repaired');
  assert.notEqual(second.journeys[0].id,'J-shared','cross-trip duplicate journey ID is repaired');
  assert.notEqual(second.days[0].items[0].uid,'A-shared','cross-trip duplicate activity UID is repaired');
  assert.equal(second.expenses[0].linkedId,second.id,'trip-level link follows repaired trip ID');
  assert.equal(second.expenses[1].linkedId,second.stays[0].id,'stay link follows repaired ID inside its own trip');
  assert.equal(second.expenses[2].linkedId,second.journeys[0].id,'journey link follows repaired ID inside its own trip');
  assert.equal(second.documents[0].linkedId,second.days[0].items[0].uid,'activity link follows repaired UID inside its own trip');
  assert.ok(result.linkRepairs>=4,'cross-trip repair reports remapped links');
  assert.equal(Ops.auditTripGraph(graph,graph[0].id).warnings.includes('orphan_link_reference'),false,'repaired links resolve within their owning trip');
}

// A historical trip object with no id must be repaired rather than silently
// discarded before migration has a chance to assign identity.
{
  const graph=[{name:'Legacy no id',days:[]}];
  const result=Ops.repairTripGraphIds(graph,()=> 'trip-recovered');
  assert.equal(result.changed,true,'missing trip ID is repairable');
  assert.equal(graph.length,1,'missing-ID trip is preserved');
  assert.equal(graph[0].id,'trip-recovered','missing trip ID receives stable identity');
}


function makeFakeCacheStorage(initialNames=[]) {
  const stores=new Map(initialNames.map(name=>[name,new Map()]));
  const deleted=[];
  const keyOf=(request)=>typeof request==="string"?request:(request&&request.url)||String(request);
  const api={
    deleted, stores,
    keys:async()=>Array.from(stores.keys()),
    has:async(name)=>stores.has(name),
    delete:async(name)=>{deleted.push(name);return stores.delete(name);},
    open:async(name)=>{
      if(!stores.has(name))stores.set(name,new Map());
      const store=stores.get(name);
      return {
        addAll:async(requests)=>{for(const req of requests)store.set(keyOf(req),new Response(fs.readFileSync(path.join(root,new URL(keyOf(req)).pathname.split("/").pop())),{status:200}));},
        add:async(req)=>{store.set(keyOf(req),new Response(fs.readFileSync(path.join(root,new URL(keyOf(req)).pathname.split("/").pop())),{status:200}));},
        keys:async()=>Array.from(store.keys()).map(url=>new Request(url)),
        match:async(req)=>{const v=store.get(keyOf(req));return v?v.clone():null;},
        put:async(req,res)=>{store.set(keyOf(req),res.clone());}
      };
    }
  };
  return api;
}

// v2800-RC2 service-worker behavior: update lifecycle must not wipe unrelated
// origin caches and must not intercept cross-origin/private traffic.
{
  const listeners = {};
  const fakeCaches = makeFakeCacheStorage([
    'tripmaster-shell-s002f0054007200690070004d00610073007400650072002f-v2750-rc1',
    'tripmaster-shell-s002f0054007200690070004d00610073007400650072002f-v2775-rc1',
    'tripmaster-shell-s002f0054007200690070004d00610073007400650072002f-v2790-rc1',
    'other-app-static-v4',
    'tripmaster-v2700-rc2-stay-readiness',
    'tripmaster-shell-v2750-rc1',
    'tripmaster-shell-tripmaster-v2750-rc1',
    'tripmaster-shell-tripmaster-v2775-rc1',
    'tripmaster-shell-tripmaster-v2790-rc1',
    'tripmaster-shell-tripmaster-beta-v3190-rc1-abcdef0123456789',
    'tripmaster-shell-tripmaster-v2-v3190-rc1-abcdef0123456789'
  ]);
  const deleted = fakeCaches.deleted;
  const swCtx = vm.createContext({
    console,
    URL,
    Response,
    Request, crypto:webcrypto,
    fetch: async () => new Response('network',{status:200}),
    caches: fakeCaches,
    self: {
      registration: { scope:'https://example.test/TripMaster/' },
      addEventListener: (type, fn) => { listeners[type] = fn; },
      skipWaiting: () => { swCtx.__skipped = true; }
    }
  });
  const swSource = fs.readFileSync(path.join(root,'sw.js'),'utf8');
  vm.runInContext(swSource, swCtx, {filename:'sw.js'});
  assert.ok(listeners.install && listeners.activate && listeners.fetch && listeners.message,'service worker registers lifecycle handlers');
  let installPromise;
  listeners.install({waitUntil:p=>{installPromise=p;}});
  await installPromise;
  assert.notEqual(swCtx.__skipped,true,'normal install does not auto-activate an update');
  let activatePromise;
  listeners.activate({waitUntil:p=>{activatePromise=p;}});
  await activatePromise;
  assert.equal(deleted.includes('other-app-static-v4'),false,'TripMaster activation never deletes unrelated origin caches');
  assert.equal(deleted.includes('tripmaster-v2700-rc2-stay-readiness'),false,'legacy unscoped TripMaster cache is not deleted because another deployment may own it');
  assert.equal(deleted.includes('tripmaster-shell-v2750-rc1'),false,'old unscoped modern cache is not deleted across sibling deployments');
  assert.ok(deleted.includes('tripmaster-shell-s002f0054007200690070004d00610073007400650072002f-v2750-rc1'),'exact path cache is trimmed beyond retention window');
  assert.equal(deleted.includes('tripmaster-shell-tripmaster-v2750-rc1'),false,'ambiguous legacy slug cache is preserved');
  assert.equal(deleted.includes('tripmaster-shell-tripmaster-beta-v3190-rc1-abcdef0123456789'),false,'sibling TripMaster beta deployment cache is not owned by the current scope token');
  assert.equal(deleted.includes('tripmaster-shell-tripmaster-v2-v3190-rc1-abcdef0123456789'),false,'version-shaped sibling scope token is not mistaken for this deployment cache');
  let crossIntercepted=false;
  listeners.fetch({request:{method:'GET',url:'https://api.example.net/private',mode:'cors'},respondWith:()=>{crossIntercepted=true;}});
  assert.equal(crossIntercepted,false,'cross-origin traffic is never intercepted/cached');
  let postIntercepted=false;
  listeners.fetch({request:{method:'POST',url:'https://example.test/TripMaster/v1/agent/query',mode:'cors'},respondWith:()=>{postIntercepted=true;}});
  assert.equal(postIntercepted,false,'non-GET API traffic is never intercepted/cached');
  let unknownSameOriginIntercepted=false;
  listeners.fetch({request:{method:'GET',url:'https://example.test/TripMaster/private-export.json',mode:'cors'},respondWith:()=>{unknownSameOriginIntercepted=true;}});
  assert.equal(unknownSameOriginIntercepted,false,'same-origin non-shell resources are not runtime-cached');

  let canonicalNavPromise=null;
  listeners.fetch({request:{method:'GET',url:'https://example.test/TripMaster/index.html?x=1#frag',mode:'navigate'},respondWith:p=>{canonicalNavPromise=p;}});
  const canonicalNav=await canonicalNavPromise;
  assert.equal(canonicalNav.status,200,'canonical shell path with query/fragment is served without a redirect loop');

  let deepNavPromise=null;
  listeners.fetch({request:{method:'GET',url:'https://example.test/TripMaster/sub/page?x=1#frag',mode:'navigate'},respondWith:p=>{deepNavPromise=p;}});
  const deepNav=await deepNavPromise;
  assert.equal(deepNav.status,302,'deep navigation redirects once to canonical shell');
  assert.equal(new URL(deepNav.headers.get('location')).pathname,'/TripMaster/index.html','deep navigation redirect targets canonical index path');
  assert.equal(new URL(deepNav.headers.get('location')).search,'?x=1','deep navigation redirect preserves query parameters');

  listeners.message({data:{type:'TRIPMASTER_SKIP_WAITING'},ports:[]});
  assert.equal(swCtx.__skipped,true,'explicit update message activates the waiting worker');
}

// v2800-RC2 failed-install cleanup: a partial modern cache must be removed so a
// legacy client can retry the bridge rather than being misclassified as already
// migrated after one network/storage failure.
{
  const listeners = {};
  const fakeCaches = makeFakeCacheStorage(['tripmaster-v2700-rc2-stay-readiness','tripmaster-shell-tripmaster-v2800-rc2']);
  const deleted = fakeCaches.deleted;
  const originalOpen=fakeCaches.open;
  fakeCaches.open=async(name)=>{
    const cache=await originalOpen(name);
    if(name.endsWith('-install'))cache.addAll=async()=>{throw new Error('simulated core precache failure');};
    return cache;
  };
  const failedCtx = vm.createContext({
    console, URL, Response, Request, crypto:webcrypto,
    fetch: async () => new Response('network',{status:200}),
    caches: fakeCaches,
    self: {
      registration:{scope:'https://example.test/TripMaster/'},
      addEventListener:(type,fn)=>{listeners[type]=fn;},
      skipWaiting:()=>{failedCtx.__skipped=true;}
    }
  });
  vm.runInContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),failedCtx,{filename:'sw.js'});
  let installPromise; listeners.install({waitUntil:p=>{installPromise=p;}});
  await assert.rejects(installPromise,/simulated core precache failure/,'core precache failure rejects installation');
  assert.notEqual(failedCtx.__skipped,true,'failed legacy install must not activate');
  assert.ok(deleted.some(name=>name.endsWith('-install')),'failed install deletes only the partial staging cache');
  assert.equal(await fakeCaches.has('tripmaster-shell-tripmaster-v2800-rc2'),true,'failed same-version install preserves the live release cache');
}

// v2800-RC2 migration bridge: a pre-v2800 cache cannot use the new postMessage
// activation protocol, so exactly that legacy -> modern transition may skip
// waiting once. As soon as a modern cache exists, the normal test above proves
// that auto-activation is disabled.
{
  const listeners = {};
  const fakeCaches = makeFakeCacheStorage(['tripmaster-v2700-rc2-stay-readiness']);
  const legacyCtx = vm.createContext({
    console, URL, Response, Request, crypto:webcrypto,
    fetch: async () => new Response('network',{status:200}),
    caches: fakeCaches,
    self: {
      registration:{scope:'https://example.test/TripMaster/'},
      addEventListener:(type,fn)=>{listeners[type]=fn;},
      skipWaiting:()=>{legacyCtx.__skipped=true;}
    }
  });
  vm.runInContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),legacyCtx,{filename:'sw.js'});
  let installPromise; listeners.install({waitUntil:p=>{installPromise=p;}}); await installPromise;
  assert.equal(legacyCtx.__skipped,true,'legacy v2700 cache receives one-time lifecycle bridge into v2800');
}

// v3500-RC1 controller-version gate: controlled pages fail closed while the
// worker identity is unresolved, exact versions match, and suffix builds do not.
async function runSwRegisterCase({cacheName=null,noReply=false,buildId="test-build"}) {
  const source=fs.readFileSync(path.join(root,'sw-register.js'),'utf8');
  const events={}, swEvents={};
  class TestCustomEvent { constructor(type,init){this.type=type;this.detail=init&&init.detail;} }
  class TestMessageChannel {
    constructor(){
      this.port1={onmessage:null,close(){}};
      const p1=this.port1;
      this.port2={close(){},reply(data){setTimeout(()=>{if(typeof p1.onmessage==='function')p1.onmessage({data});},1);}};
    }
  }
  const controller={postMessage(_msg,ports){if(!noReply)ports[0].reply({cacheName,buildId});}};
  const registration={scope:'https://example.test/TripMaster/',waiting:null,installing:null,addEventListener(){},update:async()=>{}};
  const windowObj={
    addEventListener:(type,fn)=>{events[type]=fn;},dispatchEvent:()=>{},
    setTimeout:(fn,ms)=>setTimeout(fn,Math.min(ms,8)),clearTimeout,
    setInterval:(fn,ms)=>setInterval(fn,Math.max(ms,1000000)),clearInterval,
    location:{reload(){}}
  };
  const navigatorObj={onLine:true,serviceWorker:{controller,register:async()=>registration,addEventListener:(type,fn)=>{swEvents[type]=fn;}}};
  const documentObj={hidden:false,addEventListener:()=>{}};
  const c=vm.createContext({console,URL,window:windowObj,navigator:navigatorObj,document:documentObj,CustomEvent:TestCustomEvent,MessageChannel:TestMessageChannel,APP_VERSION:'v3500-RC1',APP_BUILD_ID:'test-build',setTimeout,clearTimeout,setInterval,clearInterval});
  vm.runInContext(source,c,{filename:'sw-register.js'});
  const loadPromise=events.load();
  await new Promise(r=>setTimeout(r,1));
  const early={...windowObj.__TM_SW_STATUS__};
  await loadPromise;
  await new Promise(r=>setTimeout(r,25));
  if(events.pagehide)events.pagehide();
  return {early,final:{...windowObj.__TM_SW_STATUS__}};
}
{
  const good=await runSwRegisterCase({cacheName:'tripmaster-shell-tripmaster-v3500-rc1-0123456789abcdef'});
  assert.equal(good.final.controllerMatchesApp,true,'exact controller version/fingerprint shape matches current app');
  assert.equal(good.final.reloadRequired,false,'matching controller clears provisional write block');
  assert.equal(good.final.scopePath,'/TripMaster/','SW diagnostics expose the scoped registration pathname');
  assert.equal(good.final.controllerCheckAttempts,1,'successful controller proof records one attempt');
  assert.equal(good.final.controllerCheckTimedOut,false,'successful controller proof is not marked timed out');
  assert.ok(Number.isFinite(good.final.controllerCheckDurationMs),'successful controller proof records duration');
  const suffix=await runSwRegisterCase({cacheName:'tripmaster-shell-tripmaster-v3500-rc1-fix1-0123456789abcdef'});
  assert.equal(suffix.final.controllerMatchesApp,false,'suffix/hotfix controller does not false-match base RC');
  assert.equal(suffix.final.reloadRequired,true,'suffix mismatch requires reload');
  const wrongBuild=await runSwRegisterCase({cacheName:"tripmaster-shell-tripmaster-v3500-rc1-0123456789abcdef",buildId:"different-build"});
  assert.equal(wrongBuild.final.controllerMatchesApp,false,"same release with different build bytes fails closed");
  const timeout=await runSwRegisterCase({noReply:true});
  assert.equal(timeout.early.reloadRequired,true,'controlled page is write-blocked while controller identity is unresolved');
  assert.equal(timeout.final.reloadRequired,true,'controller query timeout fails closed after retry');
  assert.equal(timeout.final.controllerCheckAttempts,2,'timed-out controller proof records both attempts');
  assert.equal(timeout.final.controllerCheckTimedOut,true,'timed-out controller proof is visible in diagnostics');
}

console.log('TripMaster regression: PASS');
console.log('Checks: overnight timing, Back guard, Readiness 3.0, Today actions, Booking/Money/Documents operations, currency chooser, hero action cleanup');
