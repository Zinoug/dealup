import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DealUp",
    short_name: "DealUp",
    description:
      "Analyse les annonces Leboncoin d’iPhone et de MacBook avant l’achat.",
    start_url: "/",
    display: "standalone",
    background_color: "#001912",
    theme_color: "#002c20",
    lang: "fr",
    icons: [
      {
        src: "/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
