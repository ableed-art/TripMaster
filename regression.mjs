import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ctx = vm.createContext({ console });
function load(name){
  const code = fs.readFileSync(path.join(root, name), 'utf8');
  vm.runInContext(code, ctx, { filename:name });
}
['app-intelligence.js','app-logistics.js','app-finance.js','app-travel.js','app-today.js','app-operations.js'].forEach(load);

const L = ctx.TripMasterLogistics;
const F = ctx.TripMasterFinance;
const T = ctx.TripMasterTravel;
const Today = ctx.TripMasterToday;
const Ops = ctx.TripMasterOperations;
assert.ok(L && F && T && Today && Ops, 'pure model modules loaded');

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
  id:'trip-ops', days:[{date:'2026-09-08',items:[{uid:'op-a1',title:'Museum',booking:{status:'planned',paymentStatus:'unpaid'}}]}],
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

const taskTrip={tasks:[{id:'t1',title:'Buy museum tickets',done:false,date:'2026-09-06',priority:'high'},{id:'t2',title:'Check transfer',done:true},{id:'t3',title:'Call hotel',done:false,date:'2026-09-07',priority:'normal'}]};
const taskStats=Ops.taskStats(taskTrip,'2026-09-07'); assert.equal(taskStats.total,3); assert.equal(taskStats.done,1); assert.equal(taskStats.open,2); assert.equal(taskStats.overdue,1); assert.equal(taskStats.dueToday,1);
assert.equal(Ops.taskDueState(taskTrip.tasks[0],'2026-09-07'),'overdue','dated checklist detects overdue work');
assert.equal(Ops.taskDueState(taskTrip.tasks[2],'2026-09-07'),'today','dated checklist detects due-today work');
assert.equal(Ops.sortedTasks(taskTrip,'2026-09-07')[0].info.id,'t1','overdue checklist items sort first');
assert.equal(Ops.isArchivedTrip({archived:true}),true,'archived trip lifecycle flag recognized');
assert.equal(Ops.matchesText('museum',['Buy museum tickets','London']),true,'Trip Board search matches trip text');
assert.equal(Ops.matchesText('rome',['Buy museum tickets','London']),false,'Trip Board search rejects unrelated text');

const source = fs.readFileSync(path.join(root,'app.js'),'utf8');
assert.match(source, /item\.endNextDay === true/, 'overnight activity semantics retained');
assert.match(source, /arrivalDate/, 'arrival-date semantics retained');
assert.match(source, /tripmasterGuard/, 'hardware/browser Back guard present');
assert.match(source, /readiness_center_title/, 'Readiness 2.0 present');
assert.match(source, /COMMON_CURRENCIES/, 'currency chooser foundation present');
assert.match(source, /data-booking-filter/, 'Booking Center attention filters wired');
assert.match(source, /data-money-filter/, 'Money attention filters wired');
assert.match(source, /data-documents-filter/, 'Documents attention filters wired');
assert.match(source, /function duplicateTrip\(/, 'trip duplication workflow present');
assert.match(source, /home_past_trips/, 'past-trip Home grouping present');
assert.match(source, /openTripBoardSheet/, 'Trip Board is wired into product navigation');
assert.match(source, /renderTripBoardAttention/, 'Trip Board attention center is wired');
assert.match(source, /duplicateCurrentDayPlan/, 'day-plan duplication workflow present');
assert.match(source, /duplicateEditingActivity/, 'activity duplication workflow present');
assert.match(source, /setTripArchived/, 'trip archive lifecycle workflow present');
assert.match(source, /renderTodayTasks/, 'dated trip tasks surface in Today');
assert.match(source, /function duplicateTrip\(/, 'trip duplication workflow present');
assert.match(source, /writeSafetySnapshot\("trip-delete"\)/, 'trip deletion creates a safety snapshot');
assert.match(source, /openSafetyCenter/, 'Data Safety Center is wired');
assert.match(source, /renderTodayProgress/, 'Today progress is wired');
assert.doesNotMatch(source, /id="heroMapBtn"/, 'redundant small hero map control removed');

console.log('TripMaster regression: PASS');
console.log('Checks: overnight timing, Back guard, Readiness 2.0, Booking/Money/Documents operations, currency chooser, hero action cleanup');
