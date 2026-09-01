/* ══ DIR-BOOT-001 (v1040) ═══════════════════════════════════════════════
     Cold-boot direction flash. <html> ships as lang="he" dir="rtl", and the
     saved language is only applied by applyLanguage() inside
     DOMContentLoaded — i.e. after config.js, i18n.js, the stylesheet and the
     first paint. An English/Russian/Spanish/Portuguese user therefore saw a
     right-to-left frame before the layout flipped.

     This reads ONE key, synchronously, before the body is parsed, and sets
     the two attributes applyLanguage() would have set anyway. It is a
     repaint optimisation, not a source of truth: applyLanguage() still runs
     later and still wins, so a wrong or stale value here is corrected
     within the same boot and can never leave the app in a bad state.

     Constraints deliberately respected:
       - No network, no new file, no new storage key, no write of any kind.
       - Runs BEFORE the BOOT-GUARD script and shares nothing with it. It
         declares no globals and cannot throw out of its own try/catch, so a
         missing config.js/i18n.js still reaches the guard unchanged.
       - The key name and the lang/dir pairs are duplicated from
         KEY_SETTINGS and LANG_META on purpose: config.js and i18n.js have
         not loaded yet. Keep the two in sync when a language is activated;
         an unknown code here simply falls through and changes nothing. ══ */
  (function () {
    try {
      var raw = localStorage.getItem("tm_settings_clean");
      if (!raw) return;
      var lang = JSON.parse(raw).language;
      var DIRS = {
        he: ["he", "rtl"], en: ["en", "ltr"], ar: ["ar", "rtl"],
        ru: ["ru", "ltr"], es: ["es", "ltr"], pt: ["pt-BR", "ltr"]
      };
      var m = DIRS[lang];
      if (!m) return;
      document.documentElement.lang = m[0];
      document.documentElement.dir  = m[1];
    } catch (e) { /* no storage, corrupt JSON: leave the shipped defaults */ }
  })();
