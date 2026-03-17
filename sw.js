// ============================================================
//  MedTerm Service Worker v5.0
//  7-day cache · Progress reporting · Cache-first strategy
// ============================================================

const CACHE_VERSION  = 'medterm-v8.0';
const FONT_CACHE     = 'medterm-fonts-v2';
const IMAGE_CACHE    = 'medterm-images-v1';
const CACHE_MAX_AGE  = 7 * 24 * 60 * 60 * 1000; // 7 days
const CACHE_META_KEY = 'medterm-cache-meta';

const APP_FILES = [
  './', './index.html', './style.css', './app.js', './data.js',
  './features.js', './security.js', './session.js', './manifest.json',
  './icons/icon-72.png',  './icons/icon-96.png',  './icons/icon-128.png',
  './icons/icon-144.png', './icons/icon-152.png', './icons/icon-192.png',
  './icons/icon-384.png', './icons/icon-512.png',
];

const FONT_URLS = [
  'https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800;900&family=Tajawal:wght@300;400;500;700;800&display=swap',
];

const IMAGE_URLS = [
  'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Figure_01_01_01.jpg/600px-Figure_01_01_01.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Blausen_0019_AnatomicalDirectionalReferences.png/400px-Blausen_0019_AnatomicalDirectionalReferences.png',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/Anatomical_terms_of_location_-_anterior_posterior.jpg/400px-Anatomical_terms_of_location_-_anterior_posterior.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Human_body_features.jpg/400px-Human_body_features.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Abdo_regions.jpg/500px-Abdo_regions.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/BodyPlanes.jpg/500px-BodyPlanes.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/2201_BodyCavities.jpg/500px-2201_BodyCavities.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Homeostasis_Feedback_Loop.jpg/500px-Homeostasis_Feedback_Loop.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/Anatomy_and_Physiology_OpenStax.jpg/480px-Anatomy_and_Physiology_OpenStax.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Anatomical_Position.jpg/300px-Anatomical_Position.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Blausen_0019_AnatomicalDirectionalReferences.png/400px-Blausen_0019_AnatomicalDirectionalReferences.png',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Gray1219.png/320px-Gray1219.png',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/Blausen_0002_AbdominalQuadrants.png/400px-Blausen_0002_AbdominalQuadrants.png',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Human_anatomy_planes%2C_labeled.jpg/400px-Human_anatomy_planes%2C_labeled.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Body_cavities.jpg/400px-Body_cavities.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Negative_Feedback.jpg/400px-Negative_Feedback.jpg',
];

const ALL_RESOURCES = [...APP_FILES, ...FONT_URLS, ...IMAGE_URLS];
const TOTAL = ALL_RESOURCES.length;

// ── Helper: broadcast to all clients ─────────────────────
function notifyClients(data) {
  self.clients.matchAll({ includeUncontrolled: true })
    .then(clients => clients.forEach(c => c.postMessage(data)));
}

// ── Helper: cache metadata ────────────────────────────────
async function saveCacheMeta() {
  const cache = await caches.open(CACHE_VERSION);
  await cache.put(CACHE_META_KEY, new Response(
    JSON.stringify({ cachedAt: Date.now(), version: CACHE_VERSION, total: TOTAL })
  ));
}

async function getCacheMeta() {
  try {
    const cache = await caches.open(CACHE_VERSION);
    const res = await cache.match(CACHE_META_KEY);
    return res ? await res.json() : null;
  } catch { return null; }
}

// ── INSTALL ───────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => Promise.allSettled(APP_FILES.map(f => cache.add(f).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ─────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION && k !== FONT_CACHE && k !== IMAGE_CACHE)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── FETCH ─────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Fonts
  if (url.hostname.includes('fonts.gstatic.com') || url.hostname.includes('fonts.googleapis.com')) {
    event.respondWith(
      caches.open(FONT_CACHE).then(cache =>
        cache.match(event.request).then(cached => cached ||
          fetch(event.request).then(res => {
            if (res.ok) cache.put(event.request, res.clone());
            return res;
          }).catch(() => new Response('', { status: 503 }))
        )
      )
    );
    return;
  }

  // Images
  if (url.hostname.includes('wikimedia') || url.hostname.includes('wikipedia')) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(cache =>
        cache.match(event.request).then(cached => cached ||
          fetch(event.request).then(res => {
            if (res.ok) cache.put(event.request, res.clone());
            return res;
          }).catch(() => new Response('', { status: 503 }))
        )
      )
    );
    return;
  }

  // App – cache first
  event.respondWith(
    caches.open(CACHE_VERSION).then(cache =>
      cache.match(event.request).then(cached => {
        const net = fetch(event.request)
          .then(res => { if (res.ok) cache.put(event.request, res.clone()); return res; })
          .catch(() => null);
        return cached || net || new Response(
          '<html dir="rtl"><head><meta charset="UTF-8"><style>body{font-family:sans-serif;text-align:center;padding:60px;background:#0d1117;color:#e2e8f0;direction:rtl}</style></head><body><div style="font-size:3rem">⚡</div><h2>MedTerm</h2><p>يعمل بدون إنترنت.</p><a href="./" style="color:#63b3ed;font-size:1.1rem">← الصفحة الرئيسية</a></body></html>',
          { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      })
    )
  );
});

// ── MESSAGES ──────────────────────────────────────────────
self.addEventListener('message', async event => {
  if (!event.data) return;

  // Skip waiting
  if (event.data.type === 'SKIP_WAITING') { self.skipWaiting(); return; }

  // Full download with progress
  if (event.data.type === 'DOWNLOAD_ALL') {
    let done = 0;
    const cacheApp   = await caches.open(CACHE_VERSION);
    const cacheFonts = await caches.open(FONT_CACHE);
    const cacheImgs  = await caches.open(IMAGE_CACHE);

    for (const url of ALL_RESOURCES) {
      try {
        const isFont  = url.includes('fonts.google') || url.includes('fonts.gstatic');
        const isImage = url.includes('wikimedia') || url.includes('wikipedia');
        const bucket  = isFont ? cacheFonts : isImage ? cacheImgs : cacheApp;
        const existing = await bucket.match(url);
        if (!existing) {
          const res = await fetch(url, { cache: 'no-cache' });
          if (res.ok) await bucket.put(url, res.clone());
        }
      } catch (e) { /* continue on error */ }
      done++;
      notifyClients({
        type: 'DOWNLOAD_PROGRESS',
        done, total: TOTAL,
        pct: Math.round((done / TOTAL) * 100),
        label: url.split('/').pop().split('?')[0].slice(0, 35),
      });
    }

    await saveCacheMeta();
    notifyClients({
      type: 'DOWNLOAD_COMPLETE',
      total: TOTAL,
      cachedAt: Date.now(),
      expiresAt: Date.now() + CACHE_MAX_AGE,
    });
  }

  // Check cache status
  if (event.data.type === 'CHECK_CACHE') {
    const meta = await getCacheMeta();
    const valid = meta ? (Date.now() - meta.cachedAt) < CACHE_MAX_AGE : false;
    notifyClients({
      type: 'CACHE_STATUS',
      valid, meta,
      expiresInDays: meta ? Math.max(0, Math.floor((meta.cachedAt + CACHE_MAX_AGE - Date.now()) / 86400000)) : 0,
    });
  }

  // Clear all caches
  if (event.data.type === 'CLEAR_CACHE') {
    await Promise.all([
      caches.delete(CACHE_VERSION),
      caches.delete(FONT_CACHE),
      caches.delete(IMAGE_CACHE),
    ]);
    notifyClients({ type: 'CACHE_CLEARED' });
  }
});
