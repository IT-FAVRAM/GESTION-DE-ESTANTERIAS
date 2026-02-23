
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "AIzaSyARd3U4v2dLciTswSbnaKI2YgXnzUTap70",
    authDomain: "gestion-de-estanterias.firebaseapp.com",
    projectId: "gestion-de-estanterias",
    storageBucket: "gestion-de-estanterias.firebasestorage.app",
    messagingSenderId: "570794350818",
    appId: "1:570794350818:web:ba71424870eb1a87f0e6bb",
    measurementId: "G-6VPFSYWH8M",
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    // Customize notification here if needed
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/logo192.png',
        data: payload.data || {}
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

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
