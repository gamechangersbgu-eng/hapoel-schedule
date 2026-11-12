// Service worker for the installed app.
// - Schedule pages work offline: the last version seen is shown when there is no connection.
// - Push notifications (sent by the server when a team's schedule changes).
// Management pages, login and API calls are never cached.
// On GitHub Pages the script lives at /hapoel-schedule/sw.js, so paths stay under that folder.
const BASE = new URL("./", self.location).pathname.replace(/\/$/, "");
function rooted(path) {
  return `${BASE}${path}`;
}
const CACHE = "hapoel-schedule-v1";
const NEVER_CACHE = [rooted("/admin"), rooted("/login"), rooted("/api/")];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll([rooted("/icons/icon-192.png")])).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER_CACHE.some((prefix) => url.pathname.startsWith(prefix))) return;

  // Pages: network first (always fresh), fall back to the last copy when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match(rooted("/")))),
    );
    return;
  }

  // Built files and icons: cache first (their names change on every release).
  if (url.pathname.startsWith(rooted("/_next/static/")) || url.pathname.startsWith(rooted("/icons/"))) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "עדכון בלוח האימונים";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: rooted("/icons/icon-192.png"),
      badge: rooted("/icons/icon-192.png"),
      dir: "rtl",
      lang: "he",
      tag: data.tag,
      data: { url: data.url || rooted("/") },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
