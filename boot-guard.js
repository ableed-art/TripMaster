/* ══ BOOT-GUARD-001 (v1030 RC7-FIX1) ═══════════════════════════════════
     RC7 moved the KEY_ constants and PARTNER_CONFIG into config.js, and
     LANG_META / DEFAULT_LANG / TRANSLATIONS into i18n.js. A classic
     external script whose request fails is skipped SILENTLY by the browser:
     no error page, no failed navigation. The document still parses and the
     static shell still paints, and then the main script below throws
     "ReferenceError: DEFAULT_LANG is not defined" on its first statement.
     The whole DOMContentLoaded handler aborts, so nothing renders and
     nothing is clickable — which a user reads as "the app did not open".
     While these declarations were inline in RC6 this was impossible: a
     failed index.html failed the navigation outright, showed a browser
     error, and a refresh fixed it.

     This guard restores that RC6 property. On a healthy boot it does
     nothing at all. When a dependency is missing it reloads once (twice at
     most per tab), which is the same recovery the user was already
     performing by hand. It adds no UI, no localStorage key, no translation
     and no product behaviour, and it cannot loop: the retry counter is
     written to sessionStorage BEFORE any reload is attempted, and no
     usable sessionStorage means no reload. ══ */
  (function () {
    var ok = false;
    try {
      ok = typeof KEY_DAYS     !== "undefined" &&
           typeof DEFAULT_LANG !== "undefined" &&
           typeof TRANSLATIONS !== "undefined";
    } catch (e) { ok = false; }   // partially-evaluated script (TDZ) counts as missing
    var K = "tm_boot_retry";      // session-scoped only; never persisted, never backed up
    if (ok) { try { sessionStorage.removeItem(K); } catch (e) {} return; }
    var n = 0, wrote = false;
    try {
      n = parseInt(sessionStorage.getItem(K) || "0", 10) || 0;
      if (n < 2) { sessionStorage.setItem(K, String(n + 1)); wrote = true; }
    } catch (e) { wrote = false; }
    if (wrote) location.reload();
  })();
