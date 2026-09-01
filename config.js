/* TripMaster — config.js
   v1030 RC7: mechanical extraction. These dependency-free constants were
   moved verbatim out of the main inline script in index.html. Loaded as a
   classic script before i18n.js and before the main inline script.
   v1040: APP_VERSION bumped to v1040; CATEGORY_ORDER and TZ_FALLBACK added.
   PARTNER_CONFIG, PARTNERS_LIVE, the storage keys and CATEGORY_ICONS are
   unchanged. */

    const KEY_DAYS        = "tm_days_clean";
    const KEY_SETTINGS    = "tm_settings_clean";
    const KEY_THEME       = "tm_theme_clean";
    const KEY_TRIPS       = "tm_trips";
    const KEY_ACTIVE_TRIP = "tm_active_trip";
    /* SNAPSHOT-001 (v1040 / A6): single overwritten local recovery copy
       written immediately before Reset or Restore. Device-only, never
       uploaded, never part of a backup file, and not version history. */
    const KEY_SAFETY_SNAPSHOT = "tm_safety_snapshot";

    // ── Beta readiness (v1009) ──
    const APP_VERSION = "v1050-RC2-FIX1";
    // Support address for "שלח משוב". Set, so the mailto opens with the To
    // field, subject and body prefilled; the tester still picks which of
    // their own mail accounts sends it. Blank here would leave To empty.
    const FEEDBACK_EMAIL = "tripmaster.app@gmail.com";

    /* ── PARTNER-001 (v1020): inert commercial foundation ──
       Structure only. PARTNERS_LIVE is false, every entry has url: null and
       enabled: false, and renderTools() refuses to make a card interactive
       unless BOTH the master flag and a real https URL are present. No
       affiliate disclosure is shown while nothing is live, because disclosing
       partner links that do not exist is just noise. Config is a frozen
       constant, not localStorage: it is configuration, not user data, so it
       adds no migration or backup surface. ── */
    const PARTNERS_LIVE = false;

    const PARTNER_CONFIG = Object.freeze({
      version: 1,
      disclosure: "חלק מהקישורים הם קישורי שותפים. המחיר עבורכם לא משתנה, וזה עוזר לנו לפתח את TripMaster.",
      partners: Object.freeze([
        { id: "docs_backup", category: "documents", label: "מסמכים וגיבוי",
          description: "גיבוי וייצוא של הטיולים",  icon: "🗂️",
          url: null, enabled: true,  internal: "backup", priority: 10 },
        { id: "esim",        category: "esim",      label: "eSIM",
          description: "חבילות גלישה לחו״ל",       icon: "📶",
          url: null, enabled: false, priority: 20 },
        { id: "insurance",   category: "insurance", label: "ביטוח נסיעות",
          description: "השוואת ביטוחי נסיעות",     icon: "🛡️",
          url: null, enabled: false, priority: 30 },
        { id: "activities",  category: "activities",label: "אטרקציות ופעילויות",
          description: "כרטיסים וסיורים",          icon: "🎟️",
          url: null, enabled: false, priority: 40 },
        { id: "hotels",      category: "hotels",    label: "מלונות",
          description: "לינה ליעד",                icon: "🏨",
          url: null, enabled: false, priority: 50 },
        { id: "luggage",     category: "luggage",   label: "שמירת מזוודות",
          description: "אחסון בין צ׳ק־אין לצ׳ק־אאוט", icon: "🧳",
          url: null, enabled: false, priority: 60 },
        { id: "transport",   category: "transport", label: "תחבורה",
          description: "העברות ונסיעות",           icon: "🚆",
          url: null, enabled: false, priority: 70 },
        { id: "accessibility", category: "accessibility", label: "נגישות",
          description: "שירותים לצרכי נגישות",     icon: "♿",
          url: null, enabled: false, priority: 80 }
      ])
    });

    /* ── Category icons ── */
    const CATEGORY_ICONS = {
      attraction: "🏛", food: "🍴", hotel: "🛏", flight: "✈️",
      shopping: "🛍", transport: "🚇", other: "📌"
    };

    /* ── CATEGORY-001 (v1040) ──
       Render order for the activity "type" picker. item.category was ALREADY
       read first by getCategoryIcon() before this version; it simply had no
       UI, so every icon came from the Hebrew/English title-keyword guess.
       This list gives the field a real control. "" (auto) keeps the legacy
       keyword guess, so existing activities are completely unaffected.
       Keys must stay in sync with CATEGORY_ICONS above and with the
       cat_* translation keys in i18n.js. ── */
    const CATEGORY_ORDER = Object.freeze([
      "attraction", "food", "hotel", "flight", "shopping", "transport", "other"
    ]);

    /* ── TZ-001 (v1040) ──
       Fallback destination time zones, used only when the browser does not
       expose Intl.supportedValuesOf("timeZone"). Every entry is validated
       against the browser's own Intl before it is offered, so an unsupported
       identifier is dropped rather than shown. No network, no library. ── */
    const TZ_FALLBACK = Object.freeze([
      "Asia/Jerusalem", "Europe/London", "Europe/Dublin", "Europe/Paris",
      "Europe/Berlin", "Europe/Amsterdam", "Europe/Madrid", "Europe/Lisbon",
      "Europe/Rome", "Europe/Athens", "Europe/Prague", "Europe/Budapest",
      "Europe/Warsaw", "Europe/Istanbul", "Europe/Moscow", "Europe/Zurich",
      "Europe/Vienna", "Europe/Stockholm", "Europe/Oslo", "Europe/Copenhagen",
      "America/New_York", "America/Chicago", "America/Denver",
      "America/Los_Angeles", "America/Toronto", "America/Vancouver",
      "America/Mexico_City", "America/Sao_Paulo", "America/Buenos_Aires",
      "Africa/Cairo", "Africa/Johannesburg", "Africa/Casablanca",
      "Asia/Dubai", "Asia/Bangkok", "Asia/Singapore", "Asia/Hong_Kong",
      "Asia/Tokyo", "Asia/Seoul", "Asia/Shanghai", "Asia/Kolkata",
      "Australia/Sydney", "Australia/Melbourne", "Pacific/Auckland", "UTC"
    ]);
