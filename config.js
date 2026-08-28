/* TripMaster — config.js
   v1030 RC7: mechanical extraction only. These dependency-free constants
   were moved verbatim out of the main inline script in index.html.
   No value, name, order or behavior was changed. Loaded as a classic
   script before i18n.js and before the main inline script. */

    const KEY_DAYS        = "tm_days_clean";
    const KEY_SETTINGS    = "tm_settings_clean";
    const KEY_THEME       = "tm_theme_clean";
    const KEY_TRIPS       = "tm_trips";
    const KEY_ACTIVE_TRIP = "tm_active_trip";

    // ── Beta readiness (v1009) ──
    const APP_VERSION = "v1030";
    // Fill in a real support address here to enable "שלח משוב" via mailto.
    // Left blank on purpose: opens the mail app with subject/body prefilled,
    // letting the tester pick their own mail account / fill the "To" field.
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
