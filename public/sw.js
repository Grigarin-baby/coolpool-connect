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
    icon: data.icon || "/notification-icon.png",
    badge: data.badge || "/notification-icon.png",
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    }),
  );
});
