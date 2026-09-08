/* TripMaster v1070 - pure logistics/model helpers.
   User-entered data only. No live schedules, booking validation, routing or availability. */
(function (root) {
  "use strict";

  const BOOKING_STATUSES = Object.freeze(["planned", "booked", "confirmed", "cancelled"]);
  const JOURNEY_MODES = Object.freeze(["flight", "train", "bus", "ferry", "public", "taxi", "transfer", "walk", "other"]);

  function cleanString(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function validDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
    const y = Number(value.slice(0, 4)), m = Number(value.slice(5, 7)), d = Number(value.slice(8, 10));
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? value : "";
  }

  function validTime(value) {
    if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) return "";
    const h = Number(value.slice(0, 2)), m = Number(value.slice(3, 5));
    return Number.isInteger(h) && Number.isInteger(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59 ? value : "";
  }

  function bookingStatus(value) {
    return BOOKING_STATUSES.indexOf(value) !== -1 ? value : "";
  }

  function bookingInfo(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    return {
      status: bookingStatus(src.status),
      reference: cleanString(src.reference),
      provider: cleanString(src.provider),
      note: cleanString(src.note)
    };
  }

  function legacyBase(trip) {
    const raw = trip && trip.base;
    const src = raw && typeof raw === "object" ? raw : {};
    return {
      name: cleanString(src.name),
      location: cleanString(src.location),
      note: cleanString(src.note)
    };
  }

  function hasLegacyBase(trip) {
    const b = legacyBase(trip);
    return !!(b.name || b.location || b.note);
  }

  function stayInfo(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    return {
      id: cleanString(src.id),
      name: cleanString(src.name),
      location: cleanString(src.location),
      startDate: validDate(src.startDate),
      endDate: validDate(src.endDate),
      checkInTime: validTime(src.checkInTime),
      checkOutTime: validTime(src.checkOutTime),
      confirmation: cleanString(src.confirmation),
      provider: cleanString(src.provider),
      bookingUrl: cleanString(src.bookingUrl),
      note: cleanString(src.note),
      status: bookingStatus(src.status)
    };
  }

  function tripStays(trip) {
    return trip && Array.isArray(trip.stays)
      ? trip.stays.filter((x) => x && typeof x === "object")
      : [];
  }

  function staysTrackingActive(trip) {
    return tripStays(trip).length > 0;
  }

  function stayDateRangeValid(raw) {
    const s = stayInfo(raw);
    return !!(s.startDate && s.endDate && s.startDate < s.endDate);
  }

  function stayCoversDate(raw, date) {
    const s = stayInfo(raw), d = validDate(date);
    return !!(d && s.startDate && s.endDate && s.startDate <= d && d < s.endDate && s.status !== "cancelled");
  }

  function staysForDate(trip, date) {
    return tripStays(trip).filter((stay) => stayCoversDate(stay, date));
  }

  function effectiveStayForDate(trip, date) {
    const d = validDate(date);
    if (!d) return { kind: "unknown", stay: null, matches: [] };
    const stays = tripStays(trip);
    if (!stays.length) {
      const base = legacyBase(trip);
      return (base.name || base.location || base.note)
        ? { kind: "legacy", stay: base, matches: [] }
        : { kind: "none", stay: null, matches: [] };
    }
    const matches = stays.filter((stay) => stayCoversDate(stay, d));
    if (matches.length === 1) return { kind: "stay", stay: matches[0], matches };
    if (matches.length > 1) return { kind: "ambiguous", stay: null, matches };
    return { kind: "gap", stay: null, matches: [] };
  }

  function staysEndingOn(trip, date) {
    const d = validDate(date);
    if (!d) return [];
    return tripStays(trip).filter((raw) => {
      const s = stayInfo(raw);
      return s.endDate === d && s.status !== "cancelled";
    });
  }

  function staysStartingOn(trip, date) {
    const d = validDate(date);
    if (!d) return [];
    return tripStays(trip).filter((raw) => {
      const s = stayInfo(raw);
      return s.startDate === d && s.status !== "cancelled";
    });
  }

  function stayOverlaps(trip) {
    const stays = tripStays(trip)
      .map((raw) => ({ raw, info: stayInfo(raw) }))
      .filter((x) => x.info.startDate && x.info.endDate && x.info.startDate < x.info.endDate && x.info.status !== "cancelled")
      .sort((a, b) => a.info.startDate.localeCompare(b.info.startDate) || a.info.endDate.localeCompare(b.info.endDate));
    const out = [];
    for (let i = 0; i < stays.length; i++) {
      for (let j = i + 1; j < stays.length; j++) {
        const a = stays[i].info, b = stays[j].info;
        if (b.startDate >= a.endDate) break;
        if (a.startDate < b.endDate && b.startDate < a.endDate) out.push([stays[i].raw, stays[j].raw]);
      }
    }
    return out;
  }

  function uncoveredDates(trip, dates) {
    if (!staysTrackingActive(trip) || !Array.isArray(dates)) return [];
    return dates.map(validDate).filter(Boolean).filter((d) => effectiveStayForDate(trip, d).kind === "gap");
  }

  function journeyInfo(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    const mode = JOURNEY_MODES.indexOf(src.mode) !== -1 ? src.mode : "";
    return {
      id: cleanString(src.id),
      date: validDate(src.date),
      mode,
      origin: cleanString(src.origin),
      destination: cleanString(src.destination),
      departureTime: validTime(src.departureTime),
      arrivalTime: validTime(src.arrivalTime),
      arrivalDate: validDate(src.arrivalDate),
      provider: cleanString(src.provider),
      serviceNumber: cleanString(src.serviceNumber),
      confirmation: cleanString(src.confirmation),
      status: bookingStatus(src.status),
      note: cleanString(src.note)
    };
  }

  function tripJourneys(trip) {
    return trip && Array.isArray(trip.journeys)
      ? trip.journeys.filter((x) => x && typeof x === "object")
      : [];
  }

  function journeysForDate(trip, date) {
    const d = validDate(date);
    return d ? tripJourneys(trip).filter((raw) => journeyInfo(raw).date === d) : [];
  }

  function journeysTouchingDate(trip, date) {
    const d = validDate(date);
    if (!d) return [];
    return tripJourneys(trip).filter((raw) => {
      const info = journeyInfo(raw);
      if (!info.date) return false;
      const end = info.arrivalDate && info.arrivalDate >= info.date ? info.arrivalDate : info.date;
      return info.date <= d && d <= end;
    });
  }

  function nextStay(trip, fromDate) {
    const d = validDate(fromDate) || "0000-00-00";
    const rows = tripStays(trip)
      .map((raw) => ({ raw, info: stayInfo(raw) }))
      .filter((x) => x.info.startDate && x.info.endDate && x.info.endDate > d && x.info.status !== "cancelled")
      .sort((a, b) => a.info.startDate.localeCompare(b.info.startDate));
    if (!rows.length) return null;
    const current = rows.find((x) => x.info.startDate <= d && d < x.info.endDate);
    return (current || rows[0]).raw;
  }

  function nextJourney(trip, fromDate) {
    const d = validDate(fromDate) || "0000-00-00";
    const rows = tripJourneys(trip)
      .map((raw) => ({ raw, info: journeyInfo(raw) }))
      .filter((x) => x.info.date && x.info.date >= d && x.info.status !== "cancelled")
      .sort((a, b) => a.info.date.localeCompare(b.info.date) || a.info.departureTime.localeCompare(b.info.departureTime));
    return rows.length ? rows[0].raw : null;
  }

  root.TripMasterLogistics = Object.freeze({
    BOOKING_STATUSES,
    JOURNEY_MODES,
    cleanString,
    validDate,
    validTime,
    bookingStatus,
    bookingInfo,
    legacyBase,
    hasLegacyBase,
    stayInfo,
    tripStays,
    staysTrackingActive,
    stayDateRangeValid,
    stayCoversDate,
    staysForDate,
    effectiveStayForDate,
    staysEndingOn,
    staysStartingOn,
    stayOverlaps,
    uncoveredDates,
    journeyInfo,
    tripJourneys,
    journeysForDate,
    journeysTouchingDate,
    nextStay,
    nextJourney
  });
})(typeof window !== "undefined" ? window : globalThis);
