// ── Firebase Messaging ────────────────────────────────────────────────────────

importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

const serviceWorkerUrl = new URL(self.location.href);
const firebaseConfig = {
    apiKey: serviceWorkerUrl.searchParams.get('apiKey') || '',
    authDomain: serviceWorkerUrl.searchParams.get('authDomain') || '',
    projectId: serviceWorkerUrl.searchParams.get('projectId') || '',
    storageBucket: serviceWorkerUrl.searchParams.get('storageBucket') || '',
    messagingSenderId: serviceWorkerUrl.searchParams.get('messagingSenderId') || '',
    appId: serviceWorkerUrl.searchParams.get('appId') || '',
    measurementId: serviceWorkerUrl.searchParams.get('measurementId') || '',
};

const hasMessagingConfig = firebaseConfig.apiKey
    && firebaseConfig.projectId
    && firebaseConfig.messagingSenderId
    && firebaseConfig.appId;

if (hasMessagingConfig) {
    firebase.initializeApp(firebaseConfig);

    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
        console.log('[firebase-messaging-sw.js] Received background message ', payload);
        const notificationTitle = payload.notification?.title || payload.data?.title || 'Nueva notificacion';
        const notificationOptions = {
            body: payload.notification?.body || payload.data?.body || '',
            data: payload.data || {}
        };

        self.registration.showNotification(notificationTitle, notificationOptions);
    });
} else {
    console.warn('[firebase-messaging-sw.js] Firebase Messaging config missing.');
}

self.addEventListener('notificationclick', function (event) {
    console.log('[SW] Notification click Received.', event.notification.data);
    event.notification.close();

    const deepLink = event.notification.data.url || '/requests';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url.includes(deepLink) && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(deepLink);
            }
        })
    );
});

// ── App Shell Cache (Offline-First) ──────────────────────────────────────────
// Bump this version when you deploy breaking changes to force cache refresh.
const CACHE_VERSION = 'wms-app-v1';

// Hostnames to skip (Firebase, Google APIs, CDNs — handled by their own SDKs)
const SKIP_HOSTNAMES = [
    'firestore.googleapis.com',
    'firebase.googleapis.com',
    'identitytoolkit.googleapis.com',
    'securetoken.googleapis.com',
    'fcm.googleapis.com',
    'cloudfunctions.net',
    'googleapis.com',
    'gstatic.com',
    'googletagmanager.com',
];

const shouldSkip = (url) => {
    if (url.protocol === 'chrome-extension:') return true;
    if (url.protocol === 'data:') return true;
    return SKIP_HOSTNAMES.some((h) => url.hostname.includes(h));
};

// Cache the app shell on install (root + manifest)
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then((cache) =>
            cache.addAll(['/', '/manifest.webmanifest']).catch(() => {
                // Non-fatal: will be cached on first navigation
            })
        )
    );
    self.skipWaiting();
});

// Clean up old cache versions on activate
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((k) => k !== CACHE_VERSION)
                    .map((k) => caches.delete(k))
            )
        )
    );
    self.clients.claim();
});

// Fetch strategy:
//   Navigation (HTML)  → network-first, fallback to cached shell
//   Static assets      → stale-while-revalidate (instant load, bg refresh)
//   Firebase/APIs      → skip (let the SDK handle it)
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    let url;
    try { url = new URL(event.request.url); } catch { return; }

    if (shouldSkip(url)) return;

    event.respondWith(
        (async () => {
            const cache = await caches.open(CACHE_VERSION);

            // Navigation requests → network-first so we always get fresh HTML,
            // with cached shell as fallback for full offline
            if (event.request.mode === 'navigate') {
                try {
                    const response = await fetch(event.request);
                    if (response.ok) cache.put(event.request, response.clone());
                    return response;
                } catch {
                    const cached = await cache.match(event.request)
                        || await cache.match('/');
                    if (cached) return cached;
                    return new Response(
                        '<!DOCTYPE html><html><body><h1>Sin conexión</h1><p>La app se cargará cuando haya wifi.</p></body></html>',
                        { headers: { 'Content-Type': 'text/html' } }
                    );
                }
            }

            // Static assets → stale-while-revalidate
            const cached = await cache.match(event.request);
            if (cached) {
                // Refresh in background
                fetch(event.request)
                    .then((r) => { if (r.ok) cache.put(event.request, r.clone()); })
                    .catch(() => {});
                return cached;
            }

            // Not cached yet → fetch and cache
            try {
                const response = await fetch(event.request);
                if (response.ok) cache.put(event.request, response.clone());
                return response;
            } catch {
                return new Response('Sin conexión', {
                    status: 503,
                    headers: { 'Content-Type': 'text/plain' },
                });
            }
        })()
    );
});
