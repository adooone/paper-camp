self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  const payload = event.data.json();
  event.waitUntil(
    self.registration.showNotification(payload.entityTitle, {
      body: payload.text,
      icon: '/img/paper-logo.png',
      badge: '/img/paper-logo.png',
      data: payload,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const payload = event.notification.data;
  if (!payload?.id) return;
  const url = new URL(
    payload.kind === 'reply' ? 'chat' : `log/task:${payload.id}`,
    self.registration.scope,
  ).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const existing = clientList.find((client) => client.url === url);
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    }),
  );
});
