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
  root.TripMasterOperations = Object.freeze({ taskInfo, tripTasks, taskStats, taskDueState, sortedTasks, isArchivedTrip, normalizeSearch, matchesText });
})(typeof window !== "undefined" ? window : globalThis);
