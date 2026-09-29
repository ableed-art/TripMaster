/* TripMaster Service Worker — coherent app-shell updates + offline fallback.
   v3800-RC1 deployment portability + installability hardening:
   - updated workers WAIT by default; the user decides when to activate them
   - one controller serves one coherent app-shell generation
   - only TripMaster-owned caches are managed
   - API/cross-origin traffic is never runtime-cached by this worker
   - navigation remains offline-first after the first successful install */

const CACHE_NAMESPACE = "tripmaster-shell";
const LEGACY_CACHE_PREFIX = "tripmaster-v";
const LEGACY_MODERN_CACHE_PREFIX = "tripmaster-shell-v";
const CACHE_VERSION = "v3800-rc2";
const SHELL_FINGERPRINT = "e5f6cb14fc789490";
const CACHE_SCOPE_TOKEN = (() => {
  // Fixed-width UTF-16 encoding is injective for URL path strings. Slugging
  // paths lost case and punctuation, merging distinct same-origin deployments.
  const path = new URL(self.registration.scope).pathname;
  return "s" + path.split("").map(c=>c.charCodeAt(0).toString(16).padStart(4,"0")).join("");
})();
const BUILD_ID = "78ad2d961e61fe22";
const CORE_DIGESTS = {"./index.html":"0e1b3e0c2bb3db7ef0620b8567d24b526a6f6015e843c0b48055b37aadc256f4","./styles.css":"1dd3f6451640c16b2e79a94d5d120d30c698d7bc364a2676b13fbbad2255df8a","./config.js":"c9cce131d9c5ffb165f29fa365da2a9628e842687892e5dacbf06b1d3566ffbf","./i18n.js":"f9879ea40d3b976a922504bcaa69c11bab313d843928fb7778de4417dd3f56c0","./dir-boot.js":"071043bf6de5da6070f1772501100906e97f5e34ea3befa70182b4d16acbe579","./boot-guard.js":"887d0b9cac6bcfb9a9bd60e5ebba9898144511f54f3a283973d8f4a417cf0f03","./app-intelligence.js":"90e20bd9926a63910e62c8cf33ac9e58203257b48dd7685e5f46712db174bfb7","./app-logistics.js":"87d3cf267a6e781065982218cc8a158196d55fccd4468ec845666624375436d0","./app-finance.js":"e42bab5be4ec67c1c9caa608ce5a23a0379a9a441de14c1f91a2d5d3dfbb7847","./app-travel.js":"ef783c4131ea5d47034c4a53e4cc58f4fcf8dab03d87ff042d61e57ca79485ed","./app-today.js":"114885299cecfdac22171256270b46c8d95285191059cb8f9724747447c4c680","./app-operations.js":"1cfbc8242aa02562e6482633b4d9e15dbc51391eaa136bbf44a028831926defa","./app-ai-client.js":"193b93d03bc62d1722f5b797ee6aee06528f25b5ccf2b5e9cb853e9f822f9212","./app.js":"3f3ca1e7c0c37f4f46757d22798382c81c923fc831a48edaf581b927b84782a7","./boot-watchdog.js":"fb2fe0d1d68fd47ed85c46949c2fe1aba5fc013147be4515c8a6fa716422dd3e","./sw-register.js":"e6ead5bd8ccda3b997ed51c380987ae79a438bb6af169cf5a2e779bbe16a9574","./manifest.json":"50f9423a41188ad4a808b5edda2cc4cb17a441666266b3e927af0cd4466f4d8d"};
const CACHE_PREFIX = CACHE_NAMESPACE + "-" + CACHE_SCOPE_TOKEN + "-";
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION + "-" + SHELL_FINGERPRINT;
const INSTALL_CACHE_NAME = CACHE_NAME + "-install";
const BACKUP_CACHE_NAME = CACHE_NAME + "-install-backup";
const MAX_OWNED_CACHES = 3;

// The app shell is deliberately explicit. Missing core code must fail the
// install rather than activate a worker that can only boot part of the app.
const CORE_ASSETS = [
  "./index.html",
  "./styles.css",
  "./config.js",
  "./i18n.js",
  "./dir-boot.js",
  "./boot-guard.js",
  "./app-intelligence.js",
  "./app-logistics.js",
  "./app-finance.js",
  "./app-travel.js",
  "./app-today.js",
  "./app-operations.js",
  "./app-ai-client.js",
  "./app.js",
  "./boot-watchdog.js",
  "./sw-register.js",
  "./manifest.json"
];

const OPTIONAL_ASSETS = [
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png"
];

const APP_SHELL_URL = new URL("./index.html", self.registration.scope).href;
const SHELL_URLS = new Set(
  [...CORE_ASSETS, ...OPTIONAL_ASSETS].map((asset) => new URL(asset, self.registration.scope).href)
);

function isOwnedCache(name) {
  // Only caches for this exact registration scope are lifecycle-managed.
  // A simple startsWith(CACHE_PREFIX) is unsafe because /TripMaster/ would
  // also match a sibling /TripMaster-beta/ namespace. Require the suffix to
  // start with a real version token for THIS exact scope.
  if (typeof name !== "string" || !name.startsWith(CACHE_PREFIX)) return false;
  const suffix = name.slice(CACHE_PREFIX.length);
  // Release cache names use TripMaster's vNNNN[-rcN][-fixN] scheme.
  // Requiring that shape prevents a sibling scope token such as
  // "tripmaster-v2" from being mistaken for this scope's version suffix.
  return /^v[0-9]{4,}(?:-rc[0-9]+)?(?:-fix[0-9]+)?(?:-[a-f0-9]{16})?(?:-install(?:-backup)?)?$/.test(suffix);
}

async function trimOwnedCaches() {
  const keys = await caches.keys();
  const owned = keys.filter((name) => isOwnedCache(name) && !name.endsWith("-install") && !name.endsWith("-install-backup"));
  const staleInstallCaches = keys.filter((name) => isOwnedCache(name) && (name.endsWith("-install") || name.endsWith("-install-backup")));
  // CacheStorage.keys() is creation ordered in current browsers. Keep the
  // current generation plus two most recently-created predecessors so an
  // older open tab is not stranded during a user-approved update.
  const previous = owned.filter((name) => name !== CACHE_NAME).slice(-(MAX_OWNED_CACHES - 1));
  const keep = new Set([CACHE_NAME, ...previous]);
  await Promise.all(owned.filter((name) => !keep.has(name)).map((name) => caches.delete(name)));
  // Clean interrupted staging/rollback caches from every older generation in
  // this exact PWA scope, not only the names belonging to the current worker.
  await Promise.all(staleInstallCaches.map((name) => caches.delete(name)));
}

function freshAssetRequest(asset) {
  return new Request(new URL(asset, self.registration.scope).href, { cache: "reload" });
}

async function needsLegacyLifecycleBridge() {
  const keys = await caches.keys();
  const hasLegacy = keys.some((name) => name.startsWith(LEGACY_CACHE_PREFIX));
  const hasModern = keys.some((name) => name.startsWith(CACHE_NAMESPACE + "-") || isOwnedCache(name));
  return hasLegacy && !hasModern;
}

async function copyCacheContents(fromName, toName) {
  const from = await caches.open(fromName);
  const to = await caches.open(toName);
  const requests = await from.keys();
  for (const request of requests) {
    const response = await from.match(request);
    if (!response) throw new Error("TripMaster SW: staged response missing");
    await to.put(request, response.clone());
  }
}

async function responseMatchesAsset(response, asset) {
  if(!response||!response.ok||response.type==="opaque"||!CORE_DIGESTS[asset])return false;
  const digest=await crypto.subtle.digest("SHA-256",await response.clone().arrayBuffer());
  const hex=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
  return hex===CORE_DIGESTS[asset];
}

async function validateCoreCache(cacheName) {
  const cache = await caches.open(cacheName);
  for (const asset of CORE_ASSETS) {
    const url = new URL(asset, self.registration.scope).href;
    const response = await cache.match(url);
    if (!await responseMatchesAsset(response,asset)) throw new Error("TripMaster SW: core integrity check failed: " + asset);
  }
  return true;
}

async function precacheShell() {
  // Build the new shell in an isolated staging cache. A broken network/core
  // asset must never delete the cache currently serving an installed app.
  await Promise.all([caches.delete(INSTALL_CACHE_NAME), caches.delete(BACKUP_CACHE_NAME)]);
  const stage = await caches.open(INSTALL_CACHE_NAME);
  try {
    await stage.addAll(CORE_ASSETS.map(freshAssetRequest));
    await validateCoreCache(INSTALL_CACHE_NAME);
    await Promise.all(
      OPTIONAL_ASSETS.map((asset) =>
        stage.add(freshAssetRequest(asset)).catch((err) => {
          console.warn("TripMaster SW: optional asset not cached:", asset, err);
        })
      )
    );
  } catch (err) {
    await caches.delete(INSTALL_CACHE_NAME);
    throw err;
  }

  const hadCurrent = await caches.has(CACHE_NAME);
  try {
    if (hadCurrent) await copyCacheContents(CACHE_NAME, BACKUP_CACHE_NAME);
    // Promotion happens only after the complete shell exists in staging.
    // Do not delete CACHE_NAME first: this keeps a same-version hotfix from
    // destroying the live offline shell if promotion itself fails.
    await copyCacheContents(INSTALL_CACHE_NAME, CACHE_NAME);
    // If another activating worker removed this worker's staging cache while
    // promotion was in flight, copyCacheContents() could otherwise succeed
    // with zero entries. Validate the promoted live shell before cleanup.
    await validateCoreCache(CACHE_NAME);
    await caches.delete(INSTALL_CACHE_NAME);
    await caches.delete(BACKUP_CACHE_NAME);
  } catch (err) {
    if (hadCurrent) {
      try {
        await caches.delete(CACHE_NAME);
        await copyCacheContents(BACKUP_CACHE_NAME, CACHE_NAME);
      } catch (restoreErr) {
        console.warn("TripMaster SW: failed to restore pre-install cache", restoreErr);
      }
    } else {
      await caches.delete(CACHE_NAME);
    }
    await Promise.all([caches.delete(INSTALL_CACHE_NAME), caches.delete(BACKUP_CACHE_NAME)]);
    throw err;
  }
}


self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    // Detect the migration state BEFORE opening the new cache; otherwise the
    // freshly-created tripmaster-shell-* cache would make this look modern.
    const legacyBridge = await needsLegacyLifecycleBridge();
    await precacheShell();
    // One-time lifecycle bridge from pre-v2800 builds: the old client only
    // knows "reload now" and cannot message a waiting worker. Without this
    // guarded bridge, v2700 could remain stuck on the old active worker. Once
    // any modern tripmaster-shell-* cache exists, future releases wait for
    // explicit user activation and this branch can never fire again.
    if (legacyBridge) await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await trimOwnedCaches();
      // Do not use the client-claim API here. Any document that observes a
      // controller/version mismatch is forced into the client-side reload gate
      // before further writes, while the tab that requested activation reloads.
    })()
  );
});

self.addEventListener("message", (event) => {
  const data = event && event.data;
  if (!data || typeof data !== "object") return;
  if (data.type === "TRIPMASTER_SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  if (data.type === "TRIPMASTER_SW_VERSION" && event.ports && event.ports[0]) {
    event.ports[0].postMessage({ cacheName: CACHE_NAME, buildId: BUILD_ID });
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (!request || request.method !== "GET") return;

  let url;
  try { url = new URL(request.url); }
  catch (_) { return; }

  // Never proxy/cache third-party traffic, and never touch requests outside
  // this PWA scope. This keeps future provider/API/private traffic out of
  // Cache Storage by construction.
  const scopeUrl = new URL(self.registration.scope);
  if (url.origin !== scopeUrl.origin || !url.href.startsWith(scopeUrl.href)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        // TripMaster currently has no path-based router. Returning index.html
        // directly for /some/deep keeps the deep URL as document.baseURI, so
        // every relative script/style request resolves below /some/deep/ and
        // the offline shell cannot boot. Canonicalize such navigations to the
        // real shell URL first; the second navigation is fully service-worker
        // controlled and works offline from the installed cache.
        const shellUrl = new URL(APP_SHELL_URL);
        const canonicalPath = url.origin === shellUrl.origin && url.pathname === shellUrl.pathname;
        if (!canonicalPath) {
          // Preserve query parameters. Fragments are client-side and may be
          // retained by the browser across the redirect; comparing pathname
          // only prevents a #fragment redirect loop on the canonical shell.
          const target = new URL(APP_SHELL_URL);
          target.search = url.search;
          return Response.redirect(target.href, 302);
        }

        const cache = await caches.open(CACHE_NAME);
        const shell = await cache.match(APP_SHELL_URL);
        if (shell) return shell;
        try {
          // If Cache Storage was partially cleared while online, repair the
          // canonical shell entry rather than caching an arbitrary deep URL.
          const response = await fetch(new Request(APP_SHELL_URL, { cache: "reload" }));
          if (await responseMatchesAsset(response,"./index.html")) {
            try { await cache.put(APP_SHELL_URL, response.clone()); } catch (_) {}
            return response;
          }
        } catch (_) {}
        return Response.error();
      })()
    );
    return;
  }

  if (!SHELL_URLS.has(url.href)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;
      // A normally installed worker has every core asset. This fallback is
      // only for an optional asset or externally-cleared cache entry.
      const response = await fetch(request);
      const asset="./"+url.pathname.slice(scopeUrl.pathname.length);
      if(CORE_ASSETS.includes(asset)&&!await responseMatchesAsset(response,asset))return Response.error();
      if (response && response.ok && response.type !== "opaque") {
        try { await cache.put(request, response.clone()); } catch (_) {}
      }
      return response;
    })()
  );
});
