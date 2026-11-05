import type { MetadataRoute } from "next";

// Manifest colours are CSS colour strings, so they repeat tokens.css:
// background_color is --bg and theme_color is --control.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WaveParticle",
    short_name: "WaveParticle",
    description: "Pick a companion, set a goal, and start.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#eae9e7",
    theme_color: "#426f4c",
    lang: "en",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
