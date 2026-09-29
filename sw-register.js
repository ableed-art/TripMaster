/* TripMaster Service Worker registration + user-controlled update lifecycle.
   v3300-RC1: device-QA telemetry + scoped lifecycle diagnostics. */
(function () {
  const status = window.__TM_SW_STATUS__ = window.__TM_SW_STATUS__ || {
    supported: "serviceWorker" in navigator,
    registered: false,
    controlled: !!(navigator.serviceWorker && navigator.serviceWorker.controller),
    waiting: false,
    installing: false,
    applying: false,
    scopePath: null,
    controllerCacheName: null,
    controllerMatchesApp: null,
    reloadRequired: false,
    controllerCheckDurationMs: null,
    controllerCheckAttempts: 0,
    controllerCheckTimedOut: false,
    lastCheckAt: null,
    lastError: null
  };

  if (!status.supported) return;

  let registration = null;
  let applyRequested = false;
  let updateCheckTimer = null;
  let periodicUpdateTimer = null;
  let lastUpdateCheck = 0;
  let controllerQuerySeq = 0;
  const UPDATE_CHECK_MIN_INTERVAL_MS = 15 * 60 * 1000;

  function publishStatus() {
    status.controlled = !!navigator.serviceWorker.controller;
    status.waiting = !!(registration && registration.waiting);
    status.installing = !!(registration && registration.installing);
    window.dispatchEvent(new CustomEvent("tripmaster:sw-status", { detail: { ...status } }));
  }

  function signalUpdateReady() {
    status.waiting = true;
    publishStatus();
    window.dispatchEvent(new CustomEvent("tripmaster:update-ready"));
  }

  function observeInstalling(worker) {
    if (!worker) return;
    status.installing = true;
    publishStatus();
    worker.addEventListener("statechange", () => {
      status.installing = worker.state === "installing";
      if (worker.state === "installed" && navigator.serviceWorker.controller) signalUpdateReady();
      else publishStatus();
    });
  }

  async function requestControllerVersion(controller, timeoutMs) {
    if (!controller || typeof MessageChannel === "undefined") return null;
    const channel = new MessageChannel();
    return await new Promise((resolve) => {
      let settled=false,timer=null;
      const finish=(result)=>{
        if(settled)return;settled=true;
        if(timer!==null)window.clearTimeout(timer);
        channel.port1.onmessage=null;
        try{channel.port1.close();channel.port2.close();}catch(_){}
        resolve(result);
      };
      timer=window.setTimeout(()=>finish(null),timeoutMs);
      channel.port1.onmessage=event=>finish(event&&event.data?event.data:null);
      try{controller.postMessage({type:"TRIPMASTER_SW_VERSION"},[channel.port2]);}
      catch(_){finish(null);}
    });
  }


  async function queryControllerVersion() {
    const querySeq = ++controllerQuerySeq;
    const controller = navigator.serviceWorker.controller;
    const startedAt = Date.now();
    status.controllerCheckDurationMs = null;
    status.controllerCheckAttempts = 0;
    status.controllerCheckTimedOut = false;
    if (!controller) {
      status.controllerCacheName = null;
      status.controllerMatchesApp = null;
      status.reloadRequired = false;
      status.controllerCheckDurationMs = 0;
      publishStatus();
      return;
    }

    // A controlled page is write-blocked while controller identity is being
    // proven. This closes the timeout window in which a stale page could write
    // before a slow Android worker answers the version query.
    const previouslyRequired = status.reloadRequired === true;
    status.controllerMatchesApp = null;
    status.reloadRequired = true;
    publishStatus();

    // A waking Android worker can take longer than one short message round
    // trip. Retry once, and remain fail-CLOSED if the controller still cannot
    // prove that it belongs to this exact app version.
    status.controllerCheckAttempts = 1;
    let result = await requestControllerVersion(controller, 1200);
    if (!result) { status.controllerCheckAttempts = 2; result = await requestControllerVersion(controller, 1200); }

    // A newer controller/query supersedes this async result. Never let an old
    // delayed reply clear the reload gate for a different active controller.
    if (querySeq !== controllerQuerySeq || controller !== navigator.serviceWorker.controller) return;

    status.controllerCheckDurationMs = Math.max(0, Date.now() - startedAt);
    status.controllerCheckTimedOut = !result;
    const cacheName = result && typeof result.cacheName === "string" ? result.cacheName : null;
    status.controllerCacheName = cacheName;
    if (cacheName && typeof APP_VERSION === "string") {
      const token = APP_VERSION.toLowerCase().replace(/^v/, "").replace(/[^a-z0-9]+/g, "-");
      // Match the entire live cache generation suffix. This rejects both
      // RC1-vs-RC10 and RC1-vs-RC1-FIX1/hotfix false positives.
      status.controllerMatchesApp = new RegExp("-v" + token + "-[a-f0-9]{16}$").test(cacheName) && typeof APP_BUILD_ID === "string" && result.buildId === APP_BUILD_ID;
    } else {
      status.controllerMatchesApp = false;
    }

    const mustReload = status.controllerMatchesApp !== true;
    const newlyRequired = mustReload && !previouslyRequired;
    status.reloadRequired = mustReload;
    publishStatus();
    if (newlyRequired) window.dispatchEvent(new CustomEvent("tripmaster:reload-required"));
  }


  async function checkForUpdate(force) {
    if (!registration || !navigator.onLine) return;
    const now = Date.now();
    if (!force && now - lastUpdateCheck < UPDATE_CHECK_MIN_INTERVAL_MS) return;
    lastUpdateCheck = now;
    status.lastCheckAt = new Date(now).toISOString();
    try {
      await registration.update();
      status.lastError = null;
    } catch (err) {
      status.lastError = String((err && err.name) || "update_failed").slice(0, 80);
      console.warn("TripMaster: Service Worker update check failed", err);
    } finally {
      publishStatus();
    }
  }

  function applyWaitingUpdate() {
    const worker = registration && registration.waiting;
    if (!worker) {
      // The banner can survive a lifecycle race. Re-check once; if there is
      // still no waiting worker, restore the button instead of leaving a dead
      // disabled control on screen.
      status.applying = false;
      publishStatus();
      checkForUpdate(true);
      window.dispatchEvent(new CustomEvent("tripmaster:update-apply-failed"));
      return;
    }
    if(applyRequested)return;
    applyRequested=true;status.applying=true;publishStatus();
    let activationDeadline=null;
    const cleanup=()=>{if(activationDeadline!==null)window.clearTimeout(activationDeadline);worker.removeEventListener("statechange",onState);applyRequested=false;status.applying=false;};
    const fail=()=>{cleanup();publishStatus();window.dispatchEvent(new CustomEvent("tripmaster:update-apply-failed"));};
    const onState=()=>{
      if(!applyRequested)return;
      if(worker.state==="activated"){cleanup();window.location.reload();}
      else if(worker.state==="redundant")fail();
    };
    worker.addEventListener("statechange",onState);
    activationDeadline=window.setTimeout(fail,10000);
    try{worker.postMessage({type:"TRIPMASTER_SKIP_WAITING"});onState();}catch(_){fail();}
  }


  function stopUpdateTimers() {
    if (updateCheckTimer) window.clearTimeout(updateCheckTimer);
    if (periodicUpdateTimer) window.clearInterval(periodicUpdateTimer);
    updateCheckTimer = null;
    periodicUpdateTimer = null;
  }

  function startUpdateTimers() {
    stopUpdateTimers();
    if (!registration) return;
    updateCheckTimer = window.setTimeout(() => {
      updateCheckTimer = null;
      checkForUpdate(false);
    }, 2500);
    periodicUpdateTimer = window.setInterval(() => {
      if (!document.hidden) checkForUpdate(false);
    }, 30 * 60 * 1000);
  }

  window.addEventListener("tripmaster:apply-update", applyWaitingUpdate);
  window.addEventListener("online", () => checkForUpdate(false));
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) { checkForUpdate(false); queryControllerVersion(); }
  });
  window.addEventListener("pageshow", () => {
    // bfcache restores reuse this exact JS realm after pagehide cleared the
    // interval. Restart the timers instead of silently losing long-session
    // update checks for the rest of the page lifetime.
    if (registration && !periodicUpdateTimer) startUpdateTimers();
    checkForUpdate(false);
    queryControllerVersion();
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    publishStatus();
    queryControllerVersion();
  });

  window.addEventListener("load", async () => {
    try {
      registration = await navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" });
      status.registered = true;
      try { status.scopePath = new URL(registration.scope).pathname; } catch (_) { status.scopePath = null; }
      status.lastError = null;
      if (registration.waiting && navigator.serviceWorker.controller) signalUpdateReady();
      if (registration.installing) observeInstalling(registration.installing);
      registration.addEventListener("updatefound", () => observeInstalling(registration.installing));
      publishStatus();
      queryControllerVersion();
      // A load-triggered register normally performs an update check itself;
      // this delayed check also covers long-lived installed PWA sessions.
      startUpdateTimers();
    } catch (err) {
      status.lastError = String((err && err.name) || "registration_failed").slice(0, 80);
      publishStatus();
      console.warn("TripMaster: Service Worker registration failed", err);
    }
  });

  window.addEventListener("pagehide", stopUpdateTimers);
})();
