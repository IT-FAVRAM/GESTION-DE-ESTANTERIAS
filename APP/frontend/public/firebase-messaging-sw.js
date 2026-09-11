// ── Firebase Messaging ────────────────────────────────────────────────────────

importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: '%%VITE_FIREBASE_API_KEY%%',
    authDomain: '%%VITE_FIREBASE_AUTH_DOMAIN%%',
    projectId: '%%VITE_FIREBASE_PROJECT_ID%%',
    storageBucket: '%%VITE_FIREBASE_STORAGE_BUCKET%%',
    messagingSenderId: '%%VITE_FIREBASE_MESSAGING_SENDER_ID%%',
    appId: '%%VITE_FIREBASE_APP_ID%%',
    measurementId: '%%VITE_FIREBASE_MEASUREMENT_ID%%',
};

const hasMessagingConfig = firebaseConfig.apiKey
    && firebaseConfig.projectId
    && firebaseConfig.messagingSenderId
    && firebaseConfig.appId;

if (hasMessagingConfig) {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }

    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
        console.log('[firebase-messaging-sw.js] Received background message ', payload);
        const notificationTitle = payload.notification?.title || payload.data?.title || 'Gestor de Estanterías';
        const type = String(payload.data?.type || '').toUpperCase();
        const isUrgent = payload.data?.priority === 'high'
            || type.includes('URGENT')
            || type.includes('CRITICAL')
            || type === 'URGENT_PLACEMENT';
        const notificationOptions = {
            body: payload.notification?.body || payload.data?.body || '',
            icon: '/icon.svg',
            badge: '/icon.svg',
            data: payload.data || {},
            vibrate: isUrgent ? [200, 100, 200, 100, 500] : [200],
            requireInteraction: isUrgent,
            silent: false, // reproducir sonido del sistema al mostrar el aviso
            tag: payload.data?.type || 'warehouse-alert',
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
const CACHE_VERSION = 'wms-app-v15';

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
    // Aviso de versión nueva: siempre a la red, nunca desde caché.
    if (url.pathname === '/version.json') return true;
    return SKIP_HOSTNAMES.some((h) => url.hostname.includes(h));
};

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then((cache) =>
            cache.addAll(['/', '/manifest.webmanifest']).catch(() => {})
        )
    );
    self.skipWaiting();
});

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

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    let url;
    try { url = new URL(event.request.url); } catch { return; }

    if (shouldSkip(url)) return;

    event.respondWith(
        (async () => {
            const cache = await caches.open(CACHE_VERSION);

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

            const cached = await cache.match(event.request);
            if (cached) {
                fetch(event.request)
                    .then((r) => { if (r.ok) cache.put(event.request, r.clone()); })
                    .catch(() => {});
                return cached;
            }

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
