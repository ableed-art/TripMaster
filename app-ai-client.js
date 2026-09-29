/* TripMaster AI Client Foundation v2
   Client-side contracts only. No provider calls, no server orchestration and no
   autonomous actions live here. The current v1 Planner transport remains in
   app.js until the production AI V2 backend is deliberately enabled. */
(function (root) {
  "use strict";

  const CONTRACT_VERSION = 2;
  const REQUEST_SCHEMA = "tripmaster-ai-request-v2";
  const CONTEXT_SCHEMA = "tripmaster-context-v2";
  const EVENT_SCHEMA = "tripmaster-trip-event-v2";
  const TRUTH_LAYERS = Object.freeze({
    STORED_TRIP_FACT: "STORED_TRIP_FACT",
    PUBLIC_RESEARCHED_FACT: "PUBLIC_RESEARCHED_FACT",
    VERIFIED_OPERATIONAL: "VERIFIED_OPERATIONAL"
  });
  const CLIENT_CAPABILITIES = Object.freeze([
    "stable_entity_ids",
    "privacy_scoped_context",
    "user_question_envelope",
    "trip_event_envelope",
    "entity_hints",
    "context_fingerprint",
    "evidence_ready_rendering",
    "execution_receipt_gate",
    "read_only_ai_surface"
  ]);

  function cleanString(value, max) {
    const n = Number.isFinite(max) ? Math.max(1, Math.floor(max)) : 4000;
    if (typeof value !== "string") return "";
    return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
  }

  function cleanArray(value, max) {
    const limit = Number.isFinite(max) ? Math.max(0, Math.floor(max)) : 50;
    return Array.isArray(value) ? value.slice(0, limit) : [];
  }

  function normalizeSearchText(value) {
    let text = cleanString(value, 4000).toLocaleLowerCase();
    try { text = text.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch (_) {}
    return text;
  }

  function containsAny(text, terms) {
    // Tokenize punctuation as separators so natural prompts like "what now?"
    // and "taxi?" still match, without letting short tokens match inside
    // longer words (for example "now" inside "know").
    let tokenized = text;
    try { tokenized = text.replace(/[^\p{L}\p{N}]+/gu, " "); }
    catch (_) { tokenized = text.replace(/[^a-z0-9]+/gi, " "); }
    const padded = " " + tokenized.replace(/\s+/g, " ").trim() + " ";
    return terms.some((rawTerm) => {
      let term = String(rawTerm || "").toLocaleLowerCase();
      try { term = term.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch (_) {}
      if (!term) return false;
      if (/^[a-z0-9]{1,4}$/.test(term)) return padded.indexOf(" " + term + " ") !== -1;
      return text.indexOf(term) !== -1;
    });
  }

  const TERMS = Object.freeze({
    access: Object.freeze([
      "נגיש", "כיסא גלגלים", "כסא גלגלים", "מדרגות", "מעלית", "ללא מדרגות",
      "accessib", "wheelchair", "step-free", "step free", "stairs", "elevator", "mobility",
      "إمكانية الوصول", "كرسي متحرك", "درج", "مصعد",
      "доступн", "коляск", "лестниц", "лифт",
      "accesib", "silla de ruedas", "escalera", "ascensor", "movilidad",
      "acessib", "cadeira de rodas", "escada", "elevador", "mobilidade"
    ]),
    mobility: Object.freeze([
      "איך מגיע", "תחבורה", "הליכה", "מונית", "רכבת", "אוטובוס", "נסיעה", "העברה",
      "how do i get", "transport", "walking", "walk", "taxi", "train", "bus", "route", "transfer",
      "مواصلات", "المشي", "سيارة أجرة", "قطار", "حافلة", "مسار",
      "транспорт", "пеш", "такси", "поезд", "автобус", "маршрут",
      "transporte", "caminar", "taxi", "tren", "autobús", "ruta", "traslado",
      "transporte", "caminhar", "táxi", "trem", "ônibus", "rota", "transfer"
    ]),
    today: Object.freeze([
      "עכשיו", "היום", "מחר", "מה הבא", "הבא בתור", "מה חשוב עכשיו",
      "right now", "now", "today", "tomorrow", "what's next", "what is next",
      "الآن", "اليوم", "غد", "التالي",
      "сейчас", "сегодня", "завтра", "дальше",
      "ahora", "hoy", "mañana", "qué sigue", "que sigue",
      "agora", "hoje", "amanhã", "amanha", "o que vem depois"
    ]),
    booking: Object.freeze([
      "הזמנה", "הזמנות", "כרטיס", "תשלום", "שובר",
      "booking", "reservation", "ticket", "payment", "voucher",
      "حجز", "تذكرة", "دفع",
      "бронь", "бронир", "билет", "оплат",
      "reserva", "entrada", "billete", "pago",
      "reserva", "ingresso", "bilhete", "pagamento"
    ]),
    money: Object.freeze([
      "תקציב", "כסף", "הוצאה", "הוצאות", "עלות", "מחיר",
      "budget", "money", "expense", "cost", "price", "spend",
      "ميزانية", "مال", "مصروف", "تكلفة", "سعر",
      "бюджет", "деньг", "расход", "стоим", "цен",
      "presupuesto", "dinero", "gasto", "coste", "costo", "precio",
      "orçamento", "orcamento", "dinheiro", "despesa", "custo", "preço", "preco"
    ]),
    planning: Object.freeze([
      "תכנן", "לתכנן", "תכנון", "מסלול טיול", "היום ריאלי", "היום הגיוני",
      "plan my", "plan the", "itinerary", "realistic day", "day realistic",
      "خطط", "خطة الرحلة", "برنامج الرحلة",
      "спланир", "маршрут поездки", "реалистич",
      "planifica", "itinerario", "día realista", "dia realista",
      "planej", "roteiro", "dia realista"
    ]),
    researchEntity: Object.freeze([
      "מלון", "מסעדה", "אטרקציה", "מוזיאון", "מקום", "ספר לי על", "מה אתה יודע על",
      "hotel", "restaurant", "attraction", "museum", "venue", "tell me about", "what do you know about",
      "فندق", "مطعم", "متحف", "مكان",
      "отел", "ресторан", "музе", "место", "расскажи",
      "hotel", "restaurante", "museo", "lugar", "qué sabes", "que sabes",
      "hotel", "restaurante", "museu", "lugar", "o que sabe", "fale sobre"
    ]),
    recovery: Object.freeze([
      "השתבש", "בוטל", "איחור", "מאחר", "פספס", "תקלה",
      "went wrong", "cancelled", "canceled", "delayed", "delay", "missed", "disruption",
      "أُلغي", "تأخير", "فاتني", "مشكلة",
      "отмен", "задерж", "опозд", "пропуст",
      "cancelad", "retras", "perdí", "problema",
      "cancelad", "atras", "perdi", "problema"
    ]),
    live: Object.freeze([
      "מזג אוויר", "איחור", "בוטל", "ביטול", "סטטוס טיסה", "סטטוס רכבת", "פתוח עכשיו",
      "weather", "delayed", "delay", "cancelled", "canceled", "cancellation", "flight status", "train status", "open now",
      "الطقس", "تأخير", "أُلغي", "إلغاء", "حالة الرحلة", "حالة القطار",
      "погода", "задерж", "отмен", "статус рейса", "статус поезда",
      "tiempo", "clima", "retras", "cancelad", "estado del vuelo", "estado del tren",
      "clima", "tempo", "atras", "cancelad", "status do voo", "status do trem"
    ])
  });

  const ENTITY_FOCUS_TERMS = Object.freeze({
    STAY: Object.freeze(["מלון","לינה","hotel","lodging","accommodation","فندق","отел","alojamiento","hospedagem"]),
    JOURNEY: Object.freeze(["טיסה","רכבת","נסיעה","flight","train","ferry","journey","رحلة","قطار","рейс","поезд","vuelo","tren","voo","trem"]),
    ACTIVITY: Object.freeze(["מסעדה","אטרקציה","מוזיאון","מקום","restaurant","attraction","museum","venue","مطعم","متحف","ресторан","музе","место","restaurante","museo","lugar","museu"])
  });

  function entityFocusForText(text) {
    if (containsAny(text, ENTITY_FOCUS_TERMS.STAY)) return "STAY";
    if (containsAny(text, ENTITY_FOCUS_TERMS.JOURNEY)) return "JOURNEY";
    if (containsAny(text, ENTITY_FOCUS_TERMS.ACTIVITY)) return "ACTIVITY";
    return "ANY";
  }

  function normalizeIntentHint(value) {
    const v = cleanString(value, 64).toUpperCase();
    const allowed = ["WHAT_NOW", "BOOKING_AUDIT", "ENTITY_RESEARCH", "RECOVERY", "ACCESS", "MOBILITY", "MONEY", "PLANNING", "GENERAL_TRIP"];
    return allowed.indexOf(v) !== -1 ? v : "";
  }

  function questionPolicy(prompt, explicitHint) {
    const text = normalizeSearchText(prompt);
    const hint = normalizeIntentHint(explicitHint);
    const access = hint === "ACCESS" || containsAny(text, TERMS.access);
    const mobility = hint === "MOBILITY" || access || containsAny(text, TERMS.mobility);
    const today = hint === "WHAT_NOW" || hint === "RECOVERY" || containsAny(text, TERMS.today);
    const booking = hint === "BOOKING_AUDIT" || containsAny(text, TERMS.booking);
    const money = hint === "MONEY" || containsAny(text, TERMS.money);
    const planning = hint === "PLANNING" || containsAny(text, TERMS.planning);
    const researchEntity = hint === "ENTITY_RESEARCH" || access || containsAny(text, TERMS.researchEntity);
    const recovery = hint === "RECOVERY" || containsAny(text, TERMS.recovery);
    // "What should I do now?" is primarily a stored-state/chronology question.
    // Live truth is hinted only by an operational signal such as weather,
    // delay/status or open-now, never by the word "now" alone.
    const liveLikely = containsAny(text, TERMS.live);
    const entityFocus = entityFocusForText(text);
    let intent = hint;
    if (!intent) {
      if (access) intent = "ACCESS";
      else if (recovery) intent = "RECOVERY";
      else if (today) intent = "WHAT_NOW";
      else if (booking) intent = "BOOKING_AUDIT";
      else if (money) intent = "MONEY";
      else if (planning) intent = "PLANNING";
      else if (mobility) intent = "MOBILITY";
      else if (researchEntity) intent = "ENTITY_RESEARCH";
      else intent = "GENERAL_TRIP";
    }
    const scopes = ["core", "entity_hints"];
    if (today || recovery) scopes.push("today");
    if (booking || recovery) scopes.push("booking_summary");
    if (money) scopes.push("money");
    if (mobility || recovery || planning) scopes.push("mobility");
    if (access) scopes.push("access");
    return Object.freeze({
      intent,
      explicitHint: !!hint,
      includeToday: today || recovery,
      includeBookingSummary: booking || recovery,
      includeMoney: money,
      includeMobility: mobility || recovery || planning,
      includeAccess: access,
      includeActivityAccess: access,
      planningLikely: planning,
      researchLikely: researchEntity,
      liveDataLikely: liveLikely,
      // Entity focus is useful beyond public research, for example a live
      // train-status request or booking question about one attraction.
      entityFocus,
      scopes: Object.freeze(Array.from(new Set(scopes)))
    });
  }

  function clone(value) {
    if (value == null) return value;
    try { return JSON.parse(JSON.stringify(value)); } catch (_) { return null; }
  }

  function activityView(item, includeBooking, includeAccess) {
    const src = item && typeof item === "object" ? item : {};
    const out = {
      id: cleanString(src.id, 200),
      title: cleanString(src.title, 500),
      time: cleanString(src.time, 16),
      endTime: cleanString(src.endTime, 16),
      location: cleanString(src.location, 600),
      category: cleanString(src.category, 80),
      travelFromPrevious: src.travelFromPrevious && typeof src.travelFromPrevious === "object" ? clone(src.travelFromPrevious) : null
    };
    if (includeBooking) {
      out.bookingStatus = cleanString(src.bookingStatus, 64);
      out.paymentStatus = cleanString(src.paymentStatus, 64);
    }
    if (includeAccess) out.accessStatus = cleanString(src.accessStatus, 64);
    return out;
  }

  function buildContextV2(fullContext, extras, policy) {
    const src = fullContext && typeof fullContext === "object" ? fullContext : {};
    const p = policy && typeof policy === "object" ? policy : questionPolicy("", "GENERAL_TRIP");
    const x = extras && typeof extras === "object" ? extras : {};
    let days = cleanArray(src.days, 400).map((day) => ({
      id: cleanString(day && day.id, 200),
      date: cleanString(day && day.date, 16),
      dayType: cleanString(day && day.dayType, 64) || "normal",
      activities: cleanArray(day && day.activities, 500).map((item) => activityView(item, p.includeBookingSummary, p.includeActivityAccess)),
      travelDay: day && day.travelDay && typeof day.travelDay === "object" ? clone(day.travelDay) : null
    }));
    let stays = cleanArray(src.stays, 200).map((stay) => {
      const row = {
        id: cleanString(stay && stay.id, 200), name: cleanString(stay && stay.name, 500), location: cleanString(stay && stay.location, 600),
        startDate: cleanString(stay && stay.startDate, 16), endDate: cleanString(stay && stay.endDate, 16),
        checkInTime: cleanString(stay && stay.checkInTime, 16), checkOutTime: cleanString(stay && stay.checkOutTime, 16)
      };
      if (p.includeBookingSummary) { row.status = cleanString(stay && stay.status, 64); row.paymentStatus = cleanString(stay && stay.paymentStatus, 64); }
      return row;
    });
    let journeys = cleanArray(src.journeys, 300).map((journey) => {
      const row = {
        id: cleanString(journey && journey.id, 200), date: cleanString(journey && journey.date, 16), arrivalDate: cleanString(journey && journey.arrivalDate, 16),
        mode: cleanString(journey && journey.mode, 64), origin: cleanString(journey && journey.origin, 500), destination: cleanString(journey && journey.destination, 500),
        departureTime: cleanString(journey && journey.departureTime, 16), arrivalTime: cleanString(journey && journey.arrivalTime, 16),
        provider: cleanString(journey && journey.provider, 240), serviceNumber: cleanString(journey && journey.serviceNumber, 120)
      };
      if (p.includeBookingSummary) { row.status = cleanString(journey && journey.status, 64); row.paymentStatus = cleanString(journey && journey.paymentStatus, 64); }
      return row;
    });
    // Client-side minimization is only a hint/pre-filter. The production
    // server remains authoritative, but obvious entity-specific questions do
    // not need the entire itinerary duplicated into the V2 request.
    if ((p.researchLikely || p.liveDataLikely) && p.entityFocus !== "ANY") {
      if (p.entityFocus === "STAY") { days = []; journeys = []; }
      else if (p.entityFocus === "JOURNEY") { days = []; stays = []; }
      else if (p.entityFocus === "ACTIVITY") { stays = []; journeys = []; }
    }
    if (p.intent === "MONEY") { days = []; stays = []; journeys = []; }

    const out = {
      schema: CONTEXT_SCHEMA,
      contextVersion: CONTRACT_VERSION,
      truthLayer: TRUTH_LAYERS.STORED_TRIP_FACT,
      scopes: Array.isArray(p.scopes) ? p.scopes.slice() : ["core"],
      trip: clone(src.trip) || {},
      days,
      stays,
      journeys
    };
    if (p.includeBookingSummary) {
      out.booking = {
        attentionCount: Number.isFinite(Number(src.bookingAttentionCount)) ? Number(src.bookingAttentionCount) : 0,
        documentAttentionCount: Number.isFinite(Number(src.documentAttentionCount)) ? Number(src.documentAttentionCount) : 0
      };
    }
    if (p.includeMoney && src.money && typeof src.money === "object") {
      // Itemized transactions are deliberately not part of the V2 default
      // contract. Budget and aggregate totals are sufficient for routine
      // reasoning while keeping payment-level history out of the model.
      out.money = { budget: clone(src.money.budget) || {}, totals: clone(src.money.totals) || {} };
    }
    if (p.includeToday && x.today) out.today = clone(x.today);
    if (p.includeMobility && x.mobility) out.mobility = clone(x.mobility);
    if (p.includeAccess && x.access) out.access = clone(x.access);
    return out;
  }

  function entityHints(context) {
    const ctx = context && typeof context === "object" ? context : {};
    const rows = [];
    cleanArray(ctx.stays, 100).forEach((s) => rows.push({
      entityType: "STAY", tripEntityId: cleanString(s.id, 200), name: cleanString(s.name, 500), location: cleanString(s.location, 600),
      startDate: cleanString(s.startDate, 16), endDate: cleanString(s.endDate, 16), truthLayer: TRUTH_LAYERS.STORED_TRIP_FACT
    }));
    cleanArray(ctx.journeys, 150).forEach((j) => rows.push({
      entityType: "JOURNEY", tripEntityId: cleanString(j.id, 200), name: [cleanString(j.origin, 300), cleanString(j.destination, 300)].filter(Boolean).join(" → "),
      location: "", date: cleanString(j.date, 16), mode: cleanString(j.mode, 64), provider: cleanString(j.provider, 240), serviceNumber: cleanString(j.serviceNumber, 120), truthLayer: TRUTH_LAYERS.STORED_TRIP_FACT
    }));
    cleanArray(ctx.days, 250).forEach((day) => cleanArray(day && day.activities, 400).forEach((a) => rows.push({
      entityType: "ACTIVITY", tripEntityId: cleanString(a.id, 200), name: cleanString(a.title, 500), location: cleanString(a.location, 600),
      date: cleanString(day.date, 16), time: cleanString(a.time, 16), truthLayer: TRUTH_LAYERS.STORED_TRIP_FACT
    })));
    return rows.filter((row) => row.tripEntityId || row.name || row.location).slice(0, 500);
  }

  function stableStringify(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
    const keys = Object.keys(value).sort();
    return "{" + keys.map((key) => JSON.stringify(key) + ":" + stableStringify(value[key])).join(",") + "}";
  }

  function fingerprint(value) {
    const text = stableStringify(value);
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return "fnv1a32-" + hash.toString(16).padStart(8, "0");
  }

  function contextFingerprintView(context) {
    const out = clone(context && typeof context === "object" ? context : {});
    // The stale-answer guard is for stored product state, not the wall clock.
    // Today context is deliberately time-sensitive for reasoning, but its
    // current minute / now-next classification must not invalidate an answer
    // merely because the response crosses a minute boundary. The stable date
    // remains in the fingerprint and the underlying itinerary entities are
    // already represented elsewhere in the V2 context.
    if (out.today && typeof out.today === "object") {
      out.today = { date: cleanString(out.today.date, 16) };
    }
    return out;
  }

  function localeInfo(locale) {
    const src = locale && typeof locale === "object" ? locale : {};
    const direction = src.direction === "rtl" ? "rtl" : "ltr";
    return {
      language: cleanString(src.language, 16) || "en",
      locale: cleanString(src.locale, 32) || cleanString(src.language, 16) || "en",
      direction
    };
  }

  const FORBIDDEN_OUTBOUND_KEYS = Object.freeze(new Set([
    "confirmation", "confirmationcode", "bookingreference", "bookingurl",
    "documenturl", "documents", "note", "notes", "expenses",
    "passport", "passportnumber", "cardnumber", "cvv", "apikey", "token"
  ]));

  function validateOutboundContext(value) {
    const unsafeKeys = new Set();
    const visit = (node) => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) { node.forEach(visit); return; }
      Object.keys(node).forEach((key) => {
        const normalized = String(key).toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
        if (FORBIDDEN_OUTBOUND_KEYS.has(normalized)) unsafeKeys.add(key);
        visit(node[key]);
      });
    };
    visit(value);
    return { safe: unsafeKeys.size === 0, unsafeKeys: Array.from(unsafeKeys).sort() };
  }

  function privacyManifest(policy) {
    const p = policy && typeof policy === "object" ? policy : questionPolicy("", "GENERAL_TRIP");
    const excluded = ["booking_reference", "confirmation_code", "booking_url", "documents", "document_urls", "free_form_notes", "itemized_expenses", "payment_secrets", "api_keys"];
    if (!p.includeAccess) excluded.push("access_profile");
    if (!p.includeMobility) excluded.push("mobility_preferences");
    if (!p.includeToday) excluded.push("today_context");
    if (!p.includeMoney) excluded.push("money_context");
    return {
      minimization: true,
      includedScopes: Array.isArray(p.scopes) ? p.scopes.slice() : ["core"],
      excludedCategories: excluded,
      providerSecretsIncluded: false,
      bookingSecretsIncluded: false
    };
  }

  function buildUserQuestionEnvelope(args) {
    const a = args && typeof args === "object" ? args : {};
    const prompt = cleanString(a.prompt, 2000);
    const policy = a.policy && typeof a.policy === "object" ? a.policy : questionPolicy(prompt, a.intentHint);
    const context = a.context && typeof a.context === "object" ? clone(a.context) : buildContextV2(a.fullContext, a.extras, policy);
    const requestId = cleanString(a.requestId, 160);
    const outboundValidation = validateOutboundContext(context);
    const privacy = privacyManifest(policy);
    privacy.clientValidationPassed = outboundValidation.safe;
    privacy.transportAllowed = outboundValidation.safe;
    privacy.unsafeKeys = outboundValidation.unsafeKeys;
    return {
      schema: REQUEST_SCHEMA,
      contractVersion: CONTRACT_VERSION,
      type: "USER_QUESTION",
      requestId,
      idempotencyKey: cleanString(a.idempotencyKey, 200) || requestId,
      createdAt: cleanString(a.createdAt, 64) || new Date().toISOString(),
      client: {
        app: "TripMaster",
        appVersion: cleanString(a.appVersion, 64),
        capabilities: CLIENT_CAPABILITIES.slice(),
        readOnly: true,
        v2TransportExpected: a.v2TransportExpected === true
      },
      locale: localeInfo(a.locale),
      trip: {
        id: cleanString(context && context.trip && context.trip.id, 200),
        contextFingerprint: fingerprint(contextFingerprintView(context))
      },
      question: {
        text: prompt,
        intentHint: policy.intent,
        entityFocusHint: cleanString(policy.entityFocus, 32) || "ANY",
        truthLayerHint: policy.liveDataLikely ? TRUTH_LAYERS.VERIFIED_OPERATIONAL : (policy.researchLikely ? TRUTH_LAYERS.PUBLIC_RESEARCHED_FACT : TRUTH_LAYERS.STORED_TRIP_FACT),
        hintIsAuthoritative: false,
        researchLikely: !!policy.researchLikely,
        liveDataLikely: !!policy.liveDataLikely
      },
      context,
      entityHints: entityHints(context),
      privacy,
      serverRequirements: {
        authoritativeIntentRouting: true,
        authoritativeResearchPolicy: true,
        authoritativeEntityResolution: true,
        authoritativeEvidenceValidation: true,
        executionReceiptsRequiredForExternalTruth: true
      }
    };
  }

  function buildTripEventEnvelope(args) {
    const a = args && typeof args === "object" ? args : {};
    const eventName = cleanString(a.eventName, 80).toUpperCase();
    const allowed = ["APP_OPEN", "TRIP_OPENED", "TRIP_CREATED", "TRIP_UPDATED", "ACTIVITY_ADDED", "ACTIVITY_UPDATED", "STAY_UPDATED", "JOURNEY_UPDATED", "BOOKING_UPDATED", "ACCESS_PROFILE_UPDATED", "DAY_START"];
    const name = allowed.indexOf(eventName) !== -1 ? eventName : "TRIP_UPDATED";
    const changedFields = cleanArray(a.changedFields, 50).map((x) => cleanString(x, 120)).filter(Boolean);
    return {
      schema: EVENT_SCHEMA,
      contractVersion: CONTRACT_VERSION,
      type: "TRIP_EVENT",
      eventId: cleanString(a.eventId, 160),
      createdAt: cleanString(a.createdAt, 64) || new Date().toISOString(),
      client: { app:"TripMaster", appVersion:cleanString(a.appVersion, 64), capabilities:CLIENT_CAPABILITIES.slice() },
      locale: localeInfo(a.locale),
      tripId: cleanString(a.tripId, 200),
      tripFingerprint: cleanString(a.tripFingerprint, 100),
      event: {
        name,
        entityType: cleanString(a.entityType, 64).toUpperCase(),
        entityId: cleanString(a.entityId, 200),
        changedFields,
        eventVersion: Number.isFinite(Number(a.eventVersion)) ? Number(a.eventVersion) : null
      },
      privacy: {
        payloadIsMetadataOnly: true,
        rawTripStateIncluded: false,
        bookingSecretsIncluded: false
      }
    };
  }

  function responseEvidenceView(payload) {
    const p = payload && typeof payload === "object" ? payload : {};
    const result = p.result && typeof p.result === "object" ? p.result : {};
    const policy = (p.policy && typeof p.policy === "object") ? p.policy : ((result.policy && typeof result.policy === "object") ? result.policy : {});
    const bundle = (p.evidenceBundle && typeof p.evidenceBundle === "object") ? p.evidenceBundle : ((result.evidenceBundle && typeof result.evidenceBundle === "object") ? result.evidenceBundle : {});
    const observations = cleanArray(bundle.observations || p.evidence || result.evidence, 100);
    const sources = [];
    const seen = new Set();
    const evidenceIds = new Set();
    observations.forEach((obs) => {
      if (!obs || typeof obs !== "object") return;
      const evidenceId = cleanString(obs.evidence_id || obs.evidenceId || obs.id, 160);
      const provider = cleanString(obs.provider, 160);
      const sourceClass = cleanString(obs.source_class || obs.sourceClass, 160);
      const truthLayer = cleanString(obs.truth_layer || obs.truthLayer, 80).toUpperCase();
      const locator = cleanString(obs.source_locator || obs.sourceLocator || obs.url, 1000);
      const retrievedAt = cleanString(obs.retrieved_at || obs.retrievedAt, 64);
      const key = [evidenceId, provider, sourceClass, truthLayer, locator].join("|");
      if (seen.has(key)) return;
      seen.add(key);
      if (evidenceId) evidenceIds.add(evidenceId);
      sources.push({ evidenceId, provider, sourceClass, truthLayer, locator, retrievedAt });
    });
    const claims = cleanArray(result.claims || p.claims, 100).filter((claim) => claim && typeof claim === "object").map((claim) => ({
      claimId: cleanString(claim.claim_id || claim.claimId || claim.id, 160),
      truthLayer: cleanString(claim.truth_layer || claim.truthLayer, 80).toUpperCase(),
      evidenceIds: cleanArray(claim.evidence_ids || claim.evidenceIds, 50).map((id) => cleanString(id, 160)).filter(Boolean),
      allowedToRender: claim.allowed_to_render !== false && claim.allowedToRender !== false
    }));
    const receipts = cleanArray(p.toolReceipts || p.tool_receipts || result.toolReceipts || result.tool_receipts || bundle.toolReceipts || bundle.tool_receipts, 100)
      .filter((row) => row && typeof row === "object")
      .map((row) => ({
        receiptId: cleanString(row.receipt_id || row.receiptId || row.id, 160),
        tool: cleanString(row.tool, 160),
        provider: cleanString(row.provider, 160),
        status: cleanString(row.status, 80).toUpperCase(),
        entityId: cleanString(row.entity_id || row.entityId, 200)
      }));
    return {
      schema: cleanString(p.schema || result.schema, 100),
      verified: bundle.verified === true,
      identityVerified: bundle.identity_verified === true || bundle.identityVerified === true,
      freshnessPassed: bundle.freshness_passed === true || bundle.freshnessPassed === true,
      unresolvedContradictions: bundle.contradictions_unresolved === true || bundle.unresolvedContradictions === true,
      researchRequired: p.researchRequired === true || result.researchRequired === true || policy.researchRequired === true,
      liveDataRequired: p.liveDataRequired === true || result.liveDataRequired === true || policy.liveDataRequired === true,
      sources,
      claims,
      receipts,
      evidenceIds
    };
  }

  function validateV2Response(payload, envelope) {
    const p = payload && typeof payload === "object" ? payload : {};
    const schema = cleanString(p.schema || (p.result && p.result.schema), 100);
    const expectsV2 = !!(envelope && envelope.client && envelope.client.v2TransportExpected === true);
    if (schema !== "tripmaster-ai-response-v2") {
      return expectsV2
        ? { applicable:true, ok:false, code:"v2_schema_missing" }
        : { applicable:false, ok:true, code:"legacy_or_unknown" };
    }
    const ev = responseEvidenceView(p);
    const question = envelope && envelope.question && typeof envelope.question === "object" ? envelope.question : {};
    // Defense in depth: the future server is authoritative, but the client
    // already knows two unambiguous cases. A canonical ENTITY_RESEARCH request
    // cannot silently downgrade to generic synthesis, and an explicit
    // operational signal (weather/delay/status/open-now) cannot silently
    // downgrade to public web truth.
    const researchRequired = ev.researchRequired || cleanString(question.intentHint, 64).toUpperCase() === "ENTITY_RESEARCH";
    const liveDataRequired = ev.liveDataRequired || question.liveDataLikely === true;
    if (researchRequired || liveDataRequired) {
      const successfulReceipts = ev.receipts.filter((row) => row.receiptId && row.tool && row.status === "SUCCESS");
      if (!successfulReceipts.length) return { applicable:true, ok:false, code:"execution_receipt_missing" };
    }
    if (researchRequired && !ev.verified) return { applicable:true, ok:false, code:"research_evidence_missing" };
    if (researchRequired && ev.sources.length === 0) return { applicable:true, ok:false, code:"research_evidence_empty" };
    if (ev.unresolvedContradictions) return { applicable:true, ok:false, code:"evidence_contradiction" };
    if ((researchRequired || liveDataRequired) && !ev.identityVerified) return { applicable:true, ok:false, code:"entity_not_verified" };
    if ((researchRequired || liveDataRequired) && !ev.freshnessPassed) return { applicable:true, ok:false, code:"evidence_stale" };
    if ((researchRequired || liveDataRequired) && ev.claims.length === 0) return { applicable:true, ok:false, code:"claims_missing" };
    if (liveDataRequired && !ev.sources.some((source) => source.truthLayer === TRUTH_LAYERS.VERIFIED_OPERATIONAL)) {
      return { applicable:true, ok:false, code:"operational_truth_missing" };
    }
    const allowedTruthLayers = new Set(Object.values(TRUTH_LAYERS));
    for (const claim of ev.claims) {
      if (!claim.allowedToRender) return { applicable:true, ok:false, code:"claim_policy_blocked" };
      if (!allowedTruthLayers.has(claim.truthLayer)) return { applicable:true, ok:false, code:"claim_truth_layer_invalid" };
      if (claim.truthLayer === TRUTH_LAYERS.PUBLIC_RESEARCHED_FACT || claim.truthLayer === TRUTH_LAYERS.VERIFIED_OPERATIONAL) {
        if (!claim.evidenceIds.length) return { applicable:true, ok:false, code:"claim_evidence_missing" };
        if (claim.evidenceIds.some((id) => !ev.evidenceIds.has(id))) return { applicable:true, ok:false, code:"claim_evidence_unknown" };
      }
      if (claim.truthLayer === TRUTH_LAYERS.VERIFIED_OPERATIONAL) {
        const operationalIds = new Set(ev.sources.filter((source) => source.truthLayer === TRUTH_LAYERS.VERIFIED_OPERATIONAL).map((source) => source.evidenceId).filter(Boolean));
        if (!claim.evidenceIds.some((id) => operationalIds.has(id))) return { applicable:true, ok:false, code:"claim_operational_evidence_missing" };
      }
    }
    return { applicable:true, ok:true, code:"ok" };
  }

  root.TripMasterAIClient = Object.freeze({
    CONTRACT_VERSION,
    REQUEST_SCHEMA,
    CONTEXT_SCHEMA,
    EVENT_SCHEMA,
    TRUTH_LAYERS,
    CLIENT_CAPABILITIES,
    cleanString,
    questionPolicy,
    buildContextV2,
    entityHints,
    fingerprint,
    contextFingerprintView,
    privacyManifest,
    validateOutboundContext,
    buildUserQuestionEnvelope,
    buildTripEventEnvelope,
    responseEvidenceView,
    validateV2Response
  });
})(typeof window !== "undefined" ? window : globalThis);
