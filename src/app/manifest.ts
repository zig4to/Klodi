import type { MetadataRoute } from "next";

// PWA manifest — Next samodejno servira na /manifest.webmanifest in doda
// <link rel="manifest">. Ikona je vektorska (public/icon.svg); sodobni
// brskalniki jo sprejmejo kot 192/512 prek sizes: "any".
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Klodi",
    short_name: "Klodi",
    description: "Claude Code v oblaku nad tvojimi GitHub repozitoriji.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    lang: "sl",
    dir: "ltr",
    categories: ["developer", "productivity"],
    background_color: "#0f172a",
    theme_color: "#0f172a",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
