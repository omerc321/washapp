const CACHE_NAME = 'carwash-pro-v3';
const VERSION_CHECK_INTERVAL = 60000;
const urlsToCache = [
  '/',
  '/index.html',
  '/icon-192.png',
  '/icon-512.png',
];

let currentVersion = null;

async function checkVersion() {
  try {
    const response = await fetch('/version.json', { cache: 'no-store' });
    const data = await response.json();
    
    if (currentVersion === null) {
      currentVersion = data.buildTimestamp;
      return false;
    }
    
    if (data.buildTimestamp !== currentVersion) {
      console.log('New version detected, clearing caches and reloading');
      await clearAllCaches();
      currentVersion = data.buildTimestamp;
      
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({ type: 'NEW_VERSION_AVAILABLE' });
      });
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Version check failed:', error);
    return false;
  }
}

async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => caches.delete(name)));
}

setInterval(checkVersion, VERSION_CHECK_INTERVAL);

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache)),
      checkVersion()
    ])
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      }),
      checkVersion()
    ])
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // NEVER cache API requests - always fetch fresh data
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // NEVER cache WebSocket requests
  if (url.pathname.startsWith('/ws')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // Only cache static assets
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request).then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });
          return response;
        });
      })
  );
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'CarWash Pro';
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: data.data || {},
    tag: data.tag || 'default',
    requireInteraction: data.requireInteraction || false,
    silent: !data.playSound,
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      data.playSound ? playNotificationSound() : Promise.resolve(),
    ])
  );
});

function playNotificationSound() {
  return clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then((clientList) => {
      if (clientList.length > 0) {
        clientList.forEach((client) => {
          client.postMessage({
            type: 'PLAY_NOTIFICATION_SOUND',
          });
        });
      }
    })
    .catch((error) => {
      console.error('Error playing notification sound:', error);
    });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        const data = event.notification.data || {};
        const urlToOpen = data.url || '/';

        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }

        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});
