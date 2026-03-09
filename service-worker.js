const CACHE_NAME = "briscola-v1";

const CORE_URLS = [
  "/",
  "/index.html",
  "/styles.css",
  "/manifest.json",
  "/src/main.js",
  "/src/engine/game.js",
  "/src/engine/deck.js",
  "/src/engine/rules.js",
  "/src/engine/types.js",
  "/src/engine/bot.js",
  "/src/net/online.js",
  "/src/ui/render.js",
  "/src/ui/events.js",
  "/src/ui/assets.js",
  "/src/ui/animations.js",
  "/src/ui/sfx.js",
  "/assets/backgrounds/mug.png",
  "/assets/backgrounds/tunamelt.png",
  "/assets/backgrounds/capybaras.png",
  "/assets/backgrounds/Home.png",
  "/assets/sfx/card-play.wav",
  "/assets/sfx/trick-win.wav",
  "/assets/sfx/trick-lose.wav",
  "/assets/sfx/button-click.wav",
  "/assets/cards/back.png",
  "/assets/cards/C_A.png",
  "/assets/cards/C_3.png",
  "/assets/cards/C_J.png",
  "/assets/cards/C_Q.png",
  "/assets/cards/C_K.png",
  "/assets/cards/D_A.png",
  "/assets/cards/D_3.png",
  "/assets/cards/D_J.png",
  "/assets/cards/D_Q.png",
  "/assets/cards/D_K.png",
  "/assets/cards/H_A.png",
  "/assets/cards/H_3.png",
  "/assets/cards/H_J.png",
  "/assets/cards/H_Q.png",
  "/assets/cards/H_K.png",
  "/assets/cards/S_A.png",
  "/assets/cards/S_3.png",
  "/assets/cards/S_J.png",
  "/assets/cards/S_Q.png",
  "/assets/cards/S_K.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const tasks = CORE_URLS.map(async (url) => {
      try {
        const req = new Request(url, { cache: "no-cache" });
        const res = await fetch(req);
        if (res && res.ok) {
          await cache.put(req, res.clone());
        } else {
          console.warn("[sw] Skip cache (non-ok):", url);
        }
      } catch (err) {
        console.warn("[sw] Skip cache (fetch failed):", url, err);
      }
    });
    await Promise.allSettled(tasks);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => {
      if (key !== CACHE_NAME) return caches.delete(key);
      return Promise.resolve();
    }));
    await self.clients.claim();
  })());
});

function isSocketRequest(url) {
  return url.pathname.startsWith("/socket.io/");
}

function isStaticAsset(url) {
  return /\.(js|css|png|jpg|jpeg|webp|wav|mp3|json)$/i.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (isSocketRequest(url)) return;

  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        return await fetch(req);
      } catch (_err) {
        const cached = await caches.match("/index.html");
        if (cached) return cached;
        throw _err;
      }
    })());
    return;
  }

  if (!isStaticAsset(url)) return;

  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res && res.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, res.clone());
      }
      return res;
    } catch (_err) {
      return cached;
    }
  })());
});
