document.addEventListener("DOMContentLoaded", () => {
  try {
    if (typeof window.__tmBootProgress === "function") window.__tmBootProgress("dom-init");
    const $ = (id) => document.getElementById(id);
    const DayIntel = window.TripMasterIntelligence;
    const Logistics = window.TripMasterLogistics;
    const Finance = window.TripMasterFinance;
    const Travel = window.TripMasterTravel;
    const Today = window.TripMasterToday;
    const Operations = window.TripMasterOperations;
    if (!DayIntel || typeof DayIntel.analyzeDay !== "function") {
      throw new Error("TripMaster intelligence module unavailable");
    }
    if (!Logistics || typeof Logistics.effectiveStayForDate !== "function") {
      throw new Error("TripMaster logistics model module unavailable");
    }
    if (!Finance || typeof Finance.budgetSummary !== "function") {
      throw new Error("TripMaster finance model module unavailable");
    }
    if (!Travel || typeof Travel.dayType !== "function") {
      throw new Error("TripMaster travel model module unavailable");
    }
    if (!Today || typeof Today.buildToday !== "function") {
      throw new Error("TripMaster Today model module unavailable");
    }
    if (!Operations || typeof Operations.taskStats !== "function") {
      throw new Error("TripMaster operations model module unavailable");
    }
    if (typeof window.__tmBootProgress === "function") window.__tmBootProgress("modules-ready");

    /* Current UI language. Reassigned once settings are loaded (see below)
       and by setLanguage(). Declared before any t() caller runs. */
    let currentLang = DEFAULT_LANG;

    /* I18N-FIRST-RUN-001 (v1090-RC4): a brand-new international user should
       never have to navigate an unfamiliar Hebrew UI just to find language.
       On FIRST RUN ONLY, prefer the browser/device language when TripMaster
       already supports it. If the device language is unsupported, start in
       English. Existing users keep their persisted language unchanged. */
    function detectFirstRunLanguage() {
      const candidates = [];
      try {
        if (typeof navigator !== "undefined" && Array.isArray(navigator.languages)) {
          navigator.languages.forEach((x) => { if (x) candidates.push(String(x)); });
        }
        if (typeof navigator !== "undefined" && navigator.language) {
          candidates.push(String(navigator.language));
        }
      } catch (err) {}

      for (const raw of candidates) {
        const normalized = raw.trim().toLowerCase().replace(/_/g, "-");
        const primary = normalized.split("-")[0];
        if (activeLanguages().indexOf(primary) !== -1) return primary;
      }
      return activeLanguages().indexOf("en") !== -1 ? "en" : DEFAULT_LANG;
    }

    /* ── t(key): safe translation lookup ──
       Never throws and never returns undefined:
         1. current language  ->  2. Hebrew fallback
         3. caller-supplied fallback  ->  4. the key itself
       A missing key therefore degrades to Hebrew (or a visible key),
       never to a blank UI or a crash. */
    function t(key, fallback) {
      const table = TRANSLATIONS[currentLang];
      if (table && Object.prototype.hasOwnProperty.call(table, key)) return table[key];
      const base = TRANSLATIONS[DEFAULT_LANG];
      if (base && Object.prototype.hasOwnProperty.call(base, key)) return base[key];
      if (fallback !== undefined && fallback !== null) return fallback;
      return key;
    }

    /* tf(key, params): t() plus {placeholder} substitution. Values are
       inserted as-is; callers that emit HTML still escape separately. */
    function tf(key, params) {
      let out = String(t(key));
      if (params) {
        Object.keys(params).forEach((p) => {
          out = out.split("{" + p + "}").join(String(params[p]));
        });
      }
      return out;
    }

    /* I18N-PLURAL-001 (v1500): locale-aware plural selection foundation.
       Existing strings continue to use tf() unchanged. New/updated copy may
       define <key>_one / <key>_other (and any CLDR category) and call
       tfPlural(key, count, params). If a category-specific key is absent,
       the legacy base key is used, so this is additive for every active language.
       Amharic uses Intl.PluralRules("am-ET") like the other locales. */
    function pluralCategory(count, langCode = currentLang) {
      const meta = LANG_META[langCode] || LANG_META[DEFAULT_LANG];
      try { return new Intl.PluralRules(meta.lang).select(Number(count)); }
      catch (_) { return Number(count) === 1 ? "one" : "other"; }
    }

    function tfPlural(key, count, params) {
      const category = pluralCategory(count);
      const candidate = key + "_" + category;
      const table = TRANSLATIONS[currentLang] || {};
      const base = TRANSLATIONS[DEFAULT_LANG] || {};
      const selected = Object.prototype.hasOwnProperty.call(table, candidate) ||
        Object.prototype.hasOwnProperty.call(base, candidate) ? candidate : key;
      return tf(selected, Object.assign({ n: count }, params || {}));
    }

    /* ── Document language + direction ──
       DATES-001 is unaffected: .header-trip-dates keeps its own
       dir="ltr" + unicode-bidi:isolate, which overrides the document
       direction in both languages, so numeric ranges never reverse. */
    function applyLanguageAttributes() {
      const meta = LANG_META[currentLang] || LANG_META[DEFAULT_LANG];
      document.documentElement.lang = meta.lang;
      document.documentElement.dir  = meta.dir;
    }

    /* Walks the app-owned static markup only. Elements carry data-i18n*
       attributes; user content never does, so nothing typed by the user
       can be reached by this function. */
    function applyStaticTranslations() {
      document.querySelectorAll("[data-i18n]").forEach((el) => {
        el.textContent = t(el.getAttribute("data-i18n"));
      });
      document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
        el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
      });
      document.querySelectorAll("[data-i18n-title]").forEach((el) => {
        el.setAttribute("title", t(el.getAttribute("data-i18n-title")));
      });
      document.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
        el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria-label")));
      });
    }

    /* Only languages flagged active are ever rendered, so an unfinished
       translation cannot be selected. Each button carries its own
       lang/dir so endonyms render correctly inside either page direction. */
    function renderLanguageOptions() {
      // RC4-UX-003: language selection is exposed only through the persistent
      // header globe. Keeping one surface avoids duplicated settings UI.
      [$("languageQuickOptions")].filter(Boolean).forEach((row) => {
        row.innerHTML = "";
        activeLanguages().forEach((code) => {
          const meta = LANG_META[code];
          const on = code === currentLang;
          const b = document.createElement("button");
          b.className = "lang-option" + (on ? " on" : "");
          b.type = "button";
          b.dataset.lang = code;
          b.setAttribute("aria-pressed", on ? "true" : "false");

          const name = document.createElement("span");
          name.className = "lang-name";
          name.setAttribute("lang", meta.lang);
          name.setAttribute("dir", meta.dir);
          name.textContent = meta.label;

          const check = document.createElement("span");
          check.className = "lang-check";
          check.setAttribute("aria-hidden", "true");
          check.textContent = "✓";

          b.appendChild(name);
          b.appendChild(check);
          row.appendChild(b);
        });
      });
    }

    function applyLanguage() {
      applyLanguageAttributes();
      applyStaticTranslations();
      renderLanguageOptions();
      // v1040: these two are built by JS, so data-i18n cannot reach them.
      renderCategoryOptions();
      renderAccessProfile();
    }

    /* Changing language saves immediately and repaints in place. The menu
       sheet is never closed and no .sheet/.sec open state is touched, so
       the user stays exactly where they were. */
    function setLanguage(lang) {
      const meta = LANG_META[lang];
      if (!meta || !meta.active) return;
      if (!commitSettings(() => { settings.language = lang; })) return;
      currentLang = lang;
      applyLanguage();
      renderTools();
      renderCurrentView();
      updateHeaderInfo();
      if ($("bookingCenterSheet") && $("bookingCenterSheet").classList.contains("open")) renderBookingCenter();
      if ($("moneySheet") && $("moneySheet").classList.contains("open")) renderMoneyHub();
      if ($("documentsSheet") && $("documentsSheet").classList.contains("open")) renderDocumentsHub();
      showToast(t("toast_language_changed"));
    }


    let currentDayIndex  = 0;
    let editingDayId     = null;
    let editingItemUid   = null;
    let isSavingActivity = false; // BUG-001 preventive guard: blocks duplicate rapid-tap saves

    /* ── BOOT-001 fix: safe localStorage JSON read ──
       Reads a raw localStorage value and parses it as JSON.
       - Missing/null raw value -> returns fallback (no backup needed, nothing to lose).
       - Unparseable raw value -> preserves the raw string under a timestamped
         backup key (so it is never silently lost / overwritten later by
         pagehide/beforeunload/visibilitychange saves), warns in console,
         and returns fallback so boot can continue instead of throwing. ── */
    const _corruptBackupRaw = new Map();
    const _unreadableStorageKeys = new Map();
    const _storageHealth = {lastWrite:null,lastMigration:null,lastTransfer:null};
    function findPreservedCorruptKey(key, raw) {
      const prefix = key + "_corrupt_backup_";
      for (let i = 0; i < localStorage.length; i++) {
        const candidate = localStorage.key(i);
        if (candidate && candidate.startsWith(prefix) && localStorage.getItem(candidate) === raw) return candidate;
      }
      return null;
    }

    function preserveCorruptRaw(key, raw) {
      try {
        let preservedKey = findPreservedCorruptKey(key, raw);
        if (!preservedKey) {
          const base = `${key}_corrupt_backup_${Date.now()}`;
          preservedKey = base;
          // Never overwrite an earlier payload, even in the same millisecond.
          for (let suffix = 1; localStorage.getItem(preservedKey) !== null; suffix++) preservedKey = base + "_" + suffix;
          localStorage.setItem(preservedKey, raw);
        }
        if (localStorage.getItem(preservedKey) !== raw) return false;
        _corruptBackupRaw.set(key, raw);
        return true;
      } catch (_) {
        _corruptBackupRaw.delete(key);
        return false;
      }
    }

    function repairStoredCollectionRows(value, key) {
      // Only members of known arrays are repairable here. A non-array
      // collection is left untouched so structural validation can reject it.
      let changed = false;
      const rows = list => {
        if (!Array.isArray(list)) return list;
        const filtered = list.filter(row => row && typeof row === "object" && !Array.isArray(row));
        if (filtered.length !== list.length) changed = true;
        return filtered;
      };
      const days = list => {
        const filtered = rows(list);
        if (Array.isArray(filtered)) filtered.forEach(day => {
          if (Array.isArray(day.items)) day.items = rows(day.items);
        });
        return filtered;
      };
      if (key === KEY_TRIPS && Array.isArray(value)) {
        value = rows(value);
        value.forEach(trip => {
          if (Array.isArray(trip.days)) trip.days = days(trip.days);
          for (const field of ["stays", "journeys", "expenses", "documents", "tasks"]) {
            if (Array.isArray(trip[field])) trip[field] = rows(trip[field]);
          }
        });
      } else if (key === KEY_DAYS) value = days(value);
      return {value, changed};
    }

    function safeParseJSON(key, fallback) {
      const raw = localStorage.getItem(key);
      if (raw === null || raw === undefined) { _unreadableStorageKeys.delete(key); return fallback; }
      try {
        const repaired=repairStoredCollectionRows(JSON.parse(raw),key);
        const value=repaired.value;
        if(key===KEY_TRIPS && (!Array.isArray(value)||value.some(trip=>!trip||typeof trip!=="object"||Array.isArray(trip)||!Operations.portableTripShapeValid({...trip,days:trip.days==null?[]:trip.days}))))throw new Error("Invalid trip storage shape");
        if(key===KEY_DAYS && !Operations.portableTripShapeValid({days:value}))throw new Error("Invalid legacy storage shape");
        if(key===KEY_SETTINGS && (!value||typeof value!=="object"||Array.isArray(value)))throw new Error("Invalid settings shape");
        // Retain the exact pre-repair bytes before a later migration/save can
        // commit the filtered graph. If preservation fails, quarantine safely.
        if(repaired.changed&&!preserveCorruptRaw(key,raw))throw new Error("Row preservation failed");
        _unreadableStorageKeys.delete(key);
        return value;
      } catch (err) {
        _unreadableStorageKeys.set(key,raw);
        // Inspect persistent copies on every boot; an in-memory match alone
        // cannot prove the preserved bytes still exist.
        if (!preserveCorruptRaw(key,raw)) console.warn("TripMaster: corrupt raw preservation unavailable",key);
        console.warn("TripMaster: corrupt JSON in localStorage key", key, err);
        return fallback;
      }
    }

    function normalizeDays(raw) {
      if (!Array.isArray(raw)) return [];
      return raw.filter((day) => day && typeof day === "object").map((day) => {
        if (!Array.isArray(day.items)) day.items = [];
        else day.items = day.items.filter((item) => item && typeof item === "object");
        return day;
      });
    }

    // RC2 model: KEY_DAYS is legacy Home itinerary storage only. New planning
    // happens exclusively inside trips[]. It is read here solely so a safe
    // one-time migration can recover it below.
    let days = normalizeDays(safeParseJSON(KEY_DAYS, []));
    let trips = normalizeTrips(safeParseJSON(KEY_TRIPS, []));
    let activeTripId = localStorage.getItem(KEY_ACTIVE_TRIP) || null;
    let _observedTripToken = canonicalTripStorageToken();
    let currentView = activeTripId ? "planner" : "home";
    let todayPreviewDate = "";
    let todayPreviewMode = false;
    let _lastTodayModel = null;
    const _todayNotified = new Set();
    let _externalStatePending = false;
    // v3200: settings and theme participate in cross-window convergence
    // independently from the trip graph. Separate pending flags let a stale
    // preference key converge without manufacturing a trip-data conflict.
    let _externalSettingsPending = false;
    let _externalThemePending = false;
    let _settingsStorageToken = null;
    let _themeStorageToken = null;
    let _externalSyncTimer = null;
    let _stateWriteBlockReason = "";
    let _reloadRequiredForVersion = false;

    // RC4-AI-LIFECYCLE-001: one read-only request can survive an Android
    // background/foreground cycle. A resume retry is bounded to one attempt.
    let _activeAIRequest = null;
    let _aiRequestSeq = 0;
    // Sanitized in-memory client trace. Never stores prompt text, trip/entity
    // names, booking references, Access details or other trip content.
    let _lastAIClientTrace = null;

    /* ══════════════════════════════════════════════════════════════════
       STORE-001 (v1040 / A7): one guarded persistence path
       ──────────────────────────────────────────────────────────────────
       Before v1040 every important write was a bare localStorage.setItem().
       A full quota, or a browser in a mode that refuses storage, threw out
       of the click handler AFTER the model had been mutated and the UI
       re-rendered — so the app showed a saved change that could not survive
       a reload, and said nothing.

       writeAll() writes a batch and, on any failure, puts every key it
       touched back to its previous value before returning false.
       commitState() wraps that in a model-level transaction:

           snapshot -> mutate -> persist -> commit + render
                                         -> or roll back and report

       Nothing renders success and no toast claims success unless the write
       actually landed. Simulate with QuotaExceededError during QA.
       ══════════════════════════════════════════════════════════════════ */
    function writeAll(entries, options = {}) {
      const previous = [];
      const started=Date.now();
      // A fallback empty graph must never overwrite unreadable source data.
      // Only a validated explicit Restore can replace it, after raw preservation.
      for(const [key] of entries){
        if(!_unreadableStorageKeys.has(key))continue;
        let preserved=false;
        try{preserved=!!findPreservedCorruptKey(key,_unreadableStorageKeys.get(key));}catch(_){}
        if(options.recovery!==true||!preserved){
          _storageHealth.lastWrite={at:new Date().toISOString(),result:"recovery_required",durationMs:0,changedKeys:0};
          return false;
        }
      }
      try {
        for (let i = 0; i < entries.length; i++) {
          const key = entries[i][0];
          const oldValue = localStorage.getItem(key);
          if (oldValue === entries[i][1]) continue;
          previous.push([key, oldValue]);
          localStorage.setItem(key, entries[i][1]);
        }
        if(options.recovery===true)entries.forEach(([key])=>_unreadableStorageKeys.delete(key));
        _storageHealth.lastWrite={at:new Date().toISOString(),result:"saved",durationMs:Math.max(0,Date.now()-started),changedKeys:previous.length};
        if (entries.some(([key]) => key === KEY_TRIPS || key === KEY_ACTIVE_TRIP)) _observedTripToken = canonicalTripStorageToken();
        return true;
      } catch (err) {
        _storageHealth.lastWrite={at:new Date().toISOString(),result:err&&err.name==="QuotaExceededError"?"quota":"failed",durationMs:Math.max(0,Date.now()-started),changedKeys:previous.length};
        recordLifecycleEvent("storage_write",{result:_storageHealth.lastWrite.result});
        console.warn("TripMaster: localStorage write failed", err);
        for (let i = previous.length - 1; i >= 0; i--) {
          try {
            if (previous[i][1] === null) localStorage.removeItem(previous[i][0]);
            else localStorage.setItem(previous[i][0], previous[i][1]);
          } catch (rollbackErr) {
            _storageHealth.lastWrite.result="rollback_failed";
            recordLifecycleEvent("storage_write",{result:"rollback_failed"});
            console.warn("TripMaster: rollback failed for", previous[i][0], rollbackErr);
          }
        }
        return false;
      }
    }

    function reportStorageFailure() {
      if(_storageHealth.lastWrite&&_storageHealth.lastWrite.result==="rollback_failed"){
        _stateWriteBlockReason="";
        showToast(t("toast_storage_partial"),t("safety_center_title"),openSafetyCenter);
        return;
      }
      if(_stateWriteBlockReason==="external"||_stateWriteBlockReason==="update"){_stateWriteBlockReason="";return;}
      showToast(t("toast_storage_failed"));
    }

    function failedWriteWasExternal() {
      return _stateWriteBlockReason === "external";
    }

    /* ── SCHEMA-001 (v1040) ──
       Every field v1040 adds is optional and is read through an accessor, so
       a trip or activity written by v1010–v1030 is valid exactly as stored
       and is never rewritten merely for having been opened. normalizeTrips()
       fills in a missing SHAPE (days array, string name); it never rebuilds
       an object, so unknown keys on stored data survive untouched. ── */
    function normalizeTrips(raw) {
      if (!Array.isArray(raw)) return [];
      raw.forEach((trip) => {
        if (!trip || typeof trip !== "object") return;
        trip.days = normalizeDays(trip.days);
        if (typeof trip.name !== "string") trip.name = String(trip.name == null ? "" : trip.name);
      });
      // Keep structurally valid trip objects even when a historical writer
      // omitted trip.id. The stable-ID migration runs before first use and can
      // repair the missing identity; filtering here would irreversibly hide it.
      return raw.filter((trip) => trip && typeof trip === "object");
    }

    function itemLocation(item)   { return (item && typeof item.location   === "string") ? item.location.trim()   : ""; }
    function itemNote(item)       { return (item && typeof item.note       === "string") ? item.note.trim()       : ""; }
    function itemAccessNote(item) { return (item && typeof item.accessNote === "string") ? item.accessNote.trim() : ""; }
    function itemEndTime(item) {
      const v = item && item.endTime;
      return (typeof v === "string" && DayIntel.parseTime(v) !== null) ? v : "";
    }
    function itemEndsNextDay(item) { return !!(item && item.endNextDay === true && itemEndTime(item)); }
    function itemReminderMin(item) {
      const raw = item && item.reminderMin;
      let n = null;
      if (typeof raw === "number" && Number.isFinite(raw)) n = raw;
      else if (typeof raw === "string" && raw.trim() !== "" && Number.isFinite(Number(raw))) n = Number(raw);
      if (n === null || n < 0) return null;
      return Math.round(n);
    }
    function itemAccessStatus(item) {
      const v = item && item.accessStatus;
      return (v === "verified" || v === "stepfree" || v === "problem" || v === "needscheck") ? v : "";
    }
    function isAccessVerified(item) {
      const v = itemAccessStatus(item);
      return v === "verified" || v === "stepfree"; // stepfree is the v1040/v1050 verified legacy value.
    }
    function dayType(day) { return Travel.dayType(day); }
    function dayTravelInfo(day) { return Travel.travelDayInfo(day); }
    function dayBaseFlow(day) { return Travel.baseFlow(day); }
    function isTravelDay(day) { return dayType(day) !== "normal"; }
    function dayTypeLabel(type) {
      const map = { normal:"day_type_normal", arrival:"day_type_arrival", departure:"day_type_departure", transfer:"day_type_transfer" };
      return t(map[type] || map.normal);
    }
    function dayTypeIcon(type) {
      return type === "arrival" ? "🛬" : type === "departure" ? "🛫" : type === "transfer" ? "🧳" : "📅";
    }
    function travelDayModeLabel(mode) {
      const map = { flight:"travel_day_mode_flight", train:"travel_mode_train", bus:"travel_day_mode_bus", ferry:"travel_day_mode_ferry", public:"travel_mode_public", taxi:"travel_mode_taxi", other:"travel_mode_other" };
      return map[mode] ? t(map[mode]) : "";
    }
    function travelDaySummaryParts(day) {
      const info = dayTravelInfo(day);
      const parts = [];
      if (info.mode) parts.push(travelDayModeLabel(info.mode));
      if (info.origin || info.destination) parts.push(flowPairText(info.origin || t("overview_fact_unset"), info.destination || t("overview_fact_unset")));
      if (info.departureTime || info.arrivalTime) parts.push(flowPairText(info.departureTime || "…", info.arrivalTime || "…"));
      if (info.arrivalDate) parts.push(t("travel_day_arrival_date_short") + ": " + info.arrivalDate);
      if (info.reference) parts.push(info.reference);
      return parts;
    }
    function itemTravelFromPrevious(item) { return DayIntel.travelFromPrevious(item); }
    function itemCategory(item) {
      const v = item && item.category;
      return (typeof v === "string" && CATEGORY_ORDER.indexOf(v) !== -1) ? v : "";
    }
    function tripDestination(trip) { return (trip && typeof trip.destination === "string") ? trip.destination.trim() : ""; }
    function tripBase(trip) {
      const b = trip && trip.base;
      if (!b || typeof b !== "object") return { name:"", location:"", note:"" };
      return {
        name: typeof b.name === "string" ? b.name.trim() : "",
        location: typeof b.location === "string" ? b.location.trim() : "",
        note: typeof b.note === "string" ? b.note.trim() : ""
      };
    }
    function tripTimezone(trip) {
      const v = trip && trip.timezone;
      return (typeof v === "string" && v && isValidTimeZone(v)) ? v : "";
    }
    function activeTripTimezone() { return tripTimezone(getActiveTrip()); }
    function activeTripClock(now) { return Today.clock(now, activeTripTimezone()); }

    /* v1070 logistics accessors. They never rewrite stored objects merely by
       reading them, so old trips and unknown future fields remain untouched. */
    function tripStays(trip) { return Logistics.tripStays(trip); }
    function tripJourneys(trip) { return Logistics.tripJourneys(trip); }
    function stayInfo(stay) { return Logistics.stayInfo(stay); }
    function journeyInfo(journey) { return Logistics.journeyInfo(journey); }
    function itemBookingInfo(item) { return Logistics.bookingInfo(item && item.booking); }
    function scheduleRelevantItems(day) {
      const items = day && Array.isArray(day.items) ? day.items : [];
      return items.filter((item) => itemBookingInfo(item).status !== "cancelled");
    }
    function itemPaymentStatus(item) { return Finance.paymentStatus(item && item.booking && item.booking.paymentStatus); }
    function tripExpenses(trip) { return Finance.tripExpenses(trip); }
    function tripDocuments(trip) { return Finance.tripDocuments(trip); }
    function tripTasks(trip) { return Operations.tripTasks(trip); }
    function tripTaskStats(trip) { return Operations.taskStats(trip, todayISO()); }
    function paymentStatusLabel(status) {
      const map={ unpaid:"payment_status_unpaid", partial:"payment_status_partial", paid:"payment_status_paid", later:"payment_status_later" };
      return map[status] ? t(map[status]) : t("payment_status_not_tracked");
    }
    function expenseCategoryLabel(category) {
      const map={ accommodation:"expense_cat_accommodation", transport:"expense_cat_transport", food:"expense_cat_food", attraction:"expense_cat_attraction", shopping:"expense_cat_shopping", insurance:"expense_cat_insurance", connectivity:"expense_cat_connectivity", other:"expense_cat_other" };
      return t(map[category] || map.other);
    }
    function documentTypeLabel(type) {
      const map={ booking:"document_type_booking", ticket:"document_type_ticket", voucher:"document_type_voucher", insurance:"document_type_insurance", transport:"document_type_transport", other:"document_type_other" };
      return t(map[type] || map.other);
    }
    function formatMoneyAmount(amount, currency) {
      if (!Number.isFinite(amount) || !currency) return "";
      let number="";
      try { const meta = LANG_META[currentLang] || LANG_META[DEFAULT_LANG]; number = new Intl.NumberFormat(meta.lang, { maximumFractionDigits:2 }).format(amount); }
      catch (err) { number = String(Math.round((amount + Number.EPSILON) * 100) / 100); }
      return number + " " + currency;
    }
    const COMMON_CURRENCIES = Object.freeze([
      "ILS","EUR","USD","GBP","CHF","CAD","AUD","NZD","JPY","CNY","KRW","HKD","SGD","INR",
      "AED","TRY","PLN","CZK","HUF","RON","BGN","SEK","NOK","DKK","ISK","THB","ZAR","BRL","MXN","ARS","CLP","COP"
    ]);
    function currencyDisplayName(code) {
      const c = Finance.currencyCode(code); if (!c) return "";
      const meta = LANG_META[currentLang] || LANG_META[DEFAULT_LANG];
      let name = c, symbol = "";
      try {
        if (typeof Intl.DisplayNames === "function") name = new Intl.DisplayNames([meta.lang], { type:"currency" }).of(c) || c;
      } catch (_) {}
      try {
        const part = new Intl.NumberFormat(meta.lang, { style:"currency", currency:c, currencyDisplay:"narrowSymbol", maximumFractionDigits:0 }).formatToParts(0).find(x => x.type === "currency");
        symbol = part && part.value && part.value !== c ? part.value : "";
      } catch (_) {}
      return (symbol ? symbol + " · " : "") + name + " (" + c + ")";
    }
    function tripCurrencyCodes(trip) {
      const out = new Set(COMMON_CURRENCIES);
      const b = Finance.budgetInfo(trip); if (b.currency) out.add(b.currency);
      Finance.totalsByCurrency(trip).forEach(x => { if (x.currency) out.add(x.currency); });
      return Array.from(out);
    }
    function populateCurrencySelect(select, selected, trip) {
      if (!select) return;
      const current = Finance.currencyCode(selected);
      const codes = tripCurrencyCodes(trip); if (current && codes.indexOf(current) === -1) codes.unshift(current);
      select.innerHTML = "";
      const blank = document.createElement("option"); blank.value = ""; blank.textContent = t("currency_choose"); select.appendChild(blank);
      codes.forEach(code => { const opt=document.createElement("option");opt.value=code;opt.textContent=currencyDisplayName(code);select.appendChild(opt); });
      select.value = current || "";
    }
    function financeId(prefix) { return prefix + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,8); }
    function logisticsTrackingActive(trip) { return tripStays(trip).length > 0 || tripJourneys(trip).length > 0; }
    function bookingStatusLabel(status) {
      const map = {
        planned:"booking_status_planned", booked:"booking_status_booked",
        confirmed:"booking_status_confirmed", cancelled:"booking_status_cancelled"
      };
      return map[status] ? t(map[status]) : t("booking_status_not_set");
    }
    function journeyModeLabel(mode) {
      const map = {
        flight:"travel_day_mode_flight", train:"travel_mode_train", bus:"travel_day_mode_bus",
        ferry:"travel_day_mode_ferry", public:"travel_mode_public", taxi:"travel_mode_taxi",
        transfer:"journey_mode_transfer", walk:"travel_mode_walk", other:"travel_mode_other"
      };
      return map[mode] ? t(map[mode]) : t("travel_mode_unknown");
    }
    function logisticsId(prefix) {
      return prefix + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
    }
    function effectiveBaseLabelForDate(trip, date) {
      const eff = Logistics.effectiveStayForDate(trip, date);
      if (eff.kind === "stay") {
        const info = stayInfo(eff.stay);
        return info.name || info.location || "";
      }
      if (eff.kind === "legacy") return eff.stay.name || eff.stay.location || "";
      return "";
    }

    /* v1050 planning summaries consume existing prefs without inventing
       route, distance or venue facts. */
    function formatMinutesCompact(min) {
      if (min == null || !Number.isFinite(min)) return "";
      const n = Math.max(0, Math.round(min));
      const h = Math.floor(n / 60), m = n % 60;
      if (h && m) return tf("dur_hours_minutes", { h, m });
      if (h) return tf("dur_hours", { h });
      return tf("dur_minutes", { m });
    }
    function transportModeLabel(mode) {
      const map = {
        walk: "prefs_transport_walk", public: "prefs_transport_public",
        taxi: "prefs_transport_taxi", train: "prefs_transport_train"
      };
      return map[mode] ? t(map[mode]) : mode;
    }
    function travelModeLabel(mode) {
      const map = {
        walk: "travel_mode_walk", public: "travel_mode_public", taxi: "travel_mode_taxi",
        train: "travel_mode_train", other: "travel_mode_other", none: "travel_mode_none"
      };
      return map[mode] ? t(map[mode]) : t("travel_mode_unknown");
    }
    function mobilitySummaryLabels(trip) {
      const prefs = (settings && settings.prefs) || {};
      const access = (settings && settings.access) || {};
      const labels = [];
      if (prefs.noSelfDrive) labels.push(t("mobility_no_drive_summary"));
      if (Array.isArray(prefs.transport) && prefs.transport.length) {
        labels.push(tf("mobility_transport_prefix", { modes: prefs.transport.map(transportModeLabel).join(", ") }));
      }
      if (prefs.maxWalkKm != null && !isNaN(prefs.maxWalkKm)) labels.push(tf("mobility_walk_limit", { n: prefs.maxWalkKm }));
      if (access.shortWalks) labels.push(t("mobility_short_walks"));
      if (trip && Array.isArray(trip.days)) {
        const starts = trip.days.filter(day => dayBaseFlow(day).startsAtBase).length;
        const returns = trip.days.filter(day => dayBaseFlow(day).returnsToBase).length;
        if (starts) labels.push(tf("mobility_days_start_base", { n: starts }));
        if (returns) labels.push(tf("mobility_days_return_base", { n: returns }));
      }
      return labels;
    }
    function hasAccessPlanningNeeds() {
      const a = (settings && settings.access) || {};
      return !!(a.stepFree || a.avoidStairs || a.elevatorNeeded || a.shortWalks || a.companion ||
        a.quietPreference || (a.wheelchair && a.wheelchair !== "none") || (typeof a.notes === "string" && a.notes.trim()));
    }
    function tripPlanningStats(trip) {
      const tripDays = trip && Array.isArray(trip.days) ? trip.days : [];
      const allItems = tripDays.flatMap(d => Array.isArray(d.items) ? d.items : []);
      const validDayDates = tripDays.map(day => day && day.date).filter(date => Logistics.validDate(date));
      const invalidDayDates = tripDays.filter(day => !Logistics.validDate(day && day.date)).length;
      const duplicateDayDates = validDayDates.length - new Set(validDayDates).size;
      const missingDayDates = tripDays.length === 0 ? 1 : 0;
      let conflicts = 0, invalidTimes = 0, travelUnknown = 0, insufficientTravel = 0;
      tripDays.forEach(day => {
        const a = DayIntel.analyzeDay(scheduleRelevantItems(day));
        conflicts += a.conflicts.length;
        invalidTimes += a.invalidRangeCount + a.malformedCount;
        travelUnknown += a.travelUnresolved;
        insufficientTravel += a.pairs.filter(pair => pair.status === "insufficient").length;
      });
      const accessActive = hasAccessPlanningNeeds();
      const accessNeedsCheck = accessActive
        ? allItems.filter(item => !itemAccessStatus(item) || itemAccessStatus(item) === "needscheck").length : 0;
      const accessIssues = accessActive ? allItems.filter(item => itemAccessStatus(item) === "problem").length : 0;
      const accessVerified = accessActive ? allItems.filter(isAccessVerified).length : 0;
      const travelDays = tripDays.filter(isTravelDay);

      const stays = tripStays(trip), journeys = tripJourneys(trip);
      const staysActive = stays.length > 0;
      const stayOverlaps = staysActive ? Logistics.stayOverlaps(trip).length : 0;
      const stayGapDates = staysActive ? Logistics.uncoveredDates(
        trip,
        Logistics.overnightDates(tripDays.map(day => day && day.date))
      ).length : 0;
      const stayDateProblems = stays.filter(raw => {
        const st = stayInfo(raw);
        if (st.status === "cancelled") return false;
        const any = !!(st.name || st.location || st.startDate || st.endDate || st.confirmation || st.provider || st.note);
        return any && (!st.name || !st.startDate || !st.endDate || st.startDate >= st.endDate);
      }).length;
      const journeyDataProblems = journeys.filter(raw => {
        const j = journeyInfo(raw);
        if (j.status === "cancelled") return false;
        const src = raw && typeof raw === "object" ? raw : {};
        const rawDate = typeof src.date === "string" ? src.date.trim() : "";
        const rawArrivalDate = typeof src.arrivalDate === "string" ? src.arrivalDate.trim() : "";
        const rawDepartureTime = typeof src.departureTime === "string" ? src.departureTime.trim() : "";
        const rawArrivalTime = typeof src.arrivalTime === "string" ? src.arrivalTime.trim() : "";
        const any = !!(rawDate || rawArrivalDate || rawDepartureTime || rawArrivalTime || j.mode || j.origin || j.destination || j.provider || j.serviceNumber || j.confirmation || j.note || j.status);
        if (!any) return false;
        if (!j.date || (rawArrivalDate && !j.arrivalDate) || (rawDepartureTime && !j.departureTime) || (rawArrivalTime && !j.arrivalTime)) return true;
        if (j.arrivalDate && j.arrivalDate < j.date) return true;
        const sameDate = !j.arrivalDate || j.arrivalDate === j.date;
        return !!(sameDate && j.departureTime && j.arrivalTime && j.arrivalTime < j.departureTime);
      }).length;
      const plannedStays = stays.filter(raw => stayInfo(raw).status === "planned").length;
      const plannedJourneys = journeys.filter(raw => journeyInfo(raw).status === "planned").length;
      const plannedActivityBookings = allItems.filter(item => itemBookingInfo(item).status === "planned").length;
      const bookingRows = Finance.bookingEntries(trip, Logistics);
      // v2600: one operational booking row = one action, even when the same
      // booking is both Planned and unpaid/partial. Booking Center owns the
      // detailed reason; Readiness must not inflate the traveller's workload.
      const bookingAttention = Finance.bookingAttentionEntries(trip, Logistics).length;
      const paymentAttention = bookingRows.filter(row => row.bookingStatus !== "cancelled" && (row.paymentStatus === "unpaid" || row.paymentStatus === "partial")).length;
      const documentNeeds = Finance.documentNeedsAttention(trip).length;
      const budgetSummary = Finance.budgetSummary(trip);
      const taskSummary = tripTaskStats(trip);

      return {
        conflicts, invalidTimes, travelUnknown, insufficientTravel,
        missingDayDates, invalidDayDates, duplicateDayDates,
        accessActive, accessNeedsCheck, accessIssues, accessVerified,
        missingDestination: !tripDestination(trip),
        missingBase: !(tripBase(trip).name || tripBase(trip).location) && !staysActive,
        missingTimezone: !tripTimezone(trip),
        activityCount: allItems.length,
        dayCount: tripDays.length,
        travelDayCount: travelDays.length,
        arrivalDays: travelDays.filter(d => dayType(d) === "arrival").length,
        departureDays: travelDays.filter(d => dayType(d) === "departure").length,
        transferDays: travelDays.filter(d => dayType(d) === "transfer").length,
        logisticsActive: staysActive || journeys.length > 0,
        stayCount: stays.length,
        journeyCount: journeys.length,
        stayOverlaps,
        stayGapDates,
        stayDateProblems,
        journeyDataProblems,
        plannedStays,
        plannedJourneys,
        plannedActivityBookings,
        bookingAttention,
        paymentAttention,
        documentNeeds,
        budgetExceeded: budgetSummary.active && budgetSummary.exceeded,
        bookingCount: bookingRows.length,
        expenseCount: tripExpenses(trip).length,
        documentCount: tripDocuments(trip).length,
        taskCount: taskSummary.total,
        taskOpen: taskSummary.open,
        taskDone: taskSummary.done,
        taskOverdue: taskSummary.overdue || 0,
        taskDueToday: taskSummary.dueToday || 0,
        taskOtherOpen: Math.max(0,(taskSummary.open||0)-(taskSummary.overdue||0)-(taskSummary.dueToday||0))
      };
    }

    function readinessEntries(trip) {
      const st = tripPlanningStats(trip);
      const rows = [];
      const add = (level, text, area) => rows.push({ level, text, area: area || "setup" });
      /* v2600 Readiness 3.0
         Readiness has only two top-level states: real issue, or looks good.
         Operational follow-ups stay useful as neutral `action` rows but never
         turn the whole trip orange. Optional metadata and research TripMaster
         should eventually do itself are excluded entirely. */
      if (st.missingDayDates) add("issue", t("readiness_missing_trip_dates"), "setup");
      if (st.invalidDayDates) add("issue", tf("readiness_invalid_trip_dates", { n: st.invalidDayDates }), "setup");
      if (st.duplicateDayDates) add("issue", tf("readiness_duplicate_trip_dates", { n: st.duplicateDayDates }), "setup");
      if (st.conflicts) add("issue", tf("day_health_conflicts", { n: st.conflicts }), "schedule");
      if (st.invalidTimes) add("issue", tf("day_health_invalid_time", { n: st.invalidTimes }), "schedule");
      if (st.insufficientTravel) add("issue", tf("overview_travel_insufficient", { n: st.insufficientTravel }), "schedule");
      if (st.stayOverlaps) add("issue", tf("readiness_stay_overlap", { n: st.stayOverlaps }), "logistics");
      if (st.stayDateProblems) add("issue", tf("readiness_stay_date_problem", { n: st.stayDateProblems }), "logistics");
      if (st.journeyDataProblems) add("issue", tf("readiness_journey_data_problem", { n: st.journeyDataProblems }), "logistics");
      // Once stay tracking exists, an uncovered non-departure trip date is a
      // concrete accommodation gap rather than optional metadata.
      if (st.stayGapDates) add("issue", tf("readiness_stay_gaps", { n: st.stayGapDates }), "logistics");
      if (st.budgetExceeded) add("issue", t("readiness_budget_exceeded"), "money");
      if (st.taskOverdue) add("issue", tf("readiness_overdue_tasks", { n: st.taskOverdue }), "tasks");

      // Follow-ups: visible and actionable, but not a degraded Readiness state.
      if (st.travelUnknown) add("action", tf("overview_travel_unknown", { n: st.travelUnknown }), "schedule");
      if (st.bookingAttention) add("action", tf("readiness_booking_actions", { n: st.bookingAttention }), "bookings");
      if (st.documentNeeds) add("action", tf("readiness_documents_needed", { n: st.documentNeeds }), "documents");
      if (st.taskDueToday) add("action", tf("readiness_tasks_due_today", { n: st.taskDueToday }), "tasks");
      return rows;
    }

    function readinessAreaLabel(area) {
      const key = {
        schedule:"readiness_area_schedule", logistics:"readiness_area_logistics",
        bookings:"readiness_area_bookings", money:"readiness_area_money",
        documents:"readiness_area_documents", tasks:"readiness_area_tasks", access:"readiness_area_access",
        setup:"readiness_area_setup"
      }[area] || "readiness_area_setup";
      return t(key);
    }

    function closeReadinessSourceSheets() {
      ["overviewSheet", "tripBoardSheet"].forEach((id) => {
        const el = $(id);
        if (el && el.classList.contains("open")) closeSheetEl(id);
      });
    }

    function openAccessProfile(trip) {
      if (trip && trip.id !== activeTripId && !switchTrip(trip.id, { silent:true })) return;
      closeReadinessSourceSheets();
      openMenuSheet();
      const head = $("accessHead");
      if (head && head.getAttribute("aria-expanded") !== "true") head.click();
      window.setTimeout(() => {
        try { if (head) head.scrollIntoView({ block:"start", behavior:preferredScrollBehavior() }); } catch (_) {}
      }, 90);
    }

    function nextISODate(date) {
      const d = Logistics.validDate(date);
      if (!d) return "";
      const dt = new Date(d + "T00:00:00Z");
      dt.setUTCDate(dt.getUTCDate() + 1);
      return dt.toISOString().slice(0, 10);
    }

    function missingStayDates(trip) {
      if (!trip || !tripStays(trip).length) return [];
      const dates = Logistics.overnightDates((trip.days || []).map(day => day && day.date));
      return Logistics.uncoveredDates(trip, dates).sort();
    }

    function missingStayRange(trip, preferredDate) {
      const gaps = missingStayDates(trip);
      if (!gaps.length) return null;
      let startIndex = preferredDate ? gaps.indexOf(preferredDate) : 0;
      if (startIndex < 0) startIndex = 0;
      let first = gaps[startIndex], last = first;
      for (let i = startIndex + 1; i < gaps.length; i++) {
        if (gaps[i] !== nextISODate(last)) break;
        last = gaps[i];
      }
      return { startDate:first, endDate:nextISODate(last) };
    }

    function openMissingStayEditor(trip, preferredDate) {
      const range = missingStayRange(trip, preferredDate);
      if (!range) return false;
      closeReadinessSourceSheets();
      if (trip.id !== activeTripId && !switchTrip(trip.id, { silent:true })) return false;
      _logisticsTripId = trip.id;
      renderLogisticsHub();
      openStaySheet(null);
      $("stayStartDate").value = range.startDate;
      $("stayEndDate").value = range.endDate;
      window.setTimeout(() => {
        const name = $("stayName");
        try { if (name && $("staySheet").classList.contains("open")) name.focus(); } catch (_) {}
      }, 90);
      return true;
    }

    function openReadinessArea(area, trip) {
      if (!trip) return;
      if (area === "schedule") { closeReadinessSourceSheets(); continuePlanning(trip.id); return; }
      if (area === "logistics") {
        if (openMissingStayEditor(trip)) return;
        closeReadinessSourceSheets(); openLogisticsSheet(trip.id); return;
      }
      if (area === "bookings") { closeReadinessSourceSheets(); openBookingCenterSheet(trip.id); return; }
      if (area === "money") { closeReadinessSourceSheets(); openMoneySheet(trip.id); return; }
      if (area === "documents") { closeReadinessSourceSheets(); openDocumentsSheet(trip.id); return; }
      if (area === "tasks") { closeReadinessSourceSheets(); openTripBoardSheet(trip.id, "tasks"); return; }
      if (area === "access") { openAccessProfile(trip); return; }
      if (area === "setup") {
        const stats = tripPlanningStats(trip);
        if (stats.missingDayDates) {
          closeReadinessSourceSheets();
          if (trip.id !== activeTripId && !switchTrip(trip.id, { silent:true })) return;
          currentView = "planner";
          days = trip.days || [];
          currentDayIndex = 0;
          renderCurrentView();
          updateHeaderInfo();
          openFirstDaySheet();
          return;
        }
      }
      openTripDetailsSheet(trip.id);
    }

    function tripReadiness(trip) {
      const rows = readinessEntries(trip);
      const issues = rows.filter(r => r.level === "issue").length;
      const actions = rows.filter(r => r.level === "action").length;
      // Neutral actions never downgrade the trip into a warning state.
      const level = issues ? "issue" : "ready";
      return { level, rows, issues, actions };
    }

    function readinessLabel(level) {
      return level === "issue" ? t("readiness_issue") : t("readiness_ready");
    }

    function planningIssueLabels(trip) {
      return readinessEntries(trip).map(row => row.text);
    }

    function renderPlanningSummary(el, trip) {
      if (!el) return;
      el.innerHTML = "";
      const mobility = mobilitySummaryLabels(trip);
      const readiness = trip ? tripReadiness(trip) : null;
      const rows = readiness ? readiness.rows : [];
      if (!mobility.length && !rows.length) { el.style.display = "none"; return; }
      const title = document.createElement("div");
      title.className = "planning-summary-title";
      title.textContent = t("planning_profile_title");
      el.appendChild(title);
      if (readiness) {
        const status = document.createElement("div");
        status.className = "readiness-status readiness-" + readiness.level;
        status.textContent = readinessLabel(readiness.level);
        el.appendChild(status);
      }
      if (mobility.length) {
        const chips = document.createElement("div"); chips.className = "planning-chips";
        mobility.forEach(label => { const c=document.createElement("span"); c.className="planning-chip"; c.textContent=label; chips.appendChild(c); });
        el.appendChild(chips);
      }
      if (rows.length) {
        const list = document.createElement("div"); list.className = "planning-issues";
        rows.forEach(entry => { const row=document.createElement("div"); row.className="planning-issue readiness-row readiness-"+entry.level; row.textContent="• " + entry.text; list.appendChild(row); });
        el.appendChild(list);
      }
      el.style.display = "";
    }

    function renderDayHealth(day) {
      const el = $("dayHealthStrip");
      if (!el) return;
      el.innerHTML = "";
      if (!day || !Array.isArray(day.items)) { el.style.display = "none"; return; }
      const a = DayIntel.analyzeDay(scheduleRelevantItems(day));
      const chips = document.createElement("div"); chips.className = "day-health-chips";
      const addChip = (label, cls) => { const c=document.createElement("span"); c.className="day-health-chip"+(cls?" "+cls:""); c.textContent=label; chips.appendChild(c); };
      if (isTravelDay(day)) addChip(dayTypeIcon(dayType(day)) + " " + dayTypeLabel(dayType(day)), "travel-day");
      addChip(tf("day_health_activities", { n: day.items.length }));
      if (a.spanMin != null && day.items.length) addChip(tf("day_health_span", { n: formatMinutesCompact(a.spanMin) }));
      if (a.conflicts.length) addChip(tf("day_health_conflicts", { n: a.conflicts.length }), "warn");
      const bad = a.invalidRangeCount + a.malformedCount;
      if (bad) addChip(tf("day_health_invalid_time", { n: bad }), "warn");
      const insufficientTravel = a.pairs.filter(pair => pair.status === "insufficient").length;
      if (insufficientTravel) addChip(tf("day_health_travel_insufficient", { n: insufficientTravel }), "warn");
      if (a.travelUnresolved) addChip(tf("day_health_travel_unknown", { n: a.travelUnresolved }), "neutral");
      const flow = dayBaseFlow(day);
      if (flow.startsAtBase) addChip(t("day_starts_at_base"), "neutral");
      if (flow.returnsToBase) addChip(t("day_returns_to_base"), "neutral");
      el.appendChild(chips);
      const details = [];
      a.conflicts.slice(0, 3).forEach(c => {
        const first=day.items[c.firstIndex]||{}, second=day.items[c.secondIndex]||{};
        details.push(tf("day_issue_overlap", { a:first.title||first.time||"?", b:second.title||second.time||"?", n:c.overlapMin }));
      });
      a.entries.filter(e => e.invalidRange).slice(0, 2).forEach(e => details.push(tf("day_issue_invalid_range", { name:(e.item&&e.item.title)||e.startRaw||"?" })));
      a.entries.filter(e => e.malformedStart || e.malformedEnd).slice(0, 2).forEach(e => details.push(tf("day_issue_malformed_time", { name:(e.item&&e.item.title)||"?" })));
      if (details.length) {
        const d=document.createElement("div"); d.className="day-health-details";
        details.forEach(text => { const row=document.createElement("div"); row.textContent=text; d.appendChild(row); });
        el.appendChild(d);
      }
      el.style.display = "";
    }

    function renderDayLogistics(day) {
      const el = $("dayLogisticsStrip");
      if (!el) return;
      el.innerHTML = "";
      const trip = getActiveTrip();
      if (!trip || !day || !day.date || !logisticsTrackingActive(trip)) { el.style.display = "none"; return; }

      const rows = [];
      if (Logistics.staysTrackingActive(trip)) {
        const eff = Logistics.effectiveStayForDate(trip, day.date);
        if (eff.kind === "stay") {
          const st = stayInfo(eff.stay);
          rows.push({ cls:"stay", text:"🏨 " + t("day_logistics_base") + ": " + (st.name || st.location || t("overview_fact_unset")) + (st.name && st.location ? " · " + st.location : "") });
        } else if (eff.kind === "ambiguous") {
          rows.push({ cls:"warn", text:"⚠️ " + t("day_logistics_stay_ambiguous") });
        } else if (eff.kind === "gap" && dayType(day) !== "departure") {
          rows.push({ cls:"neutral", text:"🏨 " + t("day_logistics_stay_gap") });
        }
        const ending = Logistics.staysEndingOn(trip, day.date);
        const starting = Logistics.staysStartingOn(trip, day.date);
        if (ending.length === 1) {
          const st = stayInfo(ending[0]), pay=Finance.paymentStatus(ending[0]&&ending[0].paymentStatus); rows.push({ cls:"transition", text:"↗ " + t("day_logistics_checkout") + ": " + (st.name || st.location || t("overview_fact_unset")) + (pay ? " · " + paymentStatusLabel(pay) : "") });
        }
        if (starting.length === 1 && !(eff.kind === "stay" && starting[0] === eff.stay && !isTravelDay(day))) {
          const st = stayInfo(starting[0]), pay=Finance.paymentStatus(starting[0]&&starting[0].paymentStatus); rows.push({ cls:"transition", text:"↘ " + t("day_logistics_checkin") + ": " + (st.name || st.location || t("overview_fact_unset")) + (pay ? " · " + paymentStatusLabel(pay) : "") });
        }
      }

      Logistics.journeysForDate(trip, day.date).forEach((raw) => {
        const j = journeyInfo(raw);
        const bits = [];
        if (j.mode) bits.push(journeyModeLabel(j.mode));
        if (j.origin || j.destination) bits.push(flowPairText(j.origin || "…", j.destination || "…"));
        if (j.departureTime || j.arrivalTime) bits.push(flowPairText(j.departureTime || "…", j.arrivalTime || "…"));
        if (j.status) bits.push(bookingStatusLabel(j.status));
        const pay=Finance.paymentStatus(raw&&raw.paymentStatus); if(pay)bits.push(paymentStatusLabel(pay));
        rows.push({ cls:"journey", text:"🚆 " + bits.join(" · ") });
      });

      if (!rows.length) { el.style.display = "none"; return; }
      rows.forEach((r) => { const row=document.createElement("div"); row.className="day-logistics-row "+r.cls; row.textContent=r.text; el.appendChild(row); });
      el.style.display = "";
    }

    function travelPairText(pair) {
      if (!pair) return "";
      const parts = [];
      const tr = pair.travel || {};
      if (tr.known) {
        const mode = tr.mode ? travelModeLabel(tr.mode) : "";
        const dur = tr.durationMin != null ? formatMinutesCompact(tr.durationMin) : "";
        if (mode || dur) parts.push([mode, dur].filter(Boolean).join(" · "));
        if (tr.note) parts.push(tr.note);
      }
      if (pair.availableGapMin === 0) parts.push(t("gap_back_to_back"));
      else if (pair.availableGapMin > 0) parts.push(tf("gap_minutes", { n: pair.availableGapMin }));
      if (pair.status === "unknown") parts.push(t("travel_unknown"));
      else if (pair.status === "gap_unknown") parts.push(t("travel_gap_unknown"));
      else if (pair.status === "enough") parts.push(t("travel_enough"));
      else if (pair.status === "tight") parts.push(tf("travel_tight", { n: Math.max(0, pair.bufferMin || 0) }));
      else if (pair.status === "insufficient") parts.push(tf("travel_insufficient", { n: Math.abs(pair.bufferMin || 0) }));
      return parts.join(" · ");
    }

    /* ══ TRAVEL-TIMELINE-001 (v1050-RC2) ══
       Travel belongs BETWEEN two activities, not buried inside the second
       one's body. renderActivities() draws a segment row from this. It is
       shown ONLY when the traveller actually chose to track that transfer
       (travel.known is false for an entirely empty travel object), so an
       ordinary day that never uses the travel fields stays completely
       uncluttered and TripMaster never implies it knows a transfer it does
       not. Every verdict still comes from travelPairText(), i.e. from the
       user's own minutes — nothing is routed, measured or estimated. */
    function travelSegmentInfo(pair) {
      if (!pair) return null;
      const tr = pair.travel || {};
      if (!tr.known) return null;
      const text = travelPairText(pair);
      if (!text) return null;
      let tone = "";
      if (pair.status === "insufficient") tone = "warn";
      else if (pair.status === "tight") tone = "tight";
      else if (pair.status === "unknown" || pair.status === "gap_unknown") tone = "neutral";
      return { text, tone, mode: tr.mode || "" };
    }

    function travelSegmentIcon(mode) {
      const icons = { walk: "🚶", public: "🚌", taxi: "🚕", train: "🚆", other: "➡️", none: "📍" };
      return icons[mode] || "🚶";
    }

    /* ── State transaction (A4/A5/A7) ──
       snapshotState() also captures the HOME days, which live outside
       trips[] under KEY_DAYS, so an undo of Reset or Restore can put them
       back. restoreStateFrom() re-establishes the boot-time aliasing
       invariant: while a trip is active, `days` IS activeTrip.days. ── */
    function snapshotState() {
      return JSON.stringify({
        trips: trips,
        activeTripId: activeTripId,
        currentView: currentView,
        currentDayIndex: currentDayIndex,
        homeDays: normalizeDays(safeParseJSON(KEY_DAYS, []))
      });
    }

    function restoreStateFrom(json) {
      const snap = JSON.parse(json);
      trips = normalizeTrips(Array.isArray(snap.trips) ? snap.trips : []);
      activeTripId = snap.activeTripId || null;
      currentView = snap.currentView === "home" ? "home" : (snap.currentView === "today" && activeTripId ? "today" : (activeTripId ? "planner" : "home"));
      const active = getActiveTrip();
      if (active) {
        if (!Array.isArray(active.days)) active.days = [];
        days = active.days;
      } else {
        // Home is no longer an itinerary container in RC2. Any legacy Home
        // days live under KEY_DAYS until migrated, never in the active view.
        days = [];
      }
      currentDayIndex = (typeof snap.currentDayIndex === "number") ? snap.currentDayIndex : 0;
      if (currentDayIndex >= days.length) currentDayIndex = Math.max(0, days.length - 1);
      return snap;
    }

    /* BETA-CANONICAL-STATE-001 (v2400 RC2): safety/readout flows must
       read the persisted source of truth, not a potentially stale window copy.
       This intentionally does NOT clear _externalStatePending: a user may still
       have an editor open whose eventual save must be conflict-guarded. */
    function readCanonicalTripState() {
      try {
        const canonical = {
          trips: normalizeTrips(safeParseJSON(KEY_TRIPS, [])),
          activeTripId: localStorage.getItem(KEY_ACTIVE_TRIP) || null
        };
        return _unreadableStorageKeys.has(KEY_TRIPS)?null:canonical;
      } catch (err) {
        console.warn("TripMaster: canonical trip state read failed", err);
        return null;
      }
    }

    function canonicalTripStorageToken() {
      try {
        return (localStorage.getItem(KEY_TRIPS) || "[]") + "\n" + (localStorage.getItem(KEY_ACTIVE_TRIP) || "");
      } catch (_) { return "__unavailable__"; }
    }

    function openSheetHasStaleTripToken() {
      const current = canonicalTripStorageToken();
      const open = Array.from(document.querySelectorAll(".sheet.open"));
      return open.some((sheet) => {
        const token = sheet.dataset ? sheet.dataset.tripStateToken : "";
        return !!token && token !== current;
      });
    }

    function guardExternalStateBeforeWrite() {
      const swStatus = window.__TM_SW_STATUS__;
      if (_reloadRequiredForVersion || (swStatus && swStatus.reloadRequired === true && swStatus.controllerMatchesApp === false)) {
        _reloadRequiredForVersion = true;
        _stateWriteBlockReason = "update";
        recordLifecycleEvent("write_blocked",{scope:"trip",reason:"update"});
        showUpdateBanner(true);
        showToast(t("toast_update_reload_required"));
        return false;
      }
      // While a controlled page is still proving controller identity, fail
      // closed for this write WITHOUT latching a permanent reload requirement.
      // A matching reply clears the short proof window and the next tap works.
      if (swStatus && swStatus.reloadRequired === true && swStatus.controllerMatchesApp == null) {
        _stateWriteBlockReason = "update";
        recordLifecycleEvent("write_blocked",{scope:"trip",reason:"update"});
        showToast(t("toast_update_reload_required"));
        return false;
      }

      // CROSS-WINDOW-EDITOR-002 (v3000 RC2): storage events are normally the
      // first signal, but a frozen/discarded tab can miss one. Every sheet
      // remembers the canonical trip-state token from the moment it opened,
      // so an editor can still detect that its backing arrays are stale.
      if (canonicalTripStorageToken() !== _observedTripToken || openSheetHasStaleTripToken()) _externalStatePending = true;

      if(!_externalStatePending){_stateWriteBlockReason="";return true;}
      _stateWriteBlockReason="external";
      recordLifecycleEvent("write_blocked",{scope:"trip",reason:"external"});

      // Never adopt external state underneath an open editor. Keep the
      // pending flag set; closeSheetEl() schedules a safe reload immediately
      // after the modal closes. Repeated Save taps therefore remain blocked.
      if (topOpenSheet()) {
        showToast(t("toast_external_state_pending"));
        return false;
      }

      reloadStateAfterWake();
      showToast(t("toast_external_state_blocked"));
      return false;
    }

    function canonicalPreferenceTokens() {
      try {
        return {
          settings: localStorage.getItem(KEY_SETTINGS) || "",
          theme: localStorage.getItem(KEY_THEME) || ""
        };
      } catch (_) { return null; }
    }

    function detectMissedPreferenceChanges() {
      const token = canonicalPreferenceTokens();
      if (!token) return;
      if (_settingsStorageToken !== null && token.settings !== _settingsStorageToken) _externalSettingsPending = true;
      if (_themeStorageToken !== null && token.theme !== _themeStorageToken) _externalThemePending = true;
    }

    function updatePreferenceStorageTokens() {
      const token = canonicalPreferenceTokens();
      if (!token) return;
      _settingsStorageToken = token.settings;
      _themeStorageToken = token.theme;
    }

    function guardPreferenceWrite(kind) {
      const swStatus = window.__TM_SW_STATUS__;
      if (_reloadRequiredForVersion || (swStatus && swStatus.reloadRequired === true && swStatus.controllerMatchesApp === false)) {
        _reloadRequiredForVersion = true;
        _stateWriteBlockReason = "update";
        recordLifecycleEvent("write_blocked",{scope:kind,reason:"update"});
        showUpdateBanner(true);
        showToast(t("toast_update_reload_required"));
        return false;
      }
      if (swStatus && swStatus.reloadRequired === true && swStatus.controllerMatchesApp == null) {
        _stateWriteBlockReason = "update";
        recordLifecycleEvent("write_blocked",{scope:kind,reason:"update"});
        showToast(t("toast_update_reload_required"));
        return false;
      }
      detectMissedPreferenceChanges();
      if (kind === "settings" && _externalSettingsPending) {
        recordLifecycleEvent("write_blocked",{scope:"settings",reason:"external"});
        adoptExternalSettingsFromStorage();
        showToast(t("toast_external_state_blocked"));
        return false;
      }
      if (kind === "theme" && _externalThemePending) {
        recordLifecycleEvent("write_blocked",{scope:"theme",reason:"external"});
        adoptExternalThemeFromStorage();
        showToast(t("toast_external_state_blocked"));
        return false;
      }
      _stateWriteBlockReason = "";
      return true;
    }

    function guardPreferenceStateBeforeDestructiveWrite() {
      detectMissedPreferenceChanges();
      if (!_externalSettingsPending && !_externalThemePending) return true;
      recordLifecycleEvent("write_blocked",{scope:"destructive",reason:"external"});
      // Reset/Restore write both preference keys. Never snapshot or preserve a
      // stale language/theme after another window changed them. Converge first
      // and require a fresh explicit destructive confirmation.
      if (_externalSettingsPending) adoptExternalSettingsFromStorage();
      if (_externalThemePending) adoptExternalThemeFromStorage();
      showToast(t("toast_external_state_blocked"));
      return false;
    }

    /* ACTIVE-TRIP-001 (v1040 / A4): KEY_TRIPS is written on EVERY commit,
       including while Home is selected. Before v1040, deleting the active
       trip filtered trips[] in memory and then called goHome(), which wrote
       KEY_ACTIVE_TRIP but never KEY_TRIPS — so the deleted trip came back on
       reload, and only the pagehide/visibilitychange handler happened to
       rescue it later. Writing trips unconditionally costs one small write
       and makes that class of bug structurally impossible. */
    function restampOpenSheetsAfterOwnTripWrite(previousToken) {
      const nextToken = canonicalTripStorageToken();
      const datasets = Array.from(document.querySelectorAll(".sheet.open")).map(sheet => sheet.dataset).filter(Boolean);
      // Only advance sheets that were current immediately before OUR write.
      // A sheet that was already stale must retain its evidence and remain
      // blocked until it closes and canonical state is adopted.
      Operations.restampMatchingStateTokens(datasets, previousToken, nextToken);
    }

    function persistState() {
      const previousToken = canonicalTripStorageToken();
      const active = getActiveTrip();
      if (active) active.days = days;
      const entries = [
        [KEY_TRIPS, JSON.stringify(trips)],
        [KEY_ACTIVE_TRIP, activeTripId || ""]
      ];
      // KEY_DAYS is a legacy migration inbox only. RC2 never writes planner
      // content back into it, which prevents Home from becoming a second data path.
      const ok = writeAll(entries);
      if (ok) restampOpenSheetsAfterOwnTripWrite(previousToken);
      return ok;
    }

    function commitState(mutate, undoRecord) {
      if(!guardExternalStateBeforeWrite())return false;
      const before = snapshotState();
      try {
        mutate();
      } catch (err) {
        console.warn("TripMaster: mutation failed, rolling back", err);
        restoreStateFrom(before);
        reportStorageFailure();
        return false;
      }
      if (!persistState()) {
        restoreStateFrom(before);
        reportStorageFailure();
        return false;
      }
      if (undoRecord) setUndo(before, undoRecord);
      return true;
    }

    /* saveDays() keeps its name and its call sites. It is now the guarded
       path and returns a boolean; saveTrips() deliberately does NOT sync
       activeTrip.days, because createTrip() calls it at a moment when
       `days` still holds the PREVIOUS trip's days. */
    function saveDays()  { return persistState(); }
    function saveTrips() {
      if(!guardExternalStateBeforeWrite())return false;
      const previousToken = canonicalTripStorageToken();
      const ok = writeAll([
        [KEY_TRIPS, JSON.stringify(trips)],
        [KEY_ACTIVE_TRIP, activeTripId || ""]
      ]);
      if (ok) restampOpenSheetsAfterOwnTripWrite(previousToken);
      return ok;
    }

    /* ── UNDO-001 (v1040 / A5) ──
       One step, not a history. The record is a whole-state snapshot taken
       immediately before the destructive commit, which is why "restore the
       exact relevant data" needs no per-operation restore logic and cannot
       drift out of sync with the model. Reset and Restore additionally carry
       settings and theme. ── */
    let _undo = null;

    function undoStorageSignature() {
      try {
        return JSON.stringify([
          localStorage.getItem(KEY_TRIPS) || "",
          localStorage.getItem(KEY_ACTIVE_TRIP) || "",
          localStorage.getItem(KEY_DAYS) || "",
          localStorage.getItem(KEY_SETTINGS) || "",
          localStorage.getItem(KEY_THEME) || ""
        ]);
      } catch (_) { return null; }
    }

    function setUndo(stateJson, record) {
      _undo = {
        state: stateJson,
        settings: (record && record.settings) || null,
        theme: (record && record.theme) || null,
        validAgainst: undoStorageSignature()
      };
    }
    function clearUndo() { _undo = null; }
    function invalidateUndoAfterExternalState() {
      if (!_undo) return;
      clearUndo();
      const toast = $("toast");
      if (toast && toast.querySelector(".toast-action")) {
        clearTimeout(showToast._t);
        toast.classList.remove("visible");
      }
    }

    function performUndo() {
      if (!_undo) { showToast(t("toast_nothing_to_undo")); return; }
      // A whole-state undo is valid only against the exact persisted state
      // that existed immediately after the undoable action. This remains safe
      // even after an external change has already auto-synced and cleared the
      // pending flag, or when a backgrounded page resumes later.
      const currentUndoSignature = undoStorageSignature();
      if (!currentUndoSignature || !_undo.validAgainst || currentUndoSignature !== _undo.validAgainst) {
        clearUndo();
        reloadStateAfterWake();
        showToast(t("toast_undo_expired_external"));
        return;
      }
      if(_externalStatePending){ clearUndo(); guardExternalStateBeforeWrite(); return; }
      if(!guardExternalStateBeforeWrite())return;
      const record = _undo;
      _undo = null;
      const fallbackState = snapshotState();
      const fallbackSettings = JSON.stringify(settings);
      let snap;
      try {
        snap = restoreStateFrom(record.state);
        if (record.settings) settings = normalizeSettings(JSON.parse(record.settings));
      } catch (err) {
        console.warn("TripMaster: undo could not rebuild state", err);
        try { restoreStateFrom(fallbackState); } catch (e) {}
        reportStorageFailure();
        return;
      }
      const active = getActiveTrip();
      const entries = [
        [KEY_TRIPS, JSON.stringify(trips)],
        [KEY_ACTIVE_TRIP, activeTripId || ""],
        [KEY_DAYS, JSON.stringify(normalizeDays(snap.homeDays))]
      ];
      if (record.settings) entries.push([KEY_SETTINGS, JSON.stringify(settingsForStorage())]);
      if (record.theme)    entries.push([KEY_THEME, record.theme]);
      if (!writeAll(entries)) {
        try {
          restoreStateFrom(fallbackState);
          settings = normalizeSettings(JSON.parse(fallbackSettings));
        } catch (e) {}
        reportStorageFailure();
        return;
      }
      if (record.settings || record.theme) updatePreferenceStorageTokens();
      if (record.theme === "dark") document.documentElement.setAttribute("data-theme", "dark");
      else if (record.theme)       document.documentElement.removeAttribute("data-theme");
      if (record.settings) {
        currentLang = settings.language;
        applyLanguage();
        renderPrefsAndAccess();
        renderTools();
      }
      resetAIForTripContextChange();
      renderCurrentView();
      updateHeaderInfo();
      if ($("logisticsSheet") && $("logisticsSheet").classList.contains("open")) renderLogisticsHub();
      if ($("bookingCenterSheet") && $("bookingCenterSheet").classList.contains("open")) renderBookingCenter();
      if ($("moneySheet") && $("moneySheet").classList.contains("open")) renderMoneyHub();
      if ($("documentsSheet") && $("documentsSheet").classList.contains("open")) renderDocumentsHub();
      const undoTrip = logisticsTrip();
      showToast(t("toast_undone"));
    }

    /* ── SNAPSHOT-001 (v1040 / A6) ──
       Reset and Restore are the two operations that can destroy everything
       at once. Both now write a recoverable local snapshot FIRST and abort
       if that write fails, so the destructive step can never run without a
       recovery path behind it. This is a single overwritten snapshot, not
       version history, and it never leaves the device. ── */
    function writeSafetySnapshot(reason) {
      // Keep an earlier usable snapshot intact during recovery. The exact raw
      // corrupt values are already preserved independently before replacement.
      if(reason==="restore"&&_unreadableStorageKeys.size){
        // Other keys may still be healthy. Preserve ALL replacement targets,
        // not only the corrupt key, and leave the earlier good snapshot intact.
        try{
          const rawEntries=[KEY_TRIPS,KEY_DAYS,KEY_ACTIVE_TRIP,KEY_SETTINGS,KEY_THEME].map(key=>{
            const raw=localStorage.getItem(key);
            if(!_unreadableStorageKeys.has(key))return [key,raw];
            const preservedKey=findPreservedCorruptKey(key,raw);
            if(!preservedKey)throw new Error("Preserved source unavailable");
            return [key,{corruptBackupKey:preservedKey}];
          });
          const previous=localStorage.getItem("tm_recovery_raw_snapshot");
          if(previous){try{if(JSON.stringify(JSON.parse(previous).rawEntries)===JSON.stringify(rawEntries))return true;}catch(_){}}
          return writeAll([["tm_recovery_raw_snapshot",JSON.stringify({snapshotVersion:2,at:new Date().toISOString(),rawEntries})]]);
        }catch(_){return false;}
      }
      const canonical = readCanonicalTripState();
      if(!canonical)return false;
      let payload;
      try {
        const canonicalSettings = normalizeSettings(safeParseJSON(KEY_SETTINGS, null));
        payload = JSON.stringify({
          app: "TripMaster",
          snapshotVersion: 1,
          reason: reason,
          createdAt: new Date().toISOString(),
          trips: canonical.trips,
          activeTripId: canonical.activeTripId,
          homeDays: normalizeDays(safeParseJSON(KEY_DAYS, [])),
          settings: settingsForStorage(canonicalSettings),
          theme: localStorage.getItem(KEY_THEME) || "light"
        });
      } catch (err) {
        console.warn("TripMaster: could not build safety snapshot", err);
        return false;
      }
      return writeAll([[KEY_SAFETY_SNAPSHOT, payload]]);
    }

    function readSafetySnapshot() {
      let raw=null;
      try { raw=localStorage.getItem(KEY_SAFETY_SNAPSHOT); } catch (_) { return null; }
      if(!raw) return null;
      try {
        const snap=JSON.parse(raw);
        if(!snap||snap.app!=="TripMaster"||!Array.isArray(snap.trips))return null;
        return snap;
      } catch (_) { return null; }
    }
    function safetyReasonLabel(reason) {
      const key={reset:"safety_reason_reset",restore:"safety_reason_restore","trip-delete":"safety_reason_trip_delete",manual:"safety_reason_manual"}[reason]||"safety_reason_other";
      return t(key);
    }
    function storageWritableCheck(){
      const key="__tm_probe__"+Date.now();
      try{localStorage.setItem(key,"1");localStorage.removeItem(key);return true;}catch(_){try{localStorage.removeItem(key);}catch(e){}return false;}
    }
    const RUNTIME_DIAG_KEY = "tm_runtime_diag";
    const LIFECYCLE_DIAG_KEY = "tm_lifecycle_diag";
    const LIFECYCLE_DIAG_LIMIT = 40;
    const LIFECYCLE_EVENT_TYPES = new Set([
      "boot_ready","online","offline","visibility","pageshow","pagehide",
      "sw_status","update_ready","reload_required","update_apply_failed",
      "write_blocked","storage_change","state_sync","storage_write","migration","transfer"
    ]);
    let _lastBetaAudit = null;
    let _lifecycleDiagArmed = false;

    function readLifecycleDiagnostics() {
      try {
        const raw=sessionStorage.getItem(LIFECYCLE_DIAG_KEY);
        const rows=raw?JSON.parse(raw):[];
        return Array.isArray(rows)?rows.filter(x=>x&&LIFECYCLE_EVENT_TYPES.has(x.type)&&safeDiagnosticTimestamp(x.at)).slice(-LIFECYCLE_DIAG_LIMIT).map(x=>({at:safeDiagnosticTimestamp(x.at),type:x.type,detail:sanitizeLifecycleDetail(x.type,x.detail)})):[];
      } catch (_) { return []; }
    }
    function sanitizeLifecycleDetail(type, detail) {
      const d=detail&&typeof detail==="object"?detail:{};
      const out={};
      const bool=(key)=>{if(typeof d[key]==="boolean")out[key]=d[key];};
      const smallNum=(key,max)=>{const n=Number(d[key]);if(Number.isFinite(n)&&n>=0)out[key]=Math.min(Math.round(n),max);};
      if(type==="boot_ready") smallNum("durationMs",120000);
      else if(type==="visibility") out.state=d.state==="hidden"?"hidden":"visible";
      else if(type==="pageshow"||type==="pagehide") bool("persisted");
      else if(type==="sw_status") {
        for(const key of ["controlled","waiting","installing","applying","reloadRequired","controllerMatchesApp","controllerCheckTimedOut"])bool(key);
        smallNum("controllerCheckDurationMs",10000);smallNum("controllerCheckAttempts",4);
      }
      else if(type==="write_blocked") {
        if(["trip","settings","theme","destructive"].includes(d.scope))out.scope=d.scope;
        if(["update","external"].includes(d.reason))out.reason=d.reason;
      }
      else if(type==="storage_change") { if(["trip","settings","theme"].includes(d.scope))out.scope=d.scope; }
      else if(type==="state_sync") { for(const key of ["trips","settings","theme"])bool(key); }
      else if(type==="storage_write"){if(["quota","failed","rollback_failed","recovery_required"].includes(d.result))out.result=d.result;}
      else if(type==="migration"){if(["unchanged","repaired","persist_failed"].includes(d.result))out.result=d.result;smallNum("repairs",100000);smallNum("linkRepairs",100000);}
      else if(type==="transfer"){if(["restore","import"].includes(d.operation))out.operation=d.operation;if(["passed","invalid","storage","external"].includes(d.result))out.result=d.result;}
      return out;
    }
    function recordLifecycleEvent(type, detail) {
      if(!LIFECYCLE_EVENT_TYPES.has(type))return;
      try {
        const rows=readLifecycleDiagnostics();
        const safe=sanitizeLifecycleDetail(type,detail);
        const next={at:new Date().toISOString(),type};
        if(Object.keys(safe).length)next.detail=safe;
        const prior=rows.length?rows[rows.length-1]:null;
        const same=prior&&prior.type===next.type&&JSON.stringify(prior.detail||{})===JSON.stringify(next.detail||{});
        if(same&&Date.now()-Date.parse(prior.at||0)<250)return;
        rows.push(next);
        sessionStorage.setItem(LIFECYCLE_DIAG_KEY,JSON.stringify(rows.slice(-LIFECYCLE_DIAG_LIMIT)));
      } catch (_) {}
    }
    function armLifecycleDiagnostics() {
      if(_lifecycleDiagArmed)return;
      _lifecycleDiagArmed=true;
      const boot=window.__TM_BOOT_STATE__;
      if(boot&&Number.isFinite(boot.startedAt))recordLifecycleEvent("boot_ready",{durationMs:Math.max(0,Date.now()-boot.startedAt)});
      window.addEventListener("online",()=>recordLifecycleEvent("online"));
      window.addEventListener("offline",()=>recordLifecycleEvent("offline"));
      document.addEventListener("visibilitychange",()=>recordLifecycleEvent("visibility",{state:document.hidden?"hidden":"visible"}));
      window.addEventListener("pageshow",e=>recordLifecycleEvent("pageshow",{persisted:!!(e&&e.persisted)}));
      window.addEventListener("pagehide",e=>recordLifecycleEvent("pagehide",{persisted:!!(e&&e.persisted)}));
      window.addEventListener("tripmaster:sw-status",e=>{
        const x=e&&e.detail&&typeof e.detail==="object"?e.detail:{};
        recordLifecycleEvent("sw_status",{
          controlled:!!x.controlled,waiting:!!x.waiting,installing:!!x.installing,applying:!!x.applying,
          reloadRequired:x.reloadRequired===true,controllerMatchesApp:typeof x.controllerMatchesApp==="boolean"?x.controllerMatchesApp:undefined,
          controllerCheckTimedOut:x.controllerCheckTimedOut===true,controllerCheckDurationMs:x.controllerCheckDurationMs,controllerCheckAttempts:x.controllerCheckAttempts
        });
      });
      window.addEventListener("tripmaster:update-ready",()=>recordLifecycleEvent("update_ready"));
      window.addEventListener("tripmaster:reload-required",()=>recordLifecycleEvent("reload_required"));
      window.addEventListener("tripmaster:update-apply-failed",()=>recordLifecycleEvent("update_apply_failed"));
    }

    function safeDiagnosticTimestamp(value) {
      return typeof value==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))?value:null;
    }
    function safeDiagnosticError(value) {
      return ["Error","TypeError","RangeError","SyntaxError","ReferenceError","SecurityError","QuotaExceededError","NetworkError","AbortError","TimeoutError"].includes(value)?value:"Error";
    }
    function safeRuntimeFault(row) {
      if(!row||!safeDiagnosticTimestamp(row.at))return null;
      const files=new Set(["app.js","config.js","i18n.js","app-operations.js","app-finance.js","app-logistics.js","app-intelligence.js","app-travel.js","app-today.js","app-ai-client.js","sw-register.js","boot-watchdog.js","boot-guard.js","dir-boot.js"]);
      const candidate=typeof row.source==="string"?row.source.split(/[?#]/)[0].split(/[\\/]/).pop():"";
      const number=v=>Number.isFinite(v)&&v>=0?Math.min(1000000,Math.floor(v)):0;
      return {at:row.at,kind:row.kind==="unhandledrejection"?"unhandledrejection":"error",type:safeDiagnosticError(row.type),source:files.has(candidate)?candidate:"unknown",line:number(row.line),col:number(row.col)};
    }
    function clearBetaDiagnostics() {
      try{sessionStorage.removeItem(LIFECYCLE_DIAG_KEY);sessionStorage.removeItem(RUNTIME_DIAG_KEY);sessionStorage.removeItem("tm_boot_diag");}
      catch(_){showToast(t("toast_storage_failed"));return;}
      _storageHealth.lastWrite=null;_storageHealth.lastMigration=null;_storageHealth.lastTransfer=null;
    }
    function storageDiagnostics() {
      let estimatedUtf16Bytes=0,safetySnapshotBytes=0;
      try{for(const key of [KEY_TRIPS,KEY_DAYS,KEY_ACTIVE_TRIP,KEY_SETTINGS,KEY_THEME,KEY_SAFETY_SNAPSHOT,"tm_recovery_raw_snapshot"]){const value=localStorage.getItem(key);if(value!==null){const n=2*(key.length+value.length);estimatedUtf16Bytes+=n;if(key===KEY_SAFETY_SNAPSHOT)safetySnapshotBytes=n;}}}
      catch(_){return {readable:false,recoveryRequired:true};}
      return {readable:true,recoveryRequired:_unreadableStorageKeys.size>0,estimatedUtf16Bytes,safetySnapshotBytes,lastWrite:_storageHealth.lastWrite,lastMigration:_storageHealth.lastMigration,lastTransfer:_storageHealth.lastTransfer};
    }
    function diagnosticCacheGeneration(value) {
      const match=typeof value==="string"&&value.match(/(v\d{4,}(?:-rc\d+)?(?:-fix\d+)?-[a-f0-9]{16})$/);
      return match?match[1]:null;
    }
    function readRuntimeDiagnostics() {
      try {
        const raw=sessionStorage.getItem(RUNTIME_DIAG_KEY);
        const rows=raw?JSON.parse(raw):[];
        return Array.isArray(rows)?rows.map(safeRuntimeFault).filter(Boolean).slice(-8):[];
      } catch (_) { return []; }
    }
    function recordRuntimeFault(kind, event) {
      try {
        const rows=readRuntimeDiagnostics();
        const source=String(event&&event.filename||"").split(/[\\/]/).pop().slice(0,80);
        const reason=event&&event.reason;
        const error=event&&event.error;
        const type=String((error&&error.name)||(reason&&reason.name)||(reason&&reason.constructor&&reason.constructor.name)||typeof reason||"Error").slice(0,50);
        rows.push({at:new Date().toISOString(),kind:String(kind||"error").slice(0,30),type,source,line:Number(event&&event.lineno)||0,col:Number(event&&event.colno)||0});
        sessionStorage.setItem(RUNTIME_DIAG_KEY,JSON.stringify(rows.map(safeRuntimeFault).filter(Boolean).slice(-8)));
      } catch (_) {}
    }
    function armRuntimeDiagnostics() {
      armLifecycleDiagnostics();
      if(window.__tmRuntimeDiagArmed)return;
      window.__tmRuntimeDiagArmed=true;
      window.addEventListener("error",e=>recordRuntimeFault("error",e));
      window.addEventListener("unhandledrejection",e=>recordRuntimeFault("unhandledrejection",e));
    }
    function readBootDiagnosticSafe() {
      try {
        const raw=sessionStorage.getItem("tm_boot_diag");if(!raw)return null;
        const x=JSON.parse(raw);if(!x||typeof x!=="object")return null;
        return {at:safeDiagnosticTimestamp(x.at),phase:["watchdog-loaded","dom-init","modules-ready","state-ready","initial-render","core-ready","post-boot-complete","ready","app-init","startup-error","window-error","promise-rejection"].includes(x.phase)?x.phase:"unknown",reason:["startup-error","startup-error-timeout","startup-stalled"].includes(x.reason)?x.reason:"unknown"};
      } catch (_) { return null; }
    }
    function betaAuditStatusText(audit){
      if(!audit)return t("beta_health_not_run");
      if(audit.status==="error")return tf("beta_health_error_summary",{errors:audit.errors.length,warnings:audit.warnings.length});
      if(audit.status==="warning")return tf("beta_health_warning_summary",{warnings:audit.warnings.length});
      return t("beta_health_ok_summary");
    }
    function renderBetaHealthAudit(audit){
      const summary=$("betaHealthSummary"),details=$("betaHealthDetails");if(!summary||!details)return;
      summary.textContent=betaAuditStatusText(audit);summary.className="operations-summary"+(audit&&audit.status==="error"?" readiness-issue":audit&&audit.status==="warning"?" readiness-check":"");
      details.innerHTML="";
      if(!audit)return;
      const add=(label,value,tone)=>{const row=document.createElement("div");row.className="beta-health-chip "+tone;const a=document.createElement("span");a.textContent=label;const b=document.createElement("strong");b.textContent=value;row.append(a,b);details.appendChild(row);};
      add(t("beta_health_structure"),audit.errors.length?tf("beta_health_issue_count",{n:audit.errors.length}):t("beta_health_ok"),audit.errors.length?"issue":"ok");
      add(t("beta_health_warnings"),audit.warnings.length?tf("beta_health_warning_count",{n:audit.warnings.length}):t("beta_health_none"),audit.warnings.length?"warn":"ok");
      const c=audit.counts||{};add(t("beta_health_records"),tf("beta_health_records_value",{trips:c.trips||0,days:c.days||0,items:c.activities||0}),"ok");
    }
    function runBetaHealthAudit(showToastAfter){
      const canonical=readCanonicalTripState();
      _lastBetaAudit=Operations.auditTripGraph(canonical?canonical.trips:trips,canonical?canonical.activeTripId:activeTripId);
      if(!canonical||_unreadableStorageKeys.size){
        if(!_lastBetaAudit.errors.includes("storage_read_failed"))_lastBetaAudit.errors.push("storage_read_failed");
        _lastBetaAudit.status="error";
      }
      renderBetaHealthAudit(_lastBetaAudit);
      if(showToastAfter)showToast(_lastBetaAudit.status==="ok"?t("beta_health_toast_ok"):_lastBetaAudit.status==="warning"?t("beta_health_toast_warning"):t("beta_health_toast_error"));
      return _lastBetaAudit;
    }
    function betaDiagnosticsObject(){
      const canonical=readCanonicalTripState();
      const diagTrips=canonical?canonical.trips:trips;
      const diagActiveId=canonical?canonical.activeTripId:activeTripId;
      const audit=Operations.auditTripGraph(diagTrips,diagActiveId);
      if(!canonical||_unreadableStorageKeys.size){audit.errors.push("storage_read_failed");audit.status="error";}
      const swControlled=!!(navigator.serviceWorker&&navigator.serviceWorker.controller);
      const archived=diagTrips.filter(x=>x&&x.archived===true).length;
      return {
        app:"TripMaster",reportVersion:5,generatedAt:new Date().toISOString(),appVersion:APP_VERSION,buildId:APP_BUILD_ID,
        locale:{language:currentLang,locale:(LANG_META[currentLang]||LANG_META[DEFAULT_LANG]).lang,direction:document.documentElement.dir||""},
        runtime:{
          online:!!navigator.onLine,
          displayMode:((window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches)||navigator.standalone===true)?"standalone":"browser",
          serviceWorkerControlled:swControlled,
          serviceWorkerLifecycle:(()=>{const x=window.__TM_SW_STATUS__;return x&&typeof x==="object"?{supported:!!x.supported,registered:!!x.registered,controlled:!!x.controlled,waiting:!!x.waiting,installing:!!x.installing,applying:!!x.applying,hasScope:typeof x.scopePath==="string",controllerCacheName:diagnosticCacheGeneration(x.controllerCacheName),controllerMatchesApp:typeof x.controllerMatchesApp==="boolean"?x.controllerMatchesApp:null,reloadRequired:x.reloadRequired===true,controllerCheckDurationMs:Number.isFinite(x.controllerCheckDurationMs)?x.controllerCheckDurationMs:null,controllerCheckAttempts:Number.isFinite(x.controllerCheckAttempts)?x.controllerCheckAttempts:0,controllerCheckTimedOut:x.controllerCheckTimedOut===true,lastCheckAt:safeDiagnosticTimestamp(x.lastCheckAt),lastError:x.lastError?safeDiagnosticError(x.lastError):null}:null;})(),
          storageWritable:storageWritableCheck(),
          storage:storageDiagnostics(),
          visibility:document.visibilityState||"unknown",
          navigation:{canonicalPath:/\/index\.html$/.test(location.pathname)||/\/$/.test(location.pathname),hasQuery:!!location.search,hasFragment:!!location.hash},
          writeSafety:{reloadRequiredForVersion:_reloadRequiredForVersion===true,externalTripPending:_externalStatePending===true,externalSettingsPending:_externalSettingsPending===true,externalThemePending:_externalThemePending===true,lastBlockReason:_stateWriteBlockReason||null,openSheetCount:document.querySelectorAll(".sheet.open").length},
          lifecycleTimeline:readLifecycleDiagnostics(),
          runtimeFaults:readRuntimeDiagnostics(),lastBootFailure:readBootDiagnosticSafe()
        },
        state:{tripCount:diagTrips.length,archivedTripCount:archived,activeTripPresent:!!diagTrips.find(x=>x&&x.id===diagActiveId),counts:audit.counts},
        aiClient:{contractVersion:AI_CLIENT_CONTRACT_VERSION,v2TransportEnabled:AI_V2_TRANSPORT_ENABLED,lastRequest:_lastAIClientTrace?{requestId:_lastAIClientTrace.requestId,intent:_lastAIClientTrace.intent,scopes:_lastAIClientTrace.scopes.slice(),researchLikely:_lastAIClientTrace.researchLikely,liveDataLikely:_lastAIClientTrace.liveDataLikely,entityHintCount:_lastAIClientTrace.entityHintCount,attempt:_lastAIClientTrace.attempt,status:_lastAIClientTrace.status,durationMs:_lastAIClientTrace.durationMs,evidenceGate:_lastAIClientTrace.evidenceGate}:null},
        audit:{status:audit.status,errors:audit.errors.slice(),warnings:audit.warnings.slice()}
      };
    }
    function betaDiagnosticsText(){return JSON.stringify(betaDiagnosticsObject(),null,2);}
    async function copyBetaDiagnostics(){
      const text=betaDiagnosticsText();
      try{await navigator.clipboard.writeText(text);showToast(t("beta_diagnostics_copied"));}
      catch(err){console.warn("TripMaster: diagnostics copy failed",err);showToast(t("toast_copy_manual"));}
    }
    function downloadBetaDiagnostics(){
      const text=betaDiagnosticsText(),blob=new Blob([text],{type:"application/json;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
      a.href=url;a.download=`tripmaster-diagnostics-${todayISO()}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),0);showToast(t("beta_diagnostics_downloaded"));
    }

    function safetyHealthRow(label,value,tone){
      const row=document.createElement("div");row.className="safety-health-row "+(tone||"");
      const l=document.createElement("span");l.textContent=label;const v=document.createElement("strong");v.textContent=value;row.appendChild(l);row.appendChild(v);return row;
    }
    async function renderSafetyCenter(){
      const grid=$("safetyHealthGrid"),meta=$("safetySnapshotMeta"),restoreBtn=$("safetySnapshotRestoreBtn");if(!grid||!meta)return;
      grid.innerHTML="";
      const storageOk=storageWritableCheck()&&!_unreadableStorageKeys.size;
      const canonical=readCanonicalTripState();
      const safetyTrips=canonical?canonical.trips:trips;
      const safetyActiveId=canonical?canonical.activeTripId:activeTripId;
      const audit=runBetaHealthAudit(false);
      grid.appendChild(safetyHealthRow(t("safety_health_version"),APP_VERSION,"ok"));
      grid.appendChild(safetyHealthRow(t("safety_health_network"),navigator.onLine?t("safety_online"):t("safety_offline"),navigator.onLine?"ok":""));
      grid.appendChild(safetyHealthRow(t("safety_health_storage"),storageOk?t("safety_storage_ok"):t("safety_storage_problem"),storageOk?"ok":"issue"));
      const swControlled=!!(navigator.serviceWorker&&navigator.serviceWorker.controller)&&!!(window.__TM_SW_STATUS__&&window.__TM_SW_STATUS__.controllerMatchesApp===true);
      grid.appendChild(safetyHealthRow(t("safety_health_offline"),swControlled?t("safety_offline_ready"):t("safety_offline_not_controlled"),swControlled?"ok":"warn"));
      grid.appendChild(safetyHealthRow(t("beta_health_grid_label"),audit.status==="ok"?t("beta_health_ok"):audit.status==="warning"?t("beta_health_review"):t("beta_health_problem"),audit.status==="ok"?"ok":audit.status==="warning"?"warn":"issue"));
      grid.appendChild(safetyHealthRow(t("safety_health_trips"),String(safetyTrips.length),""));
      const active=safetyTrips.find(x=>x&&x.id===safetyActiveId)||null;grid.appendChild(safetyHealthRow(t("safety_health_active"),active?(active.name||t("menu_new_trip")):t("safety_none"),""));
      const snap=readSafetySnapshot();
      if(snap){
        let when=snap.createdAt||"";try{when=new Date(when).toLocaleString(dateLocale());}catch(_){}
        meta.textContent=tf("safety_snapshot_available",{date:when||"—",reason:safetyReasonLabel(snap.reason),trips:Array.isArray(snap.trips)?snap.trips.length:0});
        if(restoreBtn)restoreBtn.disabled=false;
      }else{meta.textContent=t("safety_snapshot_none");if(restoreBtn)restoreBtn.disabled=true;}
      if(navigator.storage&&typeof navigator.storage.estimate==="function"){
        try{const est=await navigator.storage.estimate();if(est&&Number.isFinite(est.usage)&&Number.isFinite(est.quota)&&est.quota>0){const pct=Math.round(est.usage/est.quota*100);grid.appendChild(safetyHealthRow(t("safety_health_usage"),tf("safety_usage_value",{pct}),pct>85?"warn":""));}}catch(_){}
      }
    }
    function openSafetyCenter(){renderSafetyCenter();renderTripTransferMeta();openSheetEl("safetyCenterSheet");}
    function closeSafetyCenter(){closeSheetEl("safetyCenterSheet");}
    function createManualSafetySnapshot(){if(!writeSafetySnapshot("manual")){showToast(t("toast_snapshot_failed"));return;}renderSafetyCenter();showToast(t("safety_snapshot_created"));}
    function restoreLocalSafetySnapshot(){const snap=readSafetySnapshot();if(!snap){showToast(t("safety_snapshot_none"));return;}confirmRestore(()=>{closeSafetyCenter();doRestore(snap);});}

    /* ══════════════════════════════════════════════════════════════════
       CAL-TIME-001 (v1040 / B5): one canonical calendar time pipeline
       ──────────────────────────────────────────────────────────────────
       Until v1040 the ICS path and the Google Calendar path each did their
       own arithmetic from the raw form fields. ICS emitted a FLOATING local
       stamp; Google converted the device-local time to UTC. For a user whose
       device clock differs from the destination, the two exports described
       two different real instants.

       Both now call activityTimeSpec() and format what it returns.

         - Trip HAS a timezone: the wall clock the user typed belongs to that
           zone. The instant is resolved with the browser's own IANA data and
           both exports emit the same UTC stamp. DST is handled by resolving
           the offset AT the candidate instant and re-resolving once if the
           first guess landed on the other side of a transition.
         - Trip has NO timezone (the explicit, tested fallback): the wall
           clock is emitted as-is, unanchored, by BOTH paths. The receiving
           calendar interprets it in its own zone, which is what a traveller
           with no destination set actually means.

       No calendar library, no network, no hand-waving.
       ══════════════════════════════════════════════════════════════════ */
    function isValidTimeZone(tz) {
      if (!tz || typeof tz !== "string") return false;
      try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; }
      catch (err) { return false; }
    }

    function deviceTimeZone() {
      try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; }
      catch (err) { return ""; }
    }

    /* Offset of `tz` from UTC, in ms, AT the given instant. */
    function tzOffsetMs(tz, utcMs) {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz, hour12: false,
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit"
      }).formatToParts(new Date(utcMs));
      const map = {};
      parts.forEach((p) => { map[p.type] = p.value; });
      let hour = parseInt(map.hour, 10);
      if (hour === 24) hour = 0;   // some ICU builds render midnight as "24"
      const asIfUTC = Date.UTC(
        parseInt(map.year, 10), parseInt(map.month, 10) - 1, parseInt(map.day, 10),
        hour, parseInt(map.minute, 10), parseInt(map.second, 10)
      );
      return asIfUTC - utcMs;
    }

    /* Wall clock in `tz` -> one unambiguous real instant (ms since epoch).
       Around DST transitions a local wall time can be missing (spring gap) or
       can occur twice (autumn fold). TripMaster must not silently invent which
       instant the user meant. We sample the offsets around the target date,
       build every plausible candidate, and accept it only when exactly one
       candidate formats back to the requested wall clock. */
    function wallClockToInstant(y, mo, d, h, mi, tz) {
      const naiveUTC = Date.UTC(y, mo - 1, d, h, mi, 0);
      const offsets = new Set();
      [-36, -12, 0, 12, 36].forEach((hours) => {
        offsets.add(tzOffsetMs(tz, naiveUTC + hours * 3600000));
      });
      const matches = [];
      offsets.forEach((offset) => {
        const candidate = naiveUTC - offset;
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: tz, hour12: false,
          year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit"
        }).formatToParts(new Date(candidate));
        const map = {}; parts.forEach((part) => { map[part.type] = part.value; });
        let hour = Number(map.hour); if (hour === 24) hour = 0;
        if (Number(map.year) === y && Number(map.month) === mo && Number(map.day) === d &&
            hour === h && Number(map.minute) === mi) matches.push(candidate);
      });
      const unique = Array.from(new Set(matches));
      return unique.length === 1 ? unique[0] : null;
    }

    function pad2(n) { return String(n).padStart(2, "0"); }

    function wallStamp(p) {
      return "" + p.y + pad2(p.mo) + pad2(p.d) + "T" + pad2(p.h) + pad2(p.mi) + "00";
    }
    function utcStamp(ms) {
      const d = new Date(ms);
      return "" + d.getUTCFullYear() + pad2(d.getUTCMonth() + 1) + pad2(d.getUTCDate())
           + "T" + pad2(d.getUTCHours()) + pad2(d.getUTCMinutes()) + pad2(d.getUTCSeconds()) + "Z";
    }

    /* Wall-clock arithmetic on a UTC scratch date, so the DEVICE timezone
       can never leak into the destination's calendar. */
    function addWallMinutes(p, minutes) {
      const scratch = new Date(Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, 0));
      scratch.setUTCMinutes(scratch.getUTCMinutes() + minutes);
      return {
        y: scratch.getUTCFullYear(), mo: scratch.getUTCMonth() + 1, d: scratch.getUTCDate(),
        h: scratch.getUTCHours(), mi: scratch.getUTCMinutes()
      };
    }

    /* THE canonical conversion. Both calendar exports use this and nothing
       else. `endTimeStr` is optional: with no end time the activity keeps
       the pre-v1040 duration of exactly one hour (B4). */
    function activityTimeSpec(dateStr, timeStr, endTimeStr, tz, endNextDay) {
      const date = parseDateOnly(String(dateStr || ""));
      if (!date) return null;
      const startMin = DayIntel.parseTime(String(timeStr || ""));
      if (startMin === null) return null;
      const start = {
        y: date.getUTCFullYear(), mo: date.getUTCMonth() + 1, d: date.getUTCDate(),
        h: Math.floor(startMin / 60), mi: startMin % 60
      };

      let end;
      const endRaw = String(endTimeStr || "");
      if (endRaw) {
        const endMin = DayIntel.parseTime(endRaw);
        if (endMin === null) return null;
        const eh = Math.floor(endMin / 60), em = endMin % 60;
        end = { y: start.y, mo: start.mo, d: start.d, h: eh, mi: em };
        if (endNextDay === true) end = addWallMinutes(end, 24 * 60);
      } else {
        end = addWallMinutes(start, 60);
      }

      const zone = (tz && isValidTimeZone(tz)) ? tz : "";
      if (zone) {
        const startMs = wallClockToInstant(start.y, start.mo, start.d, start.h, start.mi, zone);
        if (startMs === null) return null;
        let endMs;
        if (endRaw) {
          endMs = wallClockToInstant(end.y, end.mo, end.d, end.h, end.mi, zone);
          if (endMs === null) return null;
        } else {
          // No explicit end time means exactly one elapsed hour. This remains
          // correct even when the wall clock skips or repeats during DST.
          endMs = startMs + 60 * 60000;
        }
        return {
          mode: "utc", tz: zone,
          startMs, endMs,
          start: start, end: end,
          dtStart: utcStamp(startMs),
          dtEnd:   utcStamp(endMs)
        };
      }
      return {
        mode: "floating", tz: "",
        startMs: null, endMs: null,
        start: start, end: end,
        dtStart: wallStamp(start),
        dtEnd:   wallStamp(end)
      };
    }

    /* UID-001 / RC4-FIX1-AI-003: activities now receive a stable opaque UID
       when created. Legacy activities still get one lazily on their next safe
       user write/export/link action, so opening an old backup remains read-only. */
    function newActivityUid() {
      let token = "";
      try {
        if (window.crypto && typeof window.crypto.randomUUID === "function") token = window.crypto.randomUUID();
      } catch (_) {}
      if (!token) token = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
      return "tm-" + token + "@tripmaster.app";
    }

    function ensureActivityUid(item) {
      if (item && typeof item.uid === "string" && item.uid) return item.uid;
      const uid = newActivityUid();
      if (item) {
        // Export/calendar helpers must never turn a stale tab into an
        // unguarded whole-state writer. If another window changed state,
        // return an ephemeral UID for this export and leave canonical state
        // untouched; the normal stable-ID migration will persist one later.
        if (!guardExternalStateBeforeWrite()) return uid;
        item.uid = uid;
        // Best effort: a failed write only costs UID stability, never data,
        // so this must not block the export the user just asked for.
        if (!persistState()) console.warn("TripMaster: could not persist activity UID");
      }
      return uid;
    }


    /* v3200 RC3 — stable-ID repair for both live state and restored legacy
       payloads. Duplicate IDs produced by older builds are repaired before
       editing or Restore persistence. Ambiguous old links keep resolving to
       the first occurrence; we never guess that they meant a later duplicate. */
    function repairStableTripGraphIds(targetTrips) {
      const prefixFor = {trip:"trip",day:"day",activity:"activity",stay:"stay",journey:"journey",expense:"expense",document:"doc",task:"task"};
      const result = Operations.repairTripGraphIds(targetTrips, (kind) => kind === "activity" ? newActivityUid() : newTripId(prefixFor[kind] || kind));
      _storageHealth.lastMigration={at:new Date().toISOString(),result:result.changed?"repaired":"unchanged",repairs:result.repairs,linkRepairs:result.linkRepairs};
      if(result.changed)recordLifecycleEvent("migration",_storageHealth.lastMigration);
      return !!(result && result.changed);
    }

    function ensureStableTripGraphIds() {
      const changed = repairStableTripGraphIds(trips);
      if (!changed) return true;
      if (!saveTrips()) { _storageHealth.lastMigration.result="persist_failed";recordLifecycleEvent("migration",_storageHealth.lastMigration); console.warn("TripMaster: stable-ID migration could not be persisted"); return false; }
      return true;
    }

    /* ── A11Y-001 (v1040 / D6): one open/close path for every sheet ──
       Focus moves into the sheet on open and returns to whatever opened it
       on close. Escape closes the topmost sheet. The stack is keyed by sheet
       id so stacked sheets (a confirmation over the menu) unwind correctly. */
    let _focusReturn = [];
    const _sheetFocusTimers = new Map();
    let _pendingUpdateReady = false;

    /* v1100 NAV-BACK-001: installed/mobile browser Back integration.
       TripMaster is still a local single-page app, so we keep one lightweight
       same-document guard entry rather than introducing a router. Hardware /
       browser Back now unwinds in product order: top sheet -> Today -> Planner
       -> Home -> leave the app/page. Close buttons keep their existing direct
       behavior, so this cannot create duplicate modal history entries. */
    let _backGuardArmed = false;
    function armBackGuard() {
      if (!window.history || typeof history.pushState !== "function") return;
      try {
        if(history.state&&history.state.tripmasterGuard===1){_backGuardArmed=true;return;}
        history.replaceState({ tripmasterRoot: 1 }, "");
        history.pushState({ tripmasterGuard: 1 }, "");
        _backGuardArmed = true;
      } catch (_) { _backGuardArmed = false; }
    }
    function rearmBackGuard() {
      if (!_backGuardArmed || !window.history || typeof history.pushState !== "function") return;
      try { history.pushState({ tripmasterGuard: 1 }, ""); } catch (_) {}
    }

    function preferredScrollBehavior() {
      return window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth";
    }
    function syncKeyboardViewport() {
      const viewport=window.visualViewport;
      if(!viewport)return;
      const style=document.documentElement.style;
      // Pinch zoom is user-controlled magnification, not a keyboard inset.
      if(Math.abs(viewport.scale-1)>0.05){style.removeProperty("--tm-visible-height");style.removeProperty("--tm-keyboard-bottom");return;}
      style.setProperty("--tm-visible-height",Math.max(1,viewport.height)+"px");
      style.setProperty("--tm-keyboard-bottom",Math.max(0,window.innerHeight-viewport.height-viewport.offsetTop)+"px");
      const focused=document.activeElement,top=topOpenSheet();
      if(top&&focused&&top.contains(focused)&&/^(INPUT|TEXTAREA|SELECT)$/.test(focused.tagName)){
        const rect=focused.getBoundingClientRect(),sheetRect=top.getBoundingClientRect();
        if(rect.bottom>Math.min(viewport.offsetTop+viewport.height,sheetRect.bottom)-16||rect.top<Math.max(viewport.offsetTop,sheetRect.top)+16)focused.scrollIntoView({block:"nearest",behavior:"auto"});
      }
    }
    function armKeyboardViewport() {
      if(!window.visualViewport)return;
      let frame=null;
      const schedule=()=>{if(frame!==null)return;frame=window.requestAnimationFrame(()=>{frame=null;syncKeyboardViewport();});};
      window.visualViewport.addEventListener("resize",schedule);
      window.visualViewport.addEventListener("scroll",schedule);
      document.addEventListener("focusin",schedule);
      window.addEventListener("pageshow",schedule);
      syncKeyboardViewport();
    }

    function setInert(el, on) {
      if (!el) return;
      if (on) el.setAttribute("inert", "");
      else el.removeAttribute("inert");
    }

    /* v3000 A11Y-MODAL-001: aria-modal alone does not stop TalkBack from
       swiping into content behind a bottom sheet. Keep the app surface and
       every non-top sheet inert while a modal sheet is open. This also makes
       stacked confirmations behave as one true modal layer at a time. */
    function syncModalInert() {
      const top = topOpenSheet();
      const blocked = !!top;
      setInert($("mainHeader"), blocked);
      setInert(document.querySelector(".container"), blocked);
      setInert(document.querySelector(".bottom-bar"), blocked);
      document.querySelectorAll(".sheet").forEach((sheet) => {
        setInert(sheet, blocked && sheet !== top);
      });
    }

    function openSheetEl(id) {
      const el = $(id);
      if (!el) return;
      const trigger = document.activeElement;
      const already = el.classList.contains("open");
      if (!already) {
        // MOBILE-SHEET-001 (v3400): every freshly-opened sheet starts at its
        // top. Long hubs/forms must not reopen halfway down because the same
        // DOM node retained scrollTop from a previous visit.
        el.scrollTop = 0;
        if (el.dataset) el.dataset.tripStateToken = canonicalTripStorageToken();
      }
      el.classList.add("open");
      $("sheetBackdrop").classList.add("open");
      // Re-rendering an open sheet (deleteTrip re-opens the trip list) must
      // not push a second return-focus record for the same sheet.
      if (!already) _focusReturn.push({ id: id, trigger: (trigger && trigger.focus) ? trigger : null });
      syncModalInert();
      // FIX1-FOCUS-001: a sheet can be closed before this delayed focus runs.
      // Cancel any older timer for this sheet and re-check that it is still
      // open before moving focus, otherwise focus can jump back into a closed
      // sheet after Escape/close has already returned it to the trigger.
      const previousTimer = _sheetFocusTimers.get(id);
      if (previousTimer) window.clearTimeout(previousTimer);
      const focusTimer = window.setTimeout(() => {
        _sheetFocusTimers.delete(id);
        if (!el.classList.contains("open") || topOpenSheet() !== el) return;
        const target = el.querySelector(".sheet-close") || el;
        try { target.focus(); } catch (err) {}
      }, 60);
      _sheetFocusTimers.set(id, focusTimer);
    }

    function topOpenSheet() {
      for (let i = _focusReturn.length - 1; i >= 0; i--) {
        const el = $(_focusReturn[i].id);
        if (el && el.classList.contains("open")) return el;
      }
      const open = document.querySelectorAll(".sheet.open");
      return open.length ? open[open.length - 1] : null;
    }

    function closeSheetEl(id) {
      const el = $(id);
      if (!el) return;
      const pendingFocus = _sheetFocusTimers.get(id);
      if (pendingFocus) {
        window.clearTimeout(pendingFocus);
        _sheetFocusTimers.delete(id);
      }
      const wasOpen = el.classList.contains("open");
      // v3100 CROSS-WINDOW-CLOSE-001: a frozen/discarded tab can miss the
      // storage event while a confirmation/editor is open. Preserve the
      // sheet's stale-token evidence BEFORE removing the token, otherwise a
      // close-then-confirm callback could immediately write through an old
      // positional reference after the only proof of staleness was erased.
      if (wasOpen && el.dataset && el.dataset.tripStateToken) {
        const currentToken = canonicalTripStorageToken();
        if (el.dataset.tripStateToken !== currentToken) _externalStatePending = true;
      }
      el.classList.remove("open");
      if (el.dataset) delete el.dataset.tripStateToken;
      syncBackdrop();
      const ids = _focusReturn.map((r) => r.id);
      const idx = ids.lastIndexOf(id);
      const rec = idx === -1 ? null : _focusReturn.splice(idx, 1)[0];
      // Remove inert before returning focus so an underlying sheet/button is
      // focusable again synchronously.
      syncModalInert();
      if (wasOpen && rec && rec.trigger && document.contains(rec.trigger)) {
        try { rec.trigger.focus(); } catch (err) {}
      }
      // Deferred update/external-state hooks are sheet-state concerns, not
      // focus-return concerns. They must run even for a sheet without a
      // matching focus record.
      if (_pendingUpdateReady && !topOpenSheet()) { _pendingUpdateReady=false; showUpdateBanner(_reloadRequiredForVersion); }
      if ((_externalStatePending || _externalSettingsPending || _externalThemePending) && !topOpenSheet()) scheduleExternalStateSync();
    }

    function getActiveTrip() {
      return trips.find(t => t.id === activeTripId) || null;
    }

    /* ── Trip management ── */
    function newTripId(prefix) {
      let token="";
      try { if (window.crypto && typeof window.crypto.randomUUID === "function") token=window.crypto.randomUUID(); } catch (_) {}
      if (!token) token=Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,12);
      return (prefix || "trip") + "_" + token;
    }

    /* STORE-001 (v1040 / A7): returns null when the trip could not be
       persisted, so the caller cannot render and toast a trip that would
       vanish on the next reload. The name fallback is localized rather than
       a Hebrew literal (E-family); in practice the caller already rejects an
       empty name, so it is a safety net, not a normal path. */
    function createTrip(name) {
      const newTrip = { id: newTripId("trip"), name: name || t("menu_new_trip"), days: [] };
      const previousTrips = trips.slice();
      const previousActive = activeTripId;
      trips.push(newTrip);
      activeTripId = newTrip.id;
      currentView = "planner";
      if (!saveTrips()) {
        const externalConflict = failedWriteWasExternal();
        if (!externalConflict) {
          trips = previousTrips;
          activeTripId = previousActive;
          currentView = previousActive ? "planner" : "home";
        }
        reportStorageFailure();
        return null;
      }
      days = newTrip.days;
      resetAIForTripContextChange();
      return newTrip;
    }

    function cloneTripGraphForDevice(sourceTrip, name) {
      return Operations.cloneTripGraph(sourceTrip, (kind) => {
        if (kind === "activity") return newActivityUid();
        return newTripId(kind === "document" ? "doc" : kind);
      }, { name, unarchive:true });
    }

    function duplicateTrip(sourceTrip) {
      if (!sourceTrip) return null;
      const copy = cloneTripGraphForDevice(sourceTrip, tf("trip_copy_name", { name: sourceTrip.name || t("menu_new_trip") }));
      if (!copy) return null;
      const previous=snapshotState(); trips.push(copy); activeTripId=copy.id; days=copy.days||[]; currentDayIndex=0; currentView="home";
      if(!saveTrips()){const externalConflict=failedWriteWasExternal();if(!externalConflict)restoreStateFrom(previous);reportStorageFailure();return null;}
      resetAIForTripContextChange(); renderCurrentView(); updateHeaderInfo(); showToast(t("toast_trip_duplicated")); return copy;
    }

    function switchTrip(tripId, options) {
      const opts = options || {};
      const previous = snapshotState();
      activeTripId = tripId;
      const activeTrip = getActiveTrip();
      if (!activeTrip) { restoreStateFrom(previous); return false; }
      days = activeTrip.days || [];
      currentDayIndex = 0;
      currentView = opts.stayHome ? "home" : "planner";
      if (!saveTrips()) { const externalConflict=failedWriteWasExternal(); if(!externalConflict)restoreStateFrom(previous); reportStorageFailure(); return false; }
      resetAIForTripContextChange();
      renderCurrentView();
      updateHeaderInfo();
      if (!opts.silent) showToast(tf("toast_switched_trip", { name: activeTrip.name }));
      return true;
    }

    function goHome(options) {
      const opts = options || {};
      // HOME-STATE-001: dashboard navigation never clears the selected trip.
      // activeTripId remains the user's working-trip selection.
      currentView = "home";
      const activeTrip = getActiveTrip();
      days = activeTrip ? (activeTrip.days || []) : [];
      currentDayIndex = 0;
      renderCurrentView();
      updateHeaderInfo();
      if (!opts.silent) showToast(t("toast_home"));
    }

    function continuePlanning(tripId) {
      if (tripId && tripId !== activeTripId) {
        switchTrip(tripId, { silent:true });
        return;
      }
      const active = getActiveTrip();
      if (!active) {
        // HOMEHUB-001 (v1050-RC2): with no active trip there is nothing to
        // continue. A brand-new user gets the create sheet; anyone with
        // trips is left on Home, which already lists every trip.
        if (trips.length === 0) openNewTripSheet();
        else { currentView = "home"; renderCurrentView(); updateHeaderInfo(); }
        return;
      }
      currentView = "planner";
      days = active.days || [];
      if (currentDayIndex >= days.length) currentDayIndex = 0;
      renderCurrentView();
      updateHeaderInfo();
    }

    function legacyHomeSignature(homeDays) {
      // FNV-1a over the exact legacy payload. The signature is stored on the
      // migrated trip so a crash between the two storage writes cannot create
      // a duplicate on retry. It is not a security hash.
      const text = JSON.stringify(normalizeDays(homeDays));
      let h = 0x811c9dc5;
      for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
      }
      return (h >>> 0).toString(16).padStart(8, "0");
    }

    function migrateLegacyHomeDays() {
      const legacy = normalizeDays(safeParseJSON(KEY_DAYS, []));
      if (!legacy.length) return { migrated:false, reused:false };
      const signature = legacyHomeSignature(legacy);
      const legacyPayload = JSON.stringify(legacy);
      // The short FNV signature is only an index hint. Exact payload equality
      // is mandatory before treating a trip as a prior migration, so even a
      // theoretical hash collision can never cause different legacy data to
      // be cleared as "already migrated".
      const existing = trips.find((trip) => trip
        && trip.legacyHomeSignature === signature
        && JSON.stringify(normalizeDays(trip.days)) === legacyPayload);
      if (existing) {
        // Interrupted prior migration: trip already landed. Clearing the legacy
        // inbox is idempotent and cannot overwrite the trip.
        const adoptExisting = getActiveTrip() ? activeTripId : existing.id;
        if (!writeAll([[KEY_ACTIVE_TRIP, adoptExisting || ""], [KEY_DAYS, JSON.stringify([])]])) return { migrated:false, error:true };
        activeTripId = adoptExisting;
        return { migrated:false, reused:true, trip:existing };
      }

      const migratedTrip = {
        id: newTripId("trip_home"),
        name: t("legacy_home_trip_name"),
        days: JSON.parse(JSON.stringify(legacy)),
        migrationSource: "legacy-home",
        legacyHomeSignature: signature
      };
      const nextTrips = trips.concat([migratedTrip]);
      const nextActive = getActiveTrip() ? activeTripId : migratedTrip.id;
      // One guarded batch. If the legacy inbox cannot be cleared, the new trip
      // is rolled back by writeAll() and retry is safe.
      if (!writeAll([
        [KEY_TRIPS, JSON.stringify(nextTrips)],
        [KEY_ACTIVE_TRIP, nextActive || ""],
        [KEY_DAYS, JSON.stringify([])]
      ])) return { migrated:false, error:true };
      trips = normalizeTrips(nextTrips);
      activeTripId = nextActive;
      const active = getActiveTrip();
      days = active ? active.days : [];
      currentView = "home";
      return { migrated:true, reused:false, trip:migratedTrip };
    }

    function tripDateRange(trip) {
      return Today.tripDateRange(trip);
    }

    function daysUntilDate(dateString) {
      const target = parseDateOnly(dateString);
      const today = parseDateOnly(todayISO());
      if (!target || !today) return null;
      return Math.round((target.getTime() - today.getTime()) / 86400000);
    }
    function dateDiffDays(fromDate, toDate) {
      const a=parseDateOnly(fromDate),b=parseDateOnly(toDate);
      if(!a||!b)return null;
      return Math.round((b.getTime()-a.getTime())/86400000);
    }

    function upcomingTrip() {
      const today = todayISO();
      const candidates = trips.map(trip => ({ trip, range: tripDateRange(trip) }))
        .filter(x => x.range && x.range.last >= today && !Operations.isArchivedTrip(x.trip))
        .sort((a,b) => a.range.first.localeCompare(b.range.first));
      return candidates.length ? candidates[0] : null;
    }

    function dashboardTripCard(trip, kind) {
      const card = document.createElement("article");
      card.className = "home-trip-card" + (kind === "active" ? " is-active" : "");
      const range = tripDateRange(trip);
      const base = tripBase(trip);
      const dest = tripDestination(trip);
      const count = range ? daysUntilDate(range.first) : null;
      const title = document.createElement("div");
      title.className = "home-trip-title";
      title.textContent = trip.name || t("menu_new_trip");
      card.appendChild(title);
      const meta = document.createElement("div");
      meta.className = "home-trip-meta";
      const parts = [];
      if (dest) parts.push(dest);
      if (range) parts.push((formatDateOnly(range.first, {day:"numeric",month:"short"}) || range.first) + (range.last !== range.first ? " – " + (formatDateOnly(range.last, {day:"numeric",month:"short"}) || range.last) : ""));
      const today= todayISO();
      if (range && today < range.first && count != null) parts.push(tf("home_days_until", { n: count }));
      else if (range && today === range.first && range.first === range.last) parts.push(t("home_trip_ends_today"));
      else if (range && today >= range.first && today <= range.last) {
        const current=(dateDiffDays(range.first,today)||0)+1,total=(dateDiffDays(range.first,range.last)||0)+1;
        parts.push(tf("home_trip_day_progress",{current,total}));
        if(today===range.last)parts.push(t("home_trip_ends_today"));
      } else if (range && today > range.last) {
        const ended=dateDiffDays(range.last,today);if(ended!=null)parts.push(tf("home_trip_ended_days",{n:ended}));
      } else if (count === 0) parts.push(t("home_starts_today"));
      meta.textContent = parts.join(" · ") || t("home_no_dates");
      card.appendChild(meta);
      const homeRefDate = range && range.first > todayISO() ? range.first : todayISO();
      const nextStayRaw = Logistics.nextStay(trip, homeRefDate);
      if (nextStayRaw) {
        const st = stayInfo(nextStayRaw);
        const b = document.createElement("div"); b.className="home-trip-base";
        b.textContent = "🏨 " + t("home_next_stay") + ": " + (st.name || st.location || t("stay_unnamed")) + (st.startDate ? " · " + st.startDate : "");
        card.appendChild(b);
      } else if (base.name || base.location) {
        const b = document.createElement("div");
        b.className = "home-trip-base";
        b.textContent = "🏨 " + (base.name || base.location) + (base.name && base.location ? " · " + base.location : "");
        card.appendChild(b);
      }
      const nextJourneyRaw = Logistics.nextJourney(trip, homeRefDate);
      if (nextJourneyRaw) {
        const j=journeyInfo(nextJourneyRaw); const b=document.createElement("div"); b.className="home-review home-logistics-next";
        b.textContent="🚆 " + t("home_next_journey") + ": " + (j.date ? j.date + " · " : "") + flowPairText(j.origin || "…", j.destination || "…");
        card.appendChild(b);
      }
      const mobility = mobilitySummaryLabels(trip);
      if (mobility.length) {
        const chips = document.createElement("div"); chips.className = "planning-chips home-planning-chips";
        mobility.forEach(label => { const c=document.createElement("span"); c.className="planning-chip"; c.textContent=label; chips.appendChild(c); });
        card.appendChild(chips);
      }
      const readiness = tripReadiness(trip);
      const review = document.createElement("div");
      review.className = "home-review home-readiness readiness-" + readiness.level;
      if (readiness.issues) review.textContent = readinessLabel(readiness.level) + " · " + readiness.rows.find(r => r.level === "issue").text;
      else if (readiness.actions) review.textContent = readinessLabel(readiness.level) + " · " + tf("readiness_open_actions", { n: readiness.actions });
      else review.textContent = readinessLabel(readiness.level);
      card.appendChild(review);
      const travelCount = (trip.days || []).filter(isTravelDay).length;
      if (travelCount) {
        const travel = document.createElement("div");
        travel.className = "home-review";
        travel.textContent = "🧭 " + tf("home_travel_days", { n: travelCount });
        card.appendChild(travel);
      }
      const bookingAttention = Finance.bookingAttentionEntries(trip, Logistics).length;
      if (bookingAttention) {
        const bookingLine=document.createElement("div"); bookingLine.className="home-review";
        bookingLine.textContent="🎟️ " + tf("home_booking_attention", { n: bookingAttention });
        card.appendChild(bookingLine);
      }
      const budgetHome=Finance.budgetSummary(trip);
      if (budgetHome.active) {
        const moneyLine=document.createElement("div"); moneyLine.className="home-review home-money-summary";
        moneyLine.textContent="💰 " + t("home_budget") + ": " + formatMoneyAmount(budgetHome.comparableSpent, budgetHome.budget.currency) + " / " + formatMoneyAmount(budgetHome.budget.amount, budgetHome.budget.currency);
        card.appendChild(moneyLine);
      }
      const actions = document.createElement("div");
      actions.className = "home-trip-actions";
      const tripClock=Today.clock(null,tripTimezone(trip));
      const tripIsActiveToday=Today.isTripActive(trip,tripClock);
      const todayAction=document.createElement("button");
      todayAction.type="button";todayAction.className="btn "+(tripIsActiveToday?"btn-primary":"btn-muted")+" today-home-action";
      todayAction.textContent=tripIsActiveToday?t("today_home_open"):t("today_home_preview");
      todayAction.addEventListener("click",()=>openTodayForTrip(trip.id,{preview:!tripIsActiveToday}));
      const cont = document.createElement("button");
      cont.type = "button"; cont.className = "btn btn-primary"; cont.textContent = t("home_continue");
      cont.addEventListener("click", () => continuePlanning(trip.id));
      const details = document.createElement("button");
      details.type = "button"; details.className = "btn btn-muted"; details.textContent = t("menu_trip_details");
      details.addEventListener("click", () => openTripDetailsSheet(trip.id));
      const overview = document.createElement("button");
      overview.type = "button"; overview.className = "btn btn-muted"; overview.textContent = t("menu_overview");
      overview.addEventListener("click", () => { if (trip.id !== activeTripId) switchTrip(trip.id, {stayHome:true, silent:true}); openOverviewSheet(); });
      const board = document.createElement("button");
      board.type = "button"; board.className = "btn btn-muted"; board.textContent = t("trip_board_title");
      board.addEventListener("click", () => { if (trip.id !== activeTripId) switchTrip(trip.id, {stayHome:true, silent:true}); openTripBoardSheet(trip.id,"agenda"); });
      /* HOMEHUB-001 (v1050-RC2): trip deletion used to exist ONLY inside the
         removed switch-trip sheet. It moves here rather than disappearing.
         Still behind confirmDeleteTrip() and still undoable. */
      const del = document.createElement("button");
      del.type = "button"; del.className = "btn btn-muted home-trip-delete"; del.textContent = "🗑";
      del.title = t("btn_delete_trip");
      del.setAttribute("aria-label", t("btn_delete_trip") + " — " + (trip.name || ""));
      del.addEventListener("click", () => deleteTrip(trip.id));
      actions.appendChild(todayAction); actions.appendChild(cont); actions.appendChild(details); actions.appendChild(overview); actions.appendChild(board); actions.appendChild(del);
      card.appendChild(actions);
      return card;
    }

    function appendHomeTripList(body, labelKey, rows, options) {
      if (!body || !rows.length) return;
      const opts=options||{};
      const label=document.createElement("div");label.className="home-section-label";label.textContent=t(labelKey);body.appendChild(label);
      const list=document.createElement("div");list.className="home-other-list"+(opts.past?" home-past-list":"");
      rows.forEach(trip=>{
        const row=document.createElement("div");row.className="home-other-row";
        const pick=document.createElement("button");pick.type="button";pick.className="home-other-pick";
        const range=tripDateRange(trip);pick.innerHTML=`<span>${escapeHtml(trip.name||t("menu_new_trip"))}</span><small>${escapeHtml(tripDestination(trip)||(range?((formatDateOnly(range.first,{day:"numeric",month:"short",year:opts.past?"numeric":undefined})||range.first)):t("home_no_dates")))}</small>`;
        pick.addEventListener("click",()=>{if(opts.archived)openTripDetailsSheet(trip.id);else switchTrip(trip.id,{stayHome:true});});
        const actions=document.createElement("div");actions.className="home-other-actions";
        if(!opts.archived){const board=document.createElement("button");board.type="button";board.className="trip-card-btn";board.textContent="🧭";board.title=t("trip_board_title");board.setAttribute("aria-label",t("trip_board_title")+" — "+(trip.name||""));board.addEventListener("click",()=>{if(trip.id!==activeTripId)switchTrip(trip.id,{stayHome:true,silent:true});openTripBoardSheet(trip.id,"agenda");});actions.appendChild(board);}
        const edit=document.createElement("button");edit.type="button";edit.className="trip-card-btn";edit.textContent="✏️";edit.title=t("trip_edit_title");edit.setAttribute("aria-label",t("trip_edit_title")+" — "+(trip.name||""));edit.addEventListener("click",()=>openTripDetailsSheet(trip.id));
        if(opts.archived){const restore=document.createElement("button");restore.type="button";restore.className="trip-card-btn";restore.textContent="📤";restore.title=t("trip_unarchive_btn");restore.setAttribute("aria-label",t("trip_unarchive_btn")+" — "+(trip.name||""));restore.addEventListener("click",()=>setTripArchived(trip,false));actions.appendChild(restore);}
        const del=document.createElement("button");del.type="button";del.className="trip-card-btn trip-card-btn-danger";del.textContent="🗑";del.title=t("btn_delete_trip");del.setAttribute("aria-label",t("btn_delete_trip")+" — "+(trip.name||""));del.addEventListener("click",()=>deleteTrip(trip.id));
        actions.appendChild(edit);actions.appendChild(del);row.appendChild(pick);row.appendChild(actions);list.appendChild(row);
      }); body.appendChild(list);
    }

    function renderHomeDashboard() {
      const body = $("homeDashboardBody");
      if (!body) return;
      body.innerHTML = "";
      const active = getActiveTrip();
      if (active) {
        const label = document.createElement("div");
        label.className = "home-section-label"; label.textContent = t("home_active_trip");
        body.appendChild(label);
        body.appendChild(dashboardTripCard(active, "active"));
      } else {
        const empty = document.createElement("div");
        empty.className = "home-empty-card";
        const title = document.createElement("div"); title.className = "home-empty-title";
        title.textContent = trips.length ? t("home_choose_trip") : t("home_no_trips");
        const sub = document.createElement("div"); sub.className = "home-empty-sub";
        sub.textContent = trips.length ? t("home_choose_trip_sub") : t("home_no_trips_sub");
        // HOMEHUB-001: when trips exist they are already listed below this
        // card, so the only action left worth a button is creating one.
        const btn = document.createElement("button"); btn.type = "button"; btn.className = "btn btn-primary";
        btn.textContent = t("menu_new_trip");
        btn.addEventListener("click", openNewTripSheet);
        empty.appendChild(title); empty.appendChild(sub); empty.appendChild(btn); body.appendChild(empty);
      }

      const upcoming = upcomingTrip();
      if (upcoming && (!active || upcoming.trip.id !== active.id)) {
        const label = document.createElement("div"); label.className = "home-section-label"; label.textContent = t("home_upcoming_trip");
        body.appendChild(label); body.appendChild(dashboardTripCard(upcoming.trip, "upcoming"));
      }

      const archived=trips.filter(trip=>Operations.isArchivedTrip(trip));
      const others = trips.filter(trip => !Operations.isArchivedTrip(trip) && (!active || trip.id !== active.id) && (!upcoming || trip.id !== upcoming.trip.id));
      const today=todayISO();
      const past=others.filter(trip=>{const r=tripDateRange(trip);return !!(r&&r.last<today);});
      const currentOthers=others.filter(trip=>past.indexOf(trip)===-1);
      appendHomeTripList(body,"home_other_trips",currentOthers);
      appendHomeTripList(body,"home_past_trips",past,{past:true});
      appendHomeTripList(body,"home_archived_trips",archived,{past:true,archived:true});
    }

    /* ══════════════════════════════════════════════════════════════════
       TODAY-001 (v1090): operational in-trip view
       The model is built by app-today.js. This layer only translates it into
       DOM/actions and deliberately never invents live travel facts. */
    function todayEventKindLabel(kind) {
      const map={activity:"today_activity",journey:"today_journey",checkin:"today_checkin",checkout:"today_checkout",travel:"today_transfer",travelday:"today_travel_day"};
      return t(map[kind]||"today_today_item");
    }
    function todayEventIcon(kind) {
      return {activity:"📍",journey:"🚆",checkin:"🏨",checkout:"🧳",travel:"➡️",travelday:"🧭"}[kind]||"•";
    }
    function todayAttentionText(code) {
      const map={overlap:"today_issue_overlap",travel_insufficient:"today_issue_travel_insufficient",stay_conflict:"today_issue_stay_conflict",travel_unresolved:"today_check_travel_unresolved",booking_planned:"today_check_booking_planned",payment_attention:"today_check_payment",document_needed:"today_check_document",confirmation_available:"today_info_confirmation"};
      return t(map[code]||code);
    }
    function todayEventTime(event) {
      if (!event || !event.startTime) return t("today_time_unknown");
      return event.startTime + (event.endTime ? "–" + event.endTime : "");
    }
    function todayEventMeta(event, trip, accessActive) {
      const bits=[];
      if (event.kind==="journey" && event.source && Number.isInteger(event.source.index)) {
        const raw=trip && Array.isArray(trip.journeys) ? trip.journeys[event.source.index] : null, j=journeyInfo(raw);
        if (j.mode) bits.push(journeyModeLabel(j.mode));
        if (j.provider) bits.push(j.provider);
        if (j.serviceNumber) bits.push(j.serviceNumber);
      }
      if (event.kind==="travelday" && event.source && Number.isInteger(event.source.dayIndex)) {
        const d=trip.days && trip.days[event.source.dayIndex], info=d?dayTravelInfo(d):null;
        if (info && info.mode) bits.push(travelDayModeLabel(info.mode));
      }
      if (event.kind==="travel" && event.travel) {
        if (event.travel.mode) bits.push(travelModeLabel(event.travel.mode));
        bits.push(event.travel.durationMin!=null ? tf("today_travel_minutes",{m:event.travel.durationMin}) : t("today_travel_unknown"));
        if (event.travel.note) bits.push(event.travel.note);
      }
      if (event.bookingStatus) bits.push(bookingStatusLabel(event.bookingStatus));
      if (event.paymentStatus) bits.push(paymentStatusLabel(event.paymentStatus));
      if (accessActive && event.kind==="activity" && event.accessStatus && event.accessStatus!=="needscheck") {
        const a=event.accessStatus==="problem"?t("access_badge_problem"):t("access_badge_verified");
        bits.push("♿ "+a);
      }
      if (event.temporal==="started_uncertain") bits.push(t("today_started_uncertain"));
      return bits;
    }
    function todayOpenDetails(event, trip) {
      if (!event || !event.source || !trip) return;
      if (event.source.kind==="activity") {
        currentDayIndex=event.source.dayIndex; days=trip.days||[];
        openEditSheet(event.source.dayIndex,event.source.itemIndex,{expandMore:true}); return;
      }
      if (event.source.kind==="stay") {
        _logisticsTripId=trip.id; openStaySheet(event.source.index); return;
      }
      if (event.source.kind==="journey") {
        _logisticsTripId=trip.id; openJourneySheet(event.source.index); return;
      }
      if (event.source.kind==="travel") {
        currentDayIndex=event.source.dayIndex; days=trip.days||[];
        openEditSheet(event.source.dayIndex,event.source.itemIndex,{expandMore:true}); return;
      }
      if (event.source.kind==="travelday") {
        currentDayIndex=event.source.dayIndex; days=trip.days||[]; openDayDetailsSheet();
      }
    }
    function todayOpenBooking(event, trip) {
      if (!event || !event.source || !trip || !["activity","stay","journey"].includes(event.source.kind)) return;
      setOperationsTrip(trip.id);
      openBookingSource({kind:event.source.kind,sourceIndex:event.source.index,dayIndex:event.source.dayIndex,itemIndex:event.source.itemIndex});
    }
    function toggleTodayActivityCompleted(event, trip) {
      if(!event||!event.source||event.source.kind!=="activity"||!trip)return;
      const day=trip.days&&trip.days[event.source.dayIndex],item=day&&day.items&&day.items[event.source.itemIndex];
      if(!item)return;
      if(!commitState(()=>{item.completed=item.completed!==true;}))return;
      renderTodayView();
      showToast(item.completed?t("toast_done"):t("toast_undone_status"));
    }
    function renderTodayProgress(model) {
      const activities=model.events.filter(e=>e.kind==="activity");
      if(!activities.length)return null;
      const done=activities.filter(e=>e.completed===true).length,total=activities.length,pct=Math.round(done/total*100);
      const section=document.createElement("section");section.className="today-progress-card";
      const head=document.createElement("div");head.className="today-progress-head";
      const title=document.createElement("strong");title.textContent=t("today_progress_title");
      const meta=document.createElement("span");meta.textContent=tf("today_progress_meta",{done,total});
      head.appendChild(title);head.appendChild(meta);
      const track=document.createElement("div");track.className="today-progress-track";track.setAttribute("aria-label",tf("today_progress_meta",{done,total}));
      const fill=document.createElement("span");fill.style.width=pct+"%";track.appendChild(fill);
      section.appendChild(head);section.appendChild(track);return section;
    }

    function todayQuickActions(event, trip, accessActive) {
      const wrap=document.createElement("div"); wrap.className="today-quick-actions";
      const add=(label,fn)=>{const b=document.createElement("button");b.type="button";b.className="today-action";b.textContent=label;b.addEventListener("click",fn);wrap.appendChild(b);};
      if(event&&event.kind==="activity"&&event.source)add(event.completed?t("today_mark_open"):t("today_mark_done"),()=>toggleTodayActivityCompleted(event,trip));
      if (event && event.source) add(event.kind==="travel"?t("today_edit_travel"):t("today_details"),()=>todayOpenDetails(event,trip));
      if (event && event.location) add(t("today_maps"),()=>window.open(mapsUrl({location:event.location,title:event.title}),"_blank","noopener"));
      if (event && event.hasBooking && event.source && ["activity","stay","journey"].includes(event.source.kind)) add(t("today_booking_details"),()=>todayOpenBooking(event,trip));
      if (event && event.documentIndices && event.documentIndices.length) add(t("today_view_document"),()=>{setOperationsTrip(trip.id);openDocumentSheet(event.documentIndices[0]);});
      return wrap;
    }
    function renderTodayHeroEvent(label,event,trip,accessActive) {
      if (!event) return null;
      const card=document.createElement("section");card.className="today-hero-card";
      const meta=todayEventMeta(event,trip,accessActive);
      card.innerHTML=`<div class="today-hero-label">${escapeHtml(label)}</div><div class="today-hero-title">${escapeHtml(todayEventIcon(event.kind)+" "+(event.title||todayEventKindLabel(event.kind)))}</div><div class="today-hero-time">${escapeHtml(todayEventTime(event))}</div>${meta.length?`<div class="today-hero-sub">${escapeHtml(meta.join(" · "))}</div>`:""}`;
      card.appendChild(todayQuickActions(event,trip,accessActive));
      return card;
    }
    function renderTodayTimeline(model,trip,accessActive) {
      if (!model.events.length) return null;
      const section=document.createElement("section");section.className="today-section";
      section.innerHTML=`<div class="today-section-head"><div class="today-section-title">${escapeHtml(t("today_timeline"))}</div></div>`;
      const list=document.createElement("div");list.className="today-timeline";
      model.events.forEach(event=>{
        const row=document.createElement("div");row.className="today-item"+(event.temporal==="past"?" is-past":"")+(event.temporal==="current"?" is-current":"");
        const time=document.createElement("div");time.className="today-item-time"+(event.startTime?"":" unknown");time.textContent=todayEventTime(event);
        const body=document.createElement("div");
        const title=document.createElement("div");title.className="today-item-title";title.textContent=todayEventIcon(event.kind)+" "+(event.title||todayEventKindLabel(event.kind));
        const kind=document.createElement("div");kind.className="today-item-kind";kind.textContent=todayEventKindLabel(event.kind);
        body.appendChild(kind);body.appendChild(title);
        const bits=todayEventMeta(event,trip,accessActive);if(bits.length){const sub=document.createElement("div");sub.className="today-item-sub";sub.textContent=bits.join(" · ");body.appendChild(sub);}
        if(accessActive&&event.accessNote){const sub=document.createElement("div");sub.className="today-item-sub";sub.textContent="♿ "+event.accessNote;body.appendChild(sub);}
        body.appendChild(todayQuickActions(event,trip,accessActive));row.appendChild(time);row.appendChild(body);list.appendChild(row);
      });section.appendChild(list);return section;
    }
    function renderTodayAttention(model) {
      if (!model.attention.length) return null;
      const section=document.createElement("section");section.className="today-section";section.innerHTML=`<div class="today-section-title">${escapeHtml(t("today_attention"))}</div>`;
      model.attention.forEach(a=>{const row=document.createElement("div");row.className="today-attention-row "+a.level;row.innerHTML=`<span class="today-attention-level">${escapeHtml(a.level==="issue"?t("today_level_issue"):a.level==="action"?t("today_level_action"):t("today_level_info"))}</span><span>${escapeHtml(todayAttentionText(a.code))}</span>`;section.appendChild(row);});return section;
    }
    function renderTodayTasks(trip, model) {
      if(!trip||!model||!model.date)return null;
      const all=Operations.sortedTasks(trip,model.date).filter(x=>!x.info.done);
      const rows=all.filter(x=>model.isLive?(x.info.date&&x.info.date<=model.date):(x.info.date===model.date)).slice(0,5);
      if(!rows.length)return null;
      const section=document.createElement("section");section.className="today-section today-task-section";section.innerHTML=`<div class="today-section-title">${escapeHtml(t("today_tasks_title"))}</div>`;
      rows.forEach(({raw,info})=>{const state=Operations.taskDueState(info,model.date);const row=document.createElement("div");row.className="today-task-row"+(state==="overdue"?" overdue":"");const toggle=document.createElement("button");toggle.type="button";toggle.className="trip-task-toggle";toggle.textContent="○";toggle.setAttribute("aria-label",t("trip_task_mark_done"));const copy=document.createElement("div");copy.className="today-task-copy";const title=document.createElement("strong");title.textContent=info.title;copy.appendChild(title);const meta=document.createElement("small");meta.textContent=state==="overdue"?t("today_tasks_overdue"):t("today_tasks_due");copy.appendChild(meta);toggle.addEventListener("click",()=>{if(!commitState(()=>{raw.done=true;}))return;renderTodayView();renderCurrentView();showToast(t("today_mark_done"));});row.appendChild(toggle);row.appendChild(copy);section.appendChild(row);});
      const btn=document.createElement("button");btn.type="button";btn.className="btn btn-muted compact-btn today-task-board-btn";btn.textContent=t("today_tasks_open_board");btn.addEventListener("click",()=>openTripBoardSheet(trip.id,"tasks"));section.appendChild(btn);return section;
    }

    function renderTodayReminders(model) {
      const rows=model.reminders.filter(r=>model.preview?r.state==="scheduled":r.state!=="passed").slice(0,3);if(!rows.length)return null;
      const section=document.createElement("section");section.className="today-section";section.innerHTML=`<div class="today-section-title">${escapeHtml(t("today_reminders"))}</div>`;
      rows.forEach(r=>{const row=document.createElement("div");row.className="today-reminder-row"+(r.state==="due"?" is-due":"");const left=document.createElement("span");left.textContent="🔔 "+r.title;const right=document.createElement("span");right.textContent=r.state==="due"?t("today_reminder_due"):(r.state==="upcoming"&&r.minutesUntil!=null?tf("today_reminder_upcoming",{m:Math.max(0,r.minutesUntil)}):r.time);row.appendChild(left);row.appendChild(right);section.appendChild(row);});
      const note=document.createElement("div");note.className="today-section-note";note.textContent=t("today_reminder_truth");section.appendChild(note);return section;
    }
    function renderTodayMobility() {
      // TODAY-MOBILITY-001: Today should expose only the traveller's saved
      // operational mobility preferences, never route/traffic/transit claims.
      // Passing no trip intentionally excludes whole-trip base-flow counts,
      // which belong in Overview rather than the in-trip operational view.
      const labels=mobilitySummaryLabels(null);
      if(!labels.length)return null;
      const section=document.createElement("section");section.className="today-section";
      section.innerHTML=`<div class="today-section-title">${escapeHtml(t("overview_card_mobility"))}</div>`;
      const chips=document.createElement("div");chips.className="planning-chips";
      labels.forEach(label=>{const chip=document.createElement("span");chip.className="planning-chip";chip.textContent=label;chips.appendChild(chip);});
      section.appendChild(chips);
      const note=document.createElement("div");note.className="today-section-note";note.textContent=t("overview_mobility_note");section.appendChild(note);
      return section;
    }
    function renderTodayStay(model,trip) {
      const raw=model.stay&&model.stay.tonight;if(!raw)return null;
      const info=(raw.startDate||raw.endDate||raw.checkInTime||raw.checkOutTime)?stayInfo(raw):raw;
      const name=info.name||info.location;if(!name)return null;
      const section=document.createElement("section");section.className="today-section";section.innerHTML=`<div class="today-section-title">${escapeHtml(t("today_tonight"))}</div>`;
      const card=document.createElement("div");card.className="today-stay-card";const main=document.createElement("div");main.className="today-stay-main";main.innerHTML=`<div class="today-item-title">🏨 ${escapeHtml(name)}</div>${info.location&&info.location!==name?`<div class="today-item-sub">${escapeHtml(info.location)}</div>`:""}`;
      const stayPay=raw.id?Finance.paymentStatus(raw.paymentStatus):""; if(stayPay){const pay=document.createElement("div");pay.className="today-item-sub";pay.textContent=paymentStatusLabel(stayPay);main.appendChild(pay);} card.appendChild(main);
      if(raw.id){const e=model.events.find(x=>x.source&&x.source.kind==="stay"&&x.source.id===raw.id)||{kind:"checkin",title:name,location:info.location||"",paymentStatus:stayPay,source:{kind:"stay",id:raw.id,index:(trip&&Array.isArray(trip.stays)?trip.stays.indexOf(raw):-1)},hasBooking:!!(info.status||stayPay||info.confirmation||info.provider||info.bookingUrl),documentIndices:[]};card.appendChild(todayQuickActions(e,trip,false));}
      section.appendChild(card);return section;
    }
    function renderTomorrow(model,trip,accessActive) {
      if(!model.tomorrow)return null;const events=model.tomorrow.events||[],stay=model.tomorrow.stay;if(!events.length&&!stay)return null;
      const section=document.createElement("section");section.className="today-section";section.innerHTML=`<div class="today-section-head"><div class="today-section-title">${escapeHtml(t("today_tomorrow"))}</div><div class="today-item-sub">${escapeHtml(formatDateOnly(model.tomorrow.date,{day:"numeric",month:"short"})||model.tomorrow.date)}</div></div>`;
      events.forEach(event=>{const row=document.createElement("div");row.className="today-reminder-row";const left=document.createElement("span");left.textContent=(event.startTime?event.startTime+" · ":"")+todayEventIcon(event.kind)+" "+(event.title||todayEventKindLabel(event.kind));row.appendChild(left);section.appendChild(row);});
      if(stay){const info=(stay.startDate||stay.endDate)?stayInfo(stay):stay;const name=info.name||info.location;if(name){const sub=document.createElement("div");sub.className="today-section-note";sub.textContent=tf("today_tomorrow_stay",{name});section.appendChild(sub);}}
      return section;
    }
    function processTodayNotifications(model,trip) {
      if(!model||!model.isLive||typeof Notification==="undefined"||Notification.permission!=="granted")return;
      model.reminders.filter(r=>r.state==="due").forEach(r=>{const key=[trip.id,model.date,r.dayIndex,r.itemIndex,r.dueMin].join("|");if(_todayNotified.has(key))return;_todayNotified.add(key);try{new Notification(t("today_reminder_due"),{body:r.title+(r.time?" · "+r.time:"")});}catch(err){console.warn("TripMaster: foreground notification failed",err);}});
    }
    function updateTodayAlertsButton() {
      const btn=$("todayAlertsBtn"); if(!btn)return;
      if(typeof Notification==="undefined"){btn.hidden=true;return;}
      btn.hidden=false;btn.disabled=false;btn.removeAttribute("aria-pressed");
      if(Notification.permission==="granted"){btn.textContent=t("today_alerts_enabled");btn.disabled=true;btn.setAttribute("aria-pressed","true");}
      else if(Notification.permission==="denied"){btn.textContent=t("today_alerts_blocked");btn.disabled=true;}
      else btn.textContent=t("today_alerts_enable");
    }
    async function requestTodayAlerts() {
      if(typeof Notification==="undefined"){showToast(t("today_alerts_unsupported"));return;}
      try { const result=await Notification.requestPermission(); updateTodayAlertsButton(); showToast(result==="granted"?t("today_alerts_granted"):t("today_alerts_not_granted")); }
      catch(err){console.warn("TripMaster: notification permission failed",err);showToast(t("today_alerts_not_granted"));}
    }
    function renderTodayView() {
      const body=$("todayBody"),trip=getActiveTrip();if(!body)return;body.innerHTML="";
      if(!trip){body.textContent=t("toast_no_active_trip");return;}
      const clock=Today.clock(null,tripTimezone(trip));const active=Today.isTripActive(trip,clock);
      if(!active)todayPreviewMode=true;
      if(todayPreviewMode&&!todayPreviewDate)todayPreviewDate=Today.choosePreviewDate(trip,clock.date);
      const model=Today.buildToday(trip,{preview:todayPreviewMode,date:todayPreviewDate,accessActive:hasAccessPlanningNeeds()});_lastTodayModel=model;
      const badge=$("todayModeBadge"),picker=$("todayPreviewPicker"),select=$("todayPreviewSelect"),toggle=$("todayPreviewToggleBtn");
      badge.textContent=model.isLive?t("today_live_badge"):t("today_preview_badge");badge.classList.toggle("is-preview",!model.isLive);
      $("todayDateLine").textContent=model.date?(formatDateOnly(model.date,{weekday:"long",day:"numeric",month:"long"})||model.date):"";
      $("todayClockLine").textContent=model.clock.fallback?tf("today_clock_device_fallback",{time:model.clock.time}):tf("today_clock_trip",{time:model.clock.time,tz:model.clock.timezone});
      const previewDates=Today.previewDates(trip);select.innerHTML="";previewDates.forEach(d=>{const o=document.createElement("option");o.value=d;o.textContent=(formatDateOnly(d,{weekday:"short",day:"numeric",month:"short"})||d)+" · "+d;select.appendChild(o);});if(model.date&&previewDates.includes(model.date))select.value=model.date;
      picker.hidden=!model.preview;toggle.hidden=model.preview&&!model.activeTrip;toggle.setAttribute("aria-expanded",model.preview?"true":"false");toggle.textContent=model.preview&&model.activeTrip?t("today_exit_preview"):t("today_preview_btn");
      if(model.preview){const note=document.createElement("div");note.className="today-preview-banner";note.textContent=t("today_preview_notice");body.appendChild(note);}
      if(!model.date){const empty=document.createElement("section");empty.className="today-section";empty.textContent=t("today_preview_empty");body.appendChild(empty);return;}
      if(model.dayType!=="normal"){
        const travel=document.createElement("section");travel.className="today-section";const parts=[];if(model.travelDay){if(model.travelDay.origin||model.travelDay.destination)parts.push(flowPairText(model.travelDay.origin||"…", model.travelDay.destination||"…"));if(model.travelDay.departureTime||model.travelDay.arrivalTime)parts.push(flowPairText(model.travelDay.departureTime||"…", model.travelDay.arrivalTime||"…"));if(model.travelDay.arrivalDate)parts.push(t("travel_day_arrival_date_short")+": "+model.travelDay.arrivalDate);}
        travel.innerHTML=`<div class="today-section-title">${escapeHtml(dayTypeIcon(model.dayType)+" "+dayTypeLabel(model.dayType))}</div>${parts.length?`<div class="today-section-note">${escapeHtml(parts.join(" · "))}</div>`:""}`;body.appendChild(travel);
      }
      const progress=renderTodayProgress(model);if(progress)body.appendChild(progress);
      const heroes=document.createElement("div");heroes.className="today-hero-grid";
      if(model.now)heroes.appendChild(renderTodayHeroEvent(t("today_now"),model.now,trip,hasAccessPlanningNeeds()));
      if(model.next)heroes.appendChild(renderTodayHeroEvent(model.preview?t("today_preview_first"):t("today_next"),model.next,trip,hasAccessPlanningNeeds()));
      if(heroes.children.length)body.appendChild(heroes);
      else if(model.isLive&&model.noMore){const done=document.createElement("section");done.className="today-section today-empty-done";done.innerHTML=`<strong>${escapeHtml(t("today_done"))}</strong><span>${escapeHtml(t("today_no_more"))}</span>`;body.appendChild(done);}
      else if(model.isLive&&model.events.length){const uncertain=document.createElement("section");uncertain.className="today-section";uncertain.textContent=t("today_no_current");body.appendChild(uncertain);}
      else if(!model.events.length){const empty=document.createElement("section");empty.className="today-section";empty.textContent=t("today_no_plans");body.appendChild(empty);}
      [renderTodayTimeline(model,trip,hasAccessPlanningNeeds()),renderTodayAttention(model),renderTodayTasks(trip,model),renderTodayReminders(model),renderTodayMobility(),renderTodayStay(model,trip),renderTomorrow(model,trip,hasAccessPlanningNeeds())].filter(Boolean).forEach(el=>body.appendChild(el));
      processTodayNotifications(model,trip);
      updateTodayAlertsButton();
      const live = $("todayLiveStatus");
      if (live) {
        const signature=[model.date,model.now&&model.now.title,model.next&&model.next.title,model.attention.length].join("|");
        if (live.dataset.signature !== signature) {
          live.dataset.signature=signature;
          live.textContent = model.now ? tf("today_live_announce_now",{title:model.now.title||t("today_activity")}) : model.next ? tf("today_live_announce_next",{title:model.next.title||t("today_activity")}) : "";
        }
      }
    }
    function openTodayForTrip(tripId,options) {
      const opts=options||{};if(tripId&&tripId!==activeTripId){if(!switchTrip(tripId,{stayHome:true,silent:true}))return false;}
      const trip=getActiveTrip();if(!trip){if(trips.length===0)openNewTripSheet();else{currentView="home";renderCurrentView();updateHeaderInfo();showToast(t("home_choose_trip"));}return false;}
      days=trip.days||[];const c=Today.clock(null,tripTimezone(trip)),active=Today.isTripActive(trip,c);
      todayPreviewMode=opts.preview===true||!active;todayPreviewDate=opts.date||((todayPreviewMode)?Today.choosePreviewDate(trip,c.date):c.date);currentView="today";renderCurrentView();updateHeaderInfo();requestAnimationFrame(()=>{const title=$("todayViewTitle");if(title)title.focus();});return true;
    }
    function openToday() { return openTodayForTrip(activeTripId,{}); }
    function continueFromTodayToPlanner(){const trip=getActiveTrip();if(!trip)return;currentView="planner";days=trip.days||[];const wanted=_lastTodayModel&&_lastTodayModel.date;const idx=wanted?days.findIndex(d=>d.date===wanted):-1;if(idx>=0)currentDayIndex=idx;renderCurrentView();updateHeaderInfo();}

    /* Sanitized deterministic context for future local/AI integration. It
       excludes confirmations, document references and detailed finance. */
    window.TripMasterTodaySanitizedContext=function(){return _lastTodayModel?Today.sanitizedContext(_lastTodayModel):null;};
    window.TripMasterTodayPartnerContext=function(){return _lastTodayModel?Today.partnerContext(_lastTodayModel):Object.freeze({version:1,active:false,slots:[]});};

    function renderPlannerOpsHub() {
      const trip = getActiveTrip();
      const hub = $("plannerOpsHub");
      if (!hub || !trip) return;
      const clock = Today.clock(null, tripTimezone(trip));
      const activeNow = Today.isTripActive(trip, clock);
      const todayMeta = $("plannerTodayQuickMeta");
      if (todayMeta) todayMeta.textContent = activeNow ? t("ops_today_live") : t("ops_today_preview");
      const stays = tripStays(trip).length;
      const journeys = tripJourneys(trip).length;
      const logisticsMeta = $("plannerLogisticsQuickMeta");
      if (logisticsMeta) logisticsMeta.textContent = tf("ops_logistics_meta", { stays, journeys });
      const bookingRows = Finance.bookingEntries(trip, Logistics);
      const attention = Finance.bookingAttentionEntries(trip, Logistics).length;
      const bookingsMeta = $("plannerBookingsQuickMeta");
      if (bookingsMeta) bookingsMeta.textContent = tf("ops_bookings_meta", { n:bookingRows.length, attention });
      const expenses=tripExpenses(trip).length, budget=Finance.budgetInfo(trip);
      const moneyMeta=$("plannerMoneyQuickMeta");
      if(moneyMeta) moneyMeta.textContent=tf("ops_money_meta",{n:expenses,budget:budget.amount!=null&&budget.currency?formatMoneyAmount(budget.amount,budget.currency):t("overview_fact_unset")});
      const documents=tripDocuments(trip).length + Finance.derivedConfirmationDocuments(trip,Logistics).length;
      const documentsMeta=$("plannerDocumentsQuickMeta");
      if(documentsMeta) documentsMeta.textContent=tf("ops_documents_meta",{n:documents});
      const boardMeta=$("plannerBoardQuickMeta"), taskSummary=tripTaskStats(trip);
      if(boardMeta) boardMeta.textContent=tf("trip_board_meta",{days:(trip.days||[]).length,tasks:taskSummary.open});
      const readiness=tripReadiness(trip),readinessBtn=$("plannerReadinessBtn"),readinessMeta=$("plannerReadinessMeta"),readinessTitle=$("plannerReadinessTitle"),readinessIcon=$("plannerReadinessIcon");
      if(readinessBtn){readinessBtn.classList.remove("is-ready","is-check","is-issue");readinessBtn.classList.add("is-"+readiness.level);}
      if(readinessTitle)readinessTitle.textContent=t("planner_readiness_title")+" · "+readinessLabel(readiness.level);
      if(readinessMeta)readinessMeta.textContent=readiness.issues
        ? tf("planner_readiness_issue_meta",{issues:readiness.issues,actions:readiness.actions})
        : readiness.actions ? tf("planner_readiness_actions_meta",{actions:readiness.actions}) : t("planner_readiness_clear");
      if(readinessIcon)readinessIcon.textContent=readiness.level==="issue"?"!":"✓";
    }

    function renderCurrentView() {
      const home = $("homeDashboard");
      const planner = $("plannerView");
      const todayView = $("todayView");
      const bottom = document.querySelector(".bottom-bar");
      const active = getActiveTrip();
      if ((currentView === "planner" || currentView === "today") && !active) currentView = "home";
      const atHome = currentView === "home", atToday = currentView === "today";
      if (home) home.style.display = atHome ? "" : "none";
      if (planner) planner.style.display = (!atHome && !atToday) ? "" : "none";
      if (todayView) todayView.style.display = atToday ? "" : "none";
      if (bottom) bottom.style.display = (!atHome && !atToday) ? "" : "none";
      if (atHome) renderHomeDashboard();
      else if (atToday) { days = active.days || []; renderTodayView(); }
      else {
        days = active.days || [];
        renderDays();
        renderActivities(currentDayIndex);
        renderPlannerOpsHub();
      }
      renderAccessProfile();
    }

    /* ── Header info ── */
    function updateHeaderInfo() {
      const activeTrip = getActiveTrip();
      const dateLine = $("headerTripDates");
      if (currentView === "home") {
        $("headerCity").innerText = "TripMaster";
        dateLine.innerText = t("home_dashboard_title");
        // The same header line is normally a numeric date range and is styled
        // LTR. Home uses translated copy, so honour the document direction or
        // Hebrew/Arabic dashboard text would be forced into LTR presentation.
        dateLine.dir = document.documentElement.dir === "rtl" ? "rtl" : "ltr";
        dateLine.style.direction = dateLine.dir;
        return;
      }
      if (currentView === "today") {
        $("headerCity").innerText = (activeTrip && activeTrip.name) ? activeTrip.name : "TripMaster";
        dateLine.dir = document.documentElement.dir === "rtl" ? "rtl" : "ltr";
        dateLine.style.direction = dateLine.dir;
        dateLine.innerText = t("today_title");
        return;
      }
      $("headerCity").innerText = (activeTrip && activeTrip.name) ? activeTrip.name : "TripMaster";
      dateLine.dir = "ltr";
      dateLine.style.direction = "ltr";

      // dates from the active trip only
      if (activeTrip && days.length > 0) {
        const first = days[0].date;
        const last  = days[days.length - 1].date;
        // DATEONLY-001: calendar date, formatted in UTC.
        const fmt = (d) => formatDateOnly(d, { day: "numeric", month: "short" }) || d;
        dateLine.innerText = first === last ? fmt(first) : `${fmt(first)}–${fmt(last)}`;
      } else {
        dateLine.innerText = "";
      }
    }

    /* ── Sheets (trips) ── */
    function openNewTripSheet() {
      $("newTripNameInput").value = "";
      openSheetEl("newTripSheet");
    }
    function closeNewTripSheet() { closeSheetEl("newTripSheet"); }
    function openFirstDaySheet() {
      $("firstDayDateInput").value = todayISO();
      openSheetEl("firstDaySheet");
    }
    function closeFirstDaySheet() { closeSheetEl("firstDaySheet"); }

    /* ── LEGACY-SWITCH-001 (v1050-RC2): openTripSheet()/closeTripSheet() removed ──
       The "switch trip" sheet was a second, competing trip-management model
       next to the Home dashboard. Every capability it carried now lives on
       Home: Home is the active-trip card, the upcoming-trip card and the
       other-trips list, and dashboardTripCard()/renderHomeDashboard() below
       carry the per-trip Continue / Trip Details / Overview / Delete
       actions the sheet used to own. Nothing internal still needs it, so it
       is deleted rather than hidden — no orphan handler, no dead sheet id
       in closeAnySheet(), no #tripSheet markup. ── */

    function deleteTrip(tripId) {
      if (tripId === "home") { showToast(t("toast_cant_delete_home")); return; }
      const trip = trips.find(t => t.id === tripId);
      if (!trip) return;
      confirmDeleteTrip(trip.name, () => {
        /* ── ACTIVE-TRIP-001 (v1040 / A4) — CONFIRMED defect, fixed ──
           The old path filtered trips[] in memory and then, for the ACTIVE
           trip, called goHome(). goHome() wrote KEY_ACTIVE_TRIP but never
           KEY_TRIPS, so the filtered array was never persisted and the
           deleted trip reappeared on the next reload. It only ever survived
           because the pagehide / visibilitychange handler happened to call
           saveTrips() later — exactly the kind of rescue this release is
           meant to stop relying on. commitState() persists both keys inside
           the same transaction, or rolls the deletion back entirely. */
        const wasActive = activeTripId === tripId;
        // The guard must run BEFORE the single-slot safety snapshot is
        // overwritten. A refused stale delete must never consume the user's
        // previous recovery snapshot. commitState() keeps its own second guard
        // as defense-in-depth.
        if (!guardExternalStateBeforeWrite()) return;
        if (!writeSafetySnapshot("trip-delete")) { showToast(t("toast_snapshot_failed")); return; }
        const ok = commitState(() => {
          trips = trips.filter(x => x.id !== tripId);
          if (wasActive) {
            activeTripId = null;
            days = [];
            currentDayIndex = 0;
            currentView = "home";
          }
        }, {});
        if (!ok) return;
        if (wasActive) resetAIForTripContextChange();
        renderCurrentView();
        updateHeaderInfo();
        showUndoToast(tf("toast_trip_deleted", { name: trip.name }));
      });
    }

    /* ── Settings ── */
    /* ── SETTINGS-NORM-001 (v1020) ──
       v1011 built the settings default inline and doRestore() replaced the whole
       object with backup.settings, so restoring a pre-v1020 backup would have
       deleted prefs/access, and a backup with no settings key would have made
       `settings` undefined mid-session. DEFAULT_SETTINGS is now the single
       source of shape and normalizeSettings() fills any missing branch.
       Additive only: no existing field is renamed, removed, or re-typed, and
       no localStorage key changes. ── */
    const DEFAULT_SETTINGS = {
      // FIELDS-001 (v1020 RC3): city / hotel / baseArea are no longer active
      // fields, so they are absent here. They are NOT purged from stored data:
      // normalizeSettings() spreads the incoming object over these defaults, so
      // any legacy value in an older backup is preserved untouched.
      defaultReminderMin: 30,
      // I18N-001 (v1030): UI language only. Never applied to user content.
      // Absent from every pre-v1030 backup, so normalizeSettings() supplies
      // the "he" default and old backups keep restoring unchanged.
      language: DEFAULT_LANG,
      prefs: {
        v: 1,
        pace: null,            // "relaxed" | "balanced" | "packed" | null
        transport: [],         // "walk" | "public" | "taxi" | "train"
        noSelfDrive: false,    // true = user explicitly does not plan to self-drive
        maxWalkKm: null,       // number | null
        budget: null,          // "low" | "mid" | "high" | null
        food: [],              // free tags
        attractions: [],       // free tags
        notes: ""
      },
      access: {
        v: 1,
        stepFree: false,
        avoidStairs: false,
        elevatorNeeded: false,
        shortWalks: false,
        wheelchair: "none",    // "none" | "manual" | "electric"
        companion: false,
        quietPreference: false,
        notes: ""
      }
    };

    // Fills missing branches without overwriting anything the user already has.
    function normalizeSettings(raw) {
      const src = (raw && typeof raw === "object") ? raw : {};
      const out = Object.assign({}, DEFAULT_SETTINGS, src);
      out.prefs  = Object.assign({}, DEFAULT_SETTINGS.prefs,  (src.prefs  && typeof src.prefs  === "object") ? src.prefs  : {});
      out.access = Object.assign({}, DEFAULT_SETTINGS.access, (src.access && typeof src.access === "object") ? src.access : {});
      if (["none", "manual", "electric"].indexOf(out.access.wheelchair) === -1) {
        out.access.wheelchair = "none";
      }
      // I18N-001 (v1030): only an ACTIVE language may be persisted. An old
      // backup (no field), a hand-edited value, or a language that is not
      // finished yet all collapse to Hebrew rather than a half-translated UI.
      if (activeLanguages().indexOf(out.language) === -1) {
        out.language = DEFAULT_LANG;
      }
      // Object.assign is shallow, so the array defaults would otherwise be
      // shared by reference with DEFAULT_SETTINGS and across calls. Always
      // hand back a fresh array.
      ["transport", "food", "attractions"].forEach((k) => {
        out.prefs[k] = Array.isArray(out.prefs[k]) ? out.prefs[k].slice() : [];
      });
      // AI-SECRET-002 (v2800): API credentials are server-side only. Legacy
      // backups/settings may still contain this historical field, but it is
      // discarded during normalization and never becomes active app state.
      delete out.apiKey;
      return out;
    }

    const _hadStoredSettingsAtBoot = localStorage.getItem(KEY_SETTINGS) !== null;
    const _storedSettingsAtBoot = safeParseJSON(KEY_SETTINGS, null);
    const _hadLegacyClientApiKeyField = !!(_storedSettingsAtBoot && typeof _storedSettingsAtBoot === "object" && Object.prototype.hasOwnProperty.call(_storedSettingsAtBoot, "apiKey"));
    let settings = normalizeSettings(_storedSettingsAtBoot);
    const _shouldPersistFirstRunLanguage = !_hadStoredSettingsAtBoot;
    if (_shouldPersistFirstRunLanguage || _unreadableStorageKeys.has(KEY_SETTINGS)) settings.language = detectFirstRunLanguage();
    // I18N-001 / I18N-FIRST-RUN-001: adopt the stored language immediately;
    // on a true first run this is the supported device language, or English
    // when the device language is not currently supported.
    currentLang = settings.language;
    updatePreferenceStorageTokens();

    /* ── AI-SECRET-002 (v2800) ──
       Provider/API credentials do not belong in the PWA. The old hidden
       Anthropic field and listener are removed. For backward compatibility,
       normalizeSettings() accepts old settings objects but drops `apiKey`,
       and every outbound/persisted settings copy defensively deletes it. ── */
    function settingsForStorage(source) {
      const copy = JSON.parse(JSON.stringify(source === undefined ? settings : source));
      delete copy.apiKey;
      return copy;
    }

    function saveSettings() {
      const value = JSON.stringify(settingsForStorage());
      const ok = writeAll([[KEY_SETTINGS, value]]);
      if (ok) _settingsStorageToken = value;
      return ok;
    }

    function adoptExternalSettingsFromStorage() {
      let raw = "";
      try { raw = localStorage.getItem(KEY_SETTINGS) || ""; } catch (_) {}
      const storedSettings = safeParseJSON(KEY_SETTINGS, null);
      if (!storedSettings || typeof storedSettings !== "object") {
        _settingsStorageToken = raw;
        _externalSettingsPending = false;
        return false;
      }
      settings = normalizeSettings(storedSettings);
      currentLang = settings.language;
      _settingsStorageToken = raw;
      _externalSettingsPending = false;
      applyLanguage();
      renderPrefsAndAccess();
      renderCurrentView();
      updateHeaderInfo();
      return true;
    }

    function normalizedStoredTheme() {
      try { return localStorage.getItem(KEY_THEME) === "dark" ? "dark" : "light"; }
      catch (_) { return "light"; }
    }

    function adoptExternalThemeFromStorage() {
      const next = normalizedStoredTheme();
      const token = canonicalPreferenceTokens();
      if (token) _themeStorageToken = token.theme;
      _externalThemePending = false;
      if (next === "dark") document.documentElement.setAttribute("data-theme", "dark");
      else document.documentElement.removeAttribute("data-theme");
      return true;
    }

    // Lock in the automatically selected first-run language so a later device
    // locale change does not unexpectedly switch an established TripMaster UI.
    if (_shouldPersistFirstRunLanguage && !saveSettings()) {
      console.warn("TripMaster: could not persist first-run language preference");
    }

    function commitSettings(mutate) {
      // SETTINGS-SYNC-003 (v3200): preference writes obey the same stale-code
      // safety boundary as trip writes, and they detect missed storage events
      // before mutating the whole settings object.
      if (!guardPreferenceWrite("settings")) return false;
      const before = JSON.stringify(settings);
      try { mutate(); }
      catch (err) { console.warn("TripMaster: settings mutation failed", err); reportStorageFailure(); return false; }
      if (saveSettings()) return true;
      try { settings = normalizeSettings(JSON.parse(before)); } catch (err) { console.warn("TripMaster: settings rollback failed", err); }
      reportStorageFailure();
      try { renderPrefsAndAccess(); renderAccessProfile(); renderCurrentView(); updateHeaderInfo(); } catch (err) {}
      return false;
    }

    // One-time purge of the historical client API-key property, including an
    // empty placeholder left by older releases. This rewrites settings using
    // the normalized secret-free shape.
    if (_hadLegacyClientApiKeyField) saveSettings();

    /* ── Toast ──
       UNDO-001 (v1040 / A5): the toast can now carry one action button.
       Built from real elements rather than innerText so nothing can leave a
       stray text node behind, and cleared completely on every call. An
       actionable toast stays up longer, because it asks the user to decide.
       (The local element variable used to be named `t`, which shadowed the
       translation function inside this scope.) */
    function showToast(text, actionLabel, actionFn) {
      const el = $("toast");
      el.textContent = "";
      const msg = document.createElement("span");
      msg.className = "toast-text";
      msg.textContent = text;
      el.appendChild(msg);
      if (actionLabel && typeof actionFn === "function") {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "toast-action";
        btn.textContent = actionLabel;
        btn.addEventListener("click", () => {
          clearTimeout(showToast._t);
          el.classList.remove("visible");
          actionFn();
        });
        el.appendChild(btn);
      }
      el.classList.add("visible");
      clearTimeout(showToast._t);
      showToast._t = setTimeout(() => el.classList.remove("visible"), actionLabel ? 6500 : 1900);
    }

    function showUndoToast(text) {
      showToast(text, t("undo_action"), performUndo);
    }

    /* ── Custom confirm dialogs ── */
    function openConfirmSheet(sheetId) { openSheetEl(sheetId); }
    function closeConfirmSheet(sheetId) { closeSheetEl(sheetId); }

    /* MENU-003 (v1020 RC3): confirmation sheets now stack over an open menu.
       Unconditionally clearing the backdrop on close would leave the menu
       visible but undimmed and un-dismissable by tapping outside. Re-derive
       the backdrop from whatever is still open instead. */
    function syncBackdrop() {
      const stillOpen = document.querySelector(".sheet.open");
      $("sheetBackdrop").classList.toggle("open", !!stillOpen);
    }

    /* ── About / Beta feedback (v1009) ── */
    function openAboutSheet() {
      $("aboutVersionBadge").innerText = "TripMaster " + APP_VERSION;
      openConfirmSheet("aboutSheet");
    }
    function closeAboutSheet() {
      closeConfirmSheet("aboutSheet");
    }
    function buildFeedbackTemplate() {
      const audit=_lastBetaAudit||Operations.auditTripGraph(trips,activeTripId);
      const faults=readRuntimeDiagnostics();
      return [
        t("fb_head"),
        t("fb_version") + APP_VERSION,
        t("fb_device"),
        t("fb_health") + `${audit.status} · E${audit.errors.length} · W${audit.warnings.length}`,
        t("fb_runtime_faults") + String(faults.length),
        t("fb_desc"),
        t("fb_steps")
      ].join("\n");
    }

    let _pendingDeleteActivity = null;
    function confirmDeleteActivity(cb) {
      _pendingDeleteActivity = cb;
      openConfirmSheet("confirmDeleteActivitySheet");
    }
    $("confirmDeleteActivityOk").addEventListener("click", () => {
      closeConfirmSheet("confirmDeleteActivitySheet");
      if (_pendingDeleteActivity) { _pendingDeleteActivity(); _pendingDeleteActivity = null; }
    });
    $("confirmDeleteActivityCancel").addEventListener("click", () => { closeConfirmSheet("confirmDeleteActivitySheet"); _pendingDeleteActivity = null; });
    $("confirmDeleteActivityClose").addEventListener("click",  () => { closeConfirmSheet("confirmDeleteActivitySheet"); _pendingDeleteActivity = null; });

    function attachLongPressDelete(element, callback) {
      if (!element || typeof callback !== "function") return;

      let longPressTimer = null;
      let longPressFired = false;
      let startX = 0;
      let startY = 0;
      const MOVE_TOLERANCE = 12;
      const ignoreSelector = "button, input, textarea, select, .done, .delete, .hero-btn, .hero-map-btn";

      const clearLongPress = () => {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      };

      const startLongPress = (clientX, clientY, target) => {
        if (target && target.closest && target.closest(ignoreSelector)) return;
        longPressFired = false;
        startX = clientX || 0;
        startY = clientY || 0;
        clearLongPress();
        longPressTimer = setTimeout(() => {
          longPressTimer = null;
          longPressFired = true;
          callback();
        }, 650);
      };

      const maybeCancelOnMove = (clientX, clientY) => {
        if (!longPressTimer) return;
        const dx = Math.abs((clientX || 0) - startX);
        const dy = Math.abs((clientY || 0) - startY);
        if (dx > MOVE_TOLERANCE || dy > MOVE_TOLERANCE) clearLongPress();
      };

      element.addEventListener("touchstart", (e) => {
        const t = e.touches && e.touches[0];
        if (!t) return;
        startLongPress(t.clientX, t.clientY, e.target);
      }, { passive: true });

      element.addEventListener("touchmove", (e) => {
        const t = e.touches && e.touches[0];
        if (!t) return;
        maybeCancelOnMove(t.clientX, t.clientY);
      }, { passive: true });

      element.addEventListener("touchend", (e) => {
        clearLongPress();
        if (longPressFired) {
          e.preventDefault();
          e.stopPropagation();
        }
      });

      element.addEventListener("touchcancel", clearLongPress, { passive: true });

      element.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        startLongPress(e.clientX, e.clientY, e.target);
      });
      element.addEventListener("mousemove", (e) => maybeCancelOnMove(e.clientX, e.clientY));
      element.addEventListener("mouseup", clearLongPress);
      element.addEventListener("mouseleave", clearLongPress);

      element.addEventListener("contextmenu", (e) => {
        if (e.target.closest(ignoreSelector)) return;
        e.preventDefault();
        clearLongPress();
        callback();
      });
    }

    let _pendingDeleteTrip = null;
    function confirmDeleteTrip(tripName, cb) {
      $("confirmDeleteTripTitle").innerText = tf("confirm_del_trip_q_named", { name: tripName });
      _pendingDeleteTrip = cb;
      openConfirmSheet("confirmDeleteTripSheet");
    }
    $("confirmDeleteTripOk").addEventListener("click", () => {
      closeConfirmSheet("confirmDeleteTripSheet");
      if (_pendingDeleteTrip) { _pendingDeleteTrip(); _pendingDeleteTrip = null; }
    });
    $("confirmDeleteTripCancel").addEventListener("click", () => { closeConfirmSheet("confirmDeleteTripSheet"); _pendingDeleteTrip = null; });
    $("confirmDeleteTripClose").addEventListener("click",  () => { closeConfirmSheet("confirmDeleteTripSheet"); _pendingDeleteTrip = null; });

    let _pendingReset = null;
    function confirmReset(cb) {
      _pendingReset = cb;
      openConfirmSheet("confirmResetSheet");
    }
    $("confirmResetOk").addEventListener("click", () => {
      closeConfirmSheet("confirmResetSheet");
      if (_pendingReset) { _pendingReset(); _pendingReset = null; }
    });
    $("confirmResetCancel").addEventListener("click", () => { closeConfirmSheet("confirmResetSheet"); _pendingReset = null; });
    $("confirmResetClose").addEventListener("click",  () => { closeConfirmSheet("confirmResetSheet"); _pendingReset = null; });

    let _pendingRestore = null;
    function confirmRestore(cb) {
      _pendingRestore = cb;
      openConfirmSheet("confirmRestoreSheet");
    }
    $("confirmRestoreOk").addEventListener("click", () => {
      closeConfirmSheet("confirmRestoreSheet");
      if (_pendingRestore) { _pendingRestore(); _pendingRestore = null; }
    });
    $("confirmRestoreCancel").addEventListener("click", () => { closeConfirmSheet("confirmRestoreSheet"); _pendingRestore = null; });
    $("confirmRestoreClose").addEventListener("click",  () => { closeConfirmSheet("confirmRestoreSheet"); _pendingRestore = null; });

    /* ── Utils ── */
    function escapeHtml(str) {
      return String(str || "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

    function todayISO() {
      /* Correct as-is: "today" IS a local question, so local getters on a
         real instant are what we want here. Only STORED date-only values
         need the timezone-neutral treatment below. */
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    }

    /* ── DATEONLY-001 (v1040-RC1) ═══════════════════════════════════════════
       A day's `date` is a CALENDAR DATE, not an instant. It has no time and
       no zone: 2026-06-01 is the 1st of June for every user on earth.

       But new Date("2026-06-01") parses the ISO date-only form as UTC
       midnight, and every LOCAL getter then reads it through the device
       offset. West of Greenwich that is the PREVIOUS day:

         TZ=America/New_York
         new Date("2026-06-01")            -> Sun May 31 2026 20:00 EDT
         .getDate()                        -> 31
         .toLocaleDateString("en-US")      -> 5/31/2026

       Four call sites did exactly this, so a New York or Los Angeles user
       saw every day chip, day title, header range and exported date one day
       early. addNewDay() was worse than cosmetic: it read back 31, added 1,
       re-serialised through local getters and produced 2026-06-01 again —
       the SAME date — so "add day" appeared to do nothing.

       Everything below parses into explicit parts and does all arithmetic
       and formatting in UTC, which makes the device timezone structurally
       incapable of moving a stored date. The stored YYYY-MM-DD schema is
       unchanged, so no migration is involved.

       Note on sorting: stored ISO calendar dates are ordered lexicographically.
       That keeps sorting date-only and avoids parsing them as instants at all. ══ */
    function parseDateOnly(dateString) {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateString == null ? "" : dateString).trim());
      if (!m) return null;
      const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
      const dt = new Date(Date.UTC(y, mo - 1, d));
      // Rejects overflow such as 2026-02-30, which Date.UTC would roll over.
      if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
      return dt;
    }

    function dateOnlyToISO(dt) {
      return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,"0")}-${String(dt.getUTCDate()).padStart(2,"0")}`;
    }

    /* Calendar-day arithmetic. UTC setters roll months, years and leap days
       correctly and cannot be perturbed by the device offset or by DST. */
    function addDaysToDateOnly(dateString, n) {
      const dt = parseDateOnly(dateString);
      if (!dt) return null;
      dt.setUTCDate(dt.getUTCDate() + n);
      return dateOnlyToISO(dt);
    }

    /* timeZone:"UTC" is mandatory here — the Date is UTC midnight, so any
       other zone re-introduces the very shift this block exists to remove. */
    function formatDateOnly(dateString, opts) {
      const dt = parseDateOnly(dateString);
      if (!dt) return null;
      const o = Object.assign({ timeZone: "UTC" }, opts || {});
      try { return dt.toLocaleDateString(dateLocale(), o); }
      catch (e) { return dateOnlyToISO(dt); }
    }

    function flowPairText(fromValue, toValue) {
      const from = String(fromValue == null || fromValue === "" ? "…" : fromValue);
      const to = String(toValue == null || toValue === "" ? "…" : toValue);
      const isolate = (value) => "\u2068" + value + "\u2069";
      const rtl = document.documentElement.getAttribute("dir") === "rtl";
      return isolate(from) + (rtl ? " ← " : " → ") + isolate(to);
    }

    function dateOnlyWeekday(dateString) {
      const dt = parseDateOnly(dateString);
      return dt ? dt.getUTCDay() : -1;
    }

    function dateOnlyDayNum(dateString) {
      const dt = parseDateOnly(dateString);
      return dt ? dt.getUTCDate() : -1;
    }

    /* ── MAPS-001 (v1040 / B1, G) ──
       Navigation used to query the free-form NOTE, so "לקנות כרטיסים מראש"
       or a phone number was handed to Google Maps as a place search. It now
       uses the dedicated location field and falls back to the activity
       title. The note is never used as a navigation query. ── */
    function mapsQuery(item) {
      const loc = itemLocation(item);
      return loc || (item && item.title) || "";
    }
    function mapsUrl(item) {
      return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(mapsQuery(item));
    }

    /* ACCESS-ACT-001 (v1040 / D3): compact, and only ever reflects what the
       traveller entered. There is no state that means "TripMaster checked". */
    function accessBadgeHtml(item) {
      const status = itemAccessStatus(item);
      if (!status || status === "needscheck") return "";
      const verified = status === "verified" || status === "stepfree";
      const label = verified ? t("access_badge_verified") : t("access_badge_problem");
      const icon  = verified ? "✓" : "⚠️";
      const cls = verified ? "verified" : status;
      return `<span class="access-badge access-${cls}">${icon} ${escapeHtml(label)}</span>`;
    }

    /* CATEGORY-001 (v1040 / E5): options are rendered rather than static so
       they follow the active language on every switch. */
    function renderCategoryOptions() {
      const sel = $("addCategory");
      if (!sel) return;
      const prev = sel.value;
      sel.innerHTML = "";
      const auto = document.createElement("option");
      auto.value = "";
      auto.textContent = t("cat_auto");
      sel.appendChild(auto);
      CATEGORY_ORDER.forEach((key) => {
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = (CATEGORY_ICONS[key] ? CATEGORY_ICONS[key] + "  " : "") + t("cat_" + key);
        sel.appendChild(opt);
      });
      sel.value = prev;
    }

    /* ── LOCALE-001 (v1040 / E1) ──
       Every user-facing date used to be formatted with a hardcoded "he-IL",
       so an English or Spanish UI still printed Hebrew-locale dates. The
       locale now follows the active language via LANG_META, which already
       carries a valid BCP-47 tag per language. ── */
    function dateLocale() {
      const meta = LANG_META[currentLang] || LANG_META[DEFAULT_LANG];
      return (meta && meta.lang) ? meta.lang : "he";
    }

    function formatDateForTitle(dateString, fallback) {
      // DATEONLY-001: was new Date(dateString).toLocaleDateString(), which
      // printed the previous day west of Greenwich.
      const out = formatDateOnly(dateString);
      return out === null ? fallback : out;
    }

    function findTodayDayIndex() {
      const t = getActiveTrip() ? activeTripClock().date : todayISO();
      return days.findIndex(d => d.date === t);
    }

    /* ── CATEGORY-001 (v1040 / E5) ──
       item.category was ALREADY preferred over the guess below before
       v1040; it simply had no control anywhere in the UI, so in practice
       every icon came from the keyword list. That list only matches Hebrew
       and English, so a Russian, Spanish, Portuguese or Arabic title always
       fell through to the generic pin — a real language bias.

       The smallest honest fix was to give the existing structured field a
       picker (see #addCategory) rather than grow the heuristic into a
       language-specific keyword table that would keep becoming incomplete as more locales are added.
       The guess is kept, unchanged, as the "automatic" fallback so no
       existing activity changes its icon. ── */
    function getCategoryIcon(item) {
      if (item.category && CATEGORY_ICONS[item.category]) return CATEGORY_ICONS[item.category];
      const t = (item.title || "").toLowerCase();
      if (t.includes("מסעדה") || t.includes("ארוחה") || t.includes("lunch") || t.includes("dinner") || t.includes("food") || t.includes("coffee")) return "🍴";
      if (t.includes("מלון") || t.includes("hotel") || t.includes("hostel")) return "🛏";
      if (t.includes("טיסה") || t.includes("flight") || t.includes("airport")) return "✈️";
      if (t.includes("קניות") || t.includes("shopping") || t.includes("shop")) return "🛍";
      if (t.includes("רכבת") || t.includes("אוטובוס") || t.includes("metro") || t.includes("bus") || t.includes("taxi")) return "🚇";
      if (t.includes("מוזיאון") || t.includes("museum") || t.includes("גלריה") || t.includes("gallery")) return "🏛";
      return "📍";
    }

    /* ── Render Days ── */
    function renderDays() {
      const wrap = $("dayChips");
      wrap.innerHTML = "";
      const todayStr = getActiveTrip() ? activeTripClock().date : todayISO();

      days.forEach((day, index) => {
        const chip = document.createElement("button");
        // DATEONLY-001: weekday and day number come from UTC getters.
        const weekday = dateOnlyWeekday(day.date);
        const isToday = day.date === todayStr;
        chip.className = `chip ${index === currentDayIndex ? "active" : ""} ${isToday && index !== currentDayIndex ? "today-chip" : ""}`;
        chip.type = "button";

        const dayNames = String(t("day_names_short")).split(",");
        const dayLabel = weekday < 0 ? tf("day_n", { n: index + 1 }) : (dayNames[weekday] || "");
        const dayNum   = weekday < 0 ? (index + 1) : dateOnlyDayNum(day.date);

        const type = dayType(day);
        chip.innerHTML = `
          <span class="chip-day-label">${escapeHtml(dayLabel)}</span>
          <span class="chip-day-num">${dayNum}</span>
          ${type !== "normal" ? `<span class="chip-day-type" title="${escapeHtml(dayTypeLabel(type))}">${escapeHtml(dayTypeIcon(type))}</span>` : ""}
          <span class="chip-dot"></span>
        `;

        chip.addEventListener("click", () => {
          currentDayIndex = index;
          renderDays();
          renderActivities(index);
        });

        chip.setAttribute("aria-current", index === currentDayIndex ? "true" : "false");

        // DAY-DEL-001 (v1040 / A1): the day-specific confirmation. This used
        // to open confirmDeleteActivity(), whose text promised that one
        // activity would be deleted while the handler removed the whole day.
        chip.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          requestDeleteDay(index);
        });

        wrap.appendChild(chip);
      });

      const addChip = document.createElement("button");
      addChip.className = "chip add-day";
      addChip.type = "button";
      addChip.textContent = "＋";
      addChip.title = t("add_day_title");
      addChip.addEventListener("click", addNewDay);
      wrap.appendChild(addChip);

      // DAY-DEL-001 (v1040 / A1): the visible delete control only exists
      // while there is a day to delete.
      const delDayBtn = $("deleteDayBtn");
      if (delDayBtn) delDayBtn.style.display = days.length > 0 ? "" : "none";
      const detailsBtn = $("dayDetailsBtn");
      if (detailsBtn) detailsBtn.style.display = days.length > 0 ? "" : "none";

      updateHeaderInfo();
    }

    /* ── TRAVEL-DAY-001 (v1060): additive day classification/details. ── */
    function updateTravelDayFieldsVisibility() {
      const fields = $("travelDayFields");
      if (!fields) return;
      fields.hidden = $("dayTypeSelect").value === "normal";
    }

    function openDayDetailsSheet() {
      const day = days[currentDayIndex];
      if (!day) return;
      const type = dayType(day);
      const info = dayTravelInfo(day);
      const flow = dayBaseFlow(day);
      $("dayTypeSelect").value = type;
      $("travelDayOrigin").value = info.origin;
      $("travelDayDestination").value = info.destination;
      $("travelDayMode").value = info.mode;
      $("travelDayDepartureTime").value = info.departureTime;
      $("travelDayArrivalTime").value = info.arrivalTime;
      $("travelDayArrivalDate").value = info.arrivalDate || "";
      $("travelDayReference").value = info.reference;
      $("dayStartsAtBase").checked = flow.startsAtBase;
      $("dayReturnsToBase").checked = flow.returnsToBase;
      const base = tripBase(getActiveTrip());
      const baseBlock = $("dayBaseFlowBlock");
      if (baseBlock) baseBlock.hidden = !(base.name || base.location);
      updateTravelDayFieldsVisibility();
      openSheetEl("dayDetailsSheet");
    }

    function closeDayDetailsSheet() { closeSheetEl("dayDetailsSheet"); }

    function saveDayDetails() {
      const day = days[currentDayIndex];
      if (!day) { closeDayDetailsSheet(); return; }
      const type = Travel.DAY_TYPES.indexOf($("dayTypeSelect").value) !== -1 ? $("dayTypeSelect").value : "normal";
      const base = tripBase(getActiveTrip());
      const hasBase = !!(base.name || base.location);
      if (type !== "normal") {
        const departureTime = $("travelDayDepartureTime").value;
        const arrivalTime = $("travelDayArrivalTime").value;
        const arrivalDate = $("travelDayArrivalDate").value;
        if (arrivalDate && arrivalDate < day.date) { showToast(t("toast_travel_day_arrival_date_invalid")); return; }
        const dep=DayIntel.parseTime(departureTime), arr=DayIntel.parseTime(arrivalTime);
        if (dep !== null && arr !== null && arr <= dep && !arrivalDate) { showToast(t("toast_travel_day_arrival_date_required")); return; }
        if (arrivalDate === day.date && dep !== null && arr !== null && arr <= dep) { showToast(t("toast_travel_day_time_range")); return; }
      }
      const ok = commitState(() => {
        if (type === "normal") delete day.dayType;
        else day.dayType = type;

        // Only edit the nested travel object while the day is a travel day.
        // Switching back to Normal never silently destroys previously entered details.
        if (type !== "normal") {
          const travel = (day.travelDay && typeof day.travelDay === "object") ? Object.assign({}, day.travelDay) : {};
          const origin = $("travelDayOrigin").value.trim();
          const destination = $("travelDayDestination").value.trim();
          const mode = $("travelDayMode").value;
          const departureTime = $("travelDayDepartureTime").value;
          const arrivalTime = $("travelDayArrivalTime").value;
          const arrivalDate = $("travelDayArrivalDate").value;
          const reference = $("travelDayReference").value.trim();
          if (origin) travel.origin = origin; else delete travel.origin;
          if (destination) travel.destination = destination; else delete travel.destination;
          if (Travel.DAY_TRAVEL_MODES.indexOf(mode) !== -1) travel.mode = mode; else delete travel.mode;
          if (/^\d{2}:\d{2}$/.test(departureTime)) travel.departureTime = departureTime; else delete travel.departureTime;
          if (/^\d{2}:\d{2}$/.test(arrivalTime)) travel.arrivalTime = arrivalTime; else delete travel.arrivalTime;
          if (/^\d{4}-\d{2}-\d{2}$/.test(arrivalDate) && arrivalDate >= day.date) travel.arrivalDate = arrivalDate; else delete travel.arrivalDate;
          if (reference) travel.reference = reference; else delete travel.reference;
          if (Object.keys(travel).length) day.travelDay = travel; else delete day.travelDay;
        }

        if (hasBase) {
          const flow = (day.baseFlow && typeof day.baseFlow === "object") ? Object.assign({}, day.baseFlow) : {};
          if ($("dayStartsAtBase").checked) flow.startsAtBase = true; else delete flow.startsAtBase;
          if ($("dayReturnsToBase").checked) flow.returnsToBase = true; else delete flow.returnsToBase;
          if (Object.keys(flow).length) day.baseFlow = flow; else delete day.baseFlow;
        }
      });
      if (!ok) return;
      renderDays();
      renderActivities(currentDayIndex);
      if (currentView === "today") renderTodayView();
      closeDayDetailsSheet();
      showToast(t("toast_day_details_saved"));
    }

    /* ── DAY-DEL-001 (v1040 / A1) + ACT-DEL-001 (A2) ──
       Two separate confirmations for two separate operations. The day dialog
       names the date and states how many activities go with it; the activity
       dialog is untouched and still speaks only about one activity. ── */
    let _pendingDeleteDay = null;

    function requestDeleteDay(index) {
      const day = days[index];
      if (!day) return;
      currentDayIndex = index;
      const label = formatDateForTitle(day.date, tf("day_n", { n: index + 1 }));
      const count = Array.isArray(day.items) ? day.items.length : 0;
      $("confirmDeleteDayTitle").innerText = tf("confirm_del_day_q_named", { date: label });
      $("confirmDeleteDayMsg").innerText = count > 0
        ? tf("confirm_del_day_msg_n", { n: count })
        : t("confirm_del_day_msg_empty");
      _pendingDeleteDay = () => { const currentIndex = days.findIndex(x => x && x.id === day.id); if (currentIndex >= 0) deleteDay(currentIndex); };
      openConfirmSheet("confirmDeleteDaySheet");
    }

    function deleteDay(index) {
      if (!days[index]) return;
      const ok = commitState(() => {
        days.splice(index, 1);
        if (currentDayIndex >= days.length) currentDayIndex = Math.max(0, days.length - 1);
      }, {});
      if (!ok) return;
      renderDays();
      renderActivities(currentDayIndex);
      if (currentView === "today") renderTodayView();
      showUndoToast(t("toast_day_deleted"));
    }

    function findActivityPositionByStableId(dayId, itemUid) {
      if (typeof itemUid !== "string" || !itemUid) return null;
      const preferred = typeof dayId === "string" && dayId ? days.findIndex((day) => day && day.id === dayId) : -1;
      const order = preferred >= 0 ? [preferred, ...days.map((_,i)=>i).filter((i)=>i!==preferred)] : days.map((_,i)=>i);
      for (const dayIndex of order) {
        const day = days[dayIndex];
        if (!day || !Array.isArray(day.items)) continue;
        const itemIndex = day.items.findIndex((item) => item && item.uid === itemUid);
        if (itemIndex >= 0) return { dayIndex, itemIndex, day, item:day.items[itemIndex] };
      }
      return null;
    }

    function deleteActivityByStableId(dayId, itemUid) {
      const pos = findActivityPositionByStableId(dayId, itemUid);
      if (!pos) { showToast(t("toast_activity_not_found")); return; }
      deleteActivity(pos.dayIndex, pos.itemIndex);
    }

    function deleteActivity(dayIndex, itemIndex) {
      const day = days[dayIndex];
      if (!day || !Array.isArray(day.items) || !day.items[itemIndex]) {
        showToast(t("toast_activity_not_found"));
        return;
      }
      const ok = commitState(() => { day.items.splice(itemIndex, 1); }, {});
      if (!ok) return;
      renderDays();
      renderActivities(currentDayIndex);
      if (currentView === "today") renderTodayView();
      showUndoToast(t("toast_activity_deleted"));
    }

    function addNewDay() {
      if (days.length > 0) {
        /* DATEONLY-001: this was the damaging one. Parsing the last date as
           UTC midnight and then reading it back with LOCAL getters produced
           the SAME date again in every negative-offset zone, so a New York
           user pressing "add day" got a duplicate instead of the next day.
           UTC arithmetic also handles month, year and leap boundaries. */
        const nextDate = addDaysToDateOnly(days[days.length - 1].date, 1);
        if (!nextDate) { showToast(t("toast_missing_date")); return; }
        /* STORE-001 (v1040 / A7): adding a day is a real mutation, so it goes
           through the same guarded commit as every other one. On a failed
           write the day is rolled back instead of sitting in the strip until
           the next reload silently drops it. */
        if (!commitState(() => {
          days.push({ id:newTripId("day"), date: nextDate, items: [] });
          currentDayIndex = days.length - 1;
        })) return;
        renderDays();
        renderActivities(currentDayIndex);
        showToast(tf("toast_day_added", { n: days.length }));
      } else {
        openFirstDaySheet();
      }
    }

    function duplicateCurrentDayPlan() {
      const source=days[currentDayIndex];if(!source||!source.date)return;
      let targetDate=addDaysToDateOnly(source.date,1),guard=0;
      while(targetDate&&days.some(d=>d&&d.date===targetDate)&&guard<370){targetDate=addDaysToDateOnly(targetDate,1);guard++;}
      if(!targetDate){showToast(t("toast_day_duplicate_failed"));return;}
      const copy=JSON.parse(JSON.stringify(source));
      const sourceDate=source.date;
      copy.id=newTripId("day");
      copy.date=targetDate;
      (copy.items||[]).forEach(item=>{
        if(!item||typeof item!=="object")return;
        item.uid=newActivityUid();
        item.completed=false;
        if(item.booking&&typeof item.booking==="object"){
          const booking=Object.assign({},item.booking);
          delete booking.reference;delete booking.paymentStatus;
          if(booking.status==="booked"||booking.status==="confirmed"||booking.status==="cancelled")booking.status="planned";
          if(Object.keys(booking).length)item.booking=booking;else delete item.booking;
        }
      });
      if(copy.travelDay&&typeof copy.travelDay==="object"){
        const td=Object.assign({},copy.travelDay);delete td.reference;
        if(td.arrivalDate){const a=parseDateOnly(td.arrivalDate),b=parseDateOnly(sourceDate);if(a&&b){const diff=Math.round((a.getTime()-b.getTime())/86400000);td.arrivalDate=addDaysToDateOnly(targetDate,diff)||targetDate;}else delete td.arrivalDate;}
        copy.travelDay=td;
      }
      const ok=commitState(()=>{days.push(copy);days.sort((a,b)=>String(a.date||"").localeCompare(String(b.date||"")));currentDayIndex=days.indexOf(copy);});
      if(!ok)return;closeDayDetailsSheet();renderDays();renderActivities(currentDayIndex);if(currentView==="today")renderTodayView();showToast(tf("toast_day_duplicated",{date:formatDateOnly(targetDate,{day:"numeric",month:"short"})||targetDate}));
    }

    /* ── Find now item ── */
    function findNowItemIndex(day) {
      if (!day || !day.date) return -1;
      const clock = getActiveTrip() ? activeTripClock() : Today.clock();
      if (day.date !== clock.date) return -1;
      const nowMin = clock.minutes;
      let best = -1, bestDiff = Infinity;
      day.items.forEach((item, i) => {
        const itemMin = DayIntel.parseTime(item && item.time);
        if (itemMin === null) return;
        const diff = nowMin - itemMin;
        if (diff >= 0 && diff < bestDiff) { bestDiff = diff; best = i; }
      });
      if (best === -1) {
        let nextDiff = Infinity;
        day.items.forEach((item, i) => {
          const itemMin = DayIntel.parseTime(item && item.time);
          if (itemMin === null) return;
          const diff = itemMin - nowMin;
          if (diff >= 0 && diff < nextDiff) { nextDiff = diff; best = i; }
        });
      }
      return best;
    }

    /* ── Minutes until next ── */
    function minutesUntilNext(day, nowItemIndex) {
      if (nowItemIndex === -1 || !day.items[nowItemIndex + 1]) return null;
      const next = day.items[nowItemIndex + 1];
      const nextMin = DayIntel.parseTime(next && next.time);
      if (nextMin === null) return null;
      const nowMin = (getActiveTrip() ? activeTripClock() : Today.clock()).minutes;
      const diff = nextMin - nowMin;
      return diff > 0 ? diff : null;
    }

    /* ── Reminders v2 (REMINDERS-002): subtle status label for timeline rows
       and the Hero Card (today only).
       This distinguishes the REMINDER countdown from the ACTIVITY countdown:
         - minutesUntilActivity = activity time - now
         - minutesUntilReminder = minutesUntilActivity - reminderMin
       Pure function: reads day/item only, never mutates data, never saves. ── */
    function getReminderSubLabel(day, item) {
      const clock = getActiveTrip() ? activeTripClock() : Today.clock();
      if (!day || day.date !== clock.date) return "";
      if (item.completed || !item.time) return "";
      const itemMin = DayIntel.parseTime(item.time);
      if (itemMin === null) return "";
      const nowMin = clock.minutes;
      const minutesUntilActivity = itemMin - nowMin;

      // After the activity's own time -> unchanged from v1.
      if (minutesUntilActivity <= 0) return t("reminder_passed");

      // No reminder set -> no reminder countdown (activity countdown line,
      // rendered elsewhere, is left untouched).
      const reminderMin = itemReminderMin(item);
      if (reminderMin === null) return "";

      const minutesUntilReminder = minutesUntilActivity - reminderMin;

      if (minutesUntilReminder > 0) {
        return tf("reminder_in", { m: minutesUntilReminder });
      }
      // We're inside the reminder window but before the activity itself.
      return t("reminder_now");
    }

    /* ── Render Hero Card ── */
    function renderHeroCard(day, dayIndex) {
      const inner = $("heroCardInner");
      const timelineCard = $("timelineCard");
      const nowIdx = findNowItemIndex(day);

      if (!day || !day.items || day.items.length === 0) {
        inner.innerHTML = `
          <div class="hero-empty">
            <span class="hero-empty-icon">✈️</span>
            <div class="hero-empty-title">${escapeHtml(t("hero_empty_title"))}</div>
            <div class="hero-empty-sub">${escapeHtml(t("hero_empty_sub"))}</div>
            <button class="hero-empty-btn" id="heroAddBtn" type="button">
              ＋ ${escapeHtml(t("hero_empty_btn"))}
            </button>
          </div>`;
        inner.classList.remove("completed");
        timelineCard.style.display = "none";
        document.getElementById("heroAddBtn").addEventListener("click", openSheet);
        return;
      }

      const heroOriginalIndex = nowIdx !== -1 ? nowIdx : 0;
      const heroItem = day.items[heroOriginalIndex];

      // REMINDERS-001 follow-up: findNowItemIndex() returns either the closest
      // PAST item, or (only when no past item exists) a fallback to the next
      // FUTURE item. nowIdx !== -1 alone can't distinguish these two cases,
      // so a lone future activity was incorrectly labeled "עכשיו". We check
      // the hero item's own time against the clock instead.
      let isNow = false;
      const heroClock = getActiveTrip() ? activeTripClock() : Today.clock();
      if (day.date === heroClock.date && heroItem && heroItem.time) {
        const heroMin = DayIntel.parseTime(heroItem.time);
        if (heroMin !== null) isNow = heroClock.minutes >= heroMin;
      }
      const isNext = !isNow;

      // REMINDERS-001 follow-up: reuse the same sub-label logic already used
      // in the Timeline so the Hero Card can also show the reminder
      // countdown / "🔔 הגיע זמן תזכורת" / "עבר".
      const heroReminderSub = getReminderSubLabel(day, heroItem);

      const untilMin = minutesUntilNext(day, nowIdx);
      const nextItem = (nowIdx !== -1 && day.items[nowIdx + 1]) ? day.items[nowIdx + 1] : null;

      let untilHtml = "";
      if (untilMin !== null && nextItem) {
        const h = Math.floor(untilMin / 60);
        const m = untilMin % 60;
        const untilStr = h > 0
          ? (m > 0 ? tf("dur_hours_minutes", { h: h, m: m }) : tf("dur_hours", { h: h }))
          : tf("dur_minutes", { m: m });
        untilHtml = `
          <div class="hero-divider"></div>
          <div class="hero-until">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            ${escapeHtml(tf("hero_until", { t: untilStr }))}
          </div>`;
      }

      const catIcon = getCategoryIcon(heroItem);
      // MAPS-001 (v1040 / B1, G): location first, title as the fallback, the
      // free-form note never.
      const navUrl = mapsUrl(heroItem);
      const heroLocation = itemLocation(heroItem);
      const heroNote = itemNote(heroItem);
      const heroEnd = itemEndTime(heroItem);

      inner.innerHTML = `
        <div class="hero-card-top" id="heroTapArea" style="cursor:pointer">
          <div class="hero-card-left">
            <div class="hero-badge ${isNow ? "now" : "next"}">
              <span class="hero-badge-dot"></span>
              ${escapeHtml(isNow ? t("hero_badge_now") : t("hero_badge_next"))}
            </div>
            <div class="hero-time">${escapeHtml(heroItem.time || "--:--")}</div>
            ${heroEnd ? `<div class="hero-endtime">→ ${escapeHtml(heroEnd)}</div>` : ""}
            ${heroReminderSub ? `<div class="hero-reminder-sub">${heroReminderSub}</div>` : ""}
            <div class="hero-title">${escapeHtml(heroItem.title)}</div>
            ${heroLocation ? `<div class="hero-location">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              ${escapeHtml(heroLocation)}
            </div>` : ""}
            ${heroNote ? `<div class="hero-note-line">${escapeHtml(heroNote)}</div>` : ""}
            ${accessBadgeHtml(heroItem)}
            ${itemAccessNote(heroItem) ? `<div class="access-note-line">♿ ${escapeHtml(itemAccessNote(heroItem))}</div>` : ""}
          </div>
          <div class="hero-card-thumb">
            <div class="hero-thumb-placeholder">
              <span class="thumb-icon">${catIcon}</span>
            </div>
          </div>
        </div>
        ${untilHtml}
        <div class="hero-actions">
          <button class="hero-btn hero-btn-done" id="heroDoneBtn" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px">
              ${heroItem.completed ? '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.1"/>' : '<polyline points="20 6 9 17 4 12"/>'}
            </svg>
            ${escapeHtml(heroItem.completed ? t("hero_done_undo") : t("hero_done_mark"))}
          </button>
          <button class="hero-btn hero-btn-done" id="heroEditBtn" type="button" title="${escapeHtml(t("hero_edit_title"))}">${escapeHtml(t("hero_edit"))}</button>
          <button class="hero-btn hero-btn-nav" id="heroNavBtn" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px">
              <polygon points="3 11 22 2 13 21 11 13 3 11"/>
            </svg>
            ${escapeHtml(t("hero_nav"))}
          </button>
        </div>
      `;

      // Completed visual state (same visual language as Timeline)
      inner.classList.toggle("completed", !!heroItem.completed);

      // hero card event listeners
      document.getElementById("heroNavBtn").addEventListener("click", () => {
        window.open(navUrl, "_blank", "noopener");
      });
      document.getElementById("heroDoneBtn").addEventListener("click", () => {
        if (!commitState(() => { heroItem.completed = !heroItem.completed; })) return;
        renderActivities(currentDayIndex);
      });
      document.getElementById("heroEditBtn").addEventListener("click", (e) => {
        e.stopPropagation();
        openEditSheet(dayIndex, heroOriginalIndex);
      });
      // Tapping the hero content opens Edit Activity; long press offers delete shortcut.
      // Buttons stop/ignore propagation so navigate/done/edit remain safe.
      document.getElementById("heroTapArea").addEventListener("click", () => {
        openEditSheet(dayIndex, heroOriginalIndex);
      });
      attachLongPressDelete(document.getElementById("heroTapArea"), () => {
        confirmDeleteActivity(() => deleteActivityByStableId(day.id, heroItem.uid));
      });

      // Show timeline for the rest of activities
      if (day.items.length > 1) {
        timelineCard.style.display = "block";
      } else {
        timelineCard.style.display = "none";
      }
    }

    /* ── Render Activities (timeline) ── */
    function renderActivities(index) {
      const list = $("activityList");
      list.innerHTML = "";
      renderPlannerOpsHub();

      const day = days[index];

      // Update day title/meta
      $("dayTitle").innerText = day ? formatDateForTitle(day.date, tf("day_n", { n: index + 1 })) : t("timeline_planned_day");
      if (day && day.items) {
        const metaBits = [tf("timeline_activities_count", { n: day.items.length })];
        if (isTravelDay(day)) metaBits.unshift(dayTypeIcon(dayType(day)) + " " + dayTypeLabel(dayType(day)));
        $("dayMeta").innerText = metaBits.join(" · ");
      } else $("dayMeta").innerText = "";
      renderDayHealth(day);
      renderDayLogistics(day);

      // Render hero card
      renderHeroCard(day, index);

      if (!day || !day.items || day.items.length === 0) {
        return;
      }

      const nowItemIndex = findNowItemIndex(day);
      const dayAnalysis = DayIntel.analyzeDay(day.items);

      // Timeline: show items excluding the hero one
      const heroIdx = nowItemIndex !== -1 ? nowItemIndex : 0;
      const timelineItems = day.items.map((item, i) => ({ item, originalIndex: i })).filter((_, i) => i !== heroIdx);

      if (timelineItems.length === 0) {
        return;
      }

      const isLastItem = (arrIdx) => arrIdx === timelineItems.length - 1;

      timelineItems.forEach(({ item, originalIndex }, arrIdx) => {
        const isNow = originalIndex === nowItemIndex;
        const catIcon = getCategoryIcon(item);
        const reminderSub = getReminderSubLabel(day, item);
        const travelPair = dayAnalysis.pairs.find(p => p.secondIndex === originalIndex) || null;
        const segment = travelSegmentInfo(travelPair);
        if (segment) {
          const seg = document.createElement("button");
          seg.type = "button";
          seg.className = "travel-segment" + (segment.tone ? " travel-" + segment.tone : "");
          seg.setAttribute("aria-label", t("travel_segment_edit") + " — " + segment.text);
          seg.innerHTML =
            `<span class="travel-segment-arrow" aria-hidden="true">↓</span>` +
            `<span class="travel-segment-icon" aria-hidden="true">${escapeHtml(travelSegmentIcon(segment.mode))}</span>` +
            `<span class="travel-segment-text">${escapeHtml(segment.text)}</span>`;
          // Editing stays in the advanced activity options, which is the one
          // place the travel fields live; the segment is a shortcut into it.
          seg.addEventListener("click", () => openEditSheet(index, originalIndex, { expandMore: true }));
          list.appendChild(seg);
        }

        const div = document.createElement("div");
        div.className = `item ${item.completed ? "completed" : ""} ${isNow ? "now-item" : ""}`;
        div.dataset.index = originalIndex;
        const a11yBooking=itemBookingInfo(item),a11yPayment=itemPaymentStatus(item);
        const activityA11yLabel=[
          t("sheet_edit_title") + ": " + (item.title || ""),
          item.time || "",
          itemEndTime(item) || "",
          itemLocation(item) || "",
          a11yBooking.status ? bookingStatusLabel(a11yBooking.status) : "",
          a11yPayment ? paymentStatusLabel(a11yPayment) : ""
        ].filter(Boolean).join(" · ");

        div.innerHTML = `
          <div class="item-time-col">
            <div class="item-time">${escapeHtml(item.time || "--:--")}</div>
            ${itemEndTime(item) ? `<div class="item-time-end">${escapeHtml(itemEndTime(item))}${itemEndsNextDay(item) ? ` <span aria-label="${escapeHtml(t("field_end_next_day"))}">+1</span>` : ""}</div>` : ""}
            ${reminderSub ? `<div class="item-time-sub">${reminderSub}</div>` : ""}
          </div>
          <div class="item-line-col">
            <div class="item-line-top" style="${arrIdx === 0 ? "flex:0 0 14px" : ""}"></div>
            <div class="item-dot"></div>
            <div class="item-line-bottom" style="${isLastItem(arrIdx) ? "flex:0 0 0" : ""}"></div>
          </div>
          <div class="item-body" role="button" tabindex="0" aria-label="${escapeHtml(activityA11yLabel)}">
            ${isNow ? `<div class="now-badge-inline">${escapeHtml(t("item_now_badge"))}</div>` : ""}
            <div class="item-category-icon">${catIcon}</div>
            <div class="item-title">${escapeHtml(item.title)}</div>
            ${itemLocation(item) ? `<div class="item-note">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              ${escapeHtml(itemLocation(item))}
            </div>` : ""}
            ${itemNote(item) ? `<div class="item-note-plain">${escapeHtml(itemNote(item))}</div>` : ""}
            ${accessBadgeHtml(item)}
            ${itemAccessNote(item) ? `<div class="access-note-line">♿ ${escapeHtml(itemAccessNote(item))}</div>` : ""}
            ${(itemBookingInfo(item).status || itemPaymentStatus(item)) ? `<div class="booking-note-line">🎟️ ${itemBookingInfo(item).status ? escapeHtml(bookingStatusLabel(itemBookingInfo(item).status)) : ""}${itemBookingInfo(item).status && itemPaymentStatus(item) ? " · " : ""}${itemPaymentStatus(item) ? escapeHtml(paymentStatusLabel(itemPaymentStatus(item))) : ""}${itemBookingInfo(item).reference ? " · " + escapeHtml(itemBookingInfo(item).reference) : ""}</div>` : ""}
          </div>
          <div class="item-actions">
            <button type="button" class="done" aria-label="${escapeHtml(t("item_done_title"))}" title="${escapeHtml(t("item_done_title"))}">${item.completed ? "↩" : "✓"}</button>
            <button type="button" class="delete" aria-label="${escapeHtml(t("item_delete_title"))}" title="${escapeHtml(t("item_delete_title"))}">🗑</button>
          </div>
        `;

        div.querySelector(".done").addEventListener("click", (e) => {
          e.stopPropagation();
          if (!commitState(() => { item.completed = !item.completed; })) return;
          renderActivities(index);
        });

        div.querySelector(".delete").addEventListener("click", (e) => {
          e.stopPropagation();
          confirmDeleteActivity(() => deleteActivity(index, originalIndex));
        });

        attachLongPressDelete(div, () => {
          confirmDeleteActivity(() => deleteActivity(index, originalIndex));
        });

        const itemBody = div.querySelector(".item-body");
        itemBody.addEventListener("click", () => {
          openEditSheet(index, originalIndex);
        });
        itemBody.addEventListener("keydown", (e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          openEditSheet(index, originalIndex);
        });

        list.appendChild(div);
      });
    }

    /* ── Add / Edit item ──
       v1040: both now return { day, item } on success and null on failure,
       so the calendar handlers export the STORED activity (with its
       location, end time and Access fields) instead of re-reading the form,
       and so a failed persist can stop the flow instead of exporting
       something that was rolled back. ── */
    /* ══ MORE-001 (v1050-RC2): optional detail behind one control ══
       The advanced inputs are hidden with the `hidden` attribute only. They
       are never removed from the DOM and never cleared on collapse, so
       applyActivityFieldsFromForm() reads the identical elements it read in
       RC1 and no stored field can be dropped by the section being closed.
       ADVANCED_FIELD_IDS is also what drives the badge, which is the reason
       a user can tell an activity carries hidden detail without opening it. */
    const ADVANCED_FIELD_IDS = ["addEndTime",
      "addTravelMode", "addTravelDuration", "addTravelNote", "addBookingStatus", "addBookingPaymentStatus",
      "addBookingReference", "addBookingProvider", "addBookingNote"];

    function advancedFieldCount() {
      let n = ADVANCED_FIELD_IDS.reduce((count, id) => {
        const el = $(id);
        return count + (el && String(el.value || "").trim() ? 1 : 0);
      }, 0);
      // A reminder only counts as "set" when it differs from "no reminder".
      const rem = $("addReminder");
      if (rem && rem.value !== "" && parseInt(rem.value, 10) >= 0) n++;
      if ($("addEndNextDay") && $("addEndNextDay").checked) n++;
      return n;
    }

    function updateMoreBadge() {
      const badge = $("addMoreBadge");
      if (!badge) return;
      const n = advancedFieldCount();
      if (n > 0) {
        badge.textContent = String(n);
        /* A11Y: a bare numeral appended to the toggle's name reads as
           "More options 6", which says nothing. The label makes the count
           mean something to a screen reader user, who is exactly the person
           who cannot see that the section is carrying data. */
        badge.setAttribute("aria-label", tf("more_filled_count", { n }));
        badge.hidden = false;
      }
      else { badge.textContent = ""; badge.removeAttribute("aria-label"); badge.hidden = true; }
    }

    function setMoreExpanded(expanded) {
      const toggle = $("addMoreToggle"), body = $("addMoreBody"), block = $("addMoreBlock");
      if (!toggle || !body) return;
      toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
      body.hidden = !expanded;
      if (block) block.classList.toggle("open", !!expanded);
      updateMoreBadge();
    }

    function activityFormTimesValid() {
      const startRaw = $("addTime").value;
      const endRaw = $("addEndTime").value;
      const nextDay = !!($("addEndNextDay") && $("addEndNextDay").checked);
      if (!endRaw) { if (nextDay) { showToast(t("toast_end_next_day_needs_time")); return false; } return true; }
      const start = DayIntel.parseTime(startRaw);
      const end = DayIntel.parseTime(endRaw);
      if (start === null || end === null) { showToast(t("toast_invalid_time_range")); return false; }
      if (!nextDay && end <= start) { showToast(t("toast_invalid_time_range")); return false; }
      return true;
    }

    function applyActivityFieldsFromForm(item) {
      const loc = $("addLocation").value.trim();
      const end = $("addEndTime").value;
      const cat = $("addCategory").value;
      const travelMode = $("addTravelMode").value;
      const travelDurRaw = $("addTravelDuration").value;
      const travelNote = $("addTravelNote").value.trim();
      const travelDur = travelDurRaw === "" ? null : Number(travelDurRaw);
      // Only keys the user actually filled are written. Unknown nested travel
      // fields survive edits because the existing object is extended, not rebuilt.
      if (loc) item.location = loc; else delete item.location;
      if (/^[0-9]{2}:[0-9]{2}$/.test(end || "")) item.endTime = end; else delete item.endTime;
      if (item.endTime && $("addEndNextDay") && $("addEndNextDay").checked) item.endNextDay = true; else delete item.endNextDay;
      if (CATEGORY_ORDER.indexOf(cat) !== -1) item.category = cat; else delete item.category;
      // v2500: accessStatus/accessNote are intentionally untouched here. They
      // may exist on older/restored activities and must survive normal edits,
      // but travellers no longer maintain venue accessibility manually.
      const travel = (item.travelFromPrevious && typeof item.travelFromPrevious === "object")
        ? Object.assign({}, item.travelFromPrevious) : {};
      if (DayIntel.MODES.indexOf(travelMode) !== -1) travel.mode = travelMode; else delete travel.mode;
      if (Number.isFinite(travelDur) && travelDur >= 0 && travelDur <= 1440) travel.durationMin = Math.round(travelDur); else delete travel.durationMin;
      if (travelNote) travel.note = travelNote; else delete travel.note;
      if (Object.keys(travel).length) item.travelFromPrevious = travel; else delete item.travelFromPrevious;

      const booking = (item.booking && typeof item.booking === "object") ? Object.assign({}, item.booking) : {};
      const bookingStatus = $("addBookingStatus").value;
      const bookingPaymentStatus = $("addBookingPaymentStatus").value;
      const bookingReference = $("addBookingReference").value.trim();
      const bookingProvider = $("addBookingProvider").value.trim();
      const bookingNote = $("addBookingNote").value.trim();
      if (Logistics.BOOKING_STATUSES.indexOf(bookingStatus) !== -1) booking.status = bookingStatus; else delete booking.status;
      if (Finance.PAYMENT_STATUSES.indexOf(bookingPaymentStatus) !== -1) booking.paymentStatus = bookingPaymentStatus; else delete booking.paymentStatus;
      if (bookingReference) booking.reference = bookingReference; else delete booking.reference;
      if (bookingProvider) booking.provider = bookingProvider; else delete booking.provider;
      if (bookingNote) booking.note = bookingNote; else delete booking.note;
      if (Object.keys(booking).length) item.booking = booking; else delete item.booking;
    }

    function addItem() {
      const title = $("addTitle").value.trim();
      if (!title) { showToast(t("toast_missing_title")); return null; }
      if (!activityFormTimesValid()) return null;

      const item = {
        uid: newActivityUid(),
        time: $("addTime").value || "12:00",
        title,
        note: $("addNote").value.trim(),
        completed: false,
        reminderMin: parseInt($("addReminder").value, 10)
      };
      applyActivityFieldsFromForm(item);

      const date = $("addDate").value || todayISO();
      let target = null;
      const ok = commitState(() => {
        let day = days.find(d => d.date === date);
        if (!day) {
          day = { id:newTripId("day"), date, items: [] };
          days.push(day);
          days.sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
        }
        day.items.push(item);
        day.items.sort((a, b) => a.time.localeCompare(b.time));
        currentDayIndex = days.indexOf(day);
        target = day;
      });
      if (!ok) return null;
      renderDays();
      renderActivities(currentDayIndex);
      if (currentView === "today") renderTodayView();
      showToast(t("toast_activity_added"));
      closeSheet();
      return { day: target, item: item };
    }

    function editItem() {
      const title = $("addTitle").value.trim();
      if (!title) { showToast(t("toast_missing_title")); return null; }
      if (!activityFormTimesValid()) return null;

      const pos = findActivityPositionByStableId(editingDayId, editingItemUid);
      if (!pos) { showToast(t("toast_activity_not_found")); closeSheet(); return null; }
      const { dayIndex, itemIndex, day:oldDay, item } = pos;
      const newDate = $("addDate").value || oldDay.date;
      let target = null;

      const ok = commitState(() => {
        if (!(typeof item.uid === "string" && item.uid)) item.uid = newActivityUid();
        item.title = title;
        item.note  = $("addNote").value.trim();
        item.time  = $("addTime").value || "12:00";
        item.reminderMin = parseInt($("addReminder").value, 10);
        applyActivityFieldsFromForm(item);

        if (newDate !== oldDay.date) {
          oldDay.items.splice(itemIndex, 1);
          let newDay = days.find(d => d.date === newDate);
          if (!newDay) {
            newDay = { id:newTripId("day"), date: newDate, items: [] };
            days.push(newDay);
            days.sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
          }
          newDay.items.push(item);
          newDay.items.sort((a, b) => a.time.localeCompare(b.time));
          currentDayIndex = days.indexOf(newDay);
          target = newDay;
        } else {
          oldDay.items.sort((a, b) => a.time.localeCompare(b.time));
          currentDayIndex = dayIndex;
          target = oldDay;
        }
      });
      if (!ok) return null;
      renderDays();
      renderActivities(currentDayIndex);
      if (currentView === "today") renderTodayView();
      showToast(t("toast_activity_updated"));
      closeSheet();
      return { day: target, item: item };
    }

    function duplicateEditingActivity() {
      const pos=findActivityPositionByStableId(editingDayId,editingItemUid);if(!pos)return;
      const {dayIndex,day,item:source}=pos;
      const copy=JSON.parse(JSON.stringify(source));copy.uid=newActivityUid();copy.completed=false;
      if(copy.booking&&typeof copy.booking==="object"){
        const booking=Object.assign({},copy.booking);delete booking.reference;delete booking.paymentStatus;
        if(booking.status==="booked"||booking.status==="confirmed"||booking.status==="cancelled")booking.status="planned";
        if(Object.keys(booking).length)copy.booking=booking;else delete copy.booking;
      }
      const ok=commitState(()=>{day.items.push(copy);day.items.sort((a,b)=>String(a.time||"").localeCompare(String(b.time||"")));});if(!ok)return;
      const newIndex=day.items.indexOf(copy);renderDays();renderActivities(dayIndex);showToast(t("toast_activity_duplicated"));openEditSheet(dayIndex,newIndex,{expandMore:false});
    }

    function openSheet() {
      isSavingActivity = false;
      $("addSaveBtn").disabled = false;
      $("addWithReminderBtn").disabled = false;
      editingDayId = null;
      editingItemUid = null;
      $("sheetTitle").innerText = t("sheet_add_title");
      $("addSaveBtn").innerText = t("btn_save");
      $("addWithReminderBtn").innerText = t("btn_save_cal_add");
      $("addTitle").value = "";
      $("addNote").value = "";
      const clock = getActiveTrip() ? activeTripClock() : Today.clock();
      const selectedDay = days[currentDayIndex];
      $("addDate").value = selectedDay?.date || clock.date || todayISO();
      $("addTime").value = clock.time;
      // FIX1-REMINDER-001: advanced options must be genuinely opt-in for a
      // new activity. A hidden default reminder made a supposedly simple
      // activity carry advanced data before the user chose anything.
      $("addReminder").value = "-1";
      // v1040 additive fields, cleared for a new activity.
      $("addEndTime").value = "";
      $("addEndNextDay").checked = false;
      $("addLocation").value = "";
      $("addCategory").value = "";
      $("addTravelMode").value = "";
      $("addTravelDuration").value = "";
      $("addTravelNote").value = "";
      $("addBookingStatus").value = "";
      $("addBookingPaymentStatus").value = "";
      $("addBookingReference").value = "";
      $("addBookingProvider").value = "";
      $("addBookingNote").value = "";
      $("addDeleteBtn").style.display = "none";
      $("addDuplicateBtn").style.display = "none";
      // ADDUX-001: a new activity starts as the simple form.
      setMoreExpanded(false);
      // CAL-AFTER-SAVE-001: calendar hand-off is offered from Edit, once the
      // activity actually exists, not as a decision during creation.
      $("addCalendarActions").style.display = "none";
      openSheetEl("sheet");
    }

    function openEditSheet(dayIndex, itemIndex, options) {
      const openOpts = options || {};
      isSavingActivity = false;
      $("addSaveBtn").disabled = false;
      $("addWithReminderBtn").disabled = false;
      const day  = days[dayIndex];
      const item = day && Array.isArray(day.items) ? day.items[itemIndex] : null;
      if (!day || !item) { showToast(t("toast_activity_not_found")); return; }
      editingDayId = typeof day.id === "string" ? day.id : null;
      editingItemUid = typeof item.uid === "string" ? item.uid : null;
      $("sheetTitle").innerText = t("sheet_edit_title");
      $("addSaveBtn").innerText = t("btn_update");
      $("addWithReminderBtn").innerText = t("btn_save_cal_edit");
      $("addDate").value = day.date;
      $("addTime").value = item.time || "12:00";
      $("addTitle").value = item.title || "";
      $("addNote").value = item.note || "";
      $("addReminder").value = String(itemReminderMin(item) ?? (settings.defaultReminderMin || 30));
      // v1040 additive fields. An activity saved before v1040 has none of
      // them, and every accessor returns "" for a missing field.
      $("addEndTime").value = itemEndTime(item);
      $("addEndNextDay").checked = itemEndsNextDay(item);
      $("addLocation").value = itemLocation(item);
      $("addCategory").value = itemCategory(item);
      const travel = itemTravelFromPrevious(item);
      $("addTravelMode").value = travel.mode || "";
      $("addTravelDuration").value = travel.durationMin == null ? "" : String(travel.durationMin);
      $("addTravelNote").value = travel.note || "";
      const booking = itemBookingInfo(item);
      $("addBookingStatus").value = booking.status || "";
      $("addBookingPaymentStatus").value = itemPaymentStatus(item) || "";
      $("addBookingReference").value = booking.reference || "";
      $("addBookingProvider").value = booking.provider || "";
      $("addBookingNote").value = booking.note || "";
      $("addDeleteBtn").style.display = "flex";
      $("addDuplicateBtn").style.display = "flex";
      // Collapsed by default here too, but the badge reports exactly how many
      // optional fields this activity already carries, so nothing the user
      // stored is silently invisible.
      setMoreExpanded(!!openOpts.expandMore);
      $("addCalendarActions").style.display = "";
      openSheetEl("sheet");
      if (openOpts.expandMore) {
        // Advanced-entry shortcuts can choose the exact field they are fixing
        // (travel segment, booking, etc.). Travel remains the
        // default for older call sites.
        window.setTimeout(() => {
          const el = $(openOpts.focusField || "addTravelMode");
          const sheet = $("sheet");
          if (el && sheet && sheet.classList.contains("open")) {
            try { el.focus(); } catch (err) {}
          }
        }, 90);
      }
    }

    function closeSheet() { closeSheetEl("sheet"); }

    function handleSave() {
      if (isSavingActivity) return;
      isSavingActivity = true;
      $("addSaveBtn").disabled = true;
      $("addWithReminderBtn").disabled = true;

      if (editingItemUid !== null) {
        editItem();
      } else {
        addItem();
      }

      isSavingActivity = false;
      $("addSaveBtn").disabled = false;
      $("addWithReminderBtn").disabled = false;
    }

    /* ── Calendar DESCRIPTION (D4) ──
       The note, plus the traveller's own Access status and note when either
       exists. The wording is theirs; nothing here asserts that TripMaster
       verified anything. */
    function calendarDescription(item) {
      const parts = [];
      const note = itemNote(item);
      if (note) parts.push(note);
      const status = itemAccessStatus(item);
      const anote  = itemAccessNote(item);
      if ((status && status !== "needscheck") || anote) {
        const label = (status === "verified" || status === "stepfree") ? t("access_badge_verified")
                    : status === "problem" ? t("access_badge_problem") : "";
        parts.push(t("export_access_line") + ": " + [label, anote].filter(Boolean).join(" - "));
      }
      const travel = itemTravelFromPrevious(item);
      if (travel.known) {
        const summary = [travel.mode ? travelModeLabel(travel.mode) : "", travel.durationMin != null ? formatMinutesCompact(travel.durationMin) : "", travel.note].filter(Boolean).join(" · ");
        if (summary) parts.push(t("travel_export_line") + ": " + summary);
      }
      return parts.join("\n");
    }

    /* ── Calendar ICS ──
       v1040 (B5/B6/E2): the event is built from activityTimeSpec(), the same
       function the Google path uses, so both describe one instant. Adds UID,
       DTSTAMP, LOCATION, and an alarm description that goes through i18n
       instead of the hardcoded Hebrew "תזכורת:" this file used to emit into
       every calendar in every language. The delivery block below (share
       sheet, download fallback) is unchanged from v1011 RC2. */
    function exportActivityToIcs(day, item) {
      const spec = activityTimeSpec(day.date, item.time, itemEndTime(item), activeTripTimezone(), itemEndsNextDay(item));
      if (!spec) { showToast(t("toast_calendar_time_invalid")); return; }
      const title = item.title || "";
      const icsEscape = s => String(s||"").replace(/\\/g,"\\\\").replace(/;/g,"\\;").replace(/,/g,"\\,").replace(/\n/g,"\\n");
      const reminderMin = itemReminderMin(item);
      const alarmBlock = reminderMin != null ? [
        "BEGIN:VALARM","ACTION:DISPLAY",
        `DESCRIPTION:${icsEscape(tf("ics_alarm_desc", { title: title }))}`,
        `TRIGGER:-PT${reminderMin}M`,"END:VALARM"
      ] : [];
      const lines = [
        "BEGIN:VCALENDAR","VERSION:2.0",`PRODID:-//TripMaster//${APP_VERSION}//EN`,"CALSCALE:GREGORIAN",
        "BEGIN:VEVENT",
        `UID:${icsEscape(ensureActivityUid(item))}`,
        `DTSTAMP:${utcStamp(Date.now())}`,
        `SUMMARY:${icsEscape(title)}`,
        `DTSTART:${spec.dtStart}`,
        `DTEND:${spec.dtEnd}`
      ];
      const location = itemLocation(item);
      if (location) lines.push(`LOCATION:${icsEscape(location)}`);
      const description = calendarDescription(item);
      if (description) lines.push(`DESCRIPTION:${icsEscape(description)}`);
      alarmBlock.forEach((l) => lines.push(l));
      lines.push("END:VEVENT", "END:VCALENDAR");
      const icsContent = lines.join("\r\n");
      const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });

      /* ── CAL-SHARE-001 (v1011 RC2) ──
         Everything above this line is unchanged: same ICS string, same VALARM,
         same reminderMin handling. Only the DELIVERY of the finished blob changes.

         Preferred path: hand the .ics to the Android share / "open with" sheet so
         the user can pick a calendar app and confirm, instead of hunting for a
         downloaded file. Strictly user-initiated — this only ever runs from the
         button's click handler and can never add an event silently.

         navigator.share() requires transient user activation, so it must be
         called synchronously in the same task as the click. Nothing is awaited
         before it. Any failure other than a deliberate user cancel falls through
         to the original download path, which is preserved verbatim below. ── */
      function downloadIcsFallback() {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement("a");
        a.href = url; a.download = `${title}.ics`;
        document.body.appendChild(a);a.click();a.remove();
        setTimeout(()=>URL.revokeObjectURL(url),0);
        showToast(t("toast_ics_downloaded"));
      }

      let icsFile = null;
      try {
        if (typeof File === "function") {
          icsFile = new File([blob], `${title}.ics`, { type: "text/calendar" });
        }
      } catch (err) {
        icsFile = null;
      }

      const canShareIcs = !!icsFile
        && typeof navigator !== "undefined"
        && typeof navigator.share === "function"
        && typeof navigator.canShare === "function"
        && navigator.canShare({ files: [icsFile] });

      if (!canShareIcs) {
        downloadIcsFallback();
        return;
      }

      navigator.share({ files: [icsFile], title: title })
        .then(() => {
          showToast(t("toast_ics_shared"));
        })
        .catch((err) => {
          // User dismissed the share sheet: the activity is already saved,
          // so do nothing except acknowledge. Any real failure -> download.
          if (err && err.name === "AbortError") {
            showToast(t("toast_ics_cancelled"));
            return;
          }
          downloadIcsFallback();
        });
    }

    /* ══ v1020 MODULE: Trip Tools / Preferences / Access ══════════════════ */

    function partnerIsLive(p) {
      return !!(PARTNERS_LIVE && p.enabled && typeof p.url === "string" && p.url.indexOf("https://") === 0);
    }

    function renderTools() {
      const grid = $("toolsGrid");
      if (!grid) return;
      grid.innerHTML = "";
      let anyLive = false;

      PARTNER_CONFIG.partners
        .slice()
        .sort((a, b) => a.priority - b.priority)
        .forEach((p) => {
          const live     = partnerIsLive(p);
          const internal = p.enabled && p.internal === "backup";
          const usable   = live || internal;
          if (live) anyLive = true;

          const card = document.createElement(usable ? "button" : "div");
          card.className = "tool-card " + (usable ? "enabled" : "soon");
          if (usable) card.type = "button";

          const icon = document.createElement("div");
          icon.className = "tool-icon"; icon.textContent = p.icon;
          const label = document.createElement("div");
          // I18N-001 (v1030): PARTNER_CONFIG stays frozen and unedited. The
          // localized string is looked up by id, and the Hebrew value in the
          // config is the fallback if a key is ever missing.
          label.className = "tool-label"; label.textContent = t("tool_" + p.id + "_label", p.label);
          const sub = document.createElement("div");
          sub.className = "tool-sub"; sub.textContent = t("tool_" + p.id + "_desc", p.description);
          card.appendChild(icon); card.appendChild(label); card.appendChild(sub);

          if (!usable) {
            const chip = document.createElement("span");
            chip.className = "tool-soon-chip"; chip.textContent = t("tools_soon");
            card.appendChild(chip);
          }

          if (internal) {
            card.addEventListener("click", () => {
              // MENU-003 (v1020 RC3): backup does not close the menu.
              exportBackup();
            });
          } else if (live) {
            card.addEventListener("click", () => {
              window.open(p.url, "_blank", "noopener");
            });
          }
          grid.appendChild(card);
        });

      // Disclosure appears only once a real partner link exists.
      const disc = $("toolsDisclosure");
      if (disc) {
        disc.textContent = anyLive ? t("tools_disclosure", PARTNER_CONFIG.disclosure) : "";
        disc.style.display = anyLive ? "" : "none";
      }

      /* ── TOOLS-001 (v1040 / E6) ──
         With PARTNERS_LIVE false every commercial card is a dead "coming
         soon" tile, and the single working card duplicates Backup, which
         already has its own row under Data & Backup. Making the user scroll
         a large dead commercial section to reach the real settings is a cost
         with no benefit, so the section is HIDDEN — not deleted.
         PARTNER_CONFIG, PARTNERS_LIVE, renderTools() and the markup are all
         intact and untouched, so activating a partner later restores this
         section with no rebuild. */
      const section = $("toolsSection");
      if (section) section.style.display = anyLive ? "" : "none";
    }

    /* ── MENU-001 (v1020 fix) ──
       Uses the same open/closed convention as every other sheet, so the
       backdrop, animation and z-index behaviour are the proven ones. */
    function openMenuSheet() {
      const el = $("menuSheet");
      if (el && !el.classList.contains("open")) el.scrollTop = 0;
      openSheetEl("menuSheet");
    }
    function closeMenuSheet() { closeSheetEl("menuSheet"); }

    /* I18N-GLOBAL-001 / RC4-UX-002: the header globe is a one-tap language
       entry point available from Home, Planner and Today. It opens a dedicated
       language-only sheet; the hamburger remains the exclusive entry point to
       the full product menu. */
    function openLanguageSelector() {
      renderLanguageOptions();
      openSheetEl("languageSheet");
    }
    function closeLanguageSelector() { closeSheetEl("languageSheet"); }

    /* ── Collapsible sections ── */
    function wireSection(headId, secEl) {
      const head = $(headId);
      if (!head || !secEl) return;
      head.addEventListener("click", () => {
        const open = secEl.classList.toggle("open");
        head.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }

    /* ── PREFS-001 / ACCESS-001 wiring ── */
    function paintOptRow(rowId, currentValue) {
      const row = $(rowId);
      if (!row) return;
      Array.prototype.forEach.call(row.querySelectorAll(".opt"), (b) => {
        const on = b.dataset.val === currentValue;
        b.classList.toggle("on", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
    }

    function paintMultiRow(rowId, list) {
      const row = $(rowId);
      if (!row) return;
      Array.prototype.forEach.call(row.querySelectorAll(".opt"), (b) => {
        const on = list.indexOf(b.dataset.val) !== -1;
        b.classList.toggle("on", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
    }

    function paintToggleRow(rowId, obj) {
      const row = $(rowId);
      if (!row) return;
      Array.prototype.forEach.call(row.querySelectorAll(".opt"), (b) => {
        const on = !!obj[b.dataset.key];
        b.classList.toggle("on", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
    }

    function renderPrefsAndAccess() {
      paintOptRow("prefPace", settings.prefs.pace);
      paintMultiRow("prefTransport", settings.prefs.transport);
      paintToggleRow("prefNoSelfDrive", { noSelfDrive: settings.prefs.noSelfDrive });
      paintOptRow("prefBudget", settings.prefs.budget);
      if ($("prefMaxWalk")) $("prefMaxWalk").value = settings.prefs.maxWalkKm != null ? settings.prefs.maxWalkKm : "";
      if ($("prefNotes"))   $("prefNotes").value   = settings.prefs.notes || "";
      paintToggleRow("accessToggles", settings.access);
      paintOptRow("accessWheelchair", settings.access.wheelchair);
      if ($("accessNotes")) $("accessNotes").value = settings.access.notes || "";
      renderAccessProfile();
    }

    function wirePrefsAndAccess() {
      wireSection("prefsHead",  $("prefsHead")  && $("prefsHead").parentElement);
      wireSection("accessHead", $("accessHead") && $("accessHead").parentElement);
      wireSection("toolsHead",  $("toolsHead")  && $("toolsHead").parentElement);
      // MENU-002 (v1020 RC3): dataHead shipped with the menu rebuild but was
      // never passed to wireSection(), so the row rendered and did nothing.
      wireSection("dataHead",   $("dataHead")   && $("dataHead").parentElement);
      const quickLangRow = $("languageQuickOptions");
      if (quickLangRow) quickLangRow.addEventListener("click", (e) => {
        const btn = e.target.closest(".lang-option");
        if (!btn || !btn.dataset.lang) return;
        setLanguage(btn.dataset.lang);
        closeLanguageSelector();
      });

      // Single-select rows: tapping the active option clears it (all optional).
      [["prefPace", "pace"], ["prefBudget", "budget"]].forEach(([rowId, key]) => {
        const row = $(rowId);
        if (!row) return;
        row.addEventListener("click", (e) => {
          const btn = e.target.closest(".opt");
          if (!btn) return;
          if (!commitSettings(() => { settings.prefs[key] = (settings.prefs[key] === btn.dataset.val) ? null : btn.dataset.val; })) return;
          paintOptRow(rowId, settings.prefs[key]);
        });
      });

      const tRow = $("prefTransport");
      if (tRow) tRow.addEventListener("click", (e) => {
        const btn = e.target.closest(".opt");
        if (!btn) return;
        if (!commitSettings(() => {
          const list = settings.prefs.transport;
          const i = list.indexOf(btn.dataset.val);
          if (i === -1) list.push(btn.dataset.val); else list.splice(i, 1);
        })) return;
        paintMultiRow("prefTransport", settings.prefs.transport);
      });

      const noDrive = $("prefNoSelfDrive");
      if (noDrive) noDrive.addEventListener("click", (e) => {
        const btn = e.target.closest(".opt");
        if (!btn) return;
        if (!commitSettings(() => { settings.prefs.noSelfDrive = !settings.prefs.noSelfDrive; })) return;
        paintToggleRow("prefNoSelfDrive", { noSelfDrive: settings.prefs.noSelfDrive });
        renderCurrentView();
      });

      const mw = $("prefMaxWalk");
      if (mw) mw.addEventListener("input", () => {
        const v = parseFloat(mw.value);
        if (!commitSettings(() => { settings.prefs.maxWalkKm = isNaN(v) ? null : v; })) return;
        renderAccessProfile();
        renderCurrentView();
      });

      const pn = $("prefNotes");
      if (pn) pn.addEventListener("input", () => {
        commitSettings(() => { settings.prefs.notes = pn.value; });
      });

      const aTog = $("accessToggles");
      if (aTog) aTog.addEventListener("click", (e) => {
        const btn = e.target.closest(".opt");
        if (!btn) return;
        if (!commitSettings(() => { settings.access[btn.dataset.key] = !settings.access[btn.dataset.key]; })) return;
        paintToggleRow("accessToggles", settings.access);
        renderAccessProfile();
        renderCurrentView();
      });

      const wc = $("accessWheelchair");
      if (wc) wc.addEventListener("click", (e) => {
        const btn = e.target.closest(".opt");
        if (!btn) return;
        if (!commitSettings(() => { settings.access.wheelchair = btn.dataset.val; })) return;
        paintOptRow("accessWheelchair", settings.access.wheelchair);
        renderAccessProfile();
        renderCurrentView();
      });

      const an = $("accessNotes");
      if (an) an.addEventListener("input", () => {
        commitSettings(() => { settings.access.notes = an.value; });
      });
    }

    /* ── GCAL-001 (v1020): Google Calendar template hand-off ──
       Secondary to the ICS path. Deliberately does NOT touch
       exportActivityToIcs() or the VALARM output. Google's TEMPLATE format
       has no reminder parameter, so reminderMin cannot be carried here — that
       is disclosed in the UI next to the button. Needs a network connection
       and only helps Google Calendar users, which is why it is not primary. */
    function exportActivityToGoogle(day, item) {
      /* CAL-TIME-001 (v1040 / B7): the stamps come from activityTimeSpec(),
         exactly as the ICS path does, so the two exports can no longer
         disagree. The old code converted the DEVICE-local time to UTC while
         ICS emitted a floating local stamp, which meant a user planning a
         London trip from Israel got two different instants out of the two
         buttons. Google's TEMPLATE format still has no reminder parameter —
         that limitation is disclosed next to the button, unchanged. */
      const spec = activityTimeSpec(day.date, item.time, itemEndTime(item), activeTripTimezone(), itemEndsNextDay(item));
      if (!spec) { showToast(t("toast_calendar_time_invalid")); return; }
      ensureActivityUid(item);
      const description = calendarDescription(item);
      const location = itemLocation(item);
      let url = "https://calendar.google.com/calendar/render?action=TEMPLATE"
        + "&text=" + encodeURIComponent(item.title || "")
        + "&dates=" + spec.dtStart + "/" + spec.dtEnd;
      if (description) url += "&details=" + encodeURIComponent(description);
      if (location)    url += "&location=" + encodeURIComponent(location);
      try {
        const a = document.createElement("a");
        a.href = url; a.target = "_blank"; a.rel = "noopener";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      } catch (err) {
        window.location.href = url;
      }
    }

    /* ── Backup / Restore ── */
    function exportBackup() {
      const canonical=readCanonicalTripState();
      if(!canonical){reportStorageFailure();return;}
      /* backupVersion stays 2 (A8). Every v1040 field rides inside the
         existing trips/days/items objects, so a v1040 backup restores into
         v1030 with the new keys simply ignored, and a v1030 backup restores
         here unchanged. AI-SECRET-002: settingsForStorage() drops any
         historical client API-key property, so backup files cannot carry it. */
      const storedSettings = safeParseJSON(KEY_SETTINGS, null);
      const canonicalSettings = (storedSettings && typeof storedSettings === "object") ? normalizeSettings(storedSettings) : settings;
      const backup = {
        app: "TripMaster", backupVersion: 2, exportedAt: new Date().toISOString(),
        trips: canonical.trips, activeTripId: canonical.activeTripId,
        homeDays: normalizeDays(safeParseJSON(KEY_DAYS, [])),
        settings: settingsForStorage(canonicalSettings), theme: localStorage.getItem(KEY_THEME) || "light"
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `tripmaster-backup-${todayISO()}.json`;
      document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),0);
      showToast(t("toast_backup_downloaded"));
    }


    /* v1800 — single-trip portability. Imports always create a new trip. */
    function activeTripPackage() {
      const trip=getActiveTrip();
      return trip ? Operations.portableTripEnvelope(trip,{appVersion:APP_VERSION,exportedAt:new Date().toISOString()}) : null;
    }
    function safeTripFilename(trip) {
      const raw=String((trip&&trip.name)||"trip");
      const base=typeof raw.normalize==="function"?raw.normalize("NFKD"):raw;
      const cleaned=base.replace(/[^\p{L}\p{N}._-]+/gu,"-").replace(/^-+|-+$/g,"").slice(0,60)||"trip";
      return `tripmaster-${cleaned}-${todayISO()}.json`;
    }
    function tripPackageBlob(pkg){return new Blob([JSON.stringify(pkg,null,2)],{type:"application/json;charset=utf-8"});}
    function downloadTripPackageFile(trip,pkg){
      const blob=tripPackageBlob(pkg),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=safeTripFilename(trip);document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),0);
    }
    function downloadTripPackage(){
      const trip=getActiveTrip(),pkg=activeTripPackage();if(!trip||!pkg){showToast(t("trip_transfer_no_active"));return;}downloadTripPackageFile(trip,pkg);showToast(t("toast_trip_exported"));
    }
    async function shareTripPackage(){
      const trip=getActiveTrip(),pkg=activeTripPackage();if(!trip||!pkg){showToast(t("trip_transfer_no_active"));return;}
      const blob=tripPackageBlob(pkg),name=safeTripFilename(trip);
      try{
        if(typeof File==="function"&&navigator.share){const file=new File([blob],name,{type:"application/json"}),data={files:[file],title:trip.name||"TripMaster"};if(!navigator.canShare||navigator.canShare(data)){await navigator.share(data);showToast(t("toast_trip_shared"));return;}}
      }catch(err){if(err&&err.name==="AbortError")return;console.warn("TripMaster: trip file share unavailable",err);}
      downloadTripPackageFile(trip,pkg);showToast(t("toast_trip_share_fallback"));
    }
    function recordTransferResult(operation,result){
      _storageHealth.lastTransfer={at:new Date().toISOString(),operation,result};
      recordLifecycleEvent("transfer",_storageHealth.lastTransfer);
    }
    function importPortableTripPayload(payload){
      if(!guardExternalStateBeforeWrite())return{ok:false,reason:"external"};
      const source=Operations.tripFromPortableEnvelope(payload);if(!source)return{ok:false,reason:"invalid"};
      const copy=cloneTripGraphForDevice(source,typeof source.name==="string"&&source.name.trim()?source.name.trim():t("menu_new_trip"));if(!copy)return{ok:false,reason:"invalid"};
      const previous=snapshotState();trips.push(copy);activeTripId=copy.id;days=copy.days||[];currentDayIndex=0;currentView="planner";
      if(!saveTrips()){const externalConflict=failedWriteWasExternal();if(!externalConflict)restoreStateFrom(previous);reportStorageFailure();return{ok:false,reason:externalConflict?"external":"storage"};}
      resetAIForTripContextChange();renderCurrentView();updateHeaderInfo();return{ok:true,trip:copy};
    }
    function renderTripTransferMeta(){
      const el=$("tripTransferMeta"),exportBtn=$("tripExportBtn"),shareBtn=$("tripShareBtn");if(!el)return;const trip=getActiveTrip();
      el.textContent=trip?tf("trip_transfer_ready",{name:trip.name||t("menu_new_trip")}):t("trip_transfer_no_active");if(exportBtn)exportBtn.disabled=!trip;if(shareBtn)shareBtn.disabled=!trip;
    }

    function doRestore(backup) {
      if(!guardExternalStateBeforeWrite())return;
      if(!guardPreferenceStateBeforeDestructiveWrite())return;
      const backupReport=Operations.backupPayloadReport(backup);
      if(!backupReport.valid){recordTransferResult("restore","invalid");console.warn("TripMaster: restore payload rejected",backupReport.errors);showToast(t("toast_bad_backup"));return;}
      /* ── I18N-RESTORE-001 (v1030 RC3) ──
         UI language is an APP-level preference, not trip data, so a restore
         must not change it — matching the Reset rule from RC2. Captured here,
         BEFORE any settings are replaced, and validated with the same
         active-language rule normalizeSettings()/setLanguage() use, so a
         stale or inactive value still lands on Hebrew. */
      const preservedLang =
        (LANG_META[currentLang] && LANG_META[currentLang].active) ? currentLang : DEFAULT_LANG;
      /* ── SNAPSHOT-001 (v1040 / A6) ──
         Restore replaces everything on the device. A recoverable local copy
         is written FIRST and the whole operation is abandoned if that write
         fails, so the destructive step can never run without a way back. */
      if (!writeSafetySnapshot("restore")) { recordTransferResult("restore","storage");showToast(t("toast_snapshot_failed")); return; }
      const undoState    = snapshotState();
      const undoSettings = JSON.stringify(settings);
      const undoTheme    = localStorage.getItem(KEY_THEME) || "light";

      let nextTrips, nextActiveId, nextHomeDays, nextDays, nextSettings;
      if (backup.trips && Array.isArray(backup.trips)) {
        nextTrips = normalizeTrips(JSON.parse(JSON.stringify(backup.trips)));
        const requestedActiveId = typeof backup.activeTripId === "string" ? backup.activeTripId.trim() : null;
        repairStableTripGraphIds(nextTrips);
        const restoredActive = nextTrips.filter((x) => x.id === requestedActiveId)[0] || null;
        nextActiveId = restoredActive ? restoredActive.id : null;
        nextHomeDays = normalizeDays(JSON.parse(JSON.stringify(Array.isArray(backup.homeDays) ? backup.homeDays : (Array.isArray(backup.days) ? backup.days : []))));
        nextDays = restoredActive
          ? JSON.parse(JSON.stringify(restoredActive.days || []))
          : JSON.parse(JSON.stringify(nextHomeDays));
        // SETTINGS-NORM-001 (v1020): merge, never replace. An older backup has
        // no prefs/access branch; normalizeSettings() supplies it instead of
        // letting the restore delete it or leave settings undefined.
        nextSettings = normalizeSettings(backup.settings);
      } else {
        nextDays = normalizeDays(JSON.parse(JSON.stringify(Array.isArray(backup.days) ? backup.days : [])));
        // FIELDS-001 (v1020 RC3): name a legacy single-trip backup from the
        // city stored in that backup. Previously this read the live settings,
        // which no longer carries a city, so the original name would be lost.
        const legacyCity = (backup.settings && backup.settings.city) ? backup.settings.city : "";
        nextTrips = [{ id: "trip_" + Date.now(), name: legacyCity || t("legacy_trip_name"), days: nextDays }];
        nextActiveId = nextTrips[0].id;
        // The legacy single-trip payload is already represented by nextTrips.
        // Do not mirror it back into the deprecated Home itinerary store.
        nextHomeDays = [];
        nextSettings = normalizeSettings(backup.settings);
      }
      // Legacy backups from pre-v3100 may contain duplicate/missing IDs.
      // Repair the detached restore graph BEFORE its first storage write so a
      // backup exported by an older TripMaster is never persisted in an
      // ambiguous state and can round-trip through current builds.
      repairStableTripGraphIds(nextTrips);

      nextSettings.language = preservedLang;
      // AI-SECRET-002: normalizeSettings() already discarded any historical
      // client-side provider credential from this backup.
      const nextTheme = backup.theme === "dark" ? "dark" : "light";

      /* STORE-001 (v1040 / A7): one guarded batch. A half-written restore —
         new trips with old settings, or trips written and days not — was
         previously possible on a quota failure part-way through. */
      const restored = writeAll([
        [KEY_TRIPS, JSON.stringify(nextTrips)],
        [KEY_ACTIVE_TRIP, nextActiveId || ""],
        [KEY_DAYS, JSON.stringify(nextHomeDays)],
        [KEY_SETTINGS, JSON.stringify(settingsForStorage(nextSettings))],
        [KEY_THEME, nextTheme]
      ], {recovery:true});
      if (!restored) { recordTransferResult("restore","storage");reportStorageFailure(); return; }
      recordTransferResult("restore","passed");

      trips = nextTrips;
      activeTripId = nextActiveId;
      resetAIForTripContextChange();
      days = getActiveTrip() ? getActiveTrip().days : [];
      currentView = activeTripId ? "planner" : "home";
      settings = nextSettings;
      const migrationAfterRestore = migrateLegacyHomeDays();
      ensureStableTripGraphIds();
      if (migrationAfterRestore.error) {
        // Restored data is still intact under KEY_DAYS; do not claim it was migrated.
        console.warn("TripMaster: legacy Home migration deferred after restore");
      }
      setUndo(undoState, { settings: undoSettings, theme: undoTheme });
      /* I18N-RESTORE-001 (v1030 RC3): both branches above have already run
         normalizeSettings(backup.settings) and persisted it. Whatever
         language that produced — "he" from an old backup with no field, or
         an explicit "he"/"en" from a v1030 backup — is now discarded in
         favour of the language the user is actually looking at. The backup
         SCHEMA is unchanged: language is still read, still exported, just no
         longer allowed to drive the UI. Re-persisted so a refresh agrees. */
      updatePreferenceStorageTokens();
      if (nextTheme === "dark") document.documentElement.setAttribute("data-theme", "dark");
      else document.documentElement.removeAttribute("data-theme");
      renderPrefsAndAccess();   // v1020: repaint from the merged settings
      // I18N-RESTORE-001 (v1030 RC3): settings.language now holds the
      // PRESERVED language, so this keeps currentLang in sync and is a no-op
      // repaint rather than a language switch.
      currentLang = settings.language;
      applyLanguage();
      renderTools();
      currentDayIndex = 0;
      renderCurrentView();
      updateHeaderInfo();
      showUndoToast(t("toast_restored"));
    }

    /* ── AI ── */
    function openAISheet() {
      // RC4-FIX1-AI-001: innerText is empty for a visibility:hidden sheet in
      // Chromium. textContent preserves an already-rendered answer while the
      // sheet is closed, so reopening no longer destroys the response.
      if (!$("aiOutput").textContent.trim()) $("aiOutput").textContent = t("ai_output_empty");
      openSheetEl("aiSheet");
    }
    function closeAISheet() { closeSheetEl("aiSheet"); }

    function aiTypeLabel(type) {
      const labels = { issue:t("ai_type_issue"), check:t("ai_type_check"), suggestion:t("ai_type_suggestion"), info:t("ai_type_info") };
      return labels[type] || t("ai_type_info");
    }

    function aiConfidenceLabel(confidence) {
      return confidence === "known" ? t("ai_confidence_known") : t("ai_confidence_inferred");
    }

    function humanizeAgentText(value) {
      let text = String(value == null ? "" : value);
      // RC4-AI-PRESENTATION-002: backend diagnostics are useful in evals, not
      // in a traveller-facing answer. Preserve meaning while replacing schema,
      // tool and counter language with ordinary product language.
      text = text.replace(/\bUNKNOWN\b/g, t("ai_not_verified"));
      text = text.replace(/\bget_[a-z0-9_]+\b/gi, t("ai_trip_data_label"));
      text = text.replace(/\bstayCount\s*=\s*\d+\b/gi, t("ai_stay_record_state"));
      text = text.replace(/\b(?:returned\s+)?count\s*=\s*0\b/gi, t("ai_no_matching_records"));
      text = text.replace(/\bresolved entity\b/gi, t("ai_matched_trip_item"));
      text = text.replace(/\btrip(?:\.[a-z0-9_]+)+\b/gi, t("ai_trip_data_label"));
      text = text.replace(/\bmany_activities\b/gi, t("ai_busy_day_label"));
      text = text.replace(/\bmissing_end_time\b/gi, t("ai_missing_end_time_label"));
      text = text.replace(/\btoday context not supplied\b/gi, t("ai_today_context_missing"));
      text = text.replace(/\bstays\s*\/\s*journeys\s*\/\s*activities\b/gi, t("ai_schema_entities"));
      text = text.replace(/\bsnapshot\b/gi, t("ai_trip_snapshot_label"));
      text = text.replace(/`/g, "");
      text = text.replace(/\s{2,}/g, " ").trim();
      return text;
    }

    function aiLocaleDescriptor() {
      const meta = LANG_META[currentLang] || LANG_META[DEFAULT_LANG] || { lang:"en", dir:"ltr" };
      return { language:currentLang || DEFAULT_LANG, locale:meta.lang || currentLang || "en", direction:meta.dir === "rtl" ? "rtl" : "ltr" };
    }

    function aiQuestionPolicy(prompt, intentHint) {
      const client = window.TripMasterAIClient;
      if (client && typeof client.questionPolicy === "function") return client.questionPolicy(prompt, intentHint);
      return { intent:"GENERAL_TRIP", includeToday:false, includeBookingSummary:false, includeMoney:false, includeMobility:false, includeAccess:false, includeActivityAccess:false, researchLikely:false, liveDataLikely:false, scopes:["core"] };
    }

    function buildAgentTripContext(trip, policy, settingsSource) {
      const p = policy || aiQuestionPolicy("", "GENERAL_TRIP");
      // The legacy server still receives tripmaster-context-v1 until the
      // October backend merge. Privacy-sensitive optional scopes are selected
      // here so a hotel/research question does not receive Access/Mobility data.
      const context = Finance.buildTripContext(trip, { includeSensitive:false, includeActivityAccess:p.includeActivityAccess === true });
      // Budget/totals are personal trip data and are unnecessary for most AI
      // questions. Keep them out of the existing legacy transport unless the
      // question is explicitly money-related; V2 applies the same policy.
      if (p.includeMoney !== true) delete context.money;
      if (p.includeBookingSummary !== true) {
        delete context.bookingAttentionCount;
        delete context.documentAttentionCount;
      }
      const sourceSettings = settingsSource && typeof settingsSource === "object" ? settingsSource : settings;
      const access = (sourceSettings && sourceSettings.access) || {};
      const prefs = (sourceSettings && sourceSettings.prefs) || {};
      if (p.includeAccess === true) {
        const hasCustomRequirements = typeof access.notes === "string" && !!access.notes.trim();
        context.access = {
          active: !!(access.stepFree || access.avoidStairs || access.elevatorNeeded || access.shortWalks || access.companion || access.quietPreference || (access.wheelchair && access.wheelchair !== "none") || hasCustomRequirements),
          hasCustomRequirements,
          stepFree: !!access.stepFree,
          avoidStairs: !!access.avoidStairs,
          elevatorNeeded: !!access.elevatorNeeded,
          shortWalks: !!access.shortWalks,
          companion: !!access.companion,
          quietPreference: !!access.quietPreference,
          wheelchair: ["none","manual","electric"].indexOf(access.wheelchair) !== -1 ? access.wheelchair : "none"
        };
      }
      if (p.includeMobility === true) {
        context.mobility = {
          noSelfDrive: !!prefs.noSelfDrive,
          transport: (Array.isArray(prefs.transport) ? prefs.transport : []).filter((x) => ["walk","public","taxi","train"].indexOf(x) !== -1).slice(0,4),
          maxWalkKm: (typeof prefs.maxWalkKm === "number" && Number.isFinite(prefs.maxWalkKm) && prefs.maxWalkKm >= 0) ? prefs.maxWalkKm : null
        };
      }
      if (p.includeToday === true) {
        try {
          const accessActive = !!(context.access && context.access.active);
          const model = Today.buildToday(trip, { preview:false, accessActive });
          context.today = Today.sanitizedContext(model, { includeAccess:p.includeAccess === true });
        } catch (_) {
          context.today = null;
        }
      }
      return context;
    }

    function buildAIClientSnapshot(trip, prompt, intentHint, requestId, idempotencyKey, settingsSource) {
      const policy = aiQuestionPolicy(prompt, intentHint);
      const legacyContext = buildAgentTripContext(trip, policy, settingsSource);
      const client = window.TripMasterAIClient;
      if (!client || typeof client.buildContextV2 !== "function" || typeof client.buildUserQuestionEnvelope !== "function") {
        return { policy, legacyContext, v2Context:null, envelope:null, fingerprint:"" };
      }
      const v2Context = client.buildContextV2(legacyContext, {
        today:legacyContext.today || null,
        mobility:legacyContext.mobility || null,
        access:legacyContext.access || null
      }, policy);
      const envelope = client.buildUserQuestionEnvelope({
        prompt,
        intentHint,
        policy,
        context:v2Context,
        requestId:requestId || "",
        idempotencyKey:idempotencyKey || requestId || "",
        appVersion:APP_VERSION,
        locale:aiLocaleDescriptor(),
        v2TransportExpected:AI_V2_TRANSPORT_ENABLED === true
      });
      return { policy, legacyContext, v2Context, envelope, fingerprint:(envelope.trip && envelope.trip.contextFingerprint) || "" };
    }

    function currentAIContextFingerprint(req) {
      if (!req) return "";
      let trip = getActiveTrip();
      let settingsSource = settings;
      // Cross-window changes may be intentionally deferred while the AI sheet
      // is open. Compare against persisted canonical state so a stale answer
      // cannot render merely because this window has not repainted yet.
      try {
        const canonical = readCanonicalTripState();
        if (canonical && Array.isArray(canonical.trips)) trip = canonical.trips.find((row) => row && row.id === req.tripId) || null;
        const rawSettings = safeParseJSON(KEY_SETTINGS, null);
        if (rawSettings && typeof rawSettings === "object") settingsSource = normalizeSettings(rawSettings);
      } catch (_) {}
      if (!trip || trip.id !== req.tripId) return "";
      return buildAIClientSnapshot(trip, req.prompt, req.intentHint, "", req.baseRequestId, settingsSource).fingerprint;
    }

    function aiRequestContextStillCurrent(req) {
      if (!req || !req.sentContextFingerprint) return true;
      return currentAIContextFingerprint(req) === req.sentContextFingerprint;
    }

    function renderAgentResult(payload) {
      const out = $("aiOutput");
      const result = payload && payload.result && typeof payload.result === "object" ? payload.result : null;
      if (!result || typeof result.summary !== "string") throw new Error("invalid_agent_response");
      const lines = [];
      lines.push(humanizeAgentText(result.summary));
      const items = Array.isArray(result.items) ? result.items : [];
      if (items.length) {
        lines.push("", t("ai_findings_heading"));
        items.forEach((item) => {
          if (!item || typeof item !== "object") return;
          const title = humanizeAgentText(item.title);
          const reason = humanizeAgentText(item.reason);
          const action = item.proposedAction == null ? "" : humanizeAgentText(item.proposedAction);
          if (!title && !reason) return;
          lines.push(`• ${aiTypeLabel(item.type)} · ${aiConfidenceLabel(item.confidence)}${title ? ` - ${title}` : ""}`);
          if (reason) lines.push(`  ${reason}`);
          if (action) lines.push(`  ${t("ai_proposed_action")}: ${action}`);
        });
      }
      const unknowns = Array.isArray(result.unknowns) ? result.unknowns : [];
      if (unknowns.length) {
        lines.push("", t("ai_unknowns_heading"));
        unknowns.forEach((row) => {
          if (!row || typeof row !== "object") return;
          const question = humanizeAgentText(row.question);
          const reason = humanizeAgentText(row.reason);
          if (question) lines.push(`• ${question}`);
          if (reason) lines.push(`  ${reason}`);
        });
      }
      const aiClient = window.TripMasterAIClient;
      if (aiClient && typeof aiClient.responseEvidenceView === "function") {
        const evidence = aiClient.responseEvidenceView(payload);
        if (evidence && evidence.sources && evidence.sources.length) {
          lines.push("", t("ai_sources_heading"));
          evidence.sources.slice(0, 6).forEach((source) => {
            let label = source.provider || source.sourceClass || "";
            if (!label && source.locator) { try { label = new URL(source.locator).hostname; } catch (_) {} }
            label = humanizeAgentText(label);
            if (label) lines.push(`• ${label}`);
          });
        }
      }
      if (result.advisoryOnly === true) lines.push("", t("ai_advisory_footer"));
      out.classList.remove("loading");
      out.style.fontStyle = "normal";
      out.innerText = lines.join("\n").trim();
      if (payload.requestId) console.info("TripMaster Planner Agent requestId:", payload.requestId);
    }

    function aiErrorText(status, data, err) {
      if (err && err.name === "AbortError") return t("ai_error_timeout");
      if (!navigator.onLine) return t("ai_error_offline");
      const code = data && data.error && data.error.code ? data.error.code : "";
      if (status === 429 || code === "rate_limited") return t("ai_error_rate_limit");
      if (status === 422 || code === "invalid_context" || code === "invalid_request") return t("ai_error_context");
      if (status === 503 || code === "agent_unavailable" || code === "openai_rate_limited") return t("ai_error_unavailable");
      if (status === 502 || status === 504 || code === "agent_timeout" || code === "agent_error") return t("ai_error_temporary");
      if (err && err.message === "invalid_ai_v2_evidence") return t("ai_error_evidence");
      if (err && err.message === "invalid_agent_response") return t("ai_error_response");
      return t("ai_error_network");
    }

    function setAIRequestUi(busy, stateText) {
      const send = $("aiSendBtn");
      if (send) send.disabled = !!busy;
      const clear = $("aiClearBtn");
      if (clear) clear.disabled = !!busy;
      document.querySelectorAll(".ai-quick-prompt").forEach((btn) => { btn.disabled = !!busy; });
      const state = $("aiRequestState");
      if (state) {
        state.textContent = stateText || "";
        state.classList.toggle("is-working", !!stateText);
      }
    }

    function aiRequestIsCurrent(req) { return !!req && _activeAIRequest === req && !req.settled; }
    function aiRequestMatchesActiveTrip(req) {
      const active = getActiveTrip();
      return !!(req && active && active.id === req.tripId);
    }
    function resetAIForTripContextChange() {
      const req = _activeAIRequest;
      if (aiRequestIsCurrent(req)) {
        req.abortReason = "context_change";
        req.settled = true;
        if (req.timeoutId) { window.clearTimeout(req.timeoutId); req.timeoutId = null; }
        try { if (req.controller) req.controller.abort(); } catch (_) {}
        _activeAIRequest = null;
      }
      setAIRequestUi(false, "");
      const input = $("aiPromptInput");
      if (input) { input.value = ""; delete input.dataset.aiIntentHint; }
      const out = $("aiOutput");
      if (out) {
        out.classList.remove("loading");
        out.style.fontStyle = "normal";
        out.textContent = t("ai_output_empty");
      }
    }

    function beginAIClientTrace(req, snapshot) {
      const now=Date.now(),policy=snapshot&&snapshot.policy||{};
      _lastAIClientTrace={
        requestId:req.baseRequestId,intent:policy.intent||"GENERAL_TRIP",scopes:Array.isArray(policy.scopes)?policy.scopes.slice():["core"],
        researchLikely:policy.researchLikely===true,liveDataLikely:policy.liveDataLikely===true,
        entityHintCount:snapshot&&snapshot.envelope&&Array.isArray(snapshot.envelope.entityHints)?snapshot.envelope.entityHints.length:0,
        attempt:req.attempt,status:"running",durationMs:null,evidenceGate:"not_applicable",startedAtMs:now
      };
    }
    function finishAIClientTrace(status, evidenceGate) {
      if(!_lastAIClientTrace)return;
      _lastAIClientTrace.status=String(status||"unknown").slice(0,80);
      _lastAIClientTrace.durationMs=Math.max(0,Date.now()-(_lastAIClientTrace.startedAtMs||Date.now()));
      if(evidenceGate)_lastAIClientTrace.evidenceGate=String(evidenceGate).slice(0,80);
    }

    async function executeAIRequest(req, isRetry) {
      if (!aiRequestIsCurrent(req)) return;
      const trip = getActiveTrip();
      if (!trip || trip.id !== req.tripId) {
        req.settled = true; _activeAIRequest = null; setAIRequestUi(false, "");
        $("aiOutput").innerText = t("ai_no_trip");
        return;
      }
      const out = $("aiOutput");
      req.attempt += 1;
      req.backgrounded = document.hidden;
      req.resumeRetryScheduled = false;
      req.controller = new AbortController();
      req.inFlight = true;
      const attemptNumber = req.attempt;
      const requestId = req.baseRequestId + "-a" + req.attempt;
      const aiSnapshot = buildAIClientSnapshot(trip, req.prompt, req.intentHint, requestId, req.baseRequestId);
      const tripContext = aiSnapshot.legacyContext;
      req.sentContextFingerprint = aiSnapshot.fingerprint;
      req.v2Envelope = aiSnapshot.envelope;
      beginAIClientTrace(req, aiSnapshot);
      setAIRequestUi(true, isRetry ? t("ai_state_retrying") : t("ai_state_working"));

      // The visible-page budget is intentionally longer than RC3. When the
      // app goes to background, the timer is cleared; Android may suspend JS
      // and networking, so wall-clock time while hidden must not count as a
      // failed Agent request.
      const armTimeout = () => {
        if (!aiRequestIsCurrent(req) || document.hidden) return;
        if (req.timeoutId) window.clearTimeout(req.timeoutId);
        req.timeoutId = window.setTimeout(() => {
          req.abortReason = "timeout";
          try { req.controller.abort(); } catch (_) {}
        }, 60000);
      };
      req.armTimeout = armTimeout;
      armTimeout();
      let status = 0, data = null;
      try {
        const res = await fetch(AGENT_QUERY_URL, {
          method: "POST", mode: "cors", cache: "no-store", credentials: "omit",
          headers: {
            "Content-Type":"application/json",
            "X-Request-ID":requestId,
            // Standard CORS-safelisted locale signal; no backend schema change.
            "Accept-Language": ((LANG_META[currentLang] || LANG_META.en || {}).lang || currentLang || "en")
          },
          body: JSON.stringify({ tripContext, request:req.prompt, mode:"auto" }),
          signal: req.controller.signal
        });
        status = res.status;
        try { data = await res.json(); } catch (_) { data = null; }
        if (!res.ok) throw new Error("agent_http_" + res.status);
        if (!aiRequestIsCurrent(req)) return;
        // RC4-FIX1-AI-002: never render a response for a trip that is no
        // longer active. This also protects against a trip switch from
        // another tab that is picked up on wake.
        if (!aiRequestMatchesActiveTrip(req)) {
          resetAIForTripContextChange();
          return;
        }
        if (!aiRequestContextStillCurrent(req)) {
          req.settled = true; _activeAIRequest = null; setAIRequestUi(false, "");
          finishAIClientTrace("discarded_stale_context", "not_applicable");
          out.classList.remove("loading"); out.style.fontStyle = "normal"; out.innerText = t("ai_context_changed");
          return;
        }
        const aiClient = window.TripMasterAIClient;
        if (aiClient && req.v2Envelope && typeof aiClient.validateV2Response === "function") {
          const validation = aiClient.validateV2Response(data, req.v2Envelope);
          if (validation.applicable && !validation.ok) {
            finishAIClientTrace("blocked_evidence", validation.code);
            const evidenceErr = new Error("invalid_ai_v2_evidence"); evidenceErr.code = validation.code; throw evidenceErr;
          }
          if (validation.applicable) finishAIClientTrace("validated", validation.code);
        }
        req.settled = true;
        renderAgentResult(data);
        if(!_lastAIClientTrace || _lastAIClientTrace.status === "running") finishAIClientTrace("success", "legacy_or_unknown");
        setAIRequestUi(false, "");
        _activeAIRequest = null;
      } catch (err) {
        if (!aiRequestIsCurrent(req)) return;
        if (!aiRequestMatchesActiveTrip(req)) {
          resetAIForTripContextChange();
          return;
        }
        const resumeAbort = req.abortReason === "resume_retry";
        const hiddenFailure = document.hidden || req.backgrounded;
        const timedOut = req.abortReason === "timeout";
        const retryableNetwork = !timedOut && !status && (err && (err.name === "TypeError" || err.name === "AbortError"));
        if (req.attempt < 2 && (resumeAbort || hiddenFailure || retryableNetwork)) {
          req.abortReason = "";
          if (document.hidden) {
            setAIRequestUi(true, t("ai_state_background"));
            return;
          }
          if (req.timeoutId) { window.clearTimeout(req.timeoutId); req.timeoutId = null; }
          window.setTimeout(() => { if (aiRequestIsCurrent(req)) executeAIRequest(req, true); }, 0);
          return;
        }
        req.settled = true; _activeAIRequest = null; setAIRequestUi(false, "");
        if(!_lastAIClientTrace || !["blocked_evidence","discarded_stale_context"].includes(_lastAIClientTrace.status)) finishAIClientTrace(status?"http_"+status:"network_error",err&&err.code||"");
        out.classList.remove("loading"); out.style.fontStyle = "normal";
        out.innerText = aiErrorText(status, data, err);
        console.warn("TripMaster Agent request failed", { status, code:data && data.error && data.error.code || "", error:err && err.name || "Error" });
      } finally {
        if (req.attempt === attemptNumber) req.inFlight = false;
        if (req.timeoutId) { window.clearTimeout(req.timeoutId); req.timeoutId = null; }
      }
    }

    function resumeAIRequestAfterWake() {
      const req = _activeAIRequest;
      if (!aiRequestIsCurrent(req)) return;
      req.backgrounded = false;
      if (req.resumeRetryScheduled) return;
      req.resumeRetryScheduled = true;
      setAIRequestUi(true, t("ai_state_working"));
      if (!req.inFlight && req.attempt < 2) {
        req.resumeRetryScheduled = false;
        executeAIRequest(req, true);
        return;
      }
      // Give a response that completed while backgrounded a short chance to
      // settle before replacing the suspended connection with one safe retry.
      window.setTimeout(() => {
        if (!aiRequestIsCurrent(req)) return;
        req.resumeRetryScheduled = false;
        if (!req.inFlight) {
          if (req.attempt < 2) executeAIRequest(req, true);
          else if (req.armTimeout) req.armTimeout();
          return;
        }
        if (req.attempt >= 2) { if (req.armTimeout) req.armTimeout(); return; }
        req.abortReason = "resume_retry";
        try { req.controller.abort(); } catch (_) {}
      }, 900);
    }

    function runAI(promptOverride, intentHintOverride) {
      const input = $("aiPromptInput");
      const prompt = String(promptOverride || input.value || "").trim();
      const intentHint = String(intentHintOverride || input.dataset.aiIntentHint || "").trim();
      if (!prompt) { showToast(t("ai_prompt_required")); return; }
      const trip = getActiveTrip();
      if (!trip) { showToast(t("ai_no_trip")); return; }
      if (_activeAIRequest && !_activeAIRequest.settled) return;
      $("aiPromptInput").value = prompt;
      const out = $("aiOutput");
      out.classList.add("loading"); out.style.fontStyle = "italic"; out.innerText = t("ai_thinking");
      $("aiImportBtn").style.display = "none";
      if (!navigator.onLine) { out.classList.remove("loading"); out.innerText = t("ai_error_offline"); return; }
      const req = {
        seq: ++_aiRequestSeq, tripId:trip.id, prompt, intentHint, attempt:0, settled:false,
        backgrounded:false, resumeRetryScheduled:false, timeoutId:null, controller:null, abortReason:"", inFlight:false,
        baseRequestId:"tm-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2,10)
      };
      _activeAIRequest = req;
      executeAIRequest(req, false);
    }

    /* ══════════════════════════════════════════════════════════════════
       TRIPMETA-001 (v1040 / B2, B3, C2): trip name, destination, time zone
       ══════════════════════════════════════════════════════════════════ */
    let _editingTripId = null;

    /* TZ-001 (B3): the browser already ships the full IANA database, so no
       backend and no library is needed. Intl.supportedValuesOf() gives the
       real list where it exists; TZ_FALLBACK covers older engines and is
       validated entry by entry before anything is offered. */
    function supportedTimeZones() {
      let list = [];
      try {
        if (typeof Intl.supportedValuesOf === "function") {
          list = Intl.supportedValuesOf("timeZone") || [];
        }
      } catch (err) { list = []; }
      if (!list.length) list = TZ_FALLBACK.filter(isValidTimeZone);
      return list;
    }

    function renderTimezoneOptions(selected) {
      const sel = $("tripTimezoneSelect");
      if (!sel) return;
      sel.innerHTML = "";
      const none = document.createElement("option");
      none.value = "";
      none.textContent = t("trip_timezone_none");
      sel.appendChild(none);

      const zones = supportedTimeZones().slice();
      const device = deviceTimeZone();
      if (device && zones.indexOf(device) === -1) zones.unshift(device);
      // A zone stored by an older device that this browser no longer lists
      // must still be selectable, or opening the sheet would silently clear it.
      if (selected && zones.indexOf(selected) === -1) zones.unshift(selected);

      zones.forEach((tz) => {
        const opt = document.createElement("option");
        opt.value = tz;
        opt.textContent = tz.split("_").join(" ");
        sel.appendChild(opt);
      });
      sel.value = selected || "";
    }

    function openTripDetailsSheet(tripId) {
      const trip = tripId
        ? trips.filter((x) => x.id === tripId)[0]
        : getActiveTrip();
      if (!trip) { showToast(t("toast_no_active_trip")); return; }
      _editingTripId = trip.id;
      $("tripNameInput").value = trip.name || "";
      $("tripDestinationInput").value = tripDestination(trip);
      renderTimezoneOptions(tripTimezone(trip));
      const base = tripBase(trip);
      $("tripBaseNameInput").value = base.name;
      $("tripBaseLocationInput").value = base.location;
      $("tripBaseNoteInput").value = base.note;
      renderPlanningSummary($("tripDetailsPlanningSummary"), trip);
      const archiveBtn=$("tripArchiveBtn");if(archiveBtn){archiveBtn.textContent=Operations.isArchivedTrip(trip)?t("trip_unarchive_btn"):t("trip_archive_btn");archiveBtn.classList.toggle("is-archived",Operations.isArchivedTrip(trip));}
      openSheetEl("tripDetailsSheet");
    }

    function closeTripDetailsSheet() {
      _editingTripId = null;
      closeSheetEl("tripDetailsSheet");
    }

    function saveTripDetails() {
      const trip = trips.filter((x) => x.id === _editingTripId)[0];
      if (!trip) { showToast(t("toast_no_active_trip")); return; }
      const name = $("tripNameInput").value.trim();
      if (!name) { showToast(t("toast_missing_trip_name")); return; }
      const dest = $("tripDestinationInput").value.trim();
      const tz   = $("tripTimezoneSelect").value;
      const baseName = $("tripBaseNameInput").value.trim();
      const baseLocation = $("tripBaseLocationInput").value.trim();
      const baseNote = $("tripBaseNoteInput").value.trim();
      // C2: the rename persists in the same transaction as everything else,
      // so it survives a reload or it did not happen at all.
      const ok = commitState(() => {
        trip.name = name;
        if (dest) trip.destination = dest; else delete trip.destination;
        if (tz && isValidTimeZone(tz)) trip.timezone = tz; else delete trip.timezone;
        const nextBase = (trip.base && typeof trip.base === "object") ? Object.assign({}, trip.base) : {};
        if (baseName) nextBase.name = baseName; else delete nextBase.name;
        if (baseLocation) nextBase.location = baseLocation; else delete nextBase.location;
        if (baseNote) nextBase.note = baseNote; else delete nextBase.note;
        if (Object.keys(nextBase).length) trip.base = nextBase; else delete trip.base;
      });
      if (!ok) return;
      closeTripDetailsSheet();
      renderCurrentView();
      updateHeaderInfo();
      showToast(t("toast_trip_updated"));
    }

    function setTripArchived(trip, archived) {
      if (!trip) return false;
      const makeArchived=archived===true;
      const wasActive=activeTripId===trip.id;
      const ok=commitState(()=>{
        if(makeArchived){trip.archived=true;trip.archivedAt=new Date().toISOString();}
        else {delete trip.archived;delete trip.archivedAt;}
        if(makeArchived&&wasActive){activeTripId=null;days=[];currentDayIndex=0;currentView="home";}
      });
      if(!ok)return false;
      if(makeArchived&&wasActive)resetAIForTripContextChange();
      closeTripDetailsSheet();renderCurrentView();updateHeaderInfo();showToast(makeArchived?t("toast_trip_archived"):t("toast_trip_unarchived"));return true;
    }

    /* ══════════════════════════════════════════════════════════════════
       LOGISTICS-001 (v1070): stays + intercity journeys
       Additive trip-owned data. Legacy trip.base remains untouched and is
       used as the effective base whenever the trip has no stays[].
       ══════════════════════════════════════════════════════════════════ */
    let _logisticsTripId = null;
    let _editingStayId = null;
    let _editingJourneyId = null;

    function logisticsTrip() {
      return trips.find((x) => x.id === _logisticsTripId) || null;
    }

    function rowIndexByStableId(rows, id) {
      if (!Array.isArray(rows) || typeof id !== "string" || !id) return -1;
      return rows.findIndex((row) => row && String(row.id || "") === id);
    }
    function rowFromEditorRef(rows, ref) {
      if (!Array.isArray(rows)) return null;
      if (Number.isInteger(ref)) return rows[ref] || null;
      if (typeof ref === "string" && ref) return rows.find((row) => row && String(row.id || "") === ref) || null;
      return null;
    }


    function renderLogisticsHub() {
      const trip = logisticsTrip();
      const staysList = $("staysList"), journeysList = $("journeysList"), legacyNote = $("legacyBaseLogisticsNote");
      if (!trip || !staysList || !journeysList) return;
      staysList.innerHTML = "";
      journeysList.innerHTML = "";
      const base = tripBase(trip), stays = tripStays(trip), journeys = tripJourneys(trip);
      if (legacyNote) {
        if ((base.name || base.location) && !stays.length) legacyNote.textContent = tf("logistics_legacy_active", { name: base.name || base.location });
        else if ((base.name || base.location) && stays.length) legacyNote.textContent = t("logistics_legacy_preserved");
        else legacyNote.textContent = "";
      }

      if (!stays.length) {
        const empty=document.createElement("div"); empty.className="logistics-empty"; empty.textContent=t("stays_empty"); staysList.appendChild(empty);
      } else {
        stays.map((raw)=>({raw,index:Array.isArray(trip.stays)?trip.stays.indexOf(raw):-1,info:stayInfo(raw)}))
          .sort((a,b)=>(a.info.startDate||"9999").localeCompare(b.info.startDate||"9999"))
          .forEach(({index,info})=>{
            const row=document.createElement("button"); row.type="button"; row.className="logistics-row";
            const title=document.createElement("div"); title.className="logistics-row-title"; title.textContent="🏨 " + (info.name || t("stay_unnamed"));
            const meta=document.createElement("div"); meta.className="logistics-row-meta";
            const bits=[];
            if (info.startDate || info.endDate) bits.push(flowPairText(info.startDate || "…", info.endDate || "…"));
            if (info.location) bits.push(info.location);
            if (info.status) bits.push(bookingStatusLabel(info.status));
            const pay=Finance.paymentStatus(info && trip.stays && trip.stays[index] && trip.stays[index].paymentStatus); if(pay) bits.push(paymentStatusLabel(pay));
            meta.textContent=bits.join(" · ") || t("overview_fact_unset");
            row.appendChild(title); row.appendChild(meta); row.addEventListener("click",()=>openStaySheet(index)); staysList.appendChild(row);
          });
      }

      if (!journeys.length) {
        const empty=document.createElement("div"); empty.className="logistics-empty"; empty.textContent=t("journeys_empty"); journeysList.appendChild(empty);
      } else {
        journeys.map((raw)=>({raw,index:Array.isArray(trip.journeys)?trip.journeys.indexOf(raw):-1,info:journeyInfo(raw)}))
          .sort((a,b)=>(a.info.date||"9999").localeCompare(b.info.date||"9999") || (a.info.departureTime||"").localeCompare(b.info.departureTime||""))
          .forEach(({index,info})=>{
            const row=document.createElement("button"); row.type="button"; row.className="logistics-row";
            const title=document.createElement("div"); title.className="logistics-row-title";
            title.textContent="🚆 " + flowPairText(info.origin || "…", info.destination || "…");
            const meta=document.createElement("div"); meta.className="logistics-row-meta";
            const bits=[]; if (info.date) bits.push(info.arrivalDate&&info.arrivalDate!==info.date ? flowPairText(info.date, info.arrivalDate) : info.date); if (info.mode) bits.push(journeyModeLabel(info.mode));
            if (info.departureTime || info.arrivalTime) bits.push(flowPairText(info.departureTime||"…", info.arrivalTime||"…"));
            if (info.status) bits.push(bookingStatusLabel(info.status));
            const pay=Finance.paymentStatus(trip.journeys && trip.journeys[index] && trip.journeys[index].paymentStatus); if(pay) bits.push(paymentStatusLabel(pay));
            meta.textContent=bits.join(" · ") || t("overview_fact_unset");
            row.appendChild(title); row.appendChild(meta); row.addEventListener("click",()=>openJourneySheet(index)); journeysList.appendChild(row);
          });
      }
    }

    function openLogisticsSheet(tripId) {
      const trip = tripId ? trips.find((x)=>x.id===tripId) : trips.find((x)=>x.id===_editingTripId) || getActiveTrip();
      if (!trip) { showToast(t("toast_no_active_trip")); return; }
      _logisticsTripId = trip.id;
      renderLogisticsHub();
      openSheetEl("logisticsSheet");
    }
    function closeLogisticsSheet() { _logisticsTripId = null; closeSheetEl("logisticsSheet"); }

    function openStaySheet(ref) {
      const trip=logisticsTrip(); if (!trip) return;
      const raw = rowFromEditorRef(trip.stays, ref);
      _editingStayId = raw && typeof raw.id === "string" ? raw.id : null;
      const info = stayInfo(raw);
      $("staySheetHead").textContent = _editingStayId === null ? t("stay_add_title") : t("stay_edit_title");
      $("stayName").value=info.name; $("stayLocation").value=info.location;
      $("stayStartDate").value=info.startDate; $("stayEndDate").value=info.endDate;
      $("stayCheckInTime").value=info.checkInTime; $("stayCheckOutTime").value=info.checkOutTime;
      $("stayStatus").value=info.status; $("stayPaymentStatus").value=Finance.paymentStatus(raw && raw.paymentStatus); $("stayConfirmation").value=info.confirmation;
      $("stayProvider").value=info.provider; $("stayBookingUrl").value=info.bookingUrl; $("stayNote").value=info.note;
      $("stayDeleteBtn").hidden = _editingStayId === null;
      const more=$("staySheet").querySelector("details.logistics-more");
      if (more) more.open=!!(info.checkInTime||info.checkOutTime||info.status||Finance.paymentStatus(raw && raw.paymentStatus)||info.confirmation||info.provider||info.bookingUrl||info.note);
      openSheetEl("staySheet");
    }
    function closeStaySheet() { _editingStayId=null; closeSheetEl("staySheet"); }

    function readStayForm(existing) {
      const name=$("stayName").value.trim(), location=$("stayLocation").value.trim();
      const startDate=$("stayStartDate").value, endDate=$("stayEndDate").value;
      if (!name) { showToast(t("toast_stay_name_required")); return null; }
      if (!startDate || !endDate) { showToast(t("toast_stay_dates_required")); return null; }
      if (startDate >= endDate) { showToast(t("toast_stay_date_range")); return null; }
      const next=(existing && typeof existing==="object") ? Object.assign({},existing) : { id:logisticsId("stay") };
      next.name=name; if (location) next.location=location; else delete next.location;
      next.startDate=startDate; next.endDate=endDate;
      const checkIn=$("stayCheckInTime").value, checkOut=$("stayCheckOutTime").value, status=$("stayStatus").value, paymentStatus=$("stayPaymentStatus").value;
      const confirmation=$("stayConfirmation").value.trim(), provider=$("stayProvider").value.trim(), bookingUrl=$("stayBookingUrl").value.trim(), note=$("stayNote").value.trim();
      if (Logistics.validTime(checkIn)) next.checkInTime=checkIn; else delete next.checkInTime;
      if (Logistics.validTime(checkOut)) next.checkOutTime=checkOut; else delete next.checkOutTime;
      if (Logistics.BOOKING_STATUSES.indexOf(status)!==-1) next.status=status; else delete next.status;
      if (Finance.PAYMENT_STATUSES.indexOf(paymentStatus)!==-1) next.paymentStatus=paymentStatus; else delete next.paymentStatus;
      if (confirmation) next.confirmation=confirmation; else delete next.confirmation;
      if (provider) next.provider=provider; else delete next.provider;
      if (bookingUrl) next.bookingUrl=bookingUrl; else delete next.bookingUrl;
      if (note) next.note=note; else delete next.note;
      return next;
    }

    function refreshAfterLogisticsChange(trip) {
      renderLogisticsHub();
      renderPlanningSummary($("tripDetailsPlanningSummary"), trip);
      renderCurrentView();
      if ($("overviewSheet").classList.contains("open") && trip.id===activeTripId) renderOverview();
      if ($("bookingCenterSheet").classList.contains("open") && operationsTrip() && operationsTrip().id===trip.id) renderBookingCenter();
      if ($("documentsSheet").classList.contains("open") && operationsTrip() && operationsTrip().id===trip.id) renderDocumentsHub();
      if ($("moneySheet").classList.contains("open") && operationsTrip() && operationsTrip().id===trip.id) renderMoneyHub();
    }

    function saveStay() {
      const trip=logisticsTrip(); if (!trip) return;
      const index=rowIndexByStableId(trip.stays,_editingStayId);
      const existing=index>=0 ? trip.stays[index] : null;
      if (_editingStayId && !existing) return;
      const next=readStayForm(existing); if (!next) return;
      const ok=commitState(()=>{
        if (!Array.isArray(trip.stays)) trip.stays=[];
        if (_editingStayId===null) trip.stays.push(next); else trip.stays[index]=next;
      });
      if (!ok) return;
      closeStaySheet(); refreshAfterLogisticsChange(trip); showToast(t("toast_stay_saved"));
    }
    function deleteStay() {
      const trip=logisticsTrip(); if (!trip || _editingStayId===null || !Array.isArray(trip.stays)) return;
      const index=rowIndexByStableId(trip.stays,_editingStayId); if(index<0)return;
      if (!commitState(()=>{ trip.stays.splice(index,1); if (!trip.stays.length) delete trip.stays; }, {})) return;
      closeStaySheet(); refreshAfterLogisticsChange(trip); showUndoToast(t("toast_stay_deleted"));
    }

    function openJourneySheet(ref) {
      const trip=logisticsTrip(); if (!trip) return;
      const raw = rowFromEditorRef(trip.journeys, ref);
      _editingJourneyId = raw && typeof raw.id === "string" ? raw.id : null;
      const info=journeyInfo(raw);
      $("journeySheetHead").textContent = _editingJourneyId===null ? t("journey_add_title") : t("journey_edit_title");
      $("journeyDate").value=info.date; $("journeyMode").value=info.mode; $("journeyOrigin").value=info.origin; $("journeyDestination").value=info.destination;
      $("journeyDepartureTime").value=info.departureTime; $("journeyArrivalTime").value=info.arrivalTime; $("journeyArrivalDate").value=info.arrivalDate||"";
      $("journeyProvider").value=info.provider; $("journeyServiceNumber").value=info.serviceNumber;
      $("journeyStatus").value=info.status; $("journeyPaymentStatus").value=Finance.paymentStatus(raw && raw.paymentStatus); $("journeyConfirmation").value=info.confirmation; $("journeyNote").value=info.note;
      $("journeyDeleteBtn").hidden = _editingJourneyId===null;
      const more=$("journeySheet").querySelector("details.logistics-more");
      if (more) more.open=!!(info.departureTime||info.arrivalTime||info.arrivalDate||info.provider||info.serviceNumber||info.status||Finance.paymentStatus(raw && raw.paymentStatus)||info.confirmation||info.note);
      openSheetEl("journeySheet");
    }
    function closeJourneySheet() { _editingJourneyId=null; closeSheetEl("journeySheet"); }

    function readJourneyForm(existing) {
      const date=$("journeyDate").value, origin=$("journeyOrigin").value.trim(), destination=$("journeyDestination").value.trim();
      if (!date) { showToast(t("toast_journey_date_required")); return null; }
      if (!origin && !destination) { showToast(t("toast_journey_route_required")); return null; }
      const next=(existing && typeof existing==="object") ? Object.assign({},existing) : { id:logisticsId("journey") };
      next.date=date;
      const mode=$("journeyMode").value; if (Logistics.JOURNEY_MODES.indexOf(mode)!==-1) next.mode=mode; else delete next.mode;
      if (origin) next.origin=origin; else delete next.origin; if (destination) next.destination=destination; else delete next.destination;
      const depart=$("journeyDepartureTime").value, arrive=$("journeyArrivalTime").value, arrivalDate=$("journeyArrivalDate").value;
      if (arrivalDate && (!Logistics.validDate(arrivalDate) || arrivalDate < date)) { showToast(t("toast_journey_arrival_date_invalid")); return null; }
      if (Logistics.validTime(depart) && Logistics.validTime(arrive) && arrive < depart && !arrivalDate) { showToast(t("toast_journey_arrival_date_required")); return null; }
      if (arrivalDate===date && Logistics.validTime(depart) && Logistics.validTime(arrive) && arrive < depart) { showToast(t("toast_journey_time_range")); return null; }
      if (Logistics.validTime(depart)) next.departureTime=depart; else delete next.departureTime;
      if (Logistics.validTime(arrive)) next.arrivalTime=arrive; else delete next.arrivalTime;
      if (Logistics.validDate(arrivalDate) && arrivalDate!==date) next.arrivalDate=arrivalDate; else delete next.arrivalDate;
      const provider=$("journeyProvider").value.trim(), service=$("journeyServiceNumber").value.trim(), status=$("journeyStatus").value, paymentStatus=$("journeyPaymentStatus").value;
      const confirmation=$("journeyConfirmation").value.trim(), note=$("journeyNote").value.trim();
      if (provider) next.provider=provider; else delete next.provider;
      if (service) next.serviceNumber=service; else delete next.serviceNumber;
      if (Logistics.BOOKING_STATUSES.indexOf(status)!==-1) next.status=status; else delete next.status;
      if (Finance.PAYMENT_STATUSES.indexOf(paymentStatus)!==-1) next.paymentStatus=paymentStatus; else delete next.paymentStatus;
      if (confirmation) next.confirmation=confirmation; else delete next.confirmation;
      if (note) next.note=note; else delete next.note;
      return next;
    }
    function saveJourney() {
      const trip=logisticsTrip(); if (!trip) return;
      const index=rowIndexByStableId(trip.journeys,_editingJourneyId);
      const existing=index>=0 ? trip.journeys[index] : null;
      if (_editingJourneyId && !existing) return;
      const next=readJourneyForm(existing); if (!next) return;
      const ok=commitState(()=>{
        if (!Array.isArray(trip.journeys)) trip.journeys=[];
        if (_editingJourneyId===null) trip.journeys.push(next); else trip.journeys[index]=next;
      });
      if (!ok) return;
      closeJourneySheet(); refreshAfterLogisticsChange(trip); showToast(t("toast_journey_saved"));
    }
    function deleteJourney() {
      const trip=logisticsTrip(); if (!trip || _editingJourneyId===null || !Array.isArray(trip.journeys)) return;
      const index=rowIndexByStableId(trip.journeys,_editingJourneyId); if(index<0)return;
      if (!commitState(()=>{ trip.journeys.splice(index,1); if (!trip.journeys.length) delete trip.journeys; }, {})) return;
      closeJourneySheet(); refreshAfterLogisticsChange(trip); showUndoToast(t("toast_journey_deleted"));
    }


    /* ══════════════════════════════════════════════════════════════════
       MONEY / BOOKING CENTER / DOCUMENT REFERENCES (v1080)
       Canonical data stays on trip entities. These hubs are views/editors,
       never a second booking database and never a network integration.
       ══════════════════════════════════════════════════════════════════ */
    let _operationsTripId = null;
    let _editingExpenseId = null;
    let _editingDocumentId = null;
    let _bookingCenterFilter = "all";
    let _documentsFilter = "all";
    let _moneyFilter = "all";

    function operationsTrip() {
      return (_operationsTripId && trips.find((x) => x.id === _operationsTripId)) || getActiveTrip();
    }

    function setOperationsTrip(tripId) {
      const trip = tripId ? trips.find((x) => x.id === tripId) : getActiveTrip();
      if (!trip) { showToast(t("toast_no_active_trip")); return null; }
      _operationsTripId = trip.id;
      return trip;
    }

    function entityLinkLabel(trip, type, id) {
      if (type === "trip") return trip.name || t("link_trip_level");
      const resolved = Finance.resolveLinkedEntity(trip, type, id, Logistics);
      if (resolved.state !== "resolved") return t("link_unresolved");
      if (type === "stay") { const x=stayInfo(resolved.entity); return "🏨 " + (x.name || x.location || t("stay_unnamed")); }
      if (type === "journey") { const x=journeyInfo(resolved.entity); return "🚆 " + flowPairText(x.origin||"…", x.destination||"…"); }
      if (type === "activity") return "🎟️ " + ((resolved.entity && resolved.entity.title) || t("expense_link_activity"));
      return t("link_unresolved");
    }

    function populateEntityLinkSelect(select, trip, currentType, currentId) {
      if (!select || !trip) return;
      select.innerHTML="";
      const add=(value,label)=>{ const o=document.createElement("option"); o.value=value; o.textContent=label; select.appendChild(o); };
      add("", t("link_none"));
      add("trip|" + trip.id, "🧳 " + (trip.name || t("link_trip_level")));
      tripStays(trip).forEach((raw,index)=>{ const id=Finance.cleanString(raw.id); if(!id)return; const x=stayInfo(raw); add("stay|"+id,"🏨 "+(x.name||x.location||t("stay_unnamed"))); });
      tripJourneys(trip).forEach((raw,index)=>{ const id=Finance.cleanString(raw.id); if(!id)return; const x=journeyInfo(raw); add("journey|"+id,"🚆 "+flowPairText(x.origin||"…", x.destination||"…")); });
      Finance.activityRows(trip).forEach((row)=>{
        const uid=Finance.cleanString(row.item.uid);
        if(!uid)return; // Unpersisted legacy identity is not a safe link target.
        const value="activity|"+uid;
        add(value,"🎟️ "+(row.item.title||t("expense_link_activity"))+(row.day.date?" · "+row.day.date:""));
      });
      if (currentType && currentId) {
        const wanted=currentType+"|"+currentId;
        if (!Array.from(select.options).some(o=>o.value===wanted)) add(wanted,"⚠️ "+t("link_unresolved"));
        select.value=wanted;
      } else select.value="";
    }

    function readLinkSelection(value) {
      if (!value) return { type:"", id:"", activityPos:null };
      const parts=String(value).split("|");
      if (parts[0]==="activitypos") return { type:"activity", id:"", activityPos:{ dayIndex:Number(parts[1]), itemIndex:Number(parts[2]) } };
      if (Finance.LINK_TYPES.indexOf(parts[0])!==-1) return { type:parts[0], id:parts.slice(1).join("|"), activityPos:null };
      return { type:"", id:"", activityPos:null };
    }

    function applyLinkToRecord(next, linkSpec, trip) {
      if (!linkSpec || !linkSpec.type) { delete next.linkedType; delete next.linkedId; return; }
      let id=linkSpec.id;
      if (linkSpec.activityPos) {
        const day=trip.days && trip.days[linkSpec.activityPos.dayIndex];
        const item=day && Array.isArray(day.items) ? day.items[linkSpec.activityPos.itemIndex] : null;
        if (!item) { delete next.linkedType; delete next.linkedId; return; }
        if (!(typeof item.uid === "string" && item.uid)) {
          item.uid = newActivityUid();
        }
        id=item.uid;
      }
      if (id) { next.linkedType=linkSpec.type; next.linkedId=id; }
      else { delete next.linkedType; delete next.linkedId; }
    }

    function setFilterButtonState(container, attr, value) {
      if (!container) return;
      container.querySelectorAll("["+attr+"]").forEach((btn) => {
        const on = btn.getAttribute(attr) === value;
        btn.classList.toggle("on", on);
        btn.setAttribute("aria-pressed", on ? "true" : "false");
      });
    }

    function openBookingCenterSheet(tripId) {
      const trip=setOperationsTrip(tripId); if(!trip)return;
      _bookingCenterFilter = "all";
      renderBookingCenter(); openSheetEl("bookingCenterSheet");
    }
    function closeBookingCenterSheet() { closeSheetEl("bookingCenterSheet"); }

    function openBookingSource(row) {
      const trip=operationsTrip(); if(!trip||!row)return;
      if(row.kind==="stay") { _logisticsTripId=trip.id; openStaySheet(row.sourceIndex); return; }
      if(row.kind==="journey") { _logisticsTripId=trip.id; openJourneySheet(row.sourceIndex); return; }
      if(row.kind==="activity") {
        if (trip.id!==activeTripId && !switchTrip(trip.id,{silent:true})) return;
        currentView="planner"; days=trip.days||[]; currentDayIndex=row.dayIndex;
        renderCurrentView(); updateHeaderInfo(); openEditSheet(row.dayIndex,row.itemIndex,{expandMore:true});
      }
    }

    function renderBookingCenter() {
      const body=$("bookingCenterBody"), trip=operationsTrip(); if(!body)return;
      body.innerHTML=""; if(!trip)return;
      const rows=Finance.bookingEntries(trip,Logistics);
      const attention=rows.filter(row => Finance.bookingEntryNeedsAttention(row));
      const paid=rows.filter(row => row.paymentStatus === "paid").length;
      const summary=$("bookingCenterSummary");
      if(summary) summary.textContent=tf("booking_summary",{total:rows.length,attention:attention.length,paid});
      setFilterButtonState($("bookingCenterFilters"),"data-booking-filter",_bookingCenterFilter);
      const filtered=_bookingCenterFilter==="attention"?attention:rows;
      if(!filtered.length){ const e=document.createElement("div");e.className="overview-empty";e.textContent=_bookingCenterFilter==="attention"?t("booking_center_no_attention"):t("booking_center_empty");body.appendChild(e);return; }
      const groups=[["stay",t("booking_group_stays")],["journey",t("booking_group_journeys")],["activity",t("booking_group_activities")]];
      groups.forEach(([kind,label])=>{
        const list=filtered.filter(r=>r.kind===kind); if(!list.length)return;
        const section=document.createElement("section");section.className="logistics-section";
        const h=document.createElement("div");h.className="trip-base-heading";h.textContent=label;
        const count=document.createElement("span");count.className="section-count";count.textContent="("+list.length+")";h.appendChild(count);section.appendChild(h);
        list.sort((a,b)=>(a.date||"9999").localeCompare(b.date||"9999")).forEach(row=>{
          const needs=Finance.bookingEntryNeedsAttention(row);
          const btn=document.createElement("button");btn.type="button";btn.className="logistics-item booking-center-row"+(needs?" booking-attention-row":"");
          const main=document.createElement("div");main.className="logistics-item-main";
          const title=document.createElement("div");title.className="logistics-item-title";title.textContent=row.title||t("booking_unnamed");
          const meta=document.createElement("div");meta.className="logistics-item-meta";
          const bits=[];if(row.date)bits.push(row.date);if(row.provider)bits.push(row.provider);if(row.bookingStatus)bits.push(bookingStatusLabel(row.bookingStatus));if(row.paymentStatus)bits.push(paymentStatusLabel(row.paymentStatus));if(row.reference)bits.push(t("booking_reference_short")+": "+row.reference);
          meta.textContent=bits.join(" · ")||t("overview_fact_unset"); main.appendChild(title);main.appendChild(meta);
          if(needs){const badge=document.createElement("span");badge.className="booking-attention-badge";badge.textContent=t("filter_needs_attention");main.appendChild(badge);}
          btn.appendChild(main);
          const arrow=document.createElement("span");arrow.className="logistics-item-arrow";arrow.textContent="›";btn.appendChild(arrow);
          btn.addEventListener("click",()=>openBookingSource(row));section.appendChild(btn);
        }); body.appendChild(section);
      });
    }

    function openMoneySheet(tripId) {
      const trip=setOperationsTrip(tripId);if(!trip)return;
      _moneyFilter="all";
      renderMoneyHub();openSheetEl("moneySheet");
    }
    function closeMoneySheet(){closeSheetEl("moneySheet");}

    function renderMoneyHub() {
      const trip=operationsTrip();if(!trip)return;
      const budget=Finance.budgetInfo(trip);
      $("budgetAmount").value=budget.amount==null?"":String(budget.amount);
      populateCurrencySelect($("budgetCurrency"),budget.currency||Finance.preferredCurrency(trip)||"",trip);
      const summary=$("budgetSummary");summary.innerHTML="";
      const bs=Finance.budgetSummary(trip), totals=Finance.totalsByCurrency(trip);
      const progress=$("budgetProgress"),progressFill=$("budgetProgressFill"),progressLabel=$("budgetProgressLabel");
      if(bs.active){
        const line=document.createElement("div");line.className="money-summary-main";line.textContent=t("budget_recorded")+": "+formatMoneyAmount(bs.comparableSpent,bs.budget.currency)+" · "+t("budget_remaining")+": "+formatMoneyAmount(bs.remaining,bs.budget.currency);summary.appendChild(line);
        if(bs.otherTotals.length){const x=document.createElement("div");x.className="field-note";x.textContent=t("budget_other_currencies")+": "+bs.otherTotals.map(v=>formatMoneyAmount(v.amount,v.currency)).join(" · ");summary.appendChild(x);}
        if(bs.exceeded){const x=document.createElement("div");x.className="readiness-row readiness-check";x.textContent=t("budget_exceeded_note");summary.appendChild(x);}
        const pct=bs.budget.amount>0?Math.max(0,Math.round((bs.comparableSpent/bs.budget.amount)*100)):0;
        progress.hidden=false;progress.classList.toggle("is-over",pct>100);progressFill.style.width=Math.min(pct,100)+"%";progressLabel.textContent=tf("budget_progress_label",{pct});
      } else {
        progress.hidden=true;progress.classList.remove("is-over");progressFill.style.width="0%";progressLabel.textContent="";
        if(totals.length){const line=document.createElement("div");line.className="money-summary-main";line.textContent=t("money_recorded_totals")+": "+totals.map(v=>formatMoneyAmount(v.amount,v.currency)).join(" · ");summary.appendChild(line);}
        else {const line=document.createElement("div");line.className="field-note";line.textContent=t("money_empty_summary");summary.appendChild(line);}
      }

      const expenseSource=Array.isArray(trip.expenses)?trip.expenses:[];
      const rows=tripExpenses(trip).map((raw)=>({raw,index:expenseSource.indexOf(raw),info:Finance.expenseInfo(raw)}));
      const paymentAttention=Finance.expensePaymentAttention(trip);
      const insight=$("moneyInsights");
      if(insight){
        const parts=[tf("money_insights_summary",{expenses:rows.length,attention:paymentAttention.length})];
        const primary=budget.currency||Finance.preferredCurrency(trip)||"";
        const cats=Finance.expenseCategoryTotals(trip,primary).slice(0,3);
        if(primary&&cats.length) parts.push(t("money_top_categories")+": "+cats.map(x=>expenseCategoryLabel(x.category)+" "+formatMoneyAmount(x.amount,primary)).join(" · "));
        insight.textContent=parts.join("\n");
      }

      setFilterButtonState($("moneyFilters"),"data-money-filter",_moneyFilter);
      const visibleRows=(_moneyFilter==="attention"?rows.filter(x=>x.info.paymentStatus==="unpaid"||x.info.paymentStatus==="partial"):rows.slice());
      const list=$("expensesList");list.innerHTML="";
      visibleRows.sort((a,b)=>{const aa=(a.info.paymentStatus==="unpaid"||a.info.paymentStatus==="partial")?0:1,bb=(b.info.paymentStatus==="unpaid"||b.info.paymentStatus==="partial")?0:1;return aa-bb||(a.info.date||"9999").localeCompare(b.info.date||"9999");}).forEach(({raw,index,info})=>{
        const needs=info.paymentStatus==="unpaid"||info.paymentStatus==="partial";
        const btn=document.createElement("button");btn.type="button";btn.className="logistics-item"+(needs?" booking-attention-row":"");
        const main=document.createElement("div");main.className="logistics-item-main";
        const title=document.createElement("div");title.className="logistics-item-title";title.textContent=info.title||t("expense_unnamed");
        const meta=document.createElement("div");meta.className="logistics-item-meta";const bits=[];if(info.amount!=null&&info.currency)bits.push(formatMoneyAmount(info.amount,info.currency));bits.push(expenseCategoryLabel(info.category));if(info.date)bits.push(info.date);if(info.paymentStatus)bits.push(paymentStatusLabel(info.paymentStatus));
        if(info.linkedType&&info.linkedId){const resolved=Finance.resolveLinkedEntity(trip,info.linkedType,info.linkedId,Logistics);bits.push(resolved.state==="resolved"?entityLinkLabel(trip,info.linkedType,info.linkedId):"⚠️ "+t("link_unresolved"));}
        meta.textContent=bits.join(" · ");main.appendChild(title);main.appendChild(meta);
        if(needs){const badge=document.createElement("span");badge.className="booking-attention-badge";badge.textContent=t("payment_attention_badge");main.appendChild(badge);}
        btn.appendChild(main);const arrow=document.createElement("span");arrow.className="logistics-item-arrow";arrow.textContent="›";btn.appendChild(arrow);btn.addEventListener("click",()=>openExpenseSheet(index));list.appendChild(btn);
      });
      if(!visibleRows.length){const e=document.createElement("div");e.className="logistics-empty";e.textContent=_moneyFilter==="attention"?t("money_no_attention"):t("expenses_empty");list.appendChild(e);}
    }

    function saveBudget() {
      const trip=operationsTrip();if(!trip)return;
      const rawAmount=$("budgetAmount").value.trim(), currency=Finance.currencyCode($("budgetCurrency").value);
      if(!rawAmount){
        if(!commitState(()=>{const next=(trip.budget&&typeof trip.budget==="object")?Object.assign({},trip.budget):{};delete next.amount;delete next.currency;if(Object.keys(next).length)trip.budget=next;else delete trip.budget;}))return;
        renderMoneyHub();renderCurrentView();if($("overviewSheet").classList.contains("open")&&trip.id===activeTripId)renderOverview();showToast(t("toast_budget_cleared"));return;
      }
      const amount=Finance.validPositiveAmount(rawAmount);if(amount==null){showToast(t("toast_amount_required"));return;}if(!currency){showToast(t("toast_currency_required"));return;}
      if(!commitState(()=>{const next=(trip.budget&&typeof trip.budget==="object")?Object.assign({},trip.budget):{};next.amount=amount;next.currency=currency;trip.budget=next;const cs=(trip.currencySettings&&typeof trip.currencySettings==="object")?Object.assign({},trip.currencySettings):{};cs.primaryCurrency=currency;trip.currencySettings=cs;}))return;
      renderMoneyHub();renderCurrentView();if($("overviewSheet").classList.contains("open")&&trip.id===activeTripId)renderOverview();showToast(t("toast_budget_saved"));
    }

    function openExpenseSheet(ref) {
      const trip=operationsTrip();if(!trip)return;const raw=rowFromEditorRef(trip.expenses,ref);_editingExpenseId=raw&&typeof raw.id==="string"?raw.id:null;
      const info=Finance.expenseInfo(raw);
      $("expenseSheetHead").textContent=_editingExpenseId===null?t("expense_add_title"):t("expense_edit_title");
      $("expenseTitle").value=info.title;$("expenseAmount").value=info.amount==null?"":String(info.amount);populateCurrencySelect($("expenseCurrency"),info.currency||Finance.preferredCurrency(trip)||"",trip);$("expenseCategory").value=info.category||"other";$("expenseDate").value=info.date;$("expensePaymentStatus").value=info.paymentStatus;$("expensePaidBy").value=info.paidBy;$("expenseNote").value=info.note;
      populateEntityLinkSelect($("expenseLink"),trip,info.linkedType,info.linkedId);$("expenseDeleteBtn").hidden=_editingExpenseId===null;
      const more=$("expenseSheet").querySelector("details.logistics-more");if(more)more.open=!!(info.date||info.paymentStatus||info.paidBy||info.linkedType||info.note);openSheetEl("expenseSheet");
    }
    function closeExpenseSheet(){_editingExpenseId=null;closeSheetEl("expenseSheet");}

    function readExpenseForm(existing) {
      const title=$("expenseTitle").value.trim(),amount=Finance.validPositiveAmount($("expenseAmount").value),currency=Finance.currencyCode($("expenseCurrency").value);
      if(!title){showToast(t("toast_expense_title_required"));return null;}if(amount==null){showToast(t("toast_amount_required"));return null;}if(!currency){showToast(t("toast_currency_required"));return null;}
      const next=(existing&&typeof existing==="object")?Object.assign({},existing):{id:financeId("expense")};next.title=title;next.amount=amount;next.currency=currency;
      const category=$("expenseCategory").value;next.category=Finance.EXPENSE_CATEGORIES.indexOf(category)!==-1?category:"other";
      const date=$("expenseDate").value,pay=$("expensePaymentStatus").value,paidBy=$("expensePaidBy").value.trim(),note=$("expenseNote").value.trim();
      if(Finance.validDate(date))next.date=date;else delete next.date;if(Finance.PAYMENT_STATUSES.indexOf(pay)!==-1)next.paymentStatus=pay;else delete next.paymentStatus;if(paidBy)next.paidBy=paidBy;else delete next.paidBy;if(note)next.note=note;else delete next.note;
      return {next,linkSpec:readLinkSelection($("expenseLink").value)};
    }
    function saveExpense(){const trip=operationsTrip();if(!trip)return;const index=rowIndexByStableId(trip.expenses,_editingExpenseId),existing=index>=0?trip.expenses[index]:null;if(_editingExpenseId&&!existing)return;const read=readExpenseForm(existing);if(!read)return;const ok=commitState(()=>{applyLinkToRecord(read.next,read.linkSpec,trip);if(!Array.isArray(trip.expenses))trip.expenses=[];if(_editingExpenseId===null)trip.expenses.push(read.next);else trip.expenses[index]=read.next;const cs=(trip.currencySettings&&typeof trip.currencySettings==="object")?Object.assign({},trip.currencySettings):{};if(!Finance.currencyCode(cs.primaryCurrency))cs.primaryCurrency=read.next.currency;trip.currencySettings=cs;});if(!ok)return;closeExpenseSheet();renderMoneyHub();renderCurrentView();if($("overviewSheet").classList.contains("open")&&trip.id===activeTripId)renderOverview();showToast(t("toast_expense_saved"));}
    function deleteExpense(){const trip=operationsTrip();if(!trip||_editingExpenseId===null||!Array.isArray(trip.expenses))return;const index=rowIndexByStableId(trip.expenses,_editingExpenseId);if(index<0)return;if(!commitState(()=>{trip.expenses.splice(index,1);if(!trip.expenses.length)delete trip.expenses;}))return;closeExpenseSheet();renderMoneyHub();renderCurrentView();showUndoToast(t("toast_expense_deleted"));}

    function openDocumentsSheet(tripId){const trip=setOperationsTrip(tripId);if(!trip)return;_documentsFilter="all";renderDocumentsHub();openSheetEl("documentsSheet");}
    function closeDocumentsSheet(){closeSheetEl("documentsSheet");}
    function renderDocumentsHub(){
      const trip=operationsTrip();if(!trip)return;
      const derived=$("derivedDocumentsList"),stand=$("documentsList");derived.innerHTML="";stand.innerHTML="";
      const drows=Finance.derivedConfirmationDocuments(trip,Logistics);
      const documentSource=Array.isArray(trip.documents)?trip.documents:[];
      const allRows=tripDocuments(trip).map((raw)=>({raw,index:documentSource.indexOf(raw),info:Finance.documentInfo(raw)}));
      const neededRows=allRows.filter(x=>x.info.status==="needed");
      const summary=$("documentsSummary");if(summary)summary.textContent=tf("documents_summary",{total:drows.length+allRows.length,needed:neededRows.length});
      setFilterButtonState($("documentsFilters"),"data-documents-filter",_documentsFilter);
      const showAll=_documentsFilter==="all";
      const derivedSection=derived.closest("section"),standSection=stand.closest("section");
      if(derivedSection)derivedSection.hidden=!showAll;
      if(standSection)standSection.hidden=false;
      if(showAll){
        drows.forEach(row=>{const btn=document.createElement("button");btn.type="button";btn.className="logistics-item";const main=document.createElement("div");main.className="logistics-item-main";const title=document.createElement("div");title.className="logistics-item-title";title.textContent=row.label||t("document_unnamed");const meta=document.createElement("div");meta.className="logistics-item-meta";const bits=[documentTypeLabel(row.type)];if(row.date)bits.push(row.date);if(row.reference)bits.push(t("booking_reference_short")+": "+row.reference);meta.textContent=bits.join(" · ");main.appendChild(title);main.appendChild(meta);btn.appendChild(main);const arrow=document.createElement("span");arrow.className="logistics-item-arrow";arrow.textContent="›";btn.appendChild(arrow);btn.addEventListener("click",()=>openBookingSource({kind:row.kind,sourceIndex:row.sourceIndex,dayIndex:row.dayIndex,itemIndex:row.itemIndex}));derived.appendChild(btn);});
        if(!drows.length){const e=document.createElement("div");e.className="logistics-empty";e.textContent=t("documents_derived_empty");derived.appendChild(e);}
      }
      const rows=showAll?allRows:neededRows;
      rows.forEach(({index,info})=>{const needs=info.status==="needed";const btn=document.createElement("button");btn.type="button";btn.className="logistics-item"+(needs?" booking-attention-row":"");const main=document.createElement("div");main.className="logistics-item-main";const title=document.createElement("div");title.className="logistics-item-title";title.textContent=info.label||t("document_unnamed");const meta=document.createElement("div");meta.className="logistics-item-meta";const bits=[documentTypeLabel(info.type)];if(info.status)bits.push(info.status==="needed"?t("document_status_needed"):t("document_status_available"));if(info.reference)bits.push(t("booking_reference_short")+": "+info.reference);if(info.linkedType&&info.linkedId){const resolved=Finance.resolveLinkedEntity(trip,info.linkedType,info.linkedId,Logistics);if(resolved.state==="missing")bits.push("⚠️ "+t("link_unresolved"));}meta.textContent=bits.join(" · ");main.appendChild(title);main.appendChild(meta);if(needs){const badge=document.createElement("span");badge.className="booking-attention-badge";badge.textContent=t("filter_needed");main.appendChild(badge);}btn.appendChild(main);const arrow=document.createElement("span");arrow.className="logistics-item-arrow";arrow.textContent="›";btn.appendChild(arrow);btn.addEventListener("click",()=>openDocumentSheet(index));stand.appendChild(btn);});
      if(!rows.length){const e=document.createElement("div");e.className="logistics-empty";e.textContent=showAll?t("documents_empty"):t("documents_no_needed");stand.appendChild(e);}
    }

    function openDocumentSheet(ref){const trip=operationsTrip();if(!trip)return;const raw=rowFromEditorRef(trip.documents,ref);_editingDocumentId=raw&&typeof raw.id==="string"?raw.id:null;const info=Finance.documentInfo(raw);$("documentSheetHead").textContent=_editingDocumentId===null?t("document_add_title"):t("document_edit_title");$("documentLabel").value=info.label;$("documentType").value=info.type||"other";$("documentStatus").value=info.status;$("documentReference").value=info.reference;$("documentUrl").value=info.url;$("documentNote").value=info.note;populateEntityLinkSelect($("documentLink"),trip,info.linkedType,info.linkedId);$("documentDeleteBtn").hidden=_editingDocumentId===null;const more=$("documentSheet").querySelector("details.logistics-more");if(more)more.open=!!(info.reference||info.url||info.note||info.linkedType);openSheetEl("documentSheet");}
    function closeDocumentSheet(){_editingDocumentId=null;closeSheetEl("documentSheet");}
    function readDocumentForm(existing){const label=$("documentLabel").value.trim();if(!label){showToast(t("toast_document_label_required"));return null;}const next=(existing&&typeof existing==="object")?Object.assign({},existing):{id:financeId("doc")};next.label=label;const type=$("documentType").value,status=$("documentStatus").value,reference=$("documentReference").value.trim(),url=$("documentUrl").value.trim(),note=$("documentNote").value.trim();next.type=Finance.DOCUMENT_TYPES.indexOf(type)!==-1?type:"other";if(Finance.DOCUMENT_STATUSES.indexOf(status)!==-1)next.status=status;else delete next.status;if(reference)next.reference=reference;else delete next.reference;if(url)next.url=url;else delete next.url;if(note)next.note=note;else delete next.note;return{next,linkSpec:readLinkSelection($("documentLink").value)};}
    function saveDocument(){const trip=operationsTrip();if(!trip)return;const index=rowIndexByStableId(trip.documents,_editingDocumentId),existing=index>=0?trip.documents[index]:null;if(_editingDocumentId&&!existing)return;const read=readDocumentForm(existing);if(!read)return;const ok=commitState(()=>{applyLinkToRecord(read.next,read.linkSpec,trip);if(!Array.isArray(trip.documents))trip.documents=[];if(_editingDocumentId===null)trip.documents.push(read.next);else trip.documents[index]=read.next;});if(!ok)return;closeDocumentSheet();renderDocumentsHub();renderCurrentView();if($("overviewSheet").classList.contains("open")&&trip.id===activeTripId)renderOverview();showToast(t("toast_document_saved"));}
    function deleteDocument(){const trip=operationsTrip();if(!trip||_editingDocumentId===null||!Array.isArray(trip.documents))return;const index=rowIndexByStableId(trip.documents,_editingDocumentId);if(index<0)return;if(!commitState(()=>{trip.documents.splice(index,1);if(!trip.documents.length)delete trip.documents;}))return;closeDocumentSheet();renderDocumentsHub();renderCurrentView();showUndoToast(t("toast_document_deleted"));}


    /* ══════════════════════════════════════════════════════════════════
       TRIP-BOARD-001 (v1200): whole-trip agenda + traveller checklist.
       Read-only agenda uses existing Today/Logistics models. Checklist data
       is trip-owned and local-only; it never leaves the device unless the
       user exports a normal TripMaster backup. */
    let _tripBoardTripId = null;
    let _tripBoardTab = "agenda";
    let _tripTaskFilter = "open";

    /* ══════════════════════════════════════════════════════════════════
       TRIP BRIEF (v2000): local command summary + privacy-safe share text.
       The shared/copied representation deliberately excludes confirmation
       codes, booking references, notes and exact financial amounts. */
    let _tripBriefTripId = null;
    function tripBriefTrip(){return trips.find(x=>x.id===_tripBriefTripId)||getActiveTrip();}
    function tripBriefDateRangeText(trip){
      const range=tripDateRange(trip);if(!range)return t("overview_fact_unset");
      const f=d=>formatDateOnly(d,{day:"numeric",month:"short",year:"numeric"})||d;
      return range.first===range.last?f(range.first):f(range.first)+" – "+f(range.last);
    }
    function tripBriefSafeText(trip){
      if(!trip)return "";
      const lines=[trip.name||"TripMaster"];
      const dest=tripDestination(trip),range=tripDateRange(trip),readiness=tripReadiness(trip),stats=tripTaskStats(trip);
      if(dest)lines.push(t("trip_brief_destination")+": "+dest);
      if(range)lines.push(t("trip_brief_dates")+": "+tripBriefDateRangeText(trip));
      const stays=tripStays(trip).map(stayInfo).filter(x=>x.status!=="cancelled");
      if(stays.length){lines.push("");lines.push(t("trip_brief_section_logistics")+":");stays.forEach(st=>{const bits=["🏨 "+(st.name||t("stay_unnamed"))];if(st.startDate||st.endDate)bits.push(flowPairText(st.startDate||"…", st.endDate||"…"));if(st.location)bits.push(st.location);lines.push("- "+bits.join(" · "));});}
      const journeys=tripJourneys(trip).map(journeyInfo).filter(x=>x.status!=="cancelled");
      journeys.forEach(j=>{const bits=["🚆 "+flowPairText(j.origin||"…", j.destination||"…")];if(j.date)bits.push(j.date);if(j.provider)bits.push(j.provider);if(j.serviceNumber)bits.push(j.serviceNumber);lines.push("- "+bits.join(" · "));});
      lines.push("");lines.push(t("trip_brief_section_readiness")+": "+(readiness.rows.length?tf("trip_brief_readiness_counts",{issues:readiness.issues,actions:readiness.actions}):t("trip_brief_readiness_ready")));
      lines.push(t("trip_brief_open_tasks")+": "+stats.open);
      lines.push(t("trip_brief_docs_needed")+": "+Finance.documentNeedsAttention(trip).length);
      lines.push(t("trip_brief_booking_attention")+": "+Finance.bookingAttentionEntries(trip,Logistics).length);
      return lines.join("\n");
    }
    function briefFactRow(label,value){const row=document.createElement("div");row.className="overview-fact";const k=document.createElement("span");k.className="overview-fact-key";k.textContent=label;const v=document.createElement("span");v.className="overview-fact-val";v.textContent=String(value);row.appendChild(k);row.appendChild(v);return row;}
    function briefSection(title){const card=document.createElement("section");card.className="overview-card trip-brief-card";const h=document.createElement("div");h.className="overview-card-title";h.textContent=title;card.appendChild(h);return card;}
    function renderTripBrief(){
      const trip=tripBriefTrip(),body=$("tripBriefBody"),status=$("tripBriefStatus");if(!body||!status)return;body.innerHTML="";
      if(!trip){status.textContent=t("trip_brief_no_trip");return;}
      const range=tripDateRange(trip),readiness=tripReadiness(trip),taskStats=tripTaskStats(trip),budget=Finance.budgetSummary(trip);
      status.textContent=readiness.rows.length?tf("trip_brief_readiness_counts",{issues:readiness.issues,actions:readiness.actions}):t("trip_brief_readiness_ready");
      const tripCard=briefSection(t("trip_brief_section_trip"));tripCard.appendChild(briefFactRow(t("trip_brief_destination"),tripDestination(trip)||t("overview_fact_unset")));tripCard.appendChild(briefFactRow(t("trip_brief_dates"),tripBriefDateRangeText(trip)));tripCard.appendChild(briefFactRow(t("trip_brief_days"),range?((dateDiffDays(range.first,range.last)||0)+1):0));body.appendChild(tripCard);
      const logisticsCard=briefSection(t("trip_brief_section_logistics"));logisticsCard.appendChild(briefFactRow(t("trip_brief_stays"),tripStays(trip).filter(x=>stayInfo(x).status!=="cancelled").length));logisticsCard.appendChild(briefFactRow(t("trip_brief_journeys"),tripJourneys(trip).filter(x=>journeyInfo(x).status!=="cancelled").length));logisticsCard.appendChild(briefFactRow(t("trip_brief_booking_attention"),Finance.bookingAttentionEntries(trip,Logistics).length));body.appendChild(logisticsCard);
      const taskCard=briefSection(t("trip_brief_section_tasks"));taskCard.appendChild(briefFactRow(t("trip_brief_open_tasks"),taskStats.open));taskCard.appendChild(briefFactRow(t("trip_brief_docs_needed"),Finance.documentNeedsAttention(trip).length));body.appendChild(taskCard);
      const moneyCard=briefSection(t("trip_brief_section_money"));moneyCard.appendChild(briefFactRow(t("trip_brief_budget"),budget.active?formatMoneyAmount(budget.comparableSpent,budget.budget.currency)+" / "+formatMoneyAmount(budget.budget.amount,budget.budget.currency):t("overview_fact_unset")));body.appendChild(moneyCard);
    }
    function openTripBriefSheet(tripId){const trip=trips.find(x=>x.id===tripId)||getActiveTrip();if(!trip)return;_tripBriefTripId=trip.id;renderTripBrief();openSheetEl("tripBriefSheet");}
    function closeTripBriefSheet(){_tripBriefTripId=null;closeSheetEl("tripBriefSheet");}
    async function copyTripBrief(){const text=tripBriefSafeText(tripBriefTrip());if(!text)return;try{await navigator.clipboard.writeText(text);showToast(t("trip_brief_copied"));}catch(_){const ta=document.createElement("textarea");ta.value=text;ta.setAttribute("readonly","");ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();try{document.execCommand("copy");showToast(t("trip_brief_copied"));}catch(__){}ta.remove();}}
    async function shareTripBrief(){const trip=tripBriefTrip(),text=tripBriefSafeText(trip);if(!trip||!text)return;try{if(navigator.share){await navigator.share({title:trip.name||"TripMaster",text});showToast(t("trip_brief_shared"));return;}}catch(err){if(err&&err.name==="AbortError")return;}await copyTripBrief();showToast(t("trip_brief_share_fallback"));}

    function tripBoardTrip() { return trips.find(x => x.id === _tripBoardTripId) || null; }
    let _editingTaskId = null;
    function newTaskId() { return newTripId("task"); }
    function cancelTripTaskEdit(){
      _editingTaskId=null;if($("tripTaskInput"))$("tripTaskInput").value="";if($("tripTaskDate"))$("tripTaskDate").value="";if($("tripTaskPriority"))$("tripTaskPriority").value="normal";if($("tripTaskCancelEditBtn"))$("tripTaskCancelEditBtn").hidden=true;if($("tripTaskAddBtn"))$("tripTaskAddBtn").textContent=t("trip_task_add_btn");
    }
    function beginTripTaskEdit(raw){
      const info=Operations.taskInfo(raw);if(!info.id)return;_editingTaskId=info.id;$("tripTaskInput").value=info.title;$("tripTaskDate").value=info.date;$("tripTaskPriority").value=info.priority;$("tripTaskCancelEditBtn").hidden=false;$("tripTaskAddBtn").textContent=t("trip_task_save_edit");try{$("tripTaskInput").focus();}catch(_){}
    }
    function tripAgendaDates(trip) {
      const dates = new Set();
      (trip && Array.isArray(trip.days) ? trip.days : []).forEach(d => { if (d && d.date) dates.add(d.date); });
      tripJourneys(trip).forEach(raw => { const j=journeyInfo(raw); if(j.date)dates.add(j.date); if(j.arrivalDate)dates.add(j.arrivalDate); });
      tripStays(trip).forEach(raw => { const st=stayInfo(raw); if(st.startDate)dates.add(st.startDate); if(st.endDate)dates.add(st.endDate); });
      return Array.from(dates).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x)).sort();
    }
    function boardEventSearchValues(event, trip) {
      const values=[event&&event.title||"",event&&event.startTime||"",event&&event.endTime||""];
      if(!event||!event.source)return values;
      if(event.source.kind==="activity"&&Number.isInteger(event.source.dayIndex)&&Number.isInteger(event.source.itemIndex)){
        const item=trip.days&&trip.days[event.source.dayIndex]&&trip.days[event.source.dayIndex].items&&trip.days[event.source.dayIndex].items[event.source.itemIndex];
        if(item)values.push(itemLocation(item),itemNote(item),itemCategory(item));
      } else if(event.source.kind==="stay"&&Number.isInteger(event.source.index)){
        const st=stayInfo(tripStays(trip)[event.source.index]); values.push(st.name,st.location,st.provider);
      } else if(event.source.kind==="journey"&&Number.isInteger(event.source.index)){
        const j=journeyInfo(tripJourneys(trip)[event.source.index]); values.push(j.origin,j.destination,j.provider,j.serviceNumber,j.mode);
      }
      return values;
    }
    function setTripBoardTab(tab) {
      _tripBoardTab = ["agenda","tasks","attention"].includes(tab) ? tab : "agenda";
      if(_tripBoardTab!=="tasks"&&_editingTaskId)cancelTripTaskEdit();
      const agenda=$("tripBoardAgendaSection"), tasks=$("tripBoardTasksSection"), attention=$("tripBoardAttentionSection");
      if(agenda)agenda.hidden=_tripBoardTab!=="agenda";
      if(tasks)tasks.hidden=_tripBoardTab!=="tasks";
      if(attention)attention.hidden=_tripBoardTab!=="attention";
      document.querySelectorAll("#tripBoardTabs [data-board-tab]").forEach(btn=>{const on=btn.dataset.boardTab===_tripBoardTab;btn.classList.toggle("on",on);btn.setAttribute("aria-pressed",on?"true":"false");});
      renderTripBoard();
    }
    function openTripBoardSheet(tripId, tab) {
      const trip=trips.find(x=>x.id===tripId)||getActiveTrip(); if(!trip)return;
      cancelTripTaskEdit();_tripBoardTripId=trip.id; _tripBoardTab=["tasks","attention"].includes(tab)?tab:"agenda"; _tripTaskFilter="open";
      if($("tripBoardSearch"))$("tripBoardSearch").value="";
      renderTripBoard(); setTripBoardTab(_tripBoardTab); openSheetEl("tripBoardSheet");
    }
    function closeTripBoardSheet(){ cancelTripTaskEdit();_tripBoardTripId=null; closeSheetEl("tripBoardSheet"); }
    function renderTripBoardSummary(trip){
      const el=$("tripBoardSummary"); if(!el)return; const stats=tripTaskStats(trip), dates=tripAgendaDates(trip);
      el.textContent=tf("trip_board_summary",{days:dates.length,activities:(trip.days||[]).reduce((n,d)=>n+((d.items&&d.items.length)||0),0),tasks:stats.open});
    }
    function renderTripBoardAgenda(trip){
      const wrap=$("tripBoardAgenda"); if(!wrap)return; wrap.innerHTML="";
      const query=$("tripBoardSearch")?$("tripBoardSearch").value:""; let visible=0;
      tripAgendaDates(trip).forEach(date=>{
        const events=Today.buildEvents(trip,date).filter(e=>e.kind!=="travel");
        const filtered=events.filter(e=>Operations.matchesText(query,boardEventSearchValues(e,trip)));
        if(query && !filtered.length)return;
        const section=document.createElement("section"); section.className="trip-board-day";
        const head=document.createElement("div"); head.className="trip-board-day-head";
        const title=document.createElement("strong"); title.textContent=formatDateOnly(date,{weekday:"short",day:"numeric",month:"short"})||date;
        const count=document.createElement("span"); count.textContent=tf("trip_board_day_items",{n:filtered.length}); head.appendChild(title);head.appendChild(count);section.appendChild(head);
        const list=document.createElement("div"); list.className="trip-board-day-list";
        filtered.forEach(event=>{
          visible++;
          const btn=document.createElement("button");btn.type="button";btn.className="trip-board-event";
          const time=document.createElement("span");time.className="trip-board-event-time";time.textContent=event.startTime||"—";
          const copy=document.createElement("span");copy.className="trip-board-event-copy";const strong=document.createElement("strong");strong.textContent=(todayEventIcon(event.kind)+" "+(event.title||todayEventKindLabel(event.kind))).trim();
          const meta=document.createElement("small");const bits=todayEventMeta(event,trip,hasAccessPlanningNeeds());meta.textContent=bits.join(" · ");copy.appendChild(strong);if(meta.textContent)copy.appendChild(meta);btn.appendChild(time);btn.appendChild(copy);
          btn.addEventListener("click",()=>{if(trip.id!==activeTripId)switchTrip(trip.id,{silent:true});closeTripBoardSheet();todayOpenDetails(event,trip);});list.appendChild(btn);
        });
        if(!filtered.length&&!query){const empty=document.createElement("div");empty.className="logistics-empty";empty.textContent=t("trip_board_day_empty");list.appendChild(empty);}
        section.appendChild(list);wrap.appendChild(section);
      });
      if(!visible&&query){const empty=document.createElement("div");empty.className="logistics-empty";empty.textContent=t("trip_board_no_results");wrap.appendChild(empty);}
      if(!tripAgendaDates(trip).length){const empty=document.createElement("div");empty.className="logistics-empty";empty.textContent=t("trip_board_empty");wrap.appendChild(empty);}
    }
    function taskDueLabel(info){
      const state=Operations.taskDueState(info,todayISO());
      if(state==="overdue") return "⚠️ "+t("trip_task_overdue");
      if(state==="today") return "⏰ "+t("trip_task_due_today");
      if(info.date) return formatDateOnly(info.date,{day:"numeric",month:"short"})||info.date;
      return "";
    }
    function taskPriorityLabel(priority){return priority==="high"?t("trip_task_priority_high"):priority==="low"?t("trip_task_priority_low"):t("trip_task_priority_normal");}
    function renderTripBoardTasks(trip){
      const wrap=$("tripBoardTasks"), progress=$("tripTaskProgress"); if(!wrap)return;wrap.innerHTML="";const allRows=Operations.sortedTasks(trip,todayISO()),stats=tripTaskStats(trip);const rows=allRows.filter(x=>_tripTaskFilter==="all"||(_tripTaskFilter==="done"?x.info.done:!x.info.done));
      if(progress)progress.textContent=stats.total?tf("trip_task_progress_due",{done:stats.done,total:stats.total,overdue:stats.overdue||0,today:stats.dueToday||0}):t("trip_task_none");
      document.querySelectorAll("#tripTaskFilters [data-task-filter]").forEach(btn=>{const on=btn.dataset.taskFilter===_tripTaskFilter;btn.classList.toggle("on",on);btn.setAttribute("aria-pressed",on?"true":"false");});
      rows.forEach(({raw,index,info})=>{const due=Operations.taskDueState(info,todayISO());const row=document.createElement("div");row.className="trip-task-row"+(info.done?" done":"")+(due==="overdue"?" overdue":"")+(due==="today"?" due-today":"")+(info.priority==="high"?" priority-high":"");
        const toggle=document.createElement("button");toggle.type="button";toggle.className="trip-task-toggle";toggle.setAttribute("aria-label",info.done?t("trip_task_mark_open"):t("trip_task_mark_done"));toggle.textContent=info.done?"✓":"○";
        const copy=document.createElement("span");copy.className="trip-task-copy";const title=document.createElement("span");title.className="trip-task-title";title.textContent=info.title;copy.appendChild(title);
        const meta=document.createElement("small");meta.className="trip-task-meta";const bits=[];const dueLabel=taskDueLabel(info);if(dueLabel)bits.push(dueLabel);if(info.priority!=="normal")bits.push(taskPriorityLabel(info.priority));meta.textContent=bits.join(" · ");if(meta.textContent)copy.appendChild(meta);
        const edit=document.createElement("button");edit.type="button";edit.className="trip-task-edit";edit.setAttribute("aria-label",t("trip_task_edit"));edit.textContent="✏️";
        const del=document.createElement("button");del.type="button";del.className="trip-task-delete";del.setAttribute("aria-label",t("trip_task_delete"));del.textContent="🗑";
        toggle.addEventListener("click",()=>{if(!commitState(()=>{const row=(trip.tasks||[]).find(x=>x.id===info.id);if(row)row.done=!row.done;}))return;renderTripBoard();renderCurrentView();});
        edit.addEventListener("click",()=>beginTripTaskEdit(raw));
        del.addEventListener("click",()=>{if(_editingTaskId===info.id)cancelTripTaskEdit();if(!commitState(()=>{const currentIndex=rowIndexByStableId(trip.tasks,info.id);if(currentIndex<0)return;trip.tasks.splice(currentIndex,1);if(!trip.tasks.length)delete trip.tasks;},{type:"task-delete"}))return;renderTripBoard();renderCurrentView();showUndoToast(t("trip_task_deleted"));});
        row.appendChild(toggle);row.appendChild(copy);row.appendChild(edit);row.appendChild(del);wrap.appendChild(row);
      });
      if(!rows.length){const empty=document.createElement("div");empty.className="logistics-empty";empty.textContent=allRows.length?t("trip_task_filter_empty"):t("trip_task_none");wrap.appendChild(empty);}
    }
    function attentionDetailRows(trip,area){
      const out=[];
      if(area==="schedule"){
        (trip.days||[]).forEach((day,dayIndex)=>{const scheduleItems=scheduleRelevantItems(day),analysis=DayIntel.analyzeDay(scheduleItems),date=formatDateOnly(day.date,{day:"numeric",month:"short"})||day.date||"—";
          analysis.conflicts.forEach(c=>{const a=scheduleItems[c.firstIndex]||{},b=scheduleItems[c.secondIndex]||{};out.push({level:"issue",dayIndex,text:tf("attention_detail_overlap",{date,first:a.title||"—",second:b.title||"—",n:c.overlapMin})});});
          analysis.entries.filter(e=>e.invalidRange||e.malformedStart||e.malformedEnd).forEach(e=>out.push({level:"issue",dayIndex,text:tf("attention_detail_invalid_time",{date,title:(e.item&&e.item.title)||"—"})}));
          analysis.pairs.filter(p=>p.status==="insufficient").forEach(pair=>{const a=scheduleItems[pair.firstIndex]||{},b=scheduleItems[pair.secondIndex]||{},short=Math.max(0,Math.abs(pair.bufferMin||0));out.push({level:"issue",dayIndex,text:tf("attention_detail_travel_short",{date,first:a.title||"—",second:b.title||"—",n:short})});});
        });
      } else if(area==="logistics"){
        Logistics.stayOverlaps(trip).forEach(pair=>{const a=stayInfo(pair[0]),b=stayInfo(pair[1]);out.push({level:"issue",text:tf("attention_detail_stay_overlap",{first:a.name||a.location||"—",second:b.name||b.location||"—"})});});
        const dates=Logistics.overnightDates((trip.days||[]).map(d=>d&&d.date));Logistics.uncoveredDates(trip,dates).forEach(date=>out.push({level:"issue",kind:"stay-gap",date,text:tf("attention_detail_stay_gap",{date:formatDateOnly(date,{day:"numeric",month:"short"})||date})}));
      } else if(area==="tasks"){
        Operations.sortedTasks(trip,todayISO()).filter(x=>Operations.taskDueState(x.info,todayISO())==="overdue").forEach(x=>out.push({level:"issue",text:tf("attention_detail_task_overdue",{title:x.info.title,date:formatDateOnly(x.info.date,{day:"numeric",month:"short"})||x.info.date})}));
      }
      return out.slice(0,12);
    }
    function openAttentionDetail(trip,detail,area){
      closeTripBoardSheet();if(trip.id!==activeTripId)switchTrip(trip.id,{silent:true});
      if(detail&&detail.kind==="stay-gap"&&openMissingStayEditor(trip,detail.date))return;
      if(Number.isInteger(detail&&detail.dayIndex)){currentView="planner";days=trip.days||[];currentDayIndex=Math.max(0,Math.min(detail.dayIndex,Math.max(0,days.length-1)));renderCurrentView();updateHeaderInfo();return;}
      openReadinessArea(area,trip);
    }
    function renderTripBoardAttention(trip){
      const wrap=$("tripBoardAttention"),summary=$("tripBoardAttentionSummary");if(!wrap)return;wrap.innerHTML="";const rows=readinessEntries(trip);const issues=rows.filter(r=>r.level==="issue").length,actions=rows.filter(r=>r.level==="action").length;
      if(summary)summary.textContent=rows.length?tf("trip_board_attention_summary",{issues,actions}):t("trip_board_attention_clear");
      if(!rows.length){const empty=document.createElement("div");empty.className="logistics-empty";empty.textContent=t("trip_board_attention_clear");wrap.appendChild(empty);return;}
      const order=["schedule","logistics","bookings","money","documents","tasks","access","setup"];
      order.forEach(area=>{const areaRows=rows.filter(r=>r.area===area);if(!areaRows.length)return;const group=document.createElement("section");group.className="trip-board-attention-group";const head=document.createElement("div");head.className="trip-board-attention-head";const title=document.createElement("strong");title.textContent=readinessAreaLabel(area);const btn=document.createElement("button");btn.type="button";btn.className="btn btn-muted compact-btn";btn.textContent=t(areaRows.some(r=>r.level==="issue")?"readiness_review_action":"readiness_open_action");btn.addEventListener("click",()=>{closeTripBoardSheet();if(trip.id!==activeTripId)switchTrip(trip.id,{silent:true});openReadinessArea(area,trip);});head.appendChild(title);head.appendChild(btn);group.appendChild(head);areaRows.forEach(entry=>{const row=document.createElement("div");row.className="planning-issue readiness-row readiness-"+entry.level;row.textContent="• "+entry.text;group.appendChild(row);});
        attentionDetailRows(trip,area).forEach(detail=>{const row=document.createElement("button");row.type="button";row.className="attention-detail-row readiness-"+detail.level;row.textContent=detail.text;row.addEventListener("click",()=>openAttentionDetail(trip,detail,area));group.appendChild(row);});wrap.appendChild(group);});
    }
    function renderTripBoard(){const trip=tripBoardTrip();if(!trip)return;renderTripBoardSummary(trip);if(_tripBoardTab==="tasks")renderTripBoardTasks(trip);else if(_tripBoardTab==="attention")renderTripBoardAttention(trip);else renderTripBoardAgenda(trip);}
    function addTripTask(){
      const trip=tripBoardTrip(),input=$("tripTaskInput");if(!trip||!input)return;const title=input.value.trim();if(!title){showToast(t("trip_task_required"));return;}const date=$("tripTaskDate")?$("tripTaskDate").value:"",priority=$("tripTaskPriority")?$("tripTaskPriority").value:"normal",editingId=_editingTaskId;
      if(editingId&&!trip.tasks?.some(x=>Operations.taskInfo(x).id===editingId)){cancelTripTaskEdit();showToast(t("trip_task_edit_missing"));return;}
      if(!commitState(()=>{if(!Array.isArray(trip.tasks))trip.tasks=[];if(editingId){const task=trip.tasks.find(x=>Operations.taskInfo(x).id===editingId);if(!task)return;task.title=title;task.priority=["low","normal","high"].includes(priority)?priority:"normal";if(/^\d{4}-\d{2}-\d{2}$/.test(date))task.date=date;else delete task.date;}else{const task={id:newTaskId(),title,done:false,createdAt:new Date().toISOString(),priority:["low","normal","high"].includes(priority)?priority:"normal"};if(/^\d{4}-\d{2}-\d{2}$/.test(date))task.date=date;trip.tasks.push(task);}}))return;
      cancelTripTaskEdit();renderTripBoard();renderCurrentView();showToast(t(editingId?"trip_task_updated":"trip_task_added"));
    }

    /* ══════════════════════════════════════════════════════════════════
       OVERVIEW-001 (v1040 / C1): read-only whole-trip view
       ══════════════════════════════════════════════════════════════════ */
    function openOverviewSheet() {
      renderOverview();
      openSheetEl("overviewSheet");
    }
    function closeOverviewSheet() { closeSheetEl("overviewSheet"); }

    function renderOverview() {
      const body = $("overviewBody");
      const meta = $("overviewMeta");
      if (!body || !meta) return;
      body.innerHTML = "";

      const trip = getActiveTrip();
      if (!trip) {
        meta.textContent = t("overview_no_trip");
        const empty = document.createElement("div");
        empty.className = "overview-empty";
        empty.innerHTML = `<div class="overview-empty-title">${escapeHtml(t("home_choose_trip"))}</div>`;
        body.appendChild(empty);
        return;
      }
      const tripDays = trip.days || [];
      const total = tripDays.reduce((sum, d) => sum + ((d.items && d.items.length) || 0), 0);
      const bits = [trip.name];
      const dest = tripDestination(trip);
      if (dest) bits.push(dest);
      bits.push(tf("overview_summary", { d: tripDays.length, n: total }));

      const base = tripBase(trip);
      const overviewStays = tripStays(trip);
      if (overviewStays.length) bits.push(tf("overview_stays_count", { n: overviewStays.length }));
      else if (base.name || base.location) bits.push((base.name || t("trip_base_section")) + (base.location ? " · " + base.location : ""));
      meta.textContent = bits.join(" · ");

      /* v1100 READINESS-2: one actionable control centre rather than a flat
         warning list. Every open item is grouped by the product surface that
         can actually resolve it, so the user can move from "what is wrong"
         to "where do I fix it" without hunting through the app. */
      const readiness = tripReadiness(trip);
      const readinessCard = document.createElement("div");
      readinessCard.className = "overview-card readiness-center-card readiness-" + readiness.level;
      const readinessHead = document.createElement("div");
      readinessHead.className = "readiness-center-head";
      const readinessCopy = document.createElement("div");
      const readinessTitle = document.createElement("div"); readinessTitle.className = "overview-card-title"; readinessTitle.textContent = t("readiness_center_title");
      const readinessSummary = document.createElement("div"); readinessSummary.className = "overview-card-note";
      readinessSummary.textContent = readiness.issues
        ? tf("readiness_center_issue_summary", { issues:readiness.issues, actions:readiness.actions })
        : readiness.actions ? tf("readiness_center_actions_summary", { actions:readiness.actions }) : t("readiness_ready_detail");
      readinessCopy.appendChild(readinessTitle); readinessCopy.appendChild(readinessSummary);
      const readinessStatus = document.createElement("div"); readinessStatus.className = "readiness-status readiness-" + readiness.level; readinessStatus.textContent = readinessLabel(readiness.level);
      readinessHead.appendChild(readinessCopy); readinessHead.appendChild(readinessStatus); readinessCard.appendChild(readinessHead);
      if (readiness.rows.length) {
        const order = ["schedule","logistics","bookings","money","documents","tasks","access","setup"];
        order.forEach(area => {
          const areaRows = readiness.rows.filter(row => row.area === area);
          if (!areaRows.length) return;
          const group = document.createElement("section"); group.className = "readiness-area";
          const groupHead = document.createElement("div"); groupHead.className = "readiness-area-head";
          const groupTitle = document.createElement("strong"); groupTitle.textContent = readinessAreaLabel(area);
          const btn = document.createElement("button"); btn.type = "button"; btn.className = "btn btn-muted compact-btn readiness-area-btn"; btn.textContent = t(areaRows.some(row => row.level === "issue") ? "readiness_review_action" : "readiness_open_action"); btn.addEventListener("click", () => openReadinessArea(area, trip));
          groupHead.appendChild(groupTitle); groupHead.appendChild(btn); group.appendChild(groupHead);
          const list = document.createElement("div"); list.className = "planning-issues";
          areaRows.forEach(entry => { const row=document.createElement("div"); row.className="planning-issue readiness-row readiness-"+entry.level; row.textContent="• "+entry.text; list.appendChild(row); });
          group.appendChild(list); readinessCard.appendChild(group);
        });
      }
      body.appendChild(readinessCard);

      /* ══ OVERVIEW-002 (v1050-RC2): pre-trip control centre ══
         Three compact cards before the day-by-day list: the trip facts, the
         saved mobility profile, and the planning status. Facts are read
         straight from the trip; nothing here is inferred, and a fact the
         user has not entered is shown as "not set" rather than guessed. */
      const facts = [
        [t("overview_fact_destination"), dest || null],
        [t("overview_fact_dates"), (function () {
          const range = tripDateRange(trip);
          if (!range) return null;
          const f = (d) => formatDateOnly(d, { day: "numeric", month: "short", year: "numeric" }) || d;
          return range.first === range.last ? f(range.first) : f(range.first) + " – " + f(range.last);
        })()],
        [t("overview_fact_timezone"), tripTimezone(trip) || null],
        [t("overview_fact_base"), overviewStays.length
          ? tf("overview_stays_count", { n: overviewStays.length })
          : ((base.name || base.location) ? (base.name || "") + (base.name && base.location ? " · " : "") + (base.location || "") : null)],
        [t("overview_fact_days"), tf("overview_summary", { d: tripDays.length, n: total })]
      ];
      const factCard = document.createElement("div");
      factCard.className = "overview-card";
      const factTitle = document.createElement("div");
      factTitle.className = "overview-card-title";
      factTitle.textContent = t("overview_card_trip");
      factCard.appendChild(factTitle);
      facts.forEach(([label, value]) => {
        const row = document.createElement("div");
        row.className = "overview-fact" + (value ? "" : " is-unset");
        const k = document.createElement("span"); k.className = "overview-fact-key"; k.textContent = label;
        const v = document.createElement("span"); v.className = "overview-fact-val";
        v.textContent = value || t("overview_fact_unset");
        row.appendChild(k); row.appendChild(v);
        factCard.appendChild(row);
      });
      body.appendChild(factCard);

      if (overviewStays.length) {
        const stayCard=document.createElement("div"); stayCard.className="overview-card";
        const title=document.createElement("div"); title.className="overview-card-title"; title.textContent=t("overview_card_stays"); stayCard.appendChild(title);
        overviewStays.map((raw,index)=>({raw,index,info:stayInfo(raw)}))
          .sort((a,b)=>(a.info.startDate||"9999").localeCompare(b.info.startDate||"9999"))
          .forEach(({raw,info})=>{
            const row=document.createElement("div"); row.className="overview-logistics-row";
            const main=document.createElement("div"); main.className="overview-travel-day-title"; main.textContent="🏨 " + (info.name || t("stay_unnamed")); row.appendChild(main);
            const bits=[]; if(info.startDate||info.endDate) bits.push(flowPairText(info.startDate||"…", info.endDate||"…")); if(info.location) bits.push(info.location); if(info.status) bits.push(bookingStatusLabel(info.status)); const pay=Finance.paymentStatus(raw&&raw.paymentStatus); if(pay)bits.push(paymentStatusLabel(pay));
            if(info.confirmation) bits.push(t("booking_reference_short")+": "+info.confirmation);
            const detail=document.createElement("div"); detail.className="overview-card-note"; detail.textContent=bits.join(" · ")||t("overview_fact_unset"); row.appendChild(detail); stayCard.appendChild(row);
          });
        body.appendChild(stayCard);
      }

      const overviewJourneys=tripJourneys(trip);
      if (overviewJourneys.length) {
        const journeyCard=document.createElement("div"); journeyCard.className="overview-card";
        const title=document.createElement("div"); title.className="overview-card-title"; title.textContent=t("overview_card_journeys"); journeyCard.appendChild(title);
        overviewJourneys.map(raw=>({raw,info:journeyInfo(raw)}))
          .sort((a,b)=>(a.info.date||"9999").localeCompare(b.info.date||"9999") || (a.info.departureTime||"").localeCompare(b.info.departureTime||""))
          .forEach(({raw,info})=>{
            const row=document.createElement("div"); row.className="overview-logistics-row";
            const main=document.createElement("div"); main.className="overview-travel-day-title"; main.textContent="🚆 " + flowPairText(info.origin||"…", info.destination||"…"); row.appendChild(main);
            const bits=[]; if(info.date)bits.push(info.arrivalDate&&info.arrivalDate!==info.date?flowPairText(info.date, info.arrivalDate):info.date); if(info.mode)bits.push(journeyModeLabel(info.mode)); if(info.departureTime||info.arrivalTime)bits.push(flowPairText(info.departureTime||"…", info.arrivalTime||"…")); if(info.status)bits.push(bookingStatusLabel(info.status)); const pay=Finance.paymentStatus(raw&&raw.paymentStatus);if(pay)bits.push(paymentStatusLabel(pay)); if(info.serviceNumber)bits.push(info.serviceNumber); if(info.confirmation)bits.push(t("booking_reference_short")+": "+info.confirmation);
            const detail=document.createElement("div"); detail.className="overview-card-note"; detail.textContent=bits.join(" · ")||t("overview_fact_unset"); row.appendChild(detail); journeyCard.appendChild(row);
          });
        body.appendChild(journeyCard);
      }

      const travelDays = tripDays.filter(isTravelDay);
      if (travelDays.length) {
        const travelCard = document.createElement("div");
        travelCard.className = "overview-card";
        const tt = document.createElement("div");
        tt.className = "overview-card-title"; tt.textContent = t("overview_card_travel_days");
        travelCard.appendChild(tt);
        travelDays.forEach((day) => {
          const row = document.createElement("div"); row.className = "overview-travel-day";
          const title = document.createElement("div"); title.className = "overview-travel-day-title";
          title.textContent = dayTypeIcon(dayType(day)) + " " + dayTypeLabel(dayType(day)) + " · " + formatDateForTitle(day.date, day.date || "");
          row.appendChild(title);
          const parts = travelDaySummaryParts(day);
          const detail = document.createElement("div"); detail.className = "overview-card-note";
          detail.textContent = parts.length ? parts.join(" · ") : t("travel_day_type_only");
          row.appendChild(detail);
          travelCard.appendChild(row);
        });
        body.appendChild(travelCard);
      }


      const bookingRowsOverview=Finance.bookingEntries(trip,Logistics);
      if(bookingRowsOverview.length){
        const card=document.createElement("div");card.className="overview-card overview-operations-card";
        const title=document.createElement("div");title.className="overview-card-title";title.textContent=t("overview_card_bookings");card.appendChild(title);
        const attention=Finance.bookingAttentionEntries(trip,Logistics).length;const note=document.createElement("div");note.className="overview-card-note";note.textContent=tf("overview_bookings_summary",{n:bookingRowsOverview.length})+(attention?" · "+tf("overview_booking_attention_short",{n:attention}):"");card.appendChild(note);
        const btn=document.createElement("button");btn.type="button";btn.className="btn btn-muted compact-btn";btn.textContent=t("booking_center_btn");btn.addEventListener("click",()=>openBookingCenterSheet(trip.id));card.appendChild(btn);body.appendChild(card);
      }

      const moneyActive=Finance.budgetTrackingActive(trip)||Finance.expenseTrackingActive(trip);
      if(moneyActive){
        const card=document.createElement("div");card.className="overview-card overview-operations-card";const title=document.createElement("div");title.className="overview-card-title";title.textContent=t("overview_card_money");card.appendChild(title);
        const bs=Finance.budgetSummary(trip),totals=Finance.totalsByCurrency(trip);const note=document.createElement("div");note.className="overview-card-note";
        if(bs.active)note.textContent=t("budget_recorded")+": "+formatMoneyAmount(bs.comparableSpent,bs.budget.currency)+" / "+formatMoneyAmount(bs.budget.amount,bs.budget.currency);else note.textContent=totals.map(v=>formatMoneyAmount(v.amount,v.currency)).join(" · ");card.appendChild(note);
        const btn=document.createElement("button");btn.type="button";btn.className="btn btn-muted compact-btn";btn.textContent=t("money_manage_btn");btn.addEventListener("click",()=>openMoneySheet(trip.id));card.appendChild(btn);body.appendChild(card);
      }

      const derivedDocsOverview=Finance.derivedConfirmationDocuments(trip,Logistics), standaloneDocsOverview=tripDocuments(trip);
      if(derivedDocsOverview.length||standaloneDocsOverview.length){
        const card=document.createElement("div");card.className="overview-card overview-operations-card";const title=document.createElement("div");title.className="overview-card-title";title.textContent=t("overview_card_documents");card.appendChild(title);
        const needed=Finance.documentNeedsAttention(trip).length;const note=document.createElement("div");note.className="overview-card-note";note.textContent=tf("overview_documents_summary",{n:derivedDocsOverview.length+standaloneDocsOverview.length})+(needed?" · "+tf("overview_documents_needed_short",{n:needed}):"");card.appendChild(note);
        const btn=document.createElement("button");btn.type="button";btn.className="btn btn-muted compact-btn";btn.textContent=t("documents_manage_btn");btn.addEventListener("click",()=>openDocumentsSheet(trip.id));card.appendChild(btn);body.appendChild(card);
      }


      const mobility = mobilitySummaryLabels(trip);
      if (mobility.length) {
        const mob = document.createElement("div");
        mob.className = "overview-card";
        const mt = document.createElement("div");
        mt.className = "overview-card-title"; mt.textContent = t("overview_card_mobility");
        mob.appendChild(mt);
        const chips = document.createElement("div"); chips.className = "planning-chips";
        mobility.forEach(label => { const c = document.createElement("span"); c.className = "planning-chip"; c.textContent = label; chips.appendChild(c); });
        mob.appendChild(chips);
        const note = document.createElement("div");
        note.className = "overview-card-note"; note.textContent = t("overview_mobility_note");
        mob.appendChild(note);
        body.appendChild(mob);
      }

      if (hasAccessPlanningNeeds()) {
        const st = tripPlanningStats(trip);
        const accessCard = document.createElement("div");
        accessCard.className = "overview-card";
        const at = document.createElement("div"); at.className = "overview-card-title"; at.textContent = t("overview_card_access");
        accessCard.appendChild(at);
        const chips = document.createElement("div"); chips.className = "planning-chips";
        const addAccessChip = (text, cls) => { const c=document.createElement("span"); c.className="planning-chip"+(cls?" "+cls:""); c.textContent=text; chips.appendChild(c); };
        if (st.accessVerified) addAccessChip(tf("overview_access_verified", { n: st.accessVerified }), "access-good");
        if (st.accessIssues) addAccessChip(tf("overview_access_issues_short", { n: st.accessIssues }), "access-issue");
        if (chips.childNodes.length) accessCard.appendChild(chips);
        const note = document.createElement("div"); note.className = "overview-card-note"; note.textContent = t("overview_access_profile_note_v2500");
        accessCard.appendChild(note);
        const accessBtn=document.createElement("button");accessBtn.type="button";accessBtn.className="btn btn-muted compact-btn";accessBtn.textContent=t("access_manage_profile");accessBtn.addEventListener("click",()=>openAccessProfile(trip));accessCard.appendChild(accessBtn);
        body.appendChild(accessCard);
      }

      if (!tripDays.length) {
        const empty = document.createElement("div");
        empty.className = "overview-empty";
        empty.innerHTML =
          `<div class="overview-empty-title">${escapeHtml(t("overview_empty"))}</div>` +
          `<div class="overview-empty-sub">${escapeHtml(t("overview_empty_sub"))}</div>`;
        body.appendChild(empty);
        return;
      }

      tripDays.forEach((day, index) => {
        const block = document.createElement("div");
        block.className = "overview-day";

        const head = document.createElement("div");
        head.className = "overview-day-head";
        head.textContent = formatDateForTitle(day.date, tf("day_n", { n: index + 1 }))
          + (isTravelDay(day) ? " · " + dayTypeIcon(dayType(day)) + " " + dayTypeLabel(dayType(day)) : "")
          + " · " + tf("timeline_activities_count", { n: (day.items && day.items.length) || 0 });
        block.appendChild(head);
        if (isTravelDay(day)) {
          const parts = travelDaySummaryParts(day);
          if (parts.length) {
            const td = document.createElement("div"); td.className = "overview-day-travel"; td.textContent = parts.join(" · "); block.appendChild(td);
          }
        }
        if (logisticsTrackingActive(trip)) {
          const logisticBits=[];
          Logistics.staysEndingOn(trip,day.date).forEach(raw=>{const st=stayInfo(raw); logisticBits.push("↗ "+t("day_logistics_checkout")+": "+(st.name||st.location||t("overview_fact_unset")));});
          Logistics.journeysForDate(trip,day.date).forEach(raw=>{const j=journeyInfo(raw); logisticBits.push("🚆 "+flowPairText(j.origin||"…", j.destination||"…")+(j.departureTime||j.arrivalTime?" · "+flowPairText(j.departureTime||"…", j.arrivalTime||"…"):""));});
          Logistics.staysStartingOn(trip,day.date).forEach(raw=>{const st=stayInfo(raw); logisticBits.push("↘ "+t("day_logistics_checkin")+": "+(st.name||st.location||t("overview_fact_unset")));});
          if (!logisticBits.length && Logistics.staysTrackingActive(trip)) {
            const baseLabel=effectiveBaseLabelForDate(trip,day.date); if(baseLabel) logisticBits.push("🏨 "+t("day_logistics_base")+": "+baseLabel);
          }
          if(logisticBits.length){const lg=document.createElement("div");lg.className="overview-day-logistics";logisticBits.forEach(text=>{const r=document.createElement("div");r.textContent=text;lg.appendChild(r);});block.appendChild(lg);}
        }
        const analysis = DayIntel.analyzeDay(scheduleRelevantItems(day));
        const healthBits = [];
        if (analysis.conflicts.length) healthBits.push(tf("day_health_conflicts", { n: analysis.conflicts.length }));
        const badTimes = analysis.invalidRangeCount + analysis.malformedCount;
        if (badTimes) healthBits.push(tf("day_health_invalid_time", { n: badTimes }));
        const insufficientTravel = analysis.pairs.filter(pair => pair.status === "insufficient").length;
        if (insufficientTravel) healthBits.push(tf("day_health_travel_insufficient", { n: insufficientTravel }));
        if (analysis.travelUnresolved) healthBits.push(tf("day_health_travel_unknown", { n: analysis.travelUnresolved }));
        if (healthBits.length) {
          const health=document.createElement("div"); health.className="overview-day-health"; health.textContent=healthBits.join(" · "); block.appendChild(health);
        }

        const items = (day.items || []).slice()
          .sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")));

        if (!items.length) {
          const none = document.createElement("div");
          none.className = "overview-row-empty";
          none.textContent = isTravelDay(day) ? t("overview_travel_day_empty") : t("overview_day_empty");
          block.appendChild(none);
        } else {
          items.forEach((item) => {
            const row = document.createElement("div");
            row.className = "overview-row" + (item.completed ? " completed" : "");
            const end = itemEndTime(item);
            row.innerHTML =
              `<div class="overview-time">${escapeHtml(item.time || "--:--")}` +
              (end ? `<span class="overview-time-end">${escapeHtml(end)}${itemEndsNextDay(item) ? " +1" : ""}</span>` : "") +
              `</div>` +
              `<div class="overview-item">` +
                `<div class="overview-item-title">${escapeHtml(getCategoryIcon(item))} ${escapeHtml(item.title || "")}</div>` +
                (itemLocation(item)
                  ? `<div class="overview-item-loc">📍 ${escapeHtml(itemLocation(item))}</div>` : "") +
                accessBadgeHtml(item) +
                (itemAccessNote(item) ? `<div class="access-note-line">♿ ${escapeHtml(itemAccessNote(item))}</div>` : "") +
                (itemBookingInfo(item).status ? `<div class="booking-note-line">🎟️ ${escapeHtml(bookingStatusLabel(itemBookingInfo(item).status))}${itemBookingInfo(item).reference ? " · " + escapeHtml(itemBookingInfo(item).reference) : ""}</div>` : "") +
              `</div>`;
            block.appendChild(row);
          });
        }
        body.appendChild(block);
      });
    }

    /* ══════════════════════════════════════════════════════════════════
       ACCESS-PROFILE-001 (v1040 / D5): the saved profile, shown back
       ──────────────────────────────────────────────────────────────────
       settings.access has been write-only since v1020 — the user filled it
       in and never saw it again. This echoes it during planning. It makes no
       judgement about any activity, and the note under it says exactly that,
       because TripMaster has no verified accessibility data for any venue.
       ══════════════════════════════════════════════════════════════════ */
    function renderAccessProfile() {
      const strip = $("accessProfileStrip");
      const chips = $("accessProfileChips");
      if (!strip || !chips) return;
      chips.innerHTML = "";

      const access = (settings && settings.access) || {};
      const prefs  = (settings && settings.prefs)  || {};
      const labels = [];
      if (access.stepFree)        labels.push(t("access_stepfree"));
      if (access.avoidStairs)     labels.push(t("access_avoidstairs"));
      if (access.elevatorNeeded)  labels.push(t("access_elevator"));
      if (access.shortWalks)      labels.push(t("access_shortwalks"));
      if (access.companion)       labels.push(t("access_companion"));
      if (access.quietPreference) labels.push(t("access_quiet"));
      if (access.wheelchair === "manual")   labels.push(t("access_profile_wc_manual"));
      if (access.wheelchair === "electric") labels.push(t("access_profile_wc_electric"));
      if (prefs.maxWalkKm != null && !isNaN(prefs.maxWalkKm)) {
        labels.push(tf("access_profile_maxwalk", { n: prefs.maxWalkKm }));
      }

      const freeNote = typeof access.notes === "string" ? access.notes.trim() : "";
      if (!labels.length && !freeNote) { strip.style.display = "none"; return; }
      labels.forEach((label) => {
        const chip = document.createElement("span");
        chip.className = "access-profile-chip";
        chip.textContent = label;
        chips.appendChild(chip);
      });
      let noteBox = strip.querySelector(".access-profile-note-value");
      if (freeNote) {
        if (!noteBox) { noteBox = document.createElement("div"); noteBox.className = "access-profile-note-value"; strip.appendChild(noteBox); }
        noteBox.textContent = t("access_profile_saved_note") + ": " + freeNote;
      } else if (noteBox) noteBox.remove();
      strip.style.display = "";
    }

    /* ── A11Y-001 (v1040 / D6): close the right sheet the right way ──
       Routing by id rather than blindly stripping the class keeps each
       sheet's pending-callback cleanup intact, so dismissing a confirmation
       with Escape or the backdrop can never leave an armed destructive
       callback behind. */
    function closeAnySheet(id) {
      switch (id) {
        case "sheet":             closeSheet(); return;
        case "aiSheet":           closeAISheet(); return;
        case "newTripSheet":      closeNewTripSheet(); return;
        case "firstDaySheet":     closeFirstDaySheet(); return;
        case "dayDetailsSheet":   closeDayDetailsSheet(); return;
        case "menuSheet":         closeMenuSheet(); return;
        case "languageSheet":     closeLanguageSelector(); return;
        case "aboutSheet":        closeAboutSheet(); return;
        case "tripDetailsSheet":  closeTripDetailsSheet(); return;
        case "logisticsSheet":    closeLogisticsSheet(); return;
        case "staySheet":         closeStaySheet(); return;
        case "journeySheet":      closeJourneySheet(); return;
        case "bookingCenterSheet": closeBookingCenterSheet(); return;
        case "moneySheet":        closeMoneySheet(); return;
        case "expenseSheet":      closeExpenseSheet(); return;
        case "documentsSheet":    closeDocumentsSheet(); return;
        case "tripBoardSheet":     closeTripBoardSheet(); return;
        case "tripBriefSheet":     closeTripBriefSheet(); return;
        case "safetyCenterSheet":  closeSafetyCenter(); return;
        case "documentSheet":     closeDocumentSheet(); return;
        case "overviewSheet":     closeOverviewSheet(); return;
        case "confirmDeleteActivitySheet": closeConfirmSheet(id); _pendingDeleteActivity = null; return;
        case "confirmDeleteDaySheet":      closeConfirmSheet(id); _pendingDeleteDay = null; return;
        case "confirmDeleteTripSheet":     closeConfirmSheet(id); _pendingDeleteTrip = null; return;
        case "confirmResetSheet":          closeConfirmSheet(id); _pendingReset = null; return;
        case "confirmRestoreSheet":        closeConfirmSheet(id); _pendingRestore = null; return;
        default: closeConfirmSheet(id);
      }
    }

    function showUpdateBanner(forceReload){
      const el=$("updateBanner");if(!el)return;
      if(forceReload===true)_reloadRequiredForVersion=true;
      if(topOpenSheet()){_pendingUpdateReady=true;return;}
      const forced=_reloadRequiredForVersion===true;
      const title=el.querySelector(".update-banner-copy strong"),body=el.querySelector(".update-banner-copy span"),later=$("updateLaterBtn");
      if(title)title.textContent=t(forced?"update_reload_required_title":"update_ready_title");
      if(body)body.textContent=t(forced?"update_reload_required_body":"update_ready_body");
      if(later)later.hidden=forced;
      el.hidden=false;
    }
    function hideUpdateBanner(){if(_reloadRequiredForVersion)return;_pendingUpdateReady=false;const el=$("updateBanner");if(el)el.hidden=true;}

    window.addEventListener("popstate", (event) => {
      if (!_backGuardArmed) return;
      // Forward navigation into our guard is not a product Back action.
      if (event && event.state && event.state.tripmasterGuard === 1) return;
      const top = topOpenSheet();
      if (top) {
        closeAnySheet(top.id);
        rearmBackGuard();
        return;
      }
      if (currentView === "today") {
        continueFromTodayToPlanner();
        rearmBackGuard();
        return;
      }
      if (currentView === "planner") {
        goHome({ silent:true });
        rearmBackGuard();
        return;
      }
      // Home is the root product surface. The second back leaves the current
      // document (or closes an installed PWA when the platform owns Back).
      _backGuardArmed = false;
      window.setTimeout(() => { try { history.back(); } catch (_) {} }, 0);
    });

    /* ══════════════════════════════════════
       EVENT LISTENERS
    ══════════════════════════════════════ */

    // Header menu toggle
    // MENU-001 (v1020 fix): the hamburger now opens the product menu sheet.
    window.addEventListener("tripmaster:update-ready", () => showUpdateBanner(false));
    window.addEventListener("tripmaster:reload-required", () => showUpdateBanner(true));
    if ($("updateLaterBtn")) $("updateLaterBtn").addEventListener("click", hideUpdateBanner);
    window.addEventListener("tripmaster:update-apply-failed", () => {
      const btn=$("updateReloadBtn"); if(btn)btn.disabled=false;
      showUpdateBanner(false);
    });
    if ($("updateReloadBtn")) $("updateReloadBtn").addEventListener("click", () => {
      const btn=$("updateReloadBtn"); if(btn)btn.disabled=true;
      if(_reloadRequiredForVersion){window.location.reload();return;}
      window.dispatchEvent(new CustomEvent("tripmaster:apply-update"));
    });
    if ($("todayAlertsBtn")) $("todayAlertsBtn").addEventListener("click", requestTodayAlerts);

    $("settingsToggle").addEventListener("click", openMenuSheet);
    $("menuSheetClose").addEventListener("click", closeMenuSheet);
    if ($("languageQuickBtn")) $("languageQuickBtn").addEventListener("click", openLanguageSelector);
    if ($("languageSheetClose")) $("languageSheetClose").addEventListener("click", closeLanguageSelector);

    // Theme
    /* STORE-001 (v1040 / A7): the theme is a real user preference, so a
       failed write must not leave the screen dark and the storage light.
       The attribute is applied only after the write is confirmed. */
    $("themeBtn").addEventListener("click", () => {
      if (!guardPreferenceWrite("theme")) return;
      const cur = document.documentElement.getAttribute("data-theme");
      const next = cur === "dark" ? "light" : "dark";
      if (!writeAll([[KEY_THEME, next]])) { reportStorageFailure(); return; }
      _themeStorageToken = next;
      if (next === "dark") document.documentElement.setAttribute("data-theme", "dark");
      else document.documentElement.removeAttribute("data-theme");
    });

    // HOMEHUB-001 (v1050-RC2): Trips === Home. goHome() keeps activeTripId
    // (HOME-STATE-001), so this is navigation, not a change of selection.
    $("homeNavBtn").addEventListener("click", () => {
      if (currentView === "home") { renderCurrentView(); return; }
      goHome();
    });

    // New trip
    $("newTripBtn").addEventListener("click", () => {
      closeMenuSheet();
      openNewTripSheet();
    });
    $("newTripSheetClose").addEventListener("click", closeNewTripSheet);
    $("newTripCancelBtn").addEventListener("click", closeNewTripSheet);
    $("newTripConfirmBtn").addEventListener("click", () => {
      const name = $("newTripNameInput").value.trim();
      if (!name) { showToast(t("toast_missing_trip_name")); return; }
      // STORE-001 (v1040 / A7): createTrip() returns null when the write
      // failed and has already rolled itself back and told the user.
      if (!createTrip(name)) return;
      const activeTrip = getActiveTrip();
      if (activeTrip) days = activeTrip.days;
      currentDayIndex = 0;
      renderCurrentView();
      updateHeaderInfo();
      closeNewTripSheet();
      $("newTripNameInput").value = "";
      showToast(t("toast_trip_created"));
    });

    // First day sheet
    $("firstDaySheetClose").addEventListener("click", closeFirstDaySheet);
    $("firstDayCancelBtn").addEventListener("click", closeFirstDaySheet);
    $("firstDayConfirmBtn").addEventListener("click", () => {
      const selectedDate = $("firstDayDateInput").value;
      if (!selectedDate) { showToast(t("toast_missing_date")); return; }
      // STORE-001 (v1040 / A7): guarded, same as addNewDay().
      if (!commitState(() => {
        days.push({ id:newTripId("day"), date: selectedDate, items: [] });
        currentDayIndex = days.length - 1;
      })) return;
      renderDays();
      renderActivities(currentDayIndex);
      closeFirstDaySheet();
      showToast(tf("toast_day_added", { n: days.length }));
    });

    // Travel Day / day details
    $("dayDetailsBtn").addEventListener("click", openDayDetailsSheet);
    $("dayDetailsClose").addEventListener("click", closeDayDetailsSheet);
    $("dayDetailsCancelBtn").addEventListener("click", closeDayDetailsSheet);
    $("dayDetailsSaveBtn").addEventListener("click", saveDayDetails);
    $("dayDuplicateBtn").addEventListener("click", duplicateCurrentDayPlan);
    $("dayTypeSelect").addEventListener("change", updateTravelDayFieldsVisibility);

    // Home
    $("homeBtn").addEventListener("click", () => {
      closeMenuSheet();
      goHome();
    });

    // Settings inputs
    // Reset
    $("resetBtn").addEventListener("click", () => {
      // MENU-003 (v1020 RC3): utility actions no longer auto-close the menu.
      // The confirm sheet stacks above it, and after a reset the next likely
      // action is Restore — which is right here in the same menu.
      confirmReset(() => {
        // v2400 RC2: never snapshot/reset a stale in-memory view after an
        // external window has changed storage. Adopt newest state and require
        // a fresh deliberate reset attempt.
        if(!guardExternalStateBeforeWrite())return;
        if(!guardPreferenceStateBeforeDestructiveWrite())return;
        /* SNAPSHOT-001 (v1040 / A6): recoverable local copy first, and no
           reset at all if it cannot be written. */
        if (!writeSafetySnapshot("reset")) { showToast(t("toast_snapshot_failed")); return; }
        const undoState    = snapshotState();
        const undoSettings = JSON.stringify(settings);
        const undoTheme    = localStorage.getItem(KEY_THEME) || "light";
        /* ── I18N-RESET-001 (v1030 RC2) ──
           UI language is an APP-level preference, not trip data, so Reset
           must not change it. Captured BEFORE settings are rebuilt, and
           validated with the same active-language rule normalizeSettings()
           uses, so a stale or inactive value still lands on Hebrew instead
           of being carried through. */
        const preservedLang =
          (LANG_META[currentLang] && LANG_META[currentLang].active) ? currentLang : DEFAULT_LANG;
        // SETTINGS-NORM-001 (v1020): rebuild from the shared default so a reset
        // restores the full shape (prefs/access) instead of a partial object.
        // RC2: seeded with the preserved language; every other branch still
        // comes from DEFAULT_SETTINGS, so nothing else survives the reset.
        const nextSettings = normalizeSettings({ language: preservedLang });
        /* I18N-RESET-001 (v1030 RC2): KEY_SETTINGS is WRITTEN, not removed.
           Removing it made the next boot fall back to DEFAULT_SETTINGS —
           that is precisely why the language reverted to Hebrew after a
           refresh. v1040: the other keys are written empty rather than
           removed too, so the whole reset is one rollback-able batch
           instead of four independent deletes that could half-succeed. */
        const wiped = writeAll([
          [KEY_TRIPS, JSON.stringify([])],
          [KEY_ACTIVE_TRIP, ""],
          [KEY_DAYS, JSON.stringify([])],
          [KEY_SETTINGS, JSON.stringify(settingsForStorage(nextSettings))],
          [KEY_THEME, "light"]
        ]);
        if (!wiped) { reportStorageFailure(); return; }

        days = []; trips = []; activeTripId = null; currentView = "home"; currentDayIndex = 0;
        resetAIForTripContextChange();
        settings = nextSettings;
        setUndo(undoState, { settings: undoSettings, theme: undoTheme });

        updatePreferenceStorageTokens();
        renderCurrentView();
          renderPrefsAndAccess();   // v1020: clear the new controls too
        // I18N-001 (v1030): keep currentLang and settings.language in sync.
        // With the RC2 fix this is a no-op repaint rather than a switch.
        currentLang = settings.language;
        applyLanguage();
        renderTools();
        /* RESET-NAME-001 (v1040 / E3): the header used to be forced to the
           untranslated literal "My Trip", which appeared in no other screen
           and in no language. updateHeaderInfo() already renders the product
           name when no trip is active, so the literal is simply gone. */
        updateHeaderInfo();
        document.documentElement.removeAttribute("data-theme");
        showUndoToast(t("toast_reset_done"));
      });
    });

    // Export text
    $("exportBtn").addEventListener("click", async () => {
      // MENU-003 (v1020 RC3): stays open; the result is a toast, not a screen.
      let text = "";
      // EXPORT-001 (v1040 / B8, D4): structured fields, still a plain text
      // itinerary — not a document generator.
      const exportTrip = getActiveTrip();
      if (exportTrip) {
        text += `${exportTrip.name}\n`;
        const dest = tripDestination(exportTrip);
        if (dest) text += `${t("trip_destination_label")}: ${dest}\n`;
        const tz = tripTimezone(exportTrip);
        if (tz) text += `${t("trip_timezone_label")}: ${tz}\n`;
        const base = tripBase(exportTrip);
        if (base.name) text += `${t("trip_base_name_label")}: ${base.name}\n`;
        if (base.location) text += `${t("trip_base_location_label")}: ${base.location}\n`;
        if (base.note) text += `${t("trip_base_note_label")}: ${base.note}\n`;
        const hasSensitiveExport = Finance.bookingEntries(exportTrip,Logistics).some(r=>r.reference||r.url) || tripDocuments(exportTrip).some(raw=>{const d=Finance.documentInfo(raw);return !!(d.reference||d.url);});
        if (hasSensitiveExport) text += `⚠️ ${t("export_confirmation_note")}\n`;
        const exportStays=tripStays(exportTrip);
        if (exportStays.length) {
          text += `\n${t("export_stays_heading")}\n`;
          exportStays.map(raw=>({raw,info:stayInfo(raw)})).sort((a,b)=>(a.info.startDate||"9999").localeCompare(b.info.startDate||"9999")).forEach(({raw,info:st})=>{
            text += `🏨 ${st.name || t("stay_unnamed")}${st.startDate||st.endDate ? " · " + flowPairText(st.startDate||"…", st.endDate||"…") : ""}\n`;
            if(st.location) text += `  📍 ${st.location}\n`;
            if(st.checkInTime) text += `  ${t("stay_checkin_time")}: ${st.checkInTime}\n`;
            if(st.checkOutTime) text += `  ${t("stay_checkout_time")}: ${st.checkOutTime}\n`;
            if(st.status) text += `  ${t("booking_status_label")}: ${bookingStatusLabel(st.status)}\n`;
            const stayPay=Finance.paymentStatus(raw&&raw.paymentStatus); if(stayPay) text += `  ${t("payment_status_label")}: ${paymentStatusLabel(stayPay)}\n`;
            if(st.provider) text += `  ${t("booking_provider_label")}: ${st.provider}\n`;
            if(st.confirmation) text += `  ${t("booking_reference_label")}: ${st.confirmation}\n`;
            if(st.bookingUrl) text += `  ${t("stay_booking_url_label")}: ${st.bookingUrl}\n`;
            if(st.note) text += `  📝 ${st.note}\n`;
          });
        }
        const exportJourneys=tripJourneys(exportTrip);
        if (exportJourneys.length) {
          text += `\n${t("export_journeys_heading")}\n`;
          exportJourneys.map(raw=>({raw,info:journeyInfo(raw)})).sort((a,b)=>(a.info.date||"9999").localeCompare(b.info.date||"9999") || (a.info.departureTime||"").localeCompare(b.info.departureTime||"")).forEach(({raw,info:j})=>{
            text += `🚆 ${j.date ? j.date + " · " : ""}${flowPairText(j.origin||"…", j.destination||"…")}${j.mode ? " · " + journeyModeLabel(j.mode) : ""}\n`;
            if(j.departureTime||j.arrivalTime) text += `  ${t("travel_day_departure_time")}: ${j.departureTime||"…"} · ${t("travel_day_arrival_time")}: ${j.arrivalTime||"…"}${j.arrivalDate&&j.arrivalDate!==j.date?" · "+t("journey_arrival_date")+": "+j.arrivalDate:""}\n`;
            if(j.provider) text += `  ${t("journey_provider_label")}: ${j.provider}\n`;
            if(j.serviceNumber) text += `  ${t("journey_service_label")}: ${j.serviceNumber}\n`;
            if(j.status) text += `  ${t("booking_status_label")}: ${bookingStatusLabel(j.status)}\n`;
            const journeyPay=Finance.paymentStatus(raw&&raw.paymentStatus); if(journeyPay) text += `  ${t("payment_status_label")}: ${paymentStatusLabel(journeyPay)}\n`;
            if(j.confirmation) text += `  ${t("booking_reference_label")}: ${j.confirmation}\n`;
            if(j.note) text += `  📝 ${j.note}\n`;
          });
        }
        const exportExpenses=tripExpenses(exportTrip);
        const exportBudget=Finance.budgetInfo(exportTrip);
        if(exportExpenses.length || (exportBudget.amount!=null&&exportBudget.currency)){
          text += `\n${t("export_money_heading")}\n`;
          if(exportBudget.amount!=null&&exportBudget.currency) text += `${t("budget_title")}: ${formatMoneyAmount(exportBudget.amount,exportBudget.currency)}\n`;
          const totals=Finance.totalsByCurrency(exportTrip); if(totals.length) text += `${t("money_recorded_totals")}: ${totals.map(v=>formatMoneyAmount(v.amount,v.currency)).join(" · ")}\n`;
          exportExpenses.map(Finance.expenseInfo).forEach((e)=>{
            text += `💳 ${e.title || t("expense_unnamed")} · ${e.amount!=null&&e.currency?formatMoneyAmount(e.amount,e.currency):""} · ${expenseCategoryLabel(e.category)}\n`;
            if(e.date) text += `  ${t("field_date")}: ${e.date}\n`; if(e.paymentStatus) text += `  ${t("payment_status_label")}: ${paymentStatusLabel(e.paymentStatus)}\n`; if(e.paidBy) text += `  ${t("expense_paid_by_label")}: ${e.paidBy}\n`; if(e.note) text += `  📝 ${e.note}\n`;
          });
        }
        const standaloneDocs=tripDocuments(exportTrip);
        if(standaloneDocs.length){
          text += `\n${t("export_documents_heading")}\n`;
          standaloneDocs.map(Finance.documentInfo).forEach((d)=>{text += `📄 ${d.label || t("document_unnamed")} · ${documentTypeLabel(d.type)}${d.status?" · "+(d.status==="needed"?t("document_status_needed"):t("document_status_available")):""}\n`;if(d.reference)text += `  ${t("booking_reference_label")}: ${d.reference}\n`;if(d.url)text += `  ${t("document_url_label")}: ${d.url}\n`;if(d.note)text += `  📝 ${d.note}\n`;});
        }
        text += "\n";
      }
      days.forEach((day, index) => {
        text += `${tf("export_day_line", { n: index + 1 })}${formatDateForTitle(day.date, "")}${isTravelDay(day) ? " · " + dayTypeLabel(dayType(day)) : ""}\n`;
        if (isTravelDay(day)) {
          const info = dayTravelInfo(day);
          if (info.origin) text += `  ${t("travel_day_origin")}: ${info.origin}\n`;
          if (info.destination) text += `  ${t("travel_day_destination")}: ${info.destination}\n`;
          if (info.mode) text += `  ${t("travel_day_mode")}: ${travelDayModeLabel(info.mode)}\n`;
          if (info.departureTime) text += `  ${t("travel_day_departure_time")}: ${info.departureTime}\n`;
          if (info.arrivalTime) text += `  ${t("travel_day_arrival_time")}: ${info.arrivalTime}\n`;
          if (info.reference) text += `  ${t("travel_day_reference")}: ${info.reference}\n`;
        }
        const flow = dayBaseFlow(day);
        if (flow.startsAtBase) text += `  🏨 ${t("day_starts_at_base")}\n`;
        if (flow.returnsToBase) text += `  🏨 ${t("day_returns_to_base")}\n`;
        (Array.isArray(day.items) ? day.items : []).forEach(item => {
          const end = itemEndTime(item);
          text += `${item.time}${end ? "-" + end : ""} - ${item.title} ${item.completed ? t("export_done") : ""}\n`;
          const loc = itemLocation(item);
          if (loc) text += `  📍 ${loc}\n`;
          const note = itemNote(item);
          if (note) text += `  📝 ${note}\n`;
          const status = itemAccessStatus(item);
          const anote  = itemAccessNote(item);
          if ((status && status !== "needscheck") || anote) {
            const label = (status === "verified" || status === "stepfree") ? t("access_badge_verified")
                        : status === "problem" ? t("access_badge_problem") : "";
            text += `  ♿ ${t("export_access_line")}: ${[label, anote].filter(Boolean).join(" - ")}\n`;
          }
          const booking = itemBookingInfo(item);
          const activityPay = itemPaymentStatus(item);
          if (booking.status || activityPay || booking.reference || booking.provider || booking.note) {
            text += `  🎟️ ${t("activity_booking_section")}${booking.status ? " · " + bookingStatusLabel(booking.status) : ""}${activityPay ? " · " + paymentStatusLabel(activityPay) : ""}\n`;
            if (booking.reference) text += `    ${t("booking_reference_label")}: ${booking.reference}\n`;
            if (booking.provider) text += `    ${t("booking_provider_label")}: ${booking.provider}\n`;
            if (booking.note) text += `    ${t("booking_note_label")}: ${booking.note}\n`;
          }
          const travel = itemTravelFromPrevious(item);
          if (travel.known) {
            const travelBits = [travel.mode ? travelModeLabel(travel.mode) : "", travel.durationMin != null ? formatMinutesCompact(travel.durationMin) : "", travel.note].filter(Boolean);
            if (travelBits.length) text += `  🚶 ${t("travel_export_line")}: ${travelBits.join(" · ")}\n`;
          }
        });
        text += "\n";
      });
      if (navigator.clipboard && window.isSecureContext) {
        try { await navigator.clipboard.writeText(text); showToast(t("toast_copied_clipboard")); }
        catch { showToast(t("toast_copy_error")); }
      } else {
        const ta = document.createElement("textarea");
        ta.value = text; ta.style.cssText = "position:fixed;left:-9999px";
        document.body.appendChild(ta); ta.select();
        try { document.execCommand("copy"); showToast(t("toast_copied")); }
        catch { showToast(t("toast_copy_unavailable")); }
        ta.remove();
      }
    });

    // TODAY-001 / Planner Jump now. The menu's Today entry now opens the
    // operational view; Jump now remains a Planner shortcut.
    $("todayBtn").addEventListener("click", () => { closeMenuSheet(); openToday(); });
    $("todayPlannerBtn").addEventListener("click", continueFromTodayToPlanner);
    $("todayOverviewBtn").addEventListener("click", () => { if(getActiveTrip()) openOverviewSheet(); });
    $("todayPreviewToggleBtn").addEventListener("click", () => {
      const trip=getActiveTrip();if(!trip)return;const c=Today.clock(null,tripTimezone(trip));
      if(todayPreviewMode&&Today.isTripActive(trip,c)){todayPreviewMode=false;todayPreviewDate=c.date;}
      else {todayPreviewMode=true;todayPreviewDate=todayPreviewDate||Today.choosePreviewDate(trip,c.date);}
      renderTodayView();updateHeaderInfo();
    });
    $("todayPreviewSelect").addEventListener("change", () => {
      const value=$("todayPreviewSelect").value;if(!Today.validDate(value))return;todayPreviewMode=true;todayPreviewDate=value;renderTodayView();
    });

    $("jumpNowBtn").addEventListener("click", () => {
      closeMenuSheet();
      const todayIdx = findTodayDayIndex();
      if (todayIdx === -1) { showToast(t("toast_no_today_emoji")); return; }
      currentDayIndex = todayIdx; renderDays(); renderActivities(currentDayIndex);
      setTimeout(() => {
        const nowEl = document.querySelector(".now-item");
        if (nowEl) { nowEl.scrollIntoView({ behavior: preferredScrollBehavior(), block: "center" }); showToast(t("toast_jumped_now")); }
        else showToast(t("toast_no_current"));
      }, 100);
    });
    $("jumpNowBtnHeader") && $("jumpNowBtnHeader").addEventListener("click", () => $("jumpNowBtn").click());

    // Backup / Restore
    $("backupBtn").addEventListener("click", () => {
      // MENU-003 (v1020 RC3): stays open; downloading a file is not navigation.
      exportBackup();
    });
    $("safetyCenterBtn").addEventListener("click", openSafetyCenter);
    $("safetyCenterClose").addEventListener("click", closeSafetyCenter);
    $("safetySnapshotCreateBtn").addEventListener("click", createManualSafetySnapshot);
    $("safetySnapshotRestoreBtn").addEventListener("click", restoreLocalSafetySnapshot);
    $("betaHealthRunBtn").addEventListener("click",()=>{runBetaHealthAudit(true);renderSafetyCenter();});
    $("betaDiagnosticsCopyBtn").addEventListener("click",copyBetaDiagnostics);
    $("betaDiagnosticsDownloadBtn").addEventListener("click",downloadBetaDiagnostics);
    $("betaDiagnosticsClearBtn").addEventListener("click",clearBetaDiagnostics);
    $("safetyBackupDownloadBtn").addEventListener("click", exportBackup);
    $("safetyBackupRestoreBtn").addEventListener("click",()=>$("restoreInput").click());
    $("tripExportBtn").addEventListener("click", downloadTripPackage);
    $("tripShareBtn").addEventListener("click", shareTripPackage);
    $("tripImportBtn").addEventListener("click",()=>$("tripImportInput").click());
    $("tripImportInput").addEventListener("change",event=>{
      const file=event.target.files&&event.target.files[0];if(!file)return;if(file.size>10*1024*1024){showToast(t("trip_import_too_large"));event.target.value="";return;}
      const reader=new FileReader();reader.onload=e=>{try{const payload=JSON.parse(e.target.result);const result=importPortableTripPayload(payload);recordTransferResult("import",result.ok?"passed":result.reason);if(!result.ok){if(result.reason==="storage")reportStorageFailure();else showToast(t("trip_import_invalid"));}else{closeSafetyCenter();showToast(tf("toast_trip_imported",{name:result.trip.name||t("menu_new_trip")}));}}catch(err){recordTransferResult("import","invalid");console.error(err);showToast(t("trip_import_invalid"));}event.target.value="";};reader.onerror=()=>{recordTransferResult("import","invalid");showToast(t("trip_import_invalid"));event.target.value="";};reader.readAsText(file);
    });
    $("restoreBtn").addEventListener("click", () => {
      // MENU-003 (v1020 RC3): stays open behind the file picker and the
      // restore confirmation, so the user is not stranded mid-flow.
      $("restoreInput").click();
    });

    let _pendingRestoreData = null;
    $("restoreInput").addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (!file) { showToast(t("toast_no_file")); return; }
      if(file.size>15*1024*1024){showToast(t("backup_too_large"));event.target.value="";return;}
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const backup = JSON.parse(e.target.result);
          const report=Operations.backupPayloadReport(backup);
          if(!report.valid){recordTransferResult("restore","invalid");console.warn("TripMaster: backup validation rejected",report.errors);showToast(t("toast_bad_backup"));event.target.value="";return;}
          _pendingRestoreData = backup;
          confirmRestore(() => { doRestore(_pendingRestoreData); _pendingRestoreData = null; });
        } catch (err) {
          recordTransferResult("restore","invalid");console.error(err); showToast(t("toast_backup_read_error"));
        }
        event.target.value = "";
      };
      reader.onerror=()=>{recordTransferResult("restore","invalid");showToast(t("toast_backup_read_error"));event.target.value="";};
      reader.readAsText(file);
    });

    // Add activity
    $("addBtn").addEventListener("click", openSheet);
    $("sheetClose").addEventListener("click", closeSheet);

    /* MORE-001 (v1050-RC2): one control, aria-expanded kept truthful. */
    $("addMoreToggle").addEventListener("click", () => {
      const expanded = $("addMoreToggle").getAttribute("aria-expanded") === "true";
      setMoreExpanded(!expanded);
      if (!expanded) {
        // Opening it should put the caret somewhere useful, not leave focus
        // on a control whose label has just changed meaning.
        const first = $("addEndTime");
        if (first) { try { first.focus({ preventScroll: true }); } catch (err) { try { first.focus(); } catch (e2) {} } }
      }
    });
    // The badge must stay honest while the section is open.
    ADVANCED_FIELD_IDS.concat(["addReminder"]).forEach((id) => {
      const el = $(id);
      if (el) el.addEventListener("change", updateMoreBadge);
    });
    $("addCancelBtn").addEventListener("click", closeSheet);
    $("addSaveBtn").addEventListener("click", handleSave);

    $("addDuplicateBtn").addEventListener("click", duplicateEditingActivity);

    // Delete activity from within Edit Activity sheet (reuses existing confirm dialog + delete logic)
    $("addDeleteBtn").addEventListener("click", () => {
      if (!editingItemUid) return;
      const dayId = editingDayId, itemUid = editingItemUid;
      confirmDeleteActivity(() => {
        closeSheet();
        deleteActivityByStableId(dayId, itemUid);
      });
    });

    $("addWithReminderBtn").addEventListener("click", () => {
      if (isSavingActivity) return;
      isSavingActivity = true;
      $("addSaveBtn").disabled = true;
      $("addWithReminderBtn").disabled = true;

      const titleCheck = $("addTitle").value.trim();
      if (!titleCheck) {
        showToast(t("toast_missing_title"));
        isSavingActivity = false;
        $("addSaveBtn").disabled = false;
        $("addWithReminderBtn").disabled = false;
        return;
      }
      // v1040: export the SAVED activity, not the raw form, so location,
      // end time and Access reach the calendar and a rolled-back save never
      // produces an .ics for something that was not stored. Still fully
      // synchronous inside the click, which navigator.share() requires.
      const saved = editingItemUid !== null
        ? editItem()
        : addItem();

      isSavingActivity = false;
      $("addSaveBtn").disabled = false;
      $("addWithReminderBtn").disabled = false;
      if (!saved) return;
      exportActivityToIcs(saved.day, saved.item);
    });

    // GCAL-001 (v1020): mirrors the ICS handler's save-then-hand-off order, so
    // the activity is stored either way and cancelling in Google Calendar can
    // never lose it. Both now share activityTimeSpec() for the times.
    $("addGoogleCalBtn").addEventListener("click", () => {
      if (isSavingActivity) return;
      isSavingActivity = true;
      $("addSaveBtn").disabled = true;
      $("addWithReminderBtn").disabled = true;
      $("addGoogleCalBtn").disabled = true;

      const titleCheck = $("addTitle").value.trim();
      if (!titleCheck) {
        showToast(t("toast_missing_title"));
        isSavingActivity = false;
        $("addSaveBtn").disabled = false;
        $("addWithReminderBtn").disabled = false;
        $("addGoogleCalBtn").disabled = false;
        return;
      }
      const saved = editingItemUid !== null
        ? editItem()
        : addItem();

      isSavingActivity = false;
      $("addSaveBtn").disabled = false;
      $("addWithReminderBtn").disabled = false;
      $("addGoogleCalBtn").disabled = false;
      if (!saved) return;
      exportActivityToGoogle(saved.day, saved.item);
    });

    // AI strip + AI button
    $("aiStripBtn").addEventListener("click", openAISheet);
    $("aiStripBtn").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openAISheet(); } });
    $("aiBtn").addEventListener("click", openAISheet);
    $("aiSheetClose").addEventListener("click", closeAISheet);
    $("aiSendBtn").addEventListener("click", () => runAI());
    $("aiPromptInput").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing) runAI(); });
    $("aiPromptInput").addEventListener("input", () => { delete $("aiPromptInput").dataset.aiIntentHint; });
    document.querySelectorAll(".ai-quick-prompt").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (_activeAIRequest && !_activeAIRequest.settled) return;
        const input=$("aiPromptInput");
        input.value = t(btn.dataset.aiPromptKey);
        input.dataset.aiIntentHint = btn.dataset.aiIntent || "";
        try { input.focus(); } catch (_) {}
      });
    });
    $("aiClearBtn").addEventListener("click", () => {
      $("aiOutput").innerText = t("ai_output_empty");
      $("aiOutput").classList.remove("loading");
      $("aiImportBtn").style.display = "none";
      $("aiPromptInput").value = "";
      delete $("aiPromptInput").dataset.aiIntentHint;
      if (!_activeAIRequest) setAIRequestUi(false, "");
    });
    // Planner Agent is advisory-only. The legacy import control stays hidden
    // and deliberately has no mutation handler.


    /* RC2-A11Y-001: backdrop and keyboard handling operate on the topmost
       modal only. A confirmation stacked over the menu must not collapse the
       menu behind it, and Tab must not escape into the inert background. */
    $("sheetBackdrop").addEventListener("click", () => {
      const top = topOpenSheet();
      if (top) closeAnySheet(top.id);
    });

    function sheetFocusable(el) {
      return Array.prototype.slice.call(el.querySelectorAll(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
      )).filter((node) => node.getAttribute("aria-hidden") !== "true" && node.offsetParent !== null);
    }

    document.addEventListener("keydown", (e) => {
      const top = topOpenSheet();
      if (!top) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closeAnySheet(top.id);
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = sheetFocusable(top);
      if (!focusable.length) {
        e.preventDefault();
        try { top.focus(); } catch (err) {}
        return;
      }
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && (document.activeElement === first || !top.contains(document.activeElement))) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !top.contains(document.activeElement))) {
        e.preventDefault(); first.focus();
      }
    });

    // DAY-DEL-001 (v1040 / A1): the day confirmation's own buttons.
    $("confirmDeleteDayOk").addEventListener("click", () => {
      closeConfirmSheet("confirmDeleteDaySheet");
      if (_pendingDeleteDay) { _pendingDeleteDay(); _pendingDeleteDay = null; }
    });
    $("confirmDeleteDayCancel").addEventListener("click", () => { closeConfirmSheet("confirmDeleteDaySheet"); _pendingDeleteDay = null; });
    $("confirmDeleteDayClose").addEventListener("click",  () => { closeConfirmSheet("confirmDeleteDaySheet"); _pendingDeleteDay = null; });
    $("deleteDayBtn").addEventListener("click", () => requestDeleteDay(currentDayIndex));

    // RC4-HUB-001: visible Planner shortcuts to operational surfaces.
    if ($("plannerReadinessBtn")) $("plannerReadinessBtn").addEventListener("click", openOverviewSheet);
    $("plannerTodayQuick").addEventListener("click", () => openToday());
    $("plannerLogisticsQuick").addEventListener("click", () => { const trip=getActiveTrip(); if(trip) openLogisticsSheet(trip.id); });
    $("plannerBookingsQuick").addEventListener("click", () => { const trip=getActiveTrip(); if(trip) openBookingCenterSheet(trip.id); });
    $("plannerMoneyQuick").addEventListener("click", () => { const trip=getActiveTrip(); if(trip) openMoneySheet(trip.id); });
    $("plannerDocumentsQuick").addEventListener("click", () => { const trip=getActiveTrip(); if(trip) openDocumentsSheet(trip.id); });
    $("plannerBoardQuick").addEventListener("click", () => { const trip=getActiveTrip(); if(trip) openTripBoardSheet(trip.id,"agenda"); });
    $("plannerBriefQuick").addEventListener("click", () => { const trip=getActiveTrip(); if(trip) openTripBriefSheet(trip.id); });
    $("tripBoardClose").addEventListener("click", closeTripBoardSheet);
    $("tripBriefClose").addEventListener("click", closeTripBriefSheet);
    $("tripBriefCopyBtn").addEventListener("click", copyTripBrief);
    $("tripBriefShareBtn").addEventListener("click", shareTripBrief);
    $("tripBoardTabs").addEventListener("click", (e) => { const btn=e.target.closest("[data-board-tab]"); if(btn)setTripBoardTab(btn.dataset.boardTab); });
    $("tripTaskFilters").addEventListener("click", (e) => { const btn=e.target.closest("[data-task-filter]"); if(!btn)return;_tripTaskFilter=["all","open","done"].includes(btn.dataset.taskFilter)?btn.dataset.taskFilter:"open";renderTripBoardTasks(tripBoardTrip()); });
    $("tripTaskCancelEditBtn").addEventListener("click", cancelTripTaskEdit);
    $("tripBoardSearch").addEventListener("input", () => { if(_tripBoardTab==="agenda")renderTripBoardAgenda(tripBoardTrip()); });
    $("tripTaskAddBtn").addEventListener("click", addTripTask);
    $("tripTaskInput").addEventListener("keydown", (e) => { if(e.key==="Enter"){e.preventDefault();addTripTask();} });

    // TRIPMETA-001 (v1040 / B2,B3,C2)
    $("tripDetailsBtn").addEventListener("click", () => {
      closeMenuSheet();
      const active = getActiveTrip();
      if (active) { openTripDetailsSheet(active.id); return; }
      if (trips.length === 0) { openNewTripSheet(); return; }
      if (trips.length === 1) {
        if (switchTrip(trips[0].id, { stayHome: currentView === "home", silent:true })) openTripDetailsSheet(trips[0].id);
        return;
      }
      // HOMEHUB-001: several trips and none active — Home is where you pick.
      showToast(t("home_choose_trip"));
      currentView = "home"; renderCurrentView(); updateHeaderInfo();
    });
    $("tripDetailsClose").addEventListener("click", closeTripDetailsSheet);
    $("tripDetailsCancelBtn").addEventListener("click", closeTripDetailsSheet);
    $("tripDetailsSaveBtn").addEventListener("click", saveTripDetails);
    $("tripDuplicateBtn").addEventListener("click", () => { const trip=trips.find(x=>x.id===_editingTripId); if(!trip)return; closeTripDetailsSheet(); duplicateTrip(trip); });
    $("tripArchiveBtn").addEventListener("click", () => { const trip=trips.find(x=>x.id===_editingTripId); if(!trip)return; setTripArchived(trip,!Operations.isArchivedTrip(trip)); });
    $("tripMoneyBtn").addEventListener("click", () => openMoneySheet(_editingTripId));
    $("tripDocumentsBtn").addEventListener("click", () => openDocumentsSheet(_editingTripId));

    // v1070 logistics hub + editors
    $("logisticsClose").addEventListener("click", closeLogisticsSheet);
    $("addStayBtn").addEventListener("click", () => openStaySheet(null));
    $("addJourneyBtn").addEventListener("click", () => openJourneySheet(null));
    $("staySheetClose").addEventListener("click", closeStaySheet);
    $("stayCancelBtn").addEventListener("click", closeStaySheet);
    $("staySaveBtn").addEventListener("click", saveStay);
    $("stayDeleteBtn").addEventListener("click", deleteStay);
    $("journeySheetClose").addEventListener("click", closeJourneySheet);
    $("journeyCancelBtn").addEventListener("click", closeJourneySheet);
    $("journeySaveBtn").addEventListener("click", saveJourney);
    $("journeyDeleteBtn").addEventListener("click", deleteJourney);

    // v1080 booking, money and document organization
    $("bookingCenterClose").addEventListener("click", closeBookingCenterSheet);
    $("bookingCenterFilters").addEventListener("click", (e) => { const btn=e.target.closest("[data-booking-filter]");if(!btn)return;_bookingCenterFilter=btn.dataset.bookingFilter==="attention"?"attention":"all";renderBookingCenter(); });
    $("moneyClose").addEventListener("click", closeMoneySheet);
    $("moneyFilters").addEventListener("click", (e) => { const btn=e.target.closest("[data-money-filter]");if(!btn)return;_moneyFilter=btn.dataset.moneyFilter==="attention"?"attention":"all";renderMoneyHub(); });
    $("budgetSaveBtn").addEventListener("click", saveBudget);
    $("addExpenseBtn").addEventListener("click", () => openExpenseSheet(null));
    $("expenseSheetClose").addEventListener("click", closeExpenseSheet);
    $("expenseCancelBtn").addEventListener("click", closeExpenseSheet);
    $("expenseSaveBtn").addEventListener("click", saveExpense);
    $("expenseDeleteBtn").addEventListener("click", deleteExpense);
    $("documentsClose").addEventListener("click", closeDocumentsSheet);
    $("documentsFilters").addEventListener("click", (e) => { const btn=e.target.closest("[data-documents-filter]");if(!btn)return;_documentsFilter=btn.dataset.documentsFilter==="needed"?"needed":"all";renderDocumentsHub(); });
    $("addDocumentBtn").addEventListener("click", () => openDocumentSheet(null));
    $("documentSheetClose").addEventListener("click", closeDocumentSheet);
    $("documentCancelBtn").addEventListener("click", closeDocumentSheet);
    $("documentSaveBtn").addEventListener("click", saveDocument);
    $("documentDeleteBtn").addEventListener("click", deleteDocument);

    // OVERVIEW-001 (v1040 / C1)
    $("overviewBtn").addEventListener("click", () => {
      closeMenuSheet();
      if (getActiveTrip()) { openOverviewSheet(); return; }
      if (trips.length === 0) { openNewTripSheet(); return; }
      if (trips.length === 1) {
        if (switchTrip(trips[0].id, { stayHome: currentView === "home", silent:true })) openOverviewSheet();
        return;
      }
      showToast(t("home_choose_trip"));
      currentView = "home"; renderCurrentView(); updateHeaderInfo();
    });
    $("overviewClose").addEventListener("click", closeOverviewSheet);

    // QA button
    $("qaBtn").addEventListener("click", () => {
      closeMenuSheet();
      const checks = [
        Boolean($("addBtn")), Boolean($("activityList")), Boolean($("sheet")),
        Boolean(window.localStorage), typeof escapeHtml === "function", typeof todayISO === "function"
      ];
      showToast(checks.every(Boolean) ? "QA בסיסי עבר ✅" : "QA מצא בעיה ❌");
    });

    // About / Beta feedback
    $("aboutBtn").addEventListener("click", () => {
      closeMenuSheet();
      openAboutSheet();
    });
    $("aboutSheetClose").addEventListener("click", closeAboutSheet);

    $("aboutCopyFeedbackBtn").addEventListener("click", async () => {
      const template = buildFeedbackTemplate();
      try {
        await navigator.clipboard.writeText(template);
        showToast(t("toast_template_copied"));
      } catch (err) {
        console.warn("TripMaster: clipboard copy failed", err);
        showToast(t("toast_copy_manual"));
      }
    });

    $("aboutSendFeedbackBtn").addEventListener("click", () => {
      const subject = encodeURIComponent("TripMaster Beta Feedback — " + APP_VERSION);
      const body = encodeURIComponent(buildFeedbackTemplate());
      const to = encodeURIComponent(FEEDBACK_EMAIL || "");
      window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
    });

    /* ── Init ── */
    if (localStorage.getItem(KEY_THEME) === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    }

    $("headerCity").innerText  = "TripMaster";   // FIELDS-001 (v1020 RC3)

    // I18N-001 (v1030): apply language + direction before the first render
    // so the app never paints in the wrong direction after boot.
    applyLanguage();

    // v1020: Trip Tools / Preferences / Access
    wirePrefsAndAccess();
    renderPrefsAndAccess();
    renderTools();
    // v1040: category picker + Access profile echo.
    renderCategoryOptions();
    renderAccessProfile();

    // HOME-MIG-001: migrate the deprecated Home itinerary before first render.
    // Fresh users have an empty KEY_DAYS and take the no-op path.
    const bootMigration = migrateLegacyHomeDays();
    if (bootMigration.error) console.warn("TripMaster: legacy Home migration deferred");
    ensureStableTripGraphIds();

    let activeTrip = getActiveTrip();
    if (activeTrip && Operations.isArchivedTrip(activeTrip)) {
      if (writeAll([[KEY_ACTIVE_TRIP, ""]])) activeTripId = null;
      activeTrip = null;
    }
    if (activeTripId && !activeTrip && !_unreadableStorageKeys.has(KEY_TRIPS)) {
      // Only a readable canonical graph can establish that a pointer is stale.
      if (writeAll([[KEY_ACTIVE_TRIP, ""]])) activeTripId = null;
      activeTrip = null;
    }
    if (activeTrip) days = activeTrip.days || [];
    else days = [];
    if (!activeTrip) currentView = "home";

    currentDayIndex = 0;
    if (typeof window.__tmBootProgress === "function") window.__tmBootProgress("initial-render");
    renderCurrentView();
    updateHeaderInfo();
    armBackGuard();

    /* BOOT-STATE-003 (v1500 RC2): critical boot ends here.
       At this point storage is loaded, the active trip/view is resolved, all
       core controls have already been wired, and the first usable UI has
       rendered. Mobile/SPCK can still throw in non-critical post-render work
       (toast/lifecycle/reminder registration). Such an error must never cover
       an already-usable app with a fatal boot screen. */
    if (typeof window.__tmBootProgress === "function") window.__tmBootProgress("core-ready");
    document.documentElement.dataset.tmBoot = "ready";
    window.dispatchEvent(new Event("tripmaster:ready"));
    armRuntimeDiagnostics();
    armKeyboardViewport();

    try {
      if (_unreadableStorageKeys.size) { runBetaHealthAudit(false);openSafetyCenter();showToast(t("beta_health_toast_error")); }
      else if (bootMigration.migrated) showToast(t("toast_home_migrated"));
      else showToast(t("toast_ready"));
    } catch (err) {
      console.warn("TripMaster: post-boot toast failed", err);
    }

    /* ── Sleep / Wake lifecycle ──
       ACTIVE-TRIP-001 (v1040 / A4) + STALE-WRITE-001 (v1040 QA):
       this handler used to call saveDays()/saveTrips() on pagehide,
       visibilitychange and beforeunload. That was a rescue path for the era
       when mutations were not reliably persisted at the moment they
       happened. Since every mutation now goes through commitState(), which
       writes and verifies before it renders, the rescue is redundant — and
       it was actively harmful: it wrote THIS page's in-memory trips[] over
       whatever is in storage now. A second tab, a second PWA window, or a
       restore performed elsewhere would be silently overwritten by a stale
       instance going to background. Proven in QA: seeding tm_trips and then
       navigating produced an empty tm_trips, because the unloading page
       flushed its own empty array on top.

       Going to sleep is therefore now a no-op. Waking still RE-READS from
       storage, which is the direction that cannot lose data and which makes
       two instances converge instead of fight. */
    function scheduleExternalStateSync() {
      if(_externalSyncTimer)window.clearTimeout(_externalSyncTimer);
      _externalSyncTimer=window.setTimeout(()=>{
        _externalSyncTimer=null;
        if(document.hidden)return;
        if(topOpenSheet()){showToast(t("toast_external_state_pending"));return;}
        if(!_externalStatePending && !_externalSettingsPending && !_externalThemePending)return;
        if(reloadStateAfterWake())showToast(t("toast_external_state_reloaded"));
      },120);
    }

    function reloadStateAfterWake() {
      // CROSS-WINDOW-EDITOR-002: a wake/pageshow must never replace the arrays
      // backing an open editor. Detect a missed storage event by comparing the
      // token captured when the sheet opened, then defer adoption until close.
      if (canonicalTripStorageToken() !== _observedTripToken || openSheetHasStaleTripToken()) _externalStatePending = true;
      // Frozen/discarded tabs can miss preference storage events too.
      detectMissedPreferenceChanges();
      if (topOpenSheet() && (_externalStatePending || _externalSettingsPending || _externalThemePending)) {
        showToast(t("toast_external_state_pending"));
        return false;
      }

      const hadExternalState = _externalStatePending;
      const hadExternalSettings = _externalSettingsPending;
      const hadExternalTheme = _externalThemePending;
      try {
        trips = normalizeTrips(safeParseJSON(KEY_TRIPS, []));
        activeTripId = localStorage.getItem(KEY_ACTIVE_TRIP) || null;
        // We have now adopted the canonical trip payload. Clear the trip
        // pending flag BEFORE repair/migration writes so their guarded save
        // cannot recursively call reloadStateAfterWake().
        _externalStatePending = false;
        _observedTripToken = canonicalTripStorageToken();
        const wakeMigration = migrateLegacyHomeDays();
        if (wakeMigration.error) console.warn("TripMaster: legacy Home migration deferred on wake");
        ensureStableTripGraphIds();
        let woken = getActiveTrip();
        if (woken && Operations.isArchivedTrip(woken)) { activeTripId=null; days=[]; currentView="home"; woken=null; }
        const req = _activeAIRequest;
        if (aiRequestIsCurrent(req) && (!woken || woken.id !== req.tripId)) resetAIForTripContextChange();
        if (woken) { days = woken.days || []; }
        else { days = []; currentView = "home"; }
        if (currentDayIndex >= days.length) currentDayIndex = 0;

        if (hadExternalSettings) adoptExternalSettingsFromStorage();
        if (hadExternalTheme) adoptExternalThemeFromStorage();

        renderCurrentView(); updateHeaderInfo();
        if (hadExternalState || hadExternalSettings || hadExternalTheme) recordLifecycleEvent("state_sync",{trips:hadExternalState,settings:hadExternalSettings,theme:hadExternalTheme});
        if (hadExternalState) invalidateUndoAfterExternalState();
        _externalStatePending=false;
        _externalSettingsPending=false;
        _externalThemePending=false;
        if(_externalSyncTimer){window.clearTimeout(_externalSyncTimer);_externalSyncTimer=null;}
        return true;
      } catch(e) { console.warn("TripMaster: wake reload failed", e); return false; }
    }

    /* Only the wake direction is wired. There is deliberately no pagehide /
       beforeunload writer: see STALE-WRITE-001 above. */
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        const req = _activeAIRequest;
        if (aiRequestIsCurrent(req)) {
          req.backgrounded = true;
          if (req.timeoutId) { window.clearTimeout(req.timeoutId); req.timeoutId = null; }
          setAIRequestUi(true, t("ai_state_background"));
        }
        return;
      }
      reloadStateAfterWake();
      resumeAIRequestAfterWake();
    });
    window.addEventListener("pageshow", () => { if (!_backGuardArmed) armBackGuard(); reloadStateAfterWake(); resumeAIRequestAfterWake(); });
    window.addEventListener("storage", (event) => {
      if (!event) return;
      if (event.key === KEY_SETTINGS) {
        recordLifecycleEvent("storage_change",{scope:"settings"});
        _externalSettingsPending = true;
        if (!document.hidden) scheduleExternalStateSync();
        return;
      }
      if (event.key === KEY_THEME) {
        recordLifecycleEvent("storage_change",{scope:"theme"});
        _externalThemePending = true;
        if (!document.hidden) scheduleExternalStateSync();
        return;
      }
      if(![KEY_TRIPS,KEY_ACTIVE_TRIP,KEY_DAYS].includes(event.key))return;
      recordLifecycleEvent("storage_change",{scope:"trip"});
      _externalStatePending=true;
      // Invalidate immediately, not only while the pending flag remains set.
      // Auto-sync and wake reloads may clear that flag before the user taps
      // Undo; the snapshot would still be stale and dangerous.
      invalidateUndoAfterExternalState();
      if(!document.hidden)scheduleExternalStateSync();
    });

    /* ── REMINDERS-001 follow-up: lightweight time-based UI refresh ──
       Purely visual re-render so the reminder countdown / "עבר" / "עכשיו" labels can
       appear as the clock moves, even if the user never taps anything.
       Does NOT save data, mutate activities, close sheets, or touch
       localStorage — it only re-renders the currently visible day. */
    setInterval(() => {
      if (document.hidden) return;
      if (currentView === "today") renderTodayView();
      else if (currentView === "planner") renderActivities(currentDayIndex);
    }, 30000);

    // BOOT-STATE-003: non-critical post-render setup completed. The app was
    // already marked ready immediately after its first usable render above.
    if (typeof window.__tmBootProgress === "function") window.__tmBootProgress("post-boot-complete");
  } catch (err) {
    console.error("TripMaster: startup failed", err);
    if (typeof window.__tmBootFail === "function") window.__tmBootFail(err, "app-init");
    else throw err;
  }

  }); // DOMContentLoaded
