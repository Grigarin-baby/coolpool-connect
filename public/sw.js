// Coolpool service worker — handles notification display and click routing.
// Notifications are currently triggered from the app (showAppNotification),
// but the `push` handler is included so server-sent push works if a push
// backend is wired up later without needing a new service worker.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Network-passthrough fetch handler — required by some browsers for the
// "Add to Home Screen" / install prompt to be offered.
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Coolpool", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Coolpool";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon-512.png",
    badge: data.badge || "/icon-192.png",
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const relativeUrl = (event.notification.data && event.notification.data.url) || "/";
  const absoluteUrl = new URL(relativeUrl, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Prefer a client already on the same origin
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          return client.navigate(absoluteUrl).then(() => client.focus());
        }
      }
      return self.clients.openWindow(absoluteUrl);
    }),
  );
});
