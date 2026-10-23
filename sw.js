// Service Worker - Regatas Andino Hockey PWA
// Cache Version
const CACHE_NAME = 'regatas-hockey-v20261022-mobile-v34';

// Recursos críticos para funcionamiento offline
const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './data.js',
  './manifest.json',
  './escudo-regatas-andino.png',
  './foto-plantel.jpg',
  './apple-touch-icon.png',
  './favicon.ico',
  './favicon-16x16.png',
  './favicon-32x32.png',
  './favicon-48x48.png',
  './favicon-192x192.png',
  './favicon-512x512.png'
];

// Instalación: precachear recursos estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Algunos recursos no pudieron precachearse:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activación: limpiar caches viejos y tomar control inmediato
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Estrategia de Fetch:
// 1. Llamadas a APIs externas (Google Script webhook, Google Sheets, AMH): Network Only / Network First
// 2. Recursos locales estáticos (HTML, CSS, JS, imágenes): Stale-While-Revalidate o Cache First con fallback
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // No interceptar peticiones que no sean GET (como los POST del webhook de incidencias)
  if (request.method !== 'GET') {
    return;
  }

  // El catálogo de clubes cambia desde el panel de administración y nunca debe
  // quedar servido desde la caché offline.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request, { cache: 'no-store' }).catch(() => {
        return new Response(JSON.stringify({ error: 'API no disponible sin conexión' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // APIs dinámicas y hojas de cálculo: Red primero
  if (
    url.hostname.includes('script.google.com') ||
    url.hostname.includes('docs.google.com') ||
    url.hostname.includes('15.235.75.172')
  ) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(JSON.stringify({ status: 'offline', message: 'Sin conexión a internet' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // 2. Navegación principal (HTML): Red primero (Network-First) para que siempre tenga la última versión de GitHub
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put('./index.html', responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Si no hay internet (offline en la cancha), servir la versión guardada en caché
        return caches.match('./index.html') || caches.match('./');
      })
    );
    return;
  }

  // 3. Scripts y estilos (app.js, styles.css, data.js): Red primero (Network-First) para recibir updates al instante
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    event.respondWith(
      fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        return caches.match(request);
      })
    );
    return;
  }

  // 4. Recursos estáticos locales (imágenes, iconos, tipografías): Cache First con fallback
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      });
    })
  );
});
