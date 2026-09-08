/* TripMaster v1090 - Today / In-Trip deterministic model.
   Pure/local only. Uses user-entered itinerary/logistics data and the browser's
   IANA timezone database. No live status, routing, traffic, booking validation,
   accessibility inference, FX, partner activation or network calls. */
(function (root) {
  "use strict";

  const L = root.TripMasterLogistics;
  const T = root.TripMasterTravel;
  const D = root.TripMasterIntelligence;
  const F = root.TripMasterFinance;

  function clean(value) { return typeof value === "string" ? value.trim() : ""; }
  function validDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
    const y=Number(value.slice(0,4)),m=Number(value.slice(5,7)),d=Number(value.slice(8,10));
    const dt=new Date(Date.UTC(y,m-1,d));
    return dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d?value:"";
  }
  function validTime(value) {
    if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) return "";
    const h=Number(value.slice(0,2)),m=Number(value.slice(3,5));
    return h>=0&&h<=23&&m>=0&&m<=59?value:"";
  }
  function parseTime(value) { return D && D.parseTime ? D.parseTime(value) : (validTime(value) ? Number(value.slice(0,2))*60+Number(value.slice(3,5)) : null); }
  function pad2(n){return String(n).padStart(2,"0");}
  function dateISO(y,m,d){return `${y}-${pad2(m)}-${pad2(d)}`;}
  function addDays(date,n){
    const d=validDate(date); if(!d)return "";
    const dt=new Date(Date.UTC(Number(d.slice(0,4)),Number(d.slice(5,7))-1,Number(d.slice(8,10))));
    dt.setUTCDate(dt.getUTCDate()+n); return dateISO(dt.getUTCFullYear(),dt.getUTCMonth()+1,dt.getUTCDate());
  }
  function diffDays(fromDate,toDate){
    const a=validDate(fromDate),b=validDate(toDate);if(!a||!b)return 0;
    return Math.round((Date.parse(b+"T00:00:00Z")-Date.parse(a+"T00:00:00Z"))/86400000);
  }
  function validTimeZone(tz){try{return !!tz&&typeof tz==="string"&&!!new Intl.DateTimeFormat("en-US",{timeZone:tz});}catch(e){return false;}}

  /* Deterministic trip-local wall clock. `nowInput` may be Date/ms for tests.
     If no valid trip timezone exists, we intentionally fall back to device
     local wall time, matching TripMaster's existing truthful fallback. */
  function clock(nowInput, timezone){
    const now=nowInput instanceof Date?nowInput:new Date(nowInput==null?Date.now():nowInput);
    const tz=validTimeZone(timezone)?timezone:"";
    if(!tz){
      return {date:dateISO(now.getFullYear(),now.getMonth()+1,now.getDate()),time:`${pad2(now.getHours())}:${pad2(now.getMinutes())}`,minutes:now.getHours()*60+now.getMinutes(),timezone:"",fallback:true,instantMs:now.getTime()};
    }
    const parts=new Intl.DateTimeFormat("en-CA",{timeZone:tz,hour12:false,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).formatToParts(now);
    const map={};parts.forEach(p=>{map[p.type]=p.value;});
    let h=Number(map.hour);if(h===24)h=0;const mi=Number(map.minute);
    return {date:`${map.year}-${map.month}-${map.day}`,time:`${pad2(h)}:${pad2(mi)}`,minutes:h*60+mi,timezone:tz,fallback:false,instantMs:now.getTime()};
  }

  function days(trip){return trip&&Array.isArray(trip.days)?trip.days.filter(x=>x&&typeof x==="object"):[];}
  function dayForDate(trip,date){const d=validDate(date);return d?days(trip).find(x=>validDate(x.date)===d)||null:null;}
  function tripDateRange(trip){
    const dates=[];
    days(trip).forEach(day=>{const d=validDate(day.date);if(d){dates.push(d);if(Array.isArray(day.items)&&day.items.some(item=>item&&item.endNextDay===true&&validTime(item.endTime)))dates.push(addDays(d,1));if(T&&T.hasTravelDayDetails&&T.hasTravelDayDetails(day)){const td=T.travelDayInfo(day);if(td.arrivalDate)dates.push(td.arrivalDate);}}});
    if(L){
      L.tripStays(trip).forEach(raw=>{const s=L.stayInfo(raw);if(s.startDate)dates.push(s.startDate);if(s.endDate)dates.push(s.endDate);});
      L.tripJourneys(trip).forEach(raw=>{const j=L.journeyInfo(raw);if(j.date)dates.push(j.date);if(j.arrivalDate)dates.push(j.arrivalDate);});
    }
    if(!dates.length)return null;dates.sort();return {first:dates[0],last:dates[dates.length-1]};
  }
  function isTripActive(trip, clockState){const r=tripDateRange(trip),d=clockState&&validDate(clockState.date);return !!(r&&d&&r.first<=d&&d<=r.last);}
  function previewDates(trip){
    const set=new Set();days(trip).forEach(x=>{const d=validDate(x.date);if(d){set.add(d);if(Array.isArray(x.items)&&x.items.some(item=>item&&item.endNextDay===true&&validTime(item.endTime)))set.add(addDays(d,1));if(T&&T.hasTravelDayDetails&&T.hasTravelDayDetails(x)){const td=T.travelDayInfo(x);if(td.arrivalDate)set.add(td.arrivalDate);}}});
    if(L){L.tripJourneys(trip).forEach(raw=>{const j=L.journeyInfo(raw);if(j.date)set.add(j.date);if(j.arrivalDate)set.add(j.arrivalDate);});L.tripStays(trip).forEach(raw=>{const s=L.stayInfo(raw);if(s.startDate)set.add(s.startDate);if(s.endDate)set.add(s.endDate);});}
    return Array.from(set).sort();
  }
  function choosePreviewDate(trip, referenceDate){const ds=previewDates(trip);if(!ds.length)return "";const r=validDate(referenceDate);return (r&&ds.find(d=>d>=r))||ds[0];}

  function payment(raw){return F&&F.paymentStatus?F.paymentStatus(raw&&raw.paymentStatus):"";}
  function activityBooking(item){return L&&L.bookingInfo?L.bookingInfo(item&&item.booking):{status:"",reference:"",provider:"",note:""};}
  function eventBase(kind,date,title){return {kind,date,title:title||"",subtitle:"",startTime:"",endTime:"",startMin:null,endMin:null,timingKnown:false,source:null,paymentStatus:"",bookingStatus:"",hasBooking:false,hasReference:false,documentIndices:[],location:"",accessStatus:"",accessNote:"",travel:null,completed:false};}
  function canonicalIndex(trip,key,raw){return trip&&Array.isArray(trip[key])?trip[key].indexOf(raw):-1;}
  function addLinkedDocuments(trip,event){
    if(!F||!event||!event.source)return event;
    F.tripDocuments(trip).forEach((raw)=>{const d=F.documentInfo(raw);if(!d.linkedType||!d.linkedId)return;const s=event.source;if(d.linkedType===s.kind&&d.linkedId===s.id){const index=canonicalIndex(trip,"documents",raw);if(index>=0)event.documentIndices.push(index);}});
    return event;
  }

  function activityEventsForDay(trip,day,date,offset){
    const source=day&&Array.isArray(day.items)?day.items:[];
    const dayOffset=Number.isInteger(offset)?offset:0;
    return source.map((item,itemIndex)=>{
      if(!item||typeof item!=="object")return null;
      const e=eventBase("activity",date,clean(item.title));
      e.startTime=validTime(item.time);e.endTime=validTime(item.endTime);
      const start=parseTime(e.startTime),end=parseTime(e.endTime);
      const nextDay=item.endNextDay===true;
      e.startMin=start===null?null:start-dayOffset*1440;
      e.endMin=end===null?null:end+(nextDay?1440:0)-dayOffset*1440;
      e.timingKnown=e.startMin!==null;
      if(e.endMin!==null&&e.startMin!==null&&e.endMin<=e.startMin)e.endMin=null;
      e.location=clean(item.location);e.accessStatus=clean(item.accessStatus);e.accessNote=clean(item.accessNote);e.completed=item.completed===true;
      const b=activityBooking(item);e.bookingStatus=b.status;e.paymentStatus=F&&F.paymentStatus?F.paymentStatus(item&&item.booking&&item.booking.paymentStatus):"";e.hasReference=!!b.reference;e.hasBooking=!!(b.status||b.reference||b.provider||b.note||e.paymentStatus);
      const id=clean(item.uid);e.source={kind:"activity",id,dayIndex:canonicalIndex(trip,"days",day),itemIndex};
      return addLinkedDocuments(trip,e);
    }).filter(Boolean);
  }
  function activityEvents(trip,day,date){
    const own=activityEventsForDay(trip,day,date,0);
    const prevDate=addDays(date,-1),prevDay=dayForDate(trip,prevDate);
    const carry=activityEventsForDay(trip,prevDay,date,1).filter(e=>e.endMin!==null&&e.endMin>0);
    return carry.concat(own);
  }
  function stayEvents(trip,date){
    if(!L)return [];
    const out=[];
    L.staysEndingOn(trip,date).forEach(raw=>{const s=L.stayInfo(raw),e=eventBase("checkout",date,s.name||s.location);e.startTime=s.checkOutTime;e.startMin=parseTime(e.startTime);e.timingKnown=e.startMin!==null;e.location=s.location;e.bookingStatus=s.status;e.paymentStatus=payment(raw);e.hasReference=!!s.confirmation;e.hasBooking=!!(s.status||s.confirmation||s.provider||s.bookingUrl||e.paymentStatus);e.source={kind:"stay",id:s.id,index:canonicalIndex(trip,"stays",raw)};out.push(addLinkedDocuments(trip,e));});
    L.staysStartingOn(trip,date).forEach(raw=>{const s=L.stayInfo(raw),e=eventBase("checkin",date,s.name||s.location);e.startTime=s.checkInTime;e.startMin=parseTime(e.startTime);e.timingKnown=e.startMin!==null;e.location=s.location;e.bookingStatus=s.status;e.paymentStatus=payment(raw);e.hasReference=!!s.confirmation;e.hasBooking=!!(s.status||s.confirmation||s.provider||s.bookingUrl||e.paymentStatus);e.source={kind:"stay",id:s.id,index:canonicalIndex(trip,"stays",raw)};out.push(addLinkedDocuments(trip,e));});
    return out;
  }
  function journeyEvents(trip,date){
    if(!L)return [];
    const rows=L.journeysTouchingDate?L.journeysTouchingDate(trip,date):L.journeysForDate(trip,date);
    return rows.map(raw=>{
      const j=L.journeyInfo(raw),e=eventBase("journey",date,[j.origin,j.destination].filter(Boolean).join(" → "));
      const totalDays=j.arrivalDate&&j.arrivalDate>=j.date?Math.max(0,diffDays(j.date,j.arrivalDate)):0;
      const offset=Math.max(0,diffDays(j.date,date));
      e.startTime=j.departureTime;e.endTime=j.arrivalTime;
      const dep=parseTime(e.startTime),arr=parseTime(e.endTime);
      e.startMin=dep===null?null:dep-offset*1440;
      e.endMin=arr===null?null:arr+(totalDays-offset)*1440;
      e.timingKnown=e.startMin!==null;
      if(totalDays===0&&e.endMin!==null&&e.startMin!==null&&e.endMin<e.startMin)e.endMin=null;
      e.subtitle=[j.mode,j.provider,j.serviceNumber].filter(Boolean).join(" · ");e.bookingStatus=j.status;e.paymentStatus=payment(raw);e.hasReference=!!j.confirmation;e.hasBooking=!!(j.status||j.confirmation||j.provider||e.paymentStatus);e.source={kind:"journey",id:j.id,index:canonicalIndex(trip,"journeys",raw)};return addLinkedDocuments(trip,e);
    });
  }
  function oneTravelDayEvent(trip,day,viewDate,canonicalJourneys){
    if(!T||!day||T.dayType(day)==="normal"||!T.hasTravelDayDetails(day))return null;
    const info=T.travelDayInfo(day),startDate=validDate(day.date);if(!startDate)return null;
    const title=[info.origin,info.destination].filter(Boolean).join(" → ");
    const duplicate=(canonicalJourneys||[]).some(e=>e.startTime===info.departureTime&&e.title===title);if(duplicate)return null;
    const totalDays=info.arrivalDate&&info.arrivalDate>=startDate?Math.max(0,diffDays(startDate,info.arrivalDate)):0;
    const offset=Math.max(0,diffDays(startDate,viewDate));if(offset>totalDays)return null;
    const e=eventBase("travelday",viewDate,title);e.startTime=info.departureTime;e.endTime=info.arrivalTime;
    const dep=parseTime(e.startTime),arr=parseTime(e.endTime);e.startMin=dep===null?null:dep-offset*1440;e.endMin=arr===null?null:arr+(totalDays-offset)*1440;e.timingKnown=e.startMin!==null;
    if(totalDays===0&&e.endMin!==null&&e.startMin!==null&&e.endMin<=e.startMin)e.endMin=null;e.subtitle=info.mode;e.hasReference=!!info.reference;e.source={kind:"travelday",id:"",dayIndex:canonicalIndex(trip,"days",day)};return e;
  }
  function travelDayEvents(trip,day,date,canonicalJourneys){
    const out=[];const own=oneTravelDayEvent(trip,day,date,canonicalJourneys);if(own)out.push(own);
    days(trip).forEach(candidate=>{if(candidate===day)return;const info=T&&T.travelDayInfo?T.travelDayInfo(candidate):null;if(!info||info.arrivalDate!==date)return;const carry=oneTravelDayEvent(trip,candidate,date,canonicalJourneys);if(carry)out.push(carry);});
    return out;
  }
  function travelSegments(day,activityList,date){
    if(!D||!day)return [];
    const analysis=D.analyzeDay(Array.isArray(day.items)?day.items:[]),out=[],dayIndex=activityList.find(e=>e.source&&e.source.kind==="activity"&&e.source.dayIndex>=0&&day.items&&day.items[e.source.itemIndex])?.source.dayIndex;
    analysis.pairs.forEach(pair=>{const tr=pair.travel;if(!tr||!tr.known)return;const next=activityList.find(e=>e.source&&e.source.kind==="activity"&&e.source.dayIndex===dayIndex&&e.source.itemIndex===pair.secondIndex);const prev=activityList.find(e=>e.source&&e.source.kind==="activity"&&e.source.dayIndex===dayIndex&&e.source.itemIndex===pair.firstIndex);const e=eventBase("travel",date,"");e.travel={mode:tr.mode,durationMin:tr.durationMin,note:tr.note,status:pair.status,availableGapMin:pair.availableGapMin,bufferMin:pair.bufferMin,unresolved:tr.unresolved===true};e.title=[prev&&prev.title,next&&next.title].filter(Boolean).join(" → ");e.startTime=prev&&prev.endTime||"";e.startMin=prev&&prev.endMin!=null?prev.endMin:null;e.timingKnown=e.startMin!==null;e.source={kind:"travel",id:"",dayIndex:Number.isInteger(dayIndex)?dayIndex:-1,itemIndex:pair.secondIndex};out.push(e);});
    return out;
  }
  function eventSort(a,b){
    const am=a.startMin,bm=b.startMin;if(am!==null&&bm!==null)return am-bm||priority(a.kind)-priority(b.kind);if(am!==null)return -1;if(bm!==null)return 1;return priority(a.kind)-priority(b.kind);
  }
  function priority(kind){return {checkout:10,journey:20,travelday:25,travel:30,activity:40,checkin:50}[kind]||90;}
  function buildEvents(trip,date){
    const d=validDate(date),day=dayForDate(trip,d);if(!d)return [];
    const acts=activityEvents(trip,day,d),journeys=journeyEvents(trip,d),stays=stayEvents(trip,d),td=travelDayEvents(trip,day,d,journeys),segments=travelSegments(day,acts,d);
    return stays.concat(journeys,td,acts,segments).sort(eventSort);
  }
  function classifyEvents(events,clockState,isLive){
    const now=isLive&&clockState?clockState.minutes:null;
    return events.map(e=>{
      const c=Object.assign({},e,{temporal:"unknown"});
      if(now===null)return c;
      if(e.startMin===null)return c;
      if(e.endMin!==null){if(now<e.startMin)c.temporal="future";else if(now<e.endMin)c.temporal="current";else c.temporal="past";}
      else {if(now<e.startMin)c.temporal="future";else if(e.kind==="activity"||e.kind==="journey"||e.kind==="travelday")c.temporal="started_uncertain";else c.temporal="past";}
      return c;
    });
  }
  function determineNowNext(classified,clockState,isLive){
    if(!isLive)return {now:null,next:classified.find(e=>e.startMin!==null)||classified[0]||null};
    const current=classified.filter(e=>e.temporal==="current").sort((a,b)=>priority(a.kind)-priority(b.kind))[0]||null;
    const future=classified.filter(e=>e.temporal==="future").sort(eventSort)[0]||null;
    const untimed=!future?classified.find(e=>e.startMin===null&&e.kind!=="travel"):null;
    return {now:current,next:future||untimed||null};
  }

  function stayContext(trip,date){
    if(!L)return {effective:null,checkout:[],checkin:[],tonight:null,kind:"none"};
    const eff=L.effectiveStayForDate(trip,date),checkout=L.staysEndingOn(trip,date),checkin=L.staysStartingOn(trip,date);
    const tonightDate=date,tonight=L.effectiveStayForDate(trip,tonightDate);
    return {effective:eff.stay||null,checkout,checkin,tonight:tonight.stay||null,kind:eff.kind,tonightKind:tonight.kind};
  }
  function tomorrowGlance(trip,date){
    const tomorrow=addDays(date,1);if(!tomorrow)return null;
    const events=buildEvents(trip,tomorrow).filter(e=>e.kind!=="travel");
    const key=events.slice(0,2);
    const st=stayContext(trip,tomorrow);
    return {date:tomorrow,events:key,stay:st.tonight||st.effective||null,stayKind:st.tonightKind||st.kind};
  }
  function reminders(trip,date,clockState,isLive){
    const day=dayForDate(trip,date);if(!day)return [];
    const out=[];(Array.isArray(day.items)?day.items:[]).forEach((item,itemIndex)=>{const start=parseTime(item&&item.time),raw=item&&item.reminderMin;let rem=null;if(typeof raw==="number"&&Number.isFinite(raw))rem=raw;else if(typeof raw==="string"&&raw.trim()!==""&&Number.isFinite(Number(raw)))rem=Number(raw);if(start===null||rem===null||rem<0)return;const rounded=Math.round(rem),due=start-rounded;let state="scheduled",delta=null;if(isLive){delta=due-clockState.minutes;if(clockState.minutes>=start)state="passed";else if(delta<=0)state="due";else state="upcoming";}out.push({dayIndex:canonicalIndex(trip,"days",day),itemIndex,title:clean(item.title),time:validTime(item.time),reminderMin:rounded,dueMin:due,state,minutesUntil:delta});});return out.sort((a,b)=>a.dueMin-b.dueMin);
  }

  function linkedDocRelevant(trip,doc,date,eventSources){
    const d=F.documentInfo(doc);if(d.status!=="needed")return false;if(!d.linkedType)return false;if(d.linkedType==="trip")return true;return eventSources.has(`${d.linkedType}:${d.linkedId}`);
  }
  function attention(trip,date,events,options){
    const opts=options||{},rows=[],day=dayForDate(trip,date);const add=(level,code,source)=>{if(rows.length<5)rows.push({level,code,source:source||null});};
    if(day&&D){
      const a=D.analyzeDay(Array.isArray(day.items)?day.items:[]);
      if(a.conflicts.length)add("issue","overlap");
      if(a.pairs.some(p=>p.status==="insufficient"))add("issue","travel_insufficient");
      const unresolvedRelevant=events.some(e=>{
        if(e.kind!=="travel"||!e.travel||e.travel.unresolved!==true)return false;
        if(opts.preview)return true;
        const next=events.find(x=>x.source&&x.source.kind==="activity"&&e.source&&x.source.dayIndex===e.source.dayIndex&&x.source.itemIndex===e.source.itemIndex);
        return !next||next.temporal==="future"||next.temporal==="unknown";
      });
      if(unresolvedRelevant)add("check","travel_unresolved");
    }
    if(L){const overlaps=L.stayOverlaps(trip).some(pair=>pair.every(raw=>L.stayCoversDate(raw,date)));if(overlaps)add("issue","stay_conflict");}
    const todayRelevant=events.filter(e=>e.kind!=="travel");if(todayRelevant.some(e=>e.bookingStatus==="planned"))add("check","booking_planned");if(todayRelevant.some(e=>e.paymentStatus==="unpaid"||e.paymentStatus==="partial"))add("check","payment_attention");
    if(opts.accessActive&&todayRelevant.some(e=>e.kind==="activity"&&(!e.accessStatus||e.accessStatus==="needscheck")))add("check","access_needs_check");
    if(F){const sources=new Set(todayRelevant.filter(e=>e.source&&e.source.id).map(e=>`${e.source.kind}:${e.source.id}`));if(F.tripDocuments(trip).some(doc=>linkedDocRelevant(trip,doc,date,sources)))add("check","document_needed");}
    if(!rows.length&&todayRelevant.some(e=>e.hasReference||e.documentIndices.length))add("info","confirmation_available");
    return rows;
  }

  function buildToday(trip,options){
    const opts=options||{},c=clock(opts.now,clean(trip&&trip.timezone)),range=tripDateRange(trip),active=isTripActive(trip,c),preview=opts.preview===true;
    const requested=validDate(opts.date);const date=preview?(requested||choosePreviewDate(trip,c.date)):(active?c.date:(requested||choosePreviewDate(trip,c.date)));
    const isLive=!preview&&active&&date===c.date;const day=dayForDate(trip,date);const rawEvents=buildEvents(trip,date);const events=classifyEvents(rawEvents,c,isLive);const state=determineNowNext(events,c,isLive);const st=stayContext(trip,date);const rem=reminders(trip,date,c,isLive);const att=attention(trip,date,events,{accessActive:opts.accessActive===true,preview:!isLive});
    return {schema:"tripmaster-today-v1",date,preview:preview||!active,isLive,activeTrip:active,clock:c,range,day,dayType:T&&day?T.dayType(day):"normal",travelDay:T&&day?T.travelDayInfo(day):null,events,now:state.now,next:state.next,stay:st,attention:att,reminders:rem,tomorrow:tomorrowGlance(trip,date),noMore:isLive&&!state.now&&!state.next&&events.length>0&&events.every(e=>e.temporal==="past")};
  }

  function sanitizedContext(model){
    if(!model)return null;const safeEvent=e=>e?{kind:e.kind,title:e.title,startTime:e.startTime,endTime:e.endTime,timingKnown:e.timingKnown,bookingStatus:e.bookingStatus,paymentStatus:e.paymentStatus,accessStatus:e.accessStatus,temporal:e.temporal}:null;
    return {schema:"tripmaster-today-context-v1",date:model.date,preview:model.preview,isLive:model.isLive,clock:{date:model.clock.date,time:model.clock.time,timezone:model.clock.timezone,fallback:model.clock.fallback},dayType:model.dayType,now:safeEvent(model.now),next:safeEvent(model.next),currentStay:model.stay&&model.stay.effective?{name:clean(model.stay.effective.name),location:clean(model.stay.effective.location)}:null,todayItems:model.events.map(safeEvent),attention:model.attention.map(x=>({level:x.level,code:x.code})),tomorrow:model.tomorrow?{date:model.tomorrow.date,events:model.tomorrow.events.map(safeEvent)}:null};
  }
  function partnerContext(model){
    const slots=[];if(!model)return Object.freeze({version:1,active:false,slots});if(model.dayType==="arrival")slots.push("esim_pretrip","airport_transfer");if(model.events.some(e=>e.kind==="journey"))slots.push("intercity_transport");if(model.events.some(e=>e.kind==="activity"))slots.push("activity_discovery");if(model.stay&&model.stay.checkout.length&&model.stay.checkin.length)slots.push("luggage_storage");return Object.freeze({version:1,active:false,slots:Array.from(new Set(slots))});
  }

  root.TripMasterToday=Object.freeze({validDate,validTime,validTimeZone,clock,addDays,tripDateRange,isTripActive,previewDates,choosePreviewDate,dayForDate,buildEvents,buildToday,sanitizedContext,partnerContext});
})(typeof window!=="undefined"?window:globalThis);
