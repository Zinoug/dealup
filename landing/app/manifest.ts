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
        src: "/dealup-app-icon.png",
        sizes: "1254x1254",
        type: "image/png",
      },
    ],
  };
}
