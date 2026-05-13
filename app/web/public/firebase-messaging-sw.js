
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

    // Deep link logic
    const deepLink = event.notification.data.url || '/requests';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            // Check if there is already a window/tab open with the target URL
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url.includes(deepLink) && 'focus' in client) {
                    return client.focus();
                }
            }
            // If not, open a new window
            if (clients.openWindow) {
                return clients.openWindow(deepLink);
            }
        })
    );
});
