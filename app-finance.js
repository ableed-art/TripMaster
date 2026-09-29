/* TripMaster v1080 - pure finance, booking/document organization and context helpers.
   User-entered values only. No FX, booking validation, payments, partner activation or network calls. */
(function (root) {
  "use strict";

  const PAYMENT_STATUSES = Object.freeze(["unpaid", "partial", "paid", "later"]);
  const EXPENSE_CATEGORIES = Object.freeze(["accommodation", "transport", "food", "attraction", "shopping", "insurance", "connectivity", "other"]);
  const LINK_TYPES = Object.freeze(["stay", "journey", "activity", "trip"]);
  const DOCUMENT_TYPES = Object.freeze(["booking", "ticket", "voucher", "insurance", "transport", "other"]);
  const DOCUMENT_STATUSES = Object.freeze(["available", "needed"]);
  const PARTNER_CONTEXT_SLOTS = Object.freeze([
    "accommodation_needed", "activity_discovery", "esim_pretrip", "airport_transfer",
    "intercity_transport", "car_rental", "insurance", "luggage_storage"
  ]);

  function cleanString(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function validDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
    const y = Number(value.slice(0, 4)), m = Number(value.slice(5, 7)), d = Number(value.slice(8, 10));
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? value : "";
  }

  function validAmount(value) {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  function validPositiveAmount(value) {
    const n = validAmount(value);
    return n != null && n > 0 ? n : null;
  }

  function currencyCode(value) {
    const v = cleanString(value).toUpperCase();
    return /^[A-Z]{3}$/.test(v) ? v : "";
  }

  function paymentStatus(value) {
    return PAYMENT_STATUSES.indexOf(value) !== -1 ? value : "";
  }

  function expenseInfo(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    const category = EXPENSE_CATEGORIES.indexOf(src.category) !== -1 ? src.category : "other";
    const linkedType = LINK_TYPES.indexOf(src.linkedType) !== -1 ? src.linkedType : "";
    return {
      id: cleanString(src.id),
      title: cleanString(src.title),
      category,
      amount: validPositiveAmount(src.amount),
      currency: currencyCode(src.currency),
      date: validDate(src.date),
      paymentStatus: paymentStatus(src.paymentStatus),
      paidBy: cleanString(src.paidBy),
      linkedType,
      linkedId: linkedType ? cleanString(src.linkedId) : "",
      note: cleanString(src.note)
    };
  }

  function tripExpenses(trip) {
    return trip && Array.isArray(trip.expenses)
      ? trip.expenses.filter((x) => x && typeof x === "object")
      : [];
  }

  function expenseTrackingActive(trip) {
    return tripExpenses(trip).length > 0;
  }

  function budgetInfo(trip) {
    const src = trip && trip.budget && typeof trip.budget === "object" ? trip.budget : {};
    return { amount: validPositiveAmount(src.amount), currency: currencyCode(src.currency) };
  }

  function budgetTrackingActive(trip) {
    const b = budgetInfo(trip);
    return b.amount != null && !!b.currency;
  }

  function currencySettings(trip) {
    const src = trip && trip.currencySettings && typeof trip.currencySettings === "object" ? trip.currencySettings : {};
    return { primaryCurrency: currencyCode(src.primaryCurrency) };
  }

  function preferredCurrency(trip) {
    const b = budgetInfo(trip);
    if (b.currency) return b.currency;
    const c = currencySettings(trip);
    if (c.primaryCurrency) return c.primaryCurrency;
    const first = tripExpenses(trip).map(expenseInfo).find((x) => x.currency);
    return first ? first.currency : "";
  }

  function totalsByCurrency(trip) {
    const totals = Object.create(null);
    tripExpenses(trip).forEach((raw) => {
      const e = expenseInfo(raw);
      if (e.amount == null || !e.currency) return;
      totals[e.currency] = (totals[e.currency] || 0) + e.amount;
    });
    return Object.keys(totals).sort().map((currency) => ({ currency, amount: Math.round((totals[currency] + Number.EPSILON) * 100) / 100 }));
  }

  function budgetSummary(trip) {
    const budget = budgetInfo(trip);
    const totals = totalsByCurrency(trip);
    if (budget.amount == null || !budget.currency) {
      return { active: false, budget, totals, comparableSpent: null, remaining: null, exceeded: false, otherTotals: totals };
    }
    const same = totals.find((x) => x.currency === budget.currency);
    const spent = same ? same.amount : 0;
    const remaining = Math.round((budget.amount - spent + Number.EPSILON) * 100) / 100;
    return {
      active: true,
      budget,
      totals,
      comparableSpent: spent,
      remaining,
      exceeded: remaining < 0,
      otherTotals: totals.filter((x) => x.currency !== budget.currency)
    };
  }

  function documentInfo(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    const type = DOCUMENT_TYPES.indexOf(src.type) !== -1 ? src.type : "other";
    const status = DOCUMENT_STATUSES.indexOf(src.status) !== -1 ? src.status : "";
    const linkedType = LINK_TYPES.indexOf(src.linkedType) !== -1 ? src.linkedType : "";
    return {
      id: cleanString(src.id),
      label: cleanString(src.label),
      type,
      status,
      reference: cleanString(src.reference),
      url: cleanString(src.url),
      note: cleanString(src.note),
      linkedType,
      linkedId: linkedType ? cleanString(src.linkedId) : ""
    };
  }

  function tripDocuments(trip) {
    return trip && Array.isArray(trip.documents)
      ? trip.documents.filter((x) => x && typeof x === "object")
      : [];
  }

  function documentsTrackingActive(trip) {
    return tripDocuments(trip).length > 0;
  }

  function activityRows(trip) {
    const rows = [];
    const days = trip && Array.isArray(trip.days) ? trip.days : [];
    days.forEach((day, dayIndex) => {
      const items = day && Array.isArray(day.items) ? day.items : [];
      items.forEach((item, itemIndex) => {
        if (!item || typeof item !== "object") return;
        rows.push({ day, dayIndex, item, itemIndex });
      });
    });
    return rows;
  }

  function bookingEntries(trip, logistics) {
    const rows = [];
    const L = logistics || root.TripMasterLogistics;
    const staySource = Array.isArray(trip && trip.stays) ? trip.stays : [];
    const stays = L && typeof L.tripStays === "function" ? L.tripStays(trip) : staySource.filter((x) => x && typeof x === "object");
    stays.forEach((raw) => {
      const sourceIndex = staySource.indexOf(raw);
      const info = L && L.stayInfo ? L.stayInfo(raw) : (raw && typeof raw === "object" ? raw : {});
      const pay = paymentStatus(raw && raw.paymentStatus);
      if (!(info.status || pay || info.confirmation || info.provider || info.bookingUrl)) return;
      rows.push({
        kind: "stay", source: raw, sourceIndex, id: cleanString(raw.id),
        title: info.name || info.location || "", date: info.startDate || "",
        bookingStatus: info.status || "", paymentStatus: pay,
        reference: info.confirmation || "", provider: info.provider || "", url: info.bookingUrl || ""
      });
    });
    const journeySource = Array.isArray(trip && trip.journeys) ? trip.journeys : [];
    const journeys = L && typeof L.tripJourneys === "function" ? L.tripJourneys(trip) : journeySource.filter((x) => x && typeof x === "object");
    journeys.forEach((raw) => {
      const sourceIndex = journeySource.indexOf(raw);
      const info = L && L.journeyInfo ? L.journeyInfo(raw) : (raw && typeof raw === "object" ? raw : {});
      const pay = paymentStatus(raw && raw.paymentStatus);
      if (!(info.status || pay || info.confirmation || info.provider)) return;
      rows.push({
        kind: "journey", source: raw, sourceIndex, id: cleanString(raw.id),
        title: [info.origin, info.destination].filter(Boolean).join(" → "), date: info.date || "",
        bookingStatus: info.status || "", paymentStatus: pay,
        reference: info.confirmation || "", provider: info.provider || "", url: ""
      });
    });
    activityRows(trip).forEach((row) => {
      const booking = row.item.booking && typeof row.item.booking === "object" ? row.item.booking : {};
      const status = L && L.bookingInfo ? L.bookingInfo(booking).status : cleanString(booking.status);
      const pay = paymentStatus(booking.paymentStatus);
      const reference = cleanString(booking.reference), provider = cleanString(booking.provider);
      if (!(status || pay || reference || provider || cleanString(booking.note))) return;
      rows.push({
        kind: "activity", source: row.item, dayIndex: row.dayIndex, itemIndex: row.itemIndex,
        id: cleanString(row.item.uid), title: cleanString(row.item.title), date: validDate(row.day && row.day.date),
        bookingStatus: status, paymentStatus: pay, reference, provider, url: ""
      });
    });
    return rows;
  }

  function bookingAttentionEntries(trip, logistics) {
    return bookingEntries(trip, logistics).filter(bookingEntryNeedsAttention);
  }
  function bookingEntryNeedsAttention(row) {
    if (!row || row.bookingStatus === "cancelled") return false;
    if (row.bookingStatus === "planned") return true;
    return row.paymentStatus === "unpaid" || row.paymentStatus === "partial";
  }

  function expensePaymentAttention(trip) {
    return tripExpenses(trip).map(expenseInfo).filter((e) => e.paymentStatus === "unpaid" || e.paymentStatus === "partial");
  }

  function expenseCategoryTotals(trip, currency) {
    const code = currencyCode(currency);
    if (!code) return [];
    const totals = Object.create(null);
    tripExpenses(trip).map(expenseInfo).forEach((e) => {
      if (e.currency !== code || e.amount == null) return;
      totals[e.category] = (totals[e.category] || 0) + e.amount;
    });
    return Object.keys(totals).map((category) => ({
      category, amount: Math.round((totals[category] + Number.EPSILON) * 100) / 100
    })).sort((a,b) => b.amount - a.amount);
  }


  function derivedConfirmationDocuments(trip, logistics) {
    return bookingEntries(trip, logistics)
      .filter((row) => row.reference || row.url)
      .map((row) => ({
        derived: true,
        kind: row.kind,
        id: row.id,
        sourceIndex: row.sourceIndex,
        dayIndex: row.dayIndex,
        itemIndex: row.itemIndex,
        label: row.title,
        date: row.date,
        reference: row.reference,
        url: row.url,
        type: row.kind === "journey" ? "transport" : "booking"
      }));
  }

  function documentNeedsAttention(trip) {
    return tripDocuments(trip).map(documentInfo).filter((d) => d.status === "needed");
  }

  function resolveLinkedEntity(trip, linkedType, linkedId, logistics) {
    const type = LINK_TYPES.indexOf(linkedType) !== -1 ? linkedType : "";
    const id = cleanString(linkedId);
    if (!type || !id) return { state: "none", entity: null };
    if (type === "trip") {
      const entity = trip && cleanString(trip.id) === id ? trip : null;
      return { state: entity ? "resolved" : "missing", entity };
    }
    const L = logistics || root.TripMasterLogistics;
    if (type === "stay") {
      const list = L && L.tripStays ? L.tripStays(trip) : (trip && Array.isArray(trip.stays) ? trip.stays : []);
      const entity = list.find((x) => cleanString(x && x.id) === id) || null;
      return { state: entity ? "resolved" : "missing", entity };
    }
    if (type === "journey") {
      const list = L && L.tripJourneys ? L.tripJourneys(trip) : (trip && Array.isArray(trip.journeys) ? trip.journeys : []);
      const entity = list.find((x) => cleanString(x && x.id) === id) || null;
      return { state: entity ? "resolved" : "missing", entity };
    }
    if (type === "activity") {
      const row = activityRows(trip).find((x) => cleanString(x.item && x.item.uid) === id) || null;
      return { state: row ? "resolved" : "missing", entity: row ? row.item : null, row };
    }
    return { state: "missing", entity: null };
  }

  function inferredStayContextFromActivities(trip) {
    if (!trip || !Array.isArray(trip.days)) return [];
    const candidates = [];
    const patterns = [
      /(מלון\s+.+)$/i,
      /(فندق\s+.+)$/i,
      /(отель\s+.+)$/i,
      /(гостиница\s+.+)$/i,
      /\b(hotel\s+.+)$/i,
      /\b(hostel\s+.+)$/i,
      /\b(resort\s+.+)$/i,
      /\b(hostal\s+.+)$/i,
      /\b(pousada\s+.+)$/i
    ];
    trip.days.forEach((day, dayIndex) => {
      const date = validDate(day && day.date);
      (day && Array.isArray(day.items) ? day.items : []).forEach((item, itemIndex) => {
        const title = cleanString(item && item.title);
        if (!title) return;
        let name = "";
        for (const re of patterns) {
          const m = title.match(re);
          if (m && m[1]) { name = cleanString(m[1]); break; }
        }
        if (!name) return;
        candidates.push({
          key: name.toLocaleLowerCase(),
          name: name.slice(0, 240),
          location: cleanString(item && item.location) || cleanString(trip.destination),
          date,
          id: cleanString(item && item.uid) || `d${dayIndex}-i${itemIndex}`
        });
      });
    });
    const unique = [];
    const seen = new Set();
    candidates.forEach((row) => {
      if (!row.key || seen.has(row.key)) return;
      seen.add(row.key);
      unique.push(row);
    });
    // Only infer when the itinerary points to one unambiguous lodging.
    if (unique.length !== 1) return [];
    const row = unique[0];
    const tripDates = trip.days.map((d) => validDate(d && d.date)).filter(Boolean).sort();
    const lastDate = tripDates.length ? tripDates[tripDates.length - 1] : "";
    return [{
      id: `inferred-stay-${row.id}`.slice(0, 160),
      name: row.name,
      location: row.location,
      startDate: row.date || "",
      endDate: (row.date && lastDate && lastDate >= row.date) ? lastDate : "",
      checkInTime: "",
      checkOutTime: "",
      status: "",
      paymentStatus: ""
    }];
  }

  function buildTripContext(trip, options) {
    const opts = options && typeof options === "object" ? options : {};
    const includeSensitive = opts.includeSensitive === true;
    const includeActivityAccess = opts.includeActivityAccess !== false;
    const L = root.TripMasterLogistics;
    const T = root.TripMasterTravel;
    const D = root.TripMasterIntelligence;
    const days = trip && Array.isArray(trip.days) ? trip.days : [];
    const rawStays = (L && L.tripStays ? L.tripStays(trip) : []);
    const mappedStays = rawStays.map((raw) => {
      const s = L.stayInfo(raw);
      return { id:s.id, name:s.name, location:s.location, startDate:s.startDate, endDate:s.endDate, checkInTime:s.checkInTime, checkOutTime:s.checkOutTime, status:s.status, paymentStatus:paymentStatus(raw.paymentStatus) };
    });
    const out = {
      schema: "tripmaster-context-v1",
      trip: {
        id: cleanString(trip && trip.id),
        name: cleanString(trip && trip.name),
        destination: cleanString(trip && trip.destination),
        timezone: cleanString(trip && trip.timezone),
        base: trip && trip.base && typeof trip.base === "object" ? {
          name: cleanString(trip.base.name), location: cleanString(trip.base.location)
        } : null
      },
      days: days.map((day) => {
        const travelDay = T && T.hasTravelDayDetails && T.hasTravelDayDetails(day) ? T.travelDayInfo(day) : null;
        return {
          id: cleanString(day && day.id),
          date: validDate(day && day.date),
          dayType: cleanString(day && day.dayType) || "normal",
          activities: (day && Array.isArray(day.items) ? day.items : []).filter(Boolean).map((item) => {
            const tr = D && D.travelFromPrevious ? D.travelFromPrevious(item) : null;
            return {
              id: cleanString(item.uid), title: cleanString(item.title), time: cleanString(item.time), endTime: cleanString(item.endTime),
              location: cleanString(item.location), category: cleanString(item.category),
              ...(includeActivityAccess ? { accessStatus: cleanString(item.accessStatus) } : {}),
              bookingStatus: cleanString(item.booking && item.booking.status),
              paymentStatus: paymentStatus(item.booking && item.booking.paymentStatus),
              travelFromPrevious: tr && tr.known ? {
                mode: cleanString(tr.mode), durationMin: tr.durationMin, unresolved: tr.unresolved === true
              } : null
            };
          }),
          // Reference is intentionally excluded: the backend contract treats
          // booking/service references as sensitive by default.
          travelDay: travelDay ? {
            origin: cleanString(travelDay.origin), destination: cleanString(travelDay.destination), mode: cleanString(travelDay.mode),
            departureTime: cleanString(travelDay.departureTime), arrivalTime: cleanString(travelDay.arrivalTime), arrivalDate: cleanString(travelDay.arrivalDate)
          } : null
        };
      }),
      // If no formal Stay exists, expose one itinerary-inferred lodging to
      // the AI context only. This never writes or mutates trip data.
      stays: mappedStays.length ? mappedStays : inferredStayContextFromActivities(trip),
      journeys: (L && L.tripJourneys ? L.tripJourneys(trip) : []).map((raw) => {
        const j = L.journeyInfo(raw);
        return { id:j.id, date:j.date, arrivalDate:j.arrivalDate, mode:j.mode, origin:j.origin, destination:j.destination, departureTime:j.departureTime, arrivalTime:j.arrivalTime, provider:j.provider, serviceNumber:j.serviceNumber, status:j.status, paymentStatus:paymentStatus(raw.paymentStatus) };
      }),
      money: {
        budget: budgetInfo(trip),
        totals: totalsByCurrency(trip),
        // RC4-FIX1-PRIVACY-001: itemized expenses are not part of the default
        // AI projection. Aggregate budget/totals remain useful without sending
        // unrelated transaction-level detail on every question.
        expenses: (includeSensitive || opts.includeExpenseDetails === true) ? tripExpenses(trip).map((raw) => {
          const e = expenseInfo(raw);
          return { id:e.id, title:e.title, category:e.category, amount:e.amount, currency:e.currency, date:e.date, paymentStatus:e.paymentStatus };
        }) : []
      },
      bookingAttentionCount: bookingAttentionEntries(trip, L).length,
      documentAttentionCount: documentNeedsAttention(trip).length
    };
    if (includeSensitive) {
      out.documents = tripDocuments(trip).map(documentInfo);
      out.confirmations = bookingEntries(trip, L).map((row) => ({ kind:row.kind, title:row.title, reference:row.reference, provider:row.provider, url:row.url }));
    }
    return out;
  }

  /* Inactive commercial foundation. No UI consumes this in v1080 and no
     partner, URL, price or ad can be returned from it. */
  function partnerOpportunityContext(trip) {
    return Object.freeze({ version: 1, allowedSlots: PARTNER_CONTEXT_SLOTS.slice(), active: false });
  }

  root.TripMasterFinance = Object.freeze({
    PAYMENT_STATUSES,
    EXPENSE_CATEGORIES,
    LINK_TYPES,
    DOCUMENT_TYPES,
    DOCUMENT_STATUSES,
    PARTNER_CONTEXT_SLOTS,
    cleanString,
    validDate,
    validAmount,
    validPositiveAmount,
    currencyCode,
    paymentStatus,
    expenseInfo,
    tripExpenses,
    expenseTrackingActive,
    budgetInfo,
    budgetTrackingActive,
    currencySettings,
    preferredCurrency,
    totalsByCurrency,
    budgetSummary,
    documentInfo,
    tripDocuments,
    documentsTrackingActive,
    activityRows,
    bookingEntries,
    bookingEntryNeedsAttention,
    bookingAttentionEntries,
    expensePaymentAttention,
    expenseCategoryTotals,
    derivedConfirmationDocuments,
    documentNeedsAttention,
    resolveLinkedEntity,
    buildTripContext,
    partnerOpportunityContext
  });
})(typeof window !== "undefined" ? window : globalThis);
