/* TripMaster boot watchdog.
   If app.js is missing or initialization throws before completion, show a
   recoverable local error instead of leaving a silent static shell. */
(function () {
  const TEXT = {
    he: ["TripMaster לא הצליח להיפתח", "קובץ יישום חסר או שהאתחול נכשל. אפשר לנסות טעינה מחדש.", "טען מחדש"],
    en: ["TripMaster could not start", "An app file is missing or startup failed. You can try reloading.", "Reload"],
    ar: ["تعذر تشغيل TripMaster", "ملف من ملفات التطبيق مفقود أو فشل بدء التشغيل. يمكنك محاولة إعادة التحميل.", "إعادة التحميل"],
    ru: ["TripMaster не удалось запустить", "Файл приложения отсутствует или запуск завершился ошибкой. Попробуйте перезагрузить.", "Перезагрузить"],
    es: ["TripMaster no pudo iniciarse", "Falta un archivo de la aplicación o falló el inicio. Puedes intentar recargar.", "Recargar"],
    pt: ["O TripMaster não conseguiu iniciar", "Um arquivo do aplicativo está ausente ou a inicialização falhou. Você pode tentar recarregar.", "Recarregar"]
  };
  function savedLang() {
    try {
      const raw = localStorage.getItem("tm_settings_clean");
      const lang = raw ? JSON.parse(raw).language : "he";
      return TEXT[lang] ? lang : "he";
    } catch (_) { return "he"; }
  }
  function showFailure() {
    if (document.documentElement.dataset.tmBoot === "ready" || document.getElementById("tmBootFailure")) return;
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
  window.addEventListener("tripmaster:ready", () => {
    const old = document.getElementById("tmBootFailure"); if (old) old.remove();
  }, { once: true });
  window.setTimeout(showFailure, 4000);
})();
