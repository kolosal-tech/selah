// Service worker Selah — mode Lite / zones à très faible connexion.
//
// Deux stratégies, volontairement séparées :
//   - navigation : réseau d'abord, page de repli hors ligne si le réseau manque.
//     Un fil mis en cache donnerait de la prière périmée affichée comme fraîche.
//   - fichiers statiques : cache d'abord, c'est ce qui coûte cher en 2G.
//
// Rien de ce qui vient de Supabase n'est mis en cache : ces réponses sont
// personnelles et soumises à la RLS.

const CACHE = "selah-v1";
const HORS_LIGNE = "/hors-ligne";
const PRECHARGE = [HORS_LIGNE, "/manifest.json", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECHARGE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((noms) => Promise.all(noms.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const requete = event.request;
  if (requete.method !== "GET") return;

  const url = new URL(requete.url);
  if (url.origin !== self.location.origin) return; // Supabase, polices, etc.

  if (requete.mode === "navigate") {
    event.respondWith(fetch(requete).catch(() => caches.match(HORS_LIGNE)));
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || PRECHARGE.includes(url.pathname)) {
    event.respondWith(
      caches.match(requete).then(
        (enCache) =>
          enCache ||
          fetch(requete).then((reponse) => {
            const copie = reponse.clone();
            caches.open(CACHE).then((c) => c.put(requete, copie));
            return reponse;
          }),
      ),
    );
  }
});
