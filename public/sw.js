// Akiya Dream — service worker minimal pour la Phase Q (checklist de visite
// hors ligne). Écrit à la main plutôt qu'avec une librairie PWA : une seule
// stratégie, simple à expliquer, sans liste de fichiers à précharger qui
// casserait à chaque build (les noms des bundles Next.js changent).
//
// Stratégie unique pour toutes les requêtes GET (pages comme appels
// Supabase) : réseau d'abord (données à jour si en ligne), cache en secours
// si hors ligne. La première visite doit donc avoir eu lieu avec réseau
// (ex. préparation à l'hôtel) pour que le cache existe une fois sur place.

const CACHE_NAME = "akiya-dream-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached ?? Response.error())),
  );
});
