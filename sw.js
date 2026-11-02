// Service Worker: versionierter Cache (Cache-first) für alle App-Dateien, damit die App nach dem ersten Aufruf
// vollständig offline läuft. Beobachtungsdaten laufen nie hierüber (sie liegen in IndexedDB).
//
// Update-Ablauf: Eine neue Version (geänderte CACHE_VERSION) wird im Hintergrund vollständig geladen und wartet.
// Sie übernimmt erst, wenn die Beobachterin auf der Startseite „Jetzt aktualisieren“ tippt (Nachricht „aktivieren“)
// oder die App vollständig geschlossen war – nie mitten in einem laufenden Block.

// Muss APP_VERSION in js/version.js entsprechen (Unit-Test prüft das). Bei jeder Auslieferung erhöhen,
// sonst bekommen installierte Geräte geänderte Dateien nicht.
const CACHE_VERSION = '0.3.0';
const CACHE_NAME = `hxnow-beobachtung-${CACHE_VERSION}`;

// Alle ausgelieferten Dateien (Unit-Test prüft Vollständigkeit gegen das Repository).
const DATEIEN = [
  './',
  'index.html',
  'manifest.webmanifest',
  'kodierschema.json',
  'css/app.css',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'js/block.js',
  'js/db.js',
  'js/export.js',
  'js/main.js',
  'js/schema.js',
  'js/sicherung.js',
  'js/sitzung.js',
  'js/uuid.js',
  'js/version.js',
  'js/zeit.js',
  'js/ui/abschluss.js',
  'js/ui/blockneu.js',
  'js/ui/dom.js',
  'js/ui/exportieren.js',
  'js/ui/info.js',
  'js/ui/kodierung.js',
  'js/ui/schemafehler.js',
  'js/ui/sicherung.js',
  'js/ui/start.js',
  'js/ui/tageskennzahlen.js',
  'js/ui/update.js',
  'js/ui/versuch.js',
];

self.addEventListener('install', (event) => {
  // Am Server vorbei an den HTTP-Cache laden, damit keine veralteten Dateien in den neuen Cache geraten.
  // Schlägt eine Datei fehl, wird die Version nicht installiert und die bisherige bleibt aktiv.
  event.waitUntil(caches.open(CACHE_NAME)
    .then((cache) => cache.addAll(DATEIEN.map((d) => new Request(d, { cache: 'reload' })))));
  // Kein skipWaiting(): Die neue Version wartet, bis sie ausdrücklich aktiviert wird.
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const namen = await caches.keys();
    await Promise.all(namen
      .filter((n) => n.startsWith('hxnow-beobachtung-') && n !== CACHE_NAME)
      .map((n) => caches.delete(n)));
    // Beim allerersten Start sofort übernehmen, damit die App schon ohne Neuladen offline bereit ist.
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'aktivieren') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const anfrage = event.request;
  if (anfrage.method !== 'GET' || new URL(anfrage.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const treffer = await cache.match(anfrage, { ignoreSearch: true })
      ?? (anfrage.mode === 'navigate' ? await cache.match('index.html') : undefined);
    return treffer ?? fetch(anfrage);
  })());
});
