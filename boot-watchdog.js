/* TripMaster boot watchdog — v1400 RC2 hardening.
   BOOT-STATE-002: distinguish a real startup failure from a slow/mobile boot.
   - Actual initialization exceptions can report failure immediately.
   - Progress signals refresh the watchdog deadline.
   - A generous stalled-boot fallback remains for missing/aborted startup.
   - No persistent user data is written; diagnostics are session-only. */
(function () {
  const TEXT = {
    he: ["TripMaster לא הצליח להיפתח", "האתחול נעצר לפני שהאפליקציה הייתה מוכנה. אפשר לנסות טעינה מחדש.", "טען מחדש"],
    en: ["TripMaster could not start", "Startup stopped before the app was ready. You can try reloading.", "Reload"],
    ar: ["تعذر تشغيل TripMaster", "توقف بدء التشغيل قبل أن يصبح التطبيق جاهزًا. يمكنك محاولة إعادة التحميل.", "إعادة التحميل"],
    ru: ["TripMaster не удалось запустить", "Запуск остановился до того, как приложение было готово. Попробуйте перезагрузить.", "Перезагрузить"],
    es: ["TripMaster no pudo iniciarse", "El inicio se detuvo antes de que la aplicación estuviera lista. Puedes intentar recargar.", "Recargar"],
    pt: ["O TripMaster não conseguiu iniciar", "A inicialização parou antes de o aplicativo ficar pronto. Você pode tentar recarregar.", "Recarregar"]
  };

  const state = window.__TM_BOOT_STATE__ = window.__TM_BOOT_STATE__ || {
    phase: "watchdog-loaded",
    startedAt: Date.now(),
    lastProgressAt: Date.now(),
    error: null,
    ready: false
  };

  function savedLang() {
    try {
      const raw = localStorage.getItem("tm_settings_clean");
      if (raw) {
        const lang = JSON.parse(raw).language;
        return TEXT[lang] ? lang : "en";
      }
      const list = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || "en"];
      for (let i = 0; i < list.length; i++) {
        const primary = String(list[i] || "").toLowerCase().replace(/_/g, "-").split("-")[0];
        if (TEXT[primary]) return primary;
      }
      return "en";
    } catch (_) { return "en"; }
  }

  function persistDiag(reason) {
    try {
      sessionStorage.setItem("tm_boot_diag", JSON.stringify({
        at: new Date().toISOString(),
        phase: state.phase || "unknown",
        reason: reason || "unknown",
        error: state.error ? String(state.error.message || state.error).slice(0, 300) : ""
      }));
    } catch (_) {}
  }

  function removeFailure() {
    const old = document.getElementById("tmBootFailure");
    if (old) old.remove();
  }

  function showFailure(reason) {
    if (state.ready || document.documentElement.dataset.tmBoot === "ready" || document.getElementById("tmBootFailure")) return;
    if (!document.body) {
      document.addEventListener("DOMContentLoaded", () => showFailure(reason), { once: true });
      return;
    }
    persistDiag(reason);
    const [title, body, reload] = TEXT[savedLang()];
    const box = document.createElement("div");
    box.id = "tmBootFailure";
    box.setAttribute("role", "alert");
    box.style.cssText = "position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:24px;background:#f5f7fa;color:#132238;font-family:system-ui,sans-serif;text-align:center";
    const card = document.createElement("div");
    card.style.cssText = "max-width:440px;background:white;border:1px solid #d8e0e8;border-radius:18px;padding:24px;box-shadow:0 16px 50px rgba(0,0,0,.14)";
    const h = document.createElement("h1"); h.textContent = title; h.style.cssText = "font-size:1.2rem;margin:0 0 10px";
    const p = document.createElement("p"); p.textContent = body; p.style.cssText = "line-height:1.55;margin:0 0 18px";
    const b = document.createElement("button"); b.type = "button"; b.textContent = reload;
    b.style.cssText = "min-height:48px;padding:10px 18px;border:0;border-radius:12px;background:#12365a;color:white;font:inherit;font-weight:700;cursor:pointer";
    b.addEventListener("click", () => location.reload());
    card.append(h, p, b); box.appendChild(card); document.body.appendChild(box); b.focus();
  }

  window.__tmBootProgress = function (phase) {
    state.phase = phase || state.phase || "starting";
    state.lastProgressAt = Date.now();
  };

  window.__tmBootFail = function (error, phase) {
    if (state.ready) return;
    state.error = error || new Error("Unknown startup failure");
    state.phase = phase || state.phase || "startup-error";
    state.lastProgressAt = Date.now();
    window.setTimeout(() => showFailure("startup-error"), 150);
  };

  window.addEventListener("error", (event) => {
    if (state.ready || document.documentElement.dataset.tmBoot === "ready") return;
    state.error = event.error || new Error(event.message || "Script error during startup");
    state.phase = state.phase || "window-error";
  });
  window.addEventListener("unhandledrejection", (event) => {
    if (state.ready || document.documentElement.dataset.tmBoot === "ready") return;
    state.error = event.reason || new Error("Unhandled promise rejection during startup");
    state.phase = state.phase || "promise-rejection";
  });

  window.addEventListener("tripmaster:ready", () => {
    state.ready = true;
    state.phase = "ready";
    state.lastProgressAt = Date.now();
    removeFailure();
    try { sessionStorage.removeItem("tm_boot_diag"); } catch (_) {}
  });

  /* Last-resort stalled-start fallback. 15 seconds is deliberately much
     longer than the old 4-second fixed deadline. Progress refreshes the
     grace window, so a device doing real startup work is not declared dead. */
  const STALL_MS = 15000;
  const TOTAL_MAX_MS = 45000;
  const poll = window.setInterval(() => {
    if (state.ready || document.documentElement.dataset.tmBoot === "ready") {
      window.clearInterval(poll);
      return;
    }
    const now = Date.now();
    const stalled = now - state.lastProgressAt >= STALL_MS;
    const totalExceeded = now - state.startedAt >= TOTAL_MAX_MS;
    if ((stalled && document.readyState !== "loading") || totalExceeded) {
      window.clearInterval(poll);
      showFailure(state.error ? "startup-error-timeout" : "startup-stalled");
    }
  }, 1000);
})();
