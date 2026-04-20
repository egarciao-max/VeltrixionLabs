const CACHE = "oropezas-v2";

self.addEventListener("install", e => {
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(k => k !== CACHE && caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  // 🔥 SOLO manejar GET (esto evita bugs raros)
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then(res => {
        // ❌ NO cachear redirects (ESTO ERA TU ERROR)
        if (res.type === "opaqueredirect") return res;

        const copy = res.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));

        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
self.addEventListener('push', event => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      title: 'Oropezas',
      body: event.data?.text() || 'Nueva notificación'
    };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Oropezas', {
      body: data.body || 'Hay una actualización nueva',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: {
        url: data.url || '/'
      }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});