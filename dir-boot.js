/* ══ DIR-BOOT-001 (v1040) ═══════════════════════════════════════════════
     Cold-boot direction flash. <html> ships as lang="he" dir="rtl", while
     the final UI language is applied later by app.js. This tiny pre-body boot
     step applies an existing saved language immediately; on a true first run
     it mirrors the device-language rule (supported locale, otherwise English)
     so an international user does not first see a right-to-left frame.

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
      var DIRS = {
        he: ["he", "rtl"], en: ["en", "ltr"], ar: ["ar", "rtl"],
        ru: ["ru", "ltr"], es: ["es", "ltr"], pt: ["pt-BR", "ltr"],
        am: ["am-ET", "ltr"]
      };
      var lang = null;
      if (raw) {
        lang = JSON.parse(raw).language;
      } else {
        /* I18N-FIRST-RUN-001: on a true first run use the first supported
           browser/device language; unsupported locales start in English. */
        var list = (navigator.languages && navigator.languages.length)
          ? navigator.languages : [navigator.language || "en"];
        for (var i = 0; i < list.length; i++) {
          var primary = String(list[i] || "").toLowerCase().replace(/_/g, "-").split("-")[0];
          if (DIRS[primary]) { lang = primary; break; }
        }
        if (!lang) lang = "en";
      }
      var m = DIRS[lang];
      if (!m) return;
      document.documentElement.lang = m[0];
      document.documentElement.dir  = m[1];
    } catch (e) { /* no storage, corrupt JSON: leave the shipped defaults */ }
  })();
