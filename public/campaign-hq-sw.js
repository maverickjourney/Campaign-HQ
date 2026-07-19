const CAMPAIGN_HQ_VERSION = "campaign-hq-mobile-foundation-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {
      body: event.data ? event.data.text() : "",
    };
  }

  event.waitUntil(
    self.registration.showNotification(
      payload.title || "Campaign HQ",
      {
        body:
          payload.body ||
          "You have a new campaign update.",
        icon: "/pwa/icon-192.png",
        badge: "/pwa/icon-192.png",
        tag:
          payload.tag ||
          CAMPAIGN_HQ_VERSION,
        requireInteraction:
          Boolean(payload.requireInteraction),
        data: {
          url:
            payload.url ||
            "/dashboard",
        },
      },
    ),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl =
    event.notification.data?.url ||
    "/dashboard";

  event.waitUntil(
    self.clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((clients) => {
        const existing =
          clients.find((client) => {
            try {
              return (
                new URL(client.url).origin ===
                self.location.origin
              );
            } catch {
              return false;
            }
          });

        if (existing) {
          existing.navigate(targetUrl);
          return existing.focus();
        }

        return self.clients.openWindow(
          targetUrl,
        );
      }),
  );
});
