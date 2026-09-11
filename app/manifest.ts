import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Akiya Dream — Simulateur d'achat de maison abandonnée au Japon",
    short_name: "Akiya Dream",
    description:
      "Estimez le coût réel d'achat et de rénovation d'une akiya au Japon, y compris hors ligne pendant une visite.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
