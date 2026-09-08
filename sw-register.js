/* TripMaster Service Worker registration + update lifecycle. */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    const hadController = !!navigator.serviceWorker.controller;
    try {
      const registration = await navigator.serviceWorker.register("./sw.js");
      const signalUpdate = () => window.dispatchEvent(new CustomEvent("tripmaster:update-ready"));
      if (hadController && registration.waiting) signalUpdate();
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && hadController) signalUpdate();
        });
      });
      if (hadController) {
        let signaled = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (signaled) return; signaled = true; signalUpdate();
        });
      }
    } catch (err) {
      console.warn("TripMaster: Service Worker registration failed", err);
    }
  });
}
