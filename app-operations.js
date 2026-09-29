/* TripMaster v1200 — pure trip operations helpers.
   Local-only task/checklist normalization and lightweight search helpers.
   No DOM, storage, network, AI, or booking-provider calls. */
(function (root) {
  "use strict";

  function clean(value) { return typeof value === "string" ? value.trim() : ""; }
  function validDate(value) { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ""; }
  function taskInfo(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    const priority = ["low","normal","high"].includes(src.priority) ? src.priority : "normal";
    return {
      id: clean(src.id),
      title: clean(src.title),
      done: src.done === true,
      date: validDate(src.date),
      priority,
      createdAt: clean(src.createdAt)
    };
  }
  function tripTasks(trip) { return trip && Array.isArray(trip.tasks) ? trip.tasks : []; }
  function taskDueState(task, today) {
    const info = taskInfo(task);
    const ref = validDate(today) || "";
    if (info.done || !info.date || !ref) return info.done ? "done" : "none";
    if (info.date < ref) return "overdue";
    if (info.date === ref) return "today";
    return "upcoming";
  }
  function taskStats(trip, today) {
    const rows = tripTasks(trip).map(taskInfo).filter(x => x.title);
    const done = rows.filter(x => x.done).length;
    const overdue = rows.filter(x => taskDueState(x, today) === "overdue").length;
    const dueToday = rows.filter(x => taskDueState(x, today) === "today").length;
    return { total: rows.length, done, open: rows.length - done, overdue, dueToday };
  }
  function sortedTasks(trip, today) {
    const rank = { overdue:0, today:1, upcoming:2, none:3, done:4 };
    const pri = { high:0, normal:1, low:2 };
    return tripTasks(trip).map((raw,index)=>({raw,index,info:taskInfo(raw)})).filter(x=>x.info.title).sort((a,b)=>{
      const ar=rank[taskDueState(a.info,today)] ?? 9, br=rank[taskDueState(b.info,today)] ?? 9;
      if (ar !== br) return ar-br;
      const ap=pri[a.info.priority] ?? 1, bp=pri[b.info.priority] ?? 1;
      if (ap !== bp) return ap-bp;
      return String(a.info.date||a.info.createdAt||"").localeCompare(String(b.info.date||b.info.createdAt||""));
    });
  }
  function normalizeSearch(value) {
    const text = clean(value);
    const normalized = typeof text.normalize === "function" ? text.normalize("NFC") : text;
    return normalized.toLocaleLowerCase();
  }
  function matchesText(query, values) {
    const q = normalizeSearch(query);
    if (!q) return true;
    return (Array.isArray(values) ? values : [values]).some(v => normalizeSearch(v).includes(q));
  }

  function isArchivedTrip(trip) { return !!(trip && trip.archived === true); }

  function portableTripEnvelope(trip, meta) {
    if (!trip || typeof trip !== "object" || !Array.isArray(trip.days)) return null;
    const m = meta && typeof meta === "object" ? meta : {};
    return { app:"TripMaster", packageType:"trip", packageVersion:1, appVersion:clean(m.appVersion), exportedAt:clean(m.exportedAt), trip:JSON.parse(JSON.stringify(trip)) };
  }
  const PORTABLE_LIMITS = Object.freeze({
    days: 400, activities: 10000, stays: 2000, journeys: 2000,
    expenses: 10000, documents: 10000, tasks: 10000
  });
  function portableTripShapeValid(trip) {
    if (!trip || typeof trip !== "object" || Array.isArray(trip) || !Array.isArray(trip.days)) return false;
    if (trip.days.length > PORTABLE_LIMITS.days) return false;
    let activities = 0;
    for (const day of trip.days) {
      if (!day || typeof day !== "object" || Array.isArray(day)) return false;
      const items = day.items == null ? [] : day.items;
      if (!Array.isArray(items)) return false;
      activities += items.length;
      if (activities > PORTABLE_LIMITS.activities) return false;
      if (items.some(item => !item || typeof item !== "object" || Array.isArray(item))) return false;
    }
    const collections = [["stays",PORTABLE_LIMITS.stays],["journeys",PORTABLE_LIMITS.journeys],["expenses",PORTABLE_LIMITS.expenses],["documents",PORTABLE_LIMITS.documents],["tasks",PORTABLE_LIMITS.tasks]];
    for (const [key,limit] of collections) {
      const rows = trip[key] == null ? [] : trip[key];
      if (!Array.isArray(rows) || rows.length > limit) return false;
      if (rows.some(row => !row || typeof row !== "object" || Array.isArray(row))) return false;
    }
    return true;
  }
  function tripFromPortableEnvelope(payload) {
    if (!payload || typeof payload !== "object") return null;
    if (payload.app !== "TripMaster" || payload.packageType !== "trip" || Number(payload.packageVersion) !== 1) return null;
    const trip=payload.trip;
    if (!portableTripShapeValid(trip)) return null;
    return JSON.parse(JSON.stringify(trip));
  }
  function cloneTripGraph(source, idFactory, options) {
    if (!source || typeof source !== "object" || !Array.isArray(source.days) || typeof idFactory !== "function") return null;
    const opts=options&&typeof options==="object"?options:{};
    const copy=JSON.parse(JSON.stringify(source));
    const idMap=new Map(), legacyIdMap=new Map(), legacyCollisions=new Set();
    const fresh=(kind,old)=>{
      const next=clean(idFactory(kind,old));
      if(!next)throw new Error("TripMaster cloneTripGraph: empty id for "+kind);
      if(old){
        idMap.set(kind+"|"+old,next);
        if(legacyIdMap.has(old)&&legacyIdMap.get(old)!==next){legacyIdMap.delete(old);legacyCollisions.add(old);}
        else if(!legacyCollisions.has(old))legacyIdMap.set(old,next);
      }
      return next;
    };
    copy.id=fresh("trip",clean(copy.id));
    if(typeof opts.name==="string")copy.name=opts.name;
    if(opts.unarchive!==false){delete copy.archived;delete copy.archivedAt;}
    delete copy.migrationSource;delete copy.legacyHomeSignature;
    (copy.days||[]).forEach(day=>{if(!day||typeof day!=="object")return;day.id=fresh("day",clean(day.id));(Array.isArray(day.items)?day.items:[]).forEach(item=>{if(!item||typeof item!=="object")return;item.uid=fresh("activity",clean(item.uid));});});
    const remapCollection=(rows,kind)=>(Array.isArray(rows)?rows:[]).forEach(row=>{if(!row||typeof row!=="object")return;row.id=fresh(kind,clean(row.id));});
    remapCollection(copy.stays,"stay");remapCollection(copy.journeys,"journey");remapCollection(copy.expenses,"expense");remapCollection(copy.documents,"document");remapCollection(copy.tasks,"task");
    const remapLink=row=>{
      if(!row||typeof row!=="object"||!clean(row.linkedId))return;
      const oldId=clean(row.linkedId),type=clean(row.linkedType),key=type+"|"+oldId;
      if(type&&idMap.has(key))row.linkedId=idMap.get(key);
      else if(!type&&legacyIdMap.has(oldId))row.linkedId=legacyIdMap.get(oldId);
    };
    (copy.expenses||[]).forEach(remapLink);(copy.documents||[]).forEach(remapLink);
    return copy;
  }


  const BACKUP_LIMITS = Object.freeze({
    trips: 250, days: 1200, activities: 30000, stays: 5000, journeys: 5000,
    expenses: 30000, documents: 30000, tasks: 30000
  });

  function fullDate(value) {
    if (!validDate(value)) return "";
    const y=Number(value.slice(0,4)),m=Number(value.slice(5,7)),d=Number(value.slice(8,10));
    const dt=new Date(Date.UTC(y,m-1,d));
    return dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d ? value : "";
  }
  function validClock(value) {
    return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
  }
  function restampMatchingStateTokens(records, previousToken, nextToken) {
    let changed=0;
    (Array.isArray(records)?records:[]).forEach(record=>{
      if(!record||typeof record!=="object")return;
      if(record.tripStateToken===previousToken){record.tripStateToken=nextToken;changed++;}
    });
    return changed;
  }

  function repairTripGraphIds(rawTrips, idFactory) {
    if (!Array.isArray(rawTrips) || typeof idFactory !== "function") return {changed:false,repairs:0,linkRepairs:0};
    const seen={trip:new Set(),day:new Set(),activity:new Set(),stay:new Set(),journey:new Set(),expense:new Set(),document:new Set(),task:new Set()};
    const reserved=Object.fromEntries(Object.keys(seen).map(kind=>[kind,new Set()]));
    const reserve=(row,kind,key="id")=>{const id=clean(row&&row[key]);if(id)reserved[kind].add(id);};
    rawTrips.forEach(trip=>{
      reserve(trip,"trip");
      (Array.isArray(trip&&trip.days)?trip.days:[]).forEach(day=>{reserve(day,"day");(Array.isArray(day&&day.items)?day.items:[]).forEach(item=>reserve(item,"activity","uid"));});
      [["stays","stay"],["journeys","journey"],["expenses","expense"],["documents","document"],["tasks","task"]].forEach(([key,kind])=>(Array.isArray(trip&&trip[key])?trip[key]:[]).forEach(row=>reserve(row,kind)));
    });
    let changed=false, repairs=0, linkRepairs=0;
    const nextId=(kind)=>{
      for(let i=0;i<1000;i++){
        const candidate=clean(idFactory(kind));
        if(candidate&&!seen[kind].has(candidate)&&!reserved[kind].has(candidate)){seen[kind].add(candidate);return candidate;}
      }
      throw new Error("TripMaster repairTripGraphIds: could not allocate unique "+kind+" id");
    };
    const countsForTrip=(trip)=>{
      const counts={trip:new Map(),activity:new Map(),stay:new Map(),journey:new Map()};
      const count=(kind,id)=>{const v=clean(id);if(v)counts[kind].set(v,(counts[kind].get(v)||0)+1);};
      count("trip",trip&&trip.id);
      (Array.isArray(trip&&trip.days)?trip.days:[]).forEach(day=>{
        (Array.isArray(day&&day.items)?day.items:[]).forEach(item=>count("activity",item&&item.uid));
      });
      (Array.isArray(trip&&trip.stays)?trip.stays:[]).forEach(row=>count("stay",row&&row.id));
      (Array.isArray(trip&&trip.journeys)?trip.journeys:[]).forEach(row=>count("journey",row&&row.id));
      return counts;
    };
    const ensure=(row,kind,key,onChanged)=>{
      if(!row||typeof row!=="object"||Array.isArray(row))return;
      const current=clean(row[key]);
      if(!current||seen[kind].has(current)){
        const replacement=nextId(kind);
        row[key]=replacement;changed=true;repairs++;
        if(current&&typeof onChanged==="function")onChanged(current,replacement);
        return;
      }
      if(row[key]!==current){row[key]=current;changed=true;}
      seen[kind].add(current);
    };
    rawTrips.forEach(trip=>{
      if(!trip||typeof trip!=="object")return;
      // LINK-REPAIR-001: IDs are globally unique, but links resolve within a
      // trip. If an ID changes only because the same historical ID existed in
      // ANOTHER trip, the old target is unambiguous inside this trip and its
      // own links can safely follow the new ID. If the same old ID occurs more
      // than once inside this trip, do not guess which duplicate a link meant.
      const localCounts=countsForTrip(trip), localRemap=new Map();
      const remember=(kind,oldId,newId)=>{
        if(oldId&&newId&&oldId!==newId&&localCounts[kind]&&localCounts[kind].get(oldId)===1){
          localRemap.set(kind+"|"+oldId,newId);
        }
      };
      ensure(trip,"trip","id",(oldId,newId)=>remember("trip",oldId,newId));
      (Array.isArray(trip.days)?trip.days:[]).forEach(day=>{
        ensure(day,"day","id");
        (Array.isArray(day&&day.items)?day.items:[]).forEach(item=>ensure(item,"activity","uid",(oldId,newId)=>remember("activity",oldId,newId)));
      });
      [["stays","stay"],["journeys","journey"],["expenses","expense"],["documents","document"],["tasks","task"]].forEach(([key,kind])=>{
        (Array.isArray(trip[key])?trip[key]:[]).forEach(row=>ensure(row,kind,"id",(oldId,newId)=>{
          if(kind==="stay"||kind==="journey")remember(kind,oldId,newId);
        }));
      });
      ["expenses","documents"].forEach(key=>{
        (Array.isArray(trip[key])?trip[key]:[]).forEach(row=>{
          if(!row||typeof row!=="object")return;
          const type=clean(row.linkedType), oldId=clean(row.linkedId);
          const replacement=localRemap.get(type+"|"+oldId);
          if(replacement&&replacement!==oldId){row.linkedId=replacement;changed=true;linkRepairs++;}
        });
      });
    });
    return {changed,repairs,linkRepairs};
  }

  function auditTripGraph(rawTrips, activeTripId) {
    const errors=[], warnings=[];
    const counts={trips:0,days:0,activities:0,stays:0,journeys:0,expenses:0,documents:0,tasks:0};
    const seen={trip:new Set(),day:new Set(),activity:new Set(),stay:new Set(),journey:new Set(),expense:new Set(),document:new Set(),task:new Set()};
    const add=(bucket,code)=>{ if(!bucket.includes(code)) bucket.push(code); };
    const idCheck=(kind,id)=>{
      const v=clean(id);
      if(!v){add(warnings,"missing_"+kind+"_id");return;}
      if(seen[kind].has(v)) add(errors,"duplicate_"+kind+"_id");
      else seen[kind].add(v);
    };
    if(!Array.isArray(rawTrips)) return {status:"error",errors:["trips_not_array"],warnings,counts};
    counts.trips=rawTrips.length;
    rawTrips.forEach(trip=>{
      if(!trip||typeof trip!=="object"||Array.isArray(trip)){add(errors,"trip_not_object");return;}
      idCheck("trip",trip.id);
      const days=Array.isArray(trip.days)?trip.days:null;
      if(!days){add(errors,"days_not_array");return;}
      counts.days+=days.length;
      const dates=new Set();
      days.forEach(day=>{
        if(!day||typeof day!=="object"||Array.isArray(day)){add(errors,"day_not_object");return;}
        idCheck("day",day.id);
        if(day.date){ if(!fullDate(day.date)) add(warnings,"invalid_day_date"); else if(dates.has(day.date)) add(warnings,"duplicate_day_date"); else dates.add(day.date); }
        const items=Array.isArray(day.items)?day.items:null;
        if(!items){add(errors,"items_not_array");return;}
        counts.activities+=items.length;
        items.forEach(item=>{
          if(!item||typeof item!=="object"||Array.isArray(item)){add(errors,"activity_not_object");return;}
          idCheck("activity",item.uid);
          if(item.time && !validClock(item.time)) add(warnings,"invalid_activity_time");
          if(item.endTime && !validClock(item.endTime)) add(warnings,"invalid_activity_end_time");
        });
        const arrival=day.travelDay&&typeof day.travelDay==="object"?day.travelDay.arrivalDate:"";
        if(arrival && !fullDate(arrival)) add(warnings,"invalid_travel_arrival_date");
        if(arrival && fullDate(arrival) && fullDate(day.date) && arrival<day.date) add(warnings,"travel_arrival_before_day");
      });
      [["stays","stay"],["journeys","journey"],["expenses","expense"],["documents","document"],["tasks","task"]].forEach(([key,kind])=>{
        const rows=trip[key]==null?[]:trip[key];
        if(!Array.isArray(rows)){add(errors,key+"_not_array");return;}
        counts[key]+=rows.length;
        rows.forEach(row=>{
          if(!row||typeof row!=="object"||Array.isArray(row)){add(errors,kind+"_not_object");return;}
          idCheck(kind,row.id);
          if(kind==="stay"){
            if(row.startDate && !fullDate(row.startDate)) add(warnings,"invalid_stay_start_date");
            if(row.endDate && !fullDate(row.endDate)) add(warnings,"invalid_stay_end_date");
            if(fullDate(row.startDate) && fullDate(row.endDate) && row.endDate<=row.startDate) add(warnings,"invalid_stay_date_range");
            if(row.checkInTime && !validClock(row.checkInTime)) add(warnings,"invalid_stay_checkin_time");
            if(row.checkOutTime && !validClock(row.checkOutTime)) add(warnings,"invalid_stay_checkout_time");
          }
          if(kind==="journey"){
            const depDate=fullDate(row.date),arrDate=fullDate(row.arrivalDate);
            if(row.date && !depDate) add(warnings,"invalid_journey_date");
            if(row.arrivalDate && !arrDate) add(warnings,"invalid_journey_arrival_date");
            if(depDate && arrDate && arrDate<depDate) add(warnings,"journey_arrival_before_departure_date");
            if(row.departureTime && !validClock(row.departureTime)) add(warnings,"invalid_journey_departure_time");
            if(row.arrivalTime && !validClock(row.arrivalTime)) add(warnings,"invalid_journey_arrival_time");
            if(depDate && validClock(row.departureTime) && validClock(row.arrivalTime) && (!arrDate || arrDate===depDate) && row.arrivalTime<row.departureTime) add(warnings,"journey_arrival_before_departure_time");
          }
          if(kind==="task" && row.date && !fullDate(row.date)) add(warnings,"invalid_task_date");
        });
      });
    });
    rawTrips.forEach(trip=>{
      if(!trip||typeof trip!=="object")return;
      // Links resolve inside their owning trip. A matching ID in some other
      // trip must never hide an orphan created by migration/import repair.
      const linkedTargets=new Set();
      const tripId=clean(trip.id);if(tripId)linkedTargets.add("trip|"+tripId);
      (Array.isArray(trip.days)?trip.days:[]).forEach(day=>{
        (Array.isArray(day&&day.items)?day.items:[]).forEach(item=>{const id=clean(item&&item.uid);if(id)linkedTargets.add("activity|"+id);});
      });
      (Array.isArray(trip.stays)?trip.stays:[]).forEach(row=>{const id=clean(row&&row.id);if(id)linkedTargets.add("stay|"+id);});
      (Array.isArray(trip.journeys)?trip.journeys:[]).forEach(row=>{const id=clean(row&&row.id);if(id)linkedTargets.add("journey|"+id);});
      ["expenses","documents"].forEach(key=>{
        (Array.isArray(trip[key])?trip[key]:[]).forEach(row=>{
          if(!row||typeof row!=="object")return;
          const type=clean(row.linkedType),id=clean(row.linkedId);
          if(!type&&!id)return;
          if(!type||!id){add(warnings,"partial_link_reference");return;}
          if(!["trip","stay","journey","activity"].includes(type)){add(warnings,"unknown_link_type");return;}
          if(!linkedTargets.has(type+"|"+id)) add(warnings,"orphan_link_reference");
        });
      });
    });
    const active=clean(activeTripId);
    if(active){
      const trip=rawTrips.find(x=>x&&typeof x==="object"&&clean(x.id)===active);
      if(!trip)add(errors,"active_trip_missing");
      else if(trip.archived===true)add(warnings,"active_trip_archived");
    }
    const status=errors.length?"error":warnings.length?"warning":"ok";
    return {status,errors,warnings,counts};
  }

  function backupPayloadReport(payload) {
    const errors=[], warnings=[];
    const add=(bucket,code)=>{if(!bucket.includes(code))bucket.push(code);};
    const counts={trips:0,days:0,activities:0,stays:0,journeys:0,expenses:0,documents:0,tasks:0};
    if(!payload||typeof payload!=="object"||Array.isArray(payload)) return {valid:false,errors:["backup_not_object"],warnings,counts};
    if(payload.app!=null&&payload.app!=="TripMaster") add(errors,"backup_wrong_app");
    if(payload.backupVersion!=null&&(!Number.isFinite(Number(payload.backupVersion))||Number(payload.backupVersion)>2)) add(errors,"backup_version_unsupported");
    if(payload.settings==null) add(warnings,"backup_settings_missing_legacy");
    else if(typeof payload.settings!=="object"||Array.isArray(payload.settings)) add(errors,"backup_settings_invalid");
    if(Object.prototype.hasOwnProperty.call(payload,"trips")&&!Array.isArray(payload.trips))add(errors,"backup_trips_invalid");
    if(payload.activeTripId!=null&&typeof payload.activeTripId!=="string")add(errors,"backup_active_invalid");
    for(const key of ["homeDays","days"]){
      if(Object.prototype.hasOwnProperty.call(payload,key)&&!portableTripShapeValid({days:payload[key]}))add(errors,"backup_"+key+"_invalid");
    }
    const trips=Array.isArray(payload.trips)?payload.trips:null;
    if(trips){
      counts.trips=trips.length;
      if(trips.length>BACKUP_LIMITS.trips)add(errors,"backup_too_many_trips");
      trips.forEach(trip=>{
        if(!portableTripShapeValid(trip)){add(errors,"backup_trip_shape_invalid");return;}
        counts.days+=trip.days.length;
        trip.days.forEach(day=>{counts.activities+=Array.isArray(day.items)?day.items.length:0;});
        ["stays","journeys","expenses","documents","tasks"].forEach(key=>{counts[key]+=Array.isArray(trip[key])?trip[key].length:0;});
      });
    } else if(Array.isArray(payload.days)) {
      const synthetic={days:payload.days};
      if(!portableTripShapeValid(synthetic))add(errors,"backup_legacy_shape_invalid");
      counts.trips=payload.days.length?1:0;counts.days=payload.days.length;
      payload.days.forEach(day=>{counts.activities+=day&&Array.isArray(day.items)?day.items.length:0;});
      add(warnings,"backup_legacy_format");
    } else add(errors,"backup_trip_data_missing");
    Object.keys(counts).forEach(key=>{const limit=BACKUP_LIMITS[key];if(limit!=null&&counts[key]>limit)add(errors,"backup_too_many_"+key);});
    if(trips){
      const graph=auditTripGraph(trips,payload.activeTripId||"");
      // Duplicate stable IDs are a known legacy condition produced by older
      // TripMaster builds. They are repairable during Restore, so validation
      // must warn rather than reject an otherwise structurally valid backup.
      (graph.errors||[]).filter(code=>String(code).startsWith("duplicate_")).forEach(code=>add(warnings,code));
    }
    return {valid:errors.length===0,errors,warnings,counts};
  }

  root.TripMasterOperations = Object.freeze({ taskInfo, tripTasks, taskStats, taskDueState, sortedTasks, isArchivedTrip, normalizeSearch, matchesText, portableTripEnvelope, portableTripShapeValid, tripFromPortableEnvelope, cloneTripGraph, restampMatchingStateTokens, repairTripGraphIds, auditTripGraph, backupPayloadReport, PORTABLE_LIMITS, BACKUP_LIMITS });
})(typeof window !== "undefined" ? window : globalThis);
