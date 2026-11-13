/* Klodi — service worker.
   Potreben, da je aplikacijo mogoče namestiti kot PWA (Android Chrome zahteva
   registriran SW s "fetch" poslušalcem), poskrbi pa tudi za osnovno delovanje
   brez povezave.

   Strategija:
   - nespremenljiva sredstva /_next/static/* (hash v imenu) — predpomnilnik najprej;
   - vse ostalo (strani, RSC, ikone) — mreža najprej, predpomnilnik le kot rezerva.
   Ob spremembi te datoteke povečaj VERZIJA. */

const VERZIJA = "v2";
const CACHE = "klodi-" + VERZIJA;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((k) => Promise.all(k.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase in tuje zahteve prepusti brskalniku
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/runner/")) return;

  // Nespremenljiva sredstva: iz predpomnilnika takoj, sicer prenesi in shrani.
  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res && res.ok) {
              const kopija = res.clone();
              caches.open(CACHE).then((c) => c.put(req, kopija));
            }
            return res;
          })
      )
    );
    return;
  }

  // Ostalo: najprej mreža (svež odgovor), ob izpadu predpomnjena različica.
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok && req.mode === "navigate") {
          const kopija = res.clone();
          caches.open(CACHE).then((c) => c.put(req, kopija));
        }
        return res;
      })
      .catch(() =>
        caches
          .match(req)
          .then((hit) => hit || (req.mode === "navigate" ? caches.match("/") : Response.error()))
      )
  );
});
