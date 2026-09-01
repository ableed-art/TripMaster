/* TripMaster v1060 - pure travel-day/model helpers.
   Local/deterministic only. No routing, availability or accessibility claims. */
(function (root) {
  "use strict";

  const DAY_TYPES = Object.freeze(["normal", "arrival", "departure", "transfer"]);
  const DAY_TRAVEL_MODES = Object.freeze(["flight", "train", "bus", "ferry", "public", "taxi", "other"]);

  function cleanString(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function validTime(value) {
    if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) return "";
    const h = Number(value.slice(0, 2)), m = Number(value.slice(3, 5));
    return Number.isInteger(h) && Number.isInteger(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59 ? value : "";
  }

  function dayType(day) {
    const value = day && day.dayType;
    return DAY_TYPES.indexOf(value) !== -1 ? value : "normal";
  }

  function travelDayInfo(day) {
    const raw = day && day.travelDay;
    const src = raw && typeof raw === "object" ? raw : {};
    const mode = DAY_TRAVEL_MODES.indexOf(src.mode) !== -1 ? src.mode : "";
    return {
      origin: cleanString(src.origin),
      destination: cleanString(src.destination),
      mode,
      reference: cleanString(src.reference),
      departureTime: validTime(src.departureTime),
      arrivalTime: validTime(src.arrivalTime)
    };
  }

  function baseFlow(day) {
    const raw = day && day.baseFlow;
    const src = raw && typeof raw === "object" ? raw : {};
    return { startsAtBase: src.startsAtBase === true, returnsToBase: src.returnsToBase === true };
  }

  function hasTravelDayDetails(day) {
    const info = travelDayInfo(day);
    return !!(info.origin || info.destination || info.mode || info.reference || info.departureTime || info.arrivalTime);
  }

  function countTravelDayDetails(day) {
    const info = travelDayInfo(day);
    return [info.origin, info.destination, info.mode, info.reference, info.departureTime, info.arrivalTime].filter(Boolean).length;
  }

  root.TripMasterTravel = Object.freeze({
    DAY_TYPES,
    DAY_TRAVEL_MODES,
    dayType,
    travelDayInfo,
    baseFlow,
    hasTravelDayDetails,
    countTravelDayDetails
  });
})(typeof window !== "undefined" ? window : globalThis);
