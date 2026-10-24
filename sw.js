// Сеть первой (чтобы обновления приходили сразу), кэш — когда нет связи.
const CACHE = "zapomni-v2";
const SHARE = "zapomni-share";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k !== SHARE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

// «Поделиться» из другого приложения: кладём присланное в кэш и открываем приложение.
async function receiveShare(request) {
  const form = await request.formData();
  const c = await caches.open(SHARE);
  const data = { title: form.get("title") || "", text: form.get("text") || "", url: form.get("url") || "" };
  await c.put("shared-data", new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } }));
  const photo = form.get("photo");
  if (photo && photo.size) await c.put("shared-photo", new Response(photo, { headers: { "content-type": photo.type || "image/jpeg" } }));
  else await c.delete("shared-photo");
  return Response.redirect("./?shared=1", 303);
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method === "POST" && url.origin === location.origin && url.pathname.endsWith("/share")) {
    e.respondWith(receiveShare(e.request));
    return;
  }
  if (e.request.method !== "GET" || (url.origin !== location.origin && !url.host.includes("fonts."))) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
