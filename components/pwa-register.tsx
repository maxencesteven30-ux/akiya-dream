"use client";

import { useEffect } from "react";

// Enregistre le service worker (Phase Q) une seule fois au montage. Aucun
// état affiché : un échec d'enregistrement (navigateur non compatible,
// contexte non sécurisé) ne doit jamais bloquer le reste de l'application,
// qui fonctionne normalement sans lui.
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      // Non bloquant et attendu dans certains contextes (navigateur
      // embarqué, politique de sécurité restrictive) : le reste de
      // l'application fonctionne normalement sans lui.
      console.warn("Enregistrement du service worker impossible:", err);
    });
  }, []);

  return null;
}
