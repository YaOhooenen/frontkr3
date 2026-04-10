const CACHE_NAME = 'notes-cache-v5';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/manifest.json',
  '/icons/favicon-16x16.png',
  '/icons/favicon-32x32.png',
  '/icons/android-chrome-192x192.png',
  '/icons/android-chrome-512x512.png',
  '/icons/favicon.ico'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});

self.addEventListener('push', (event) => {
  let data = { title: 'Новое уведомление', body: '', reminderId: null, text: '' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch(e) {
      data.body = event.data.text();
    }
  }
  
  const options = {
    body: data.body,
    icon: '/icons/android-chrome-192x192.png',
    badge: '/icons/favicon-32x32.png',
    data: { reminderId: data.reminderId, text: data.text }
  };
  
  if (data.reminderId) {
    options.actions = [{ action: 'snooze', title: 'Отложить на 1 минуту' }];
  }
  
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action;
  const reminderId = notification.data?.reminderId;
  const text = notification.data?.text;
  
  notification.close();
  
  if (action === 'snooze' && reminderId && text) {
    event.waitUntil(
      fetch(`http://localhost:3001/snooze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminderId: reminderId, text: text })
      }).catch(err => console.error('Snooze error:', err))
    );
  } else {
    event.waitUntil(clients.openWindow('/'));
  }
});