/* TripMaster deterministic day intelligence.
   Pure/local only: no routing, venue, distance or accessibility claims. */
(function (root) {
  "use strict";
  const MODES = Object.freeze(["walk", "public", "taxi", "train", "other", "none"]);
  function parseTime(value) {
    if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) return null;
    const h = Number(value.slice(0, 2)), m = Number(value.slice(3, 5));
    if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
    return h * 60 + m;
  }
  function travelFromPrevious(item) {
    const raw = item && item.travelFromPrevious;
    if (!raw || typeof raw !== "object") return { known: false, mode: "", durationMin: null, note: "" };
    const mode = MODES.indexOf(raw.mode) !== -1 ? raw.mode : "";
    /* TRAVEL-COERCE-001 (v1050-RC2) - CONFIRMED defect, fixed.
       Number.isFinite(Number(x)) accepts null, "", "   ", false and [],
       every one of which coerces to 0. A stored durationMin of null - the
       natural encoding of "explicitly unknown", and what a hand-edited or
       third-party backup is most likely to contain - was therefore read as
       a KNOWN travel time of zero minutes. The schedule check then reported
       "enough time for the transfer" for a transfer it knew nothing about,
       which is exactly the fabricated conclusion this release forbids.
       Only a real finite number, or a string that is entirely a number,
       counts as a known duration now. Everything else stays unknown. */
    let durationMin = null;
    const rawDur = raw.durationMin;
    if (typeof rawDur === "number" && Number.isFinite(rawDur)) durationMin = Math.round(rawDur);
    else if (typeof rawDur === "string" && rawDur.trim() !== "" && Number.isFinite(Number(rawDur))) {
      durationMin = Math.round(Number(rawDur));
    }
    if (durationMin !== null && (durationMin < 0 || durationMin > 1440)) durationMin = null;
    if (mode === "none" && durationMin === null) durationMin = 0;
    const note = typeof raw.note === "string" ? raw.note.trim() : "";
    const known = mode === "none" || durationMin !== null || !!note || !!mode;
    /* optedIn: the user deliberately said something about this transfer.
       unresolved: they started tracking it and the duration is still open.
       mode "none" carries its own answer (0) and is never unresolved. */
    return {
      known,
      optedIn: known,
      unresolved: known && mode !== "none" && durationMin === null,
      mode, durationMin, note
    };
  }
  function analyzeDay(items) {
    const source = Array.isArray(items) ? items : [];
    const entries = source.map((item, originalIndex) => {
      const startRaw = item && typeof item.time === "string" ? item.time : "";
      const endRaw = item && typeof item.endTime === "string" ? item.endTime : "";
      const start = parseTime(startRaw);
      const parsedEnd = endRaw ? parseTime(endRaw) : null;
      const endNextDay = !!(item && item.endNextDay === true);
      const end = parsedEnd !== null && endNextDay ? parsedEnd + 1440 : parsedEnd;
      const malformedStart = !!startRaw && start === null;
      const malformedEnd = !!endRaw && parsedEnd === null;
      const invalidRange = start !== null && end !== null && end <= start;
      return { item, originalIndex, startRaw, endRaw, start, end, endNextDay, malformedStart, malformedEnd, invalidRange };
    });
    const chronological = entries.slice().sort((a, b) => {
      if (a.start === null && b.start === null) return a.originalIndex - b.originalIndex;
      if (a.start === null) return 1;
      if (b.start === null) return -1;
      return a.start - b.start || a.originalIndex - b.originalIndex;
    });
    const conflicts = [], pairs = [];
    let travelUnknown = 0;
    const intervals = chronological.filter(e => e.start !== null && e.end !== null && !e.invalidRange);
    for (let i = 0; i < intervals.length; i++) {
      for (let j = i + 1; j < intervals.length; j++) {
        const a = intervals[i], b = intervals[j];
        if (b.start >= a.end) break;
        const overlapMin = Math.min(a.end, b.end) - b.start;
        if (overlapMin > 0) conflicts.push({ firstIndex: a.originalIndex, secondIndex: b.originalIndex, overlapMin });
      }
    }
    for (let i = 1; i < chronological.length; i++) {
      const prev = chronological[i - 1], next = chronological[i];
      if (prev.start === null || next.start === null) continue;
      const availableGapMin = prev.end !== null && !prev.invalidRange ? next.start - prev.end : null;
      const travel = travelFromPrevious(next.item);
      /* GRACEFUL-001 (v1050-RC2): "unresolved travel" now means the user
         STARTED tracking this transfer (a mode or a note is present) and the
         duration is still missing. RC1 counted every consecutive pair with no
         duration, so a perfectly normal day where the traveller simply never
         used the travel fields reported an unresolved segment per activity.
         travel.known is false only when the object is entirely empty, which
         is exactly the "user did not choose to track this" case. */
      if (travel.known && travel.durationMin === null) travelUnknown++;
      let status = "unknown", bufferMin = null;
      if (availableGapMin === null) status = travel.durationMin !== null ? "gap_unknown" : "unknown";
      else if (availableGapMin < 0) status = "overlap";
      else if (travel.durationMin === null) status = "unknown";
      else {
        bufferMin = availableGapMin - travel.durationMin;
        if (bufferMin < 0) status = "insufficient";
        else if (bufferMin < 15) status = "tight";
        else status = "enough";
      }
      pairs.push({ firstIndex: prev.originalIndex, secondIndex: next.originalIndex, availableGapMin, travel, status, bufferMin });
    }
    const validStarts = chronological.filter(e => e.start !== null);
    let spanMin = null;
    if (validStarts.length && validStarts.every(e => e.end !== null && !e.invalidRange)) {
      const first = validStarts[0].start;
      let last = first;
      validStarts.forEach(e => { last = Math.max(last, e.end); });
      spanMin = Math.max(0, last - first);
    }
    return {
      entries, chronological, pairs, conflicts, travelUnknown,
      /* Additive alias. `travelUnknown` kept its name so no call site had to
         change, but since GRACEFUL-001 its meaning is narrower than the name
         suggests: it counts only segments the user OPTED IN to tracking and
         left open. `travelUnresolved` is the accurate name and is what new
         code and the test suite read. Same number, no second source of
         truth. */
      travelUnresolved: travelUnknown, spanMin,
      malformedCount: entries.filter(e => e.malformedStart || e.malformedEnd).length,
      invalidRangeCount: entries.filter(e => e.invalidRange).length
    };
  }
  root.TripMasterIntelligence = Object.freeze({ parseTime, travelFromPrevious, analyzeDay, MODES });
})(typeof window !== "undefined" ? window : globalThis);
