/* eslint-disable no-restricted-globals */
// Service Worker for OMCA CRM Native Windows Desktop Notifications

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle notification click from Windows Action Center / System Tray
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const notifData = event.notification.data || {};
  const targetUrl = notifData.url || "/Admin/messages";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // 1. If an OMCA CRM window is already open, focus it and dispatch open chat event
      for (const client of clientList) {
        if ("focus" in client) {
          return client.focus().then((focusedClient) => {
            if (focusedClient && "postMessage" in focusedClient) {
              focusedClient.postMessage({
                type: "OMCA_NOTIFICATION_CLICK",
                payload: notifData,
              });
            }
          });
        }
      }
      // 2. If no CRM window is open, open one
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener("notificationclose", () => {
  // Notification dismissed by user
});

