export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://joindealup.com"
).replace(/\/$/, "");

export const APP_STORE_URL =
  process.env.NEXT_PUBLIC_APP_STORE_URL?.trim() || "";

export const SITE_NAME = "DealUp";

export const SITE_DESCRIPTION =
  "DealUp analyse les annonces Leboncoin d’iPhone et de MacBook d’occasion pour estimer le prix, repérer les risques et préparer les questions à poser au vendeur.";

export const NAVIGATION = [
  { href: "/#fonctionnement", label: "Comment ça marche" },
  { href: "/#rapport", label: "Le rapport" },
  { href: "/appareils-compatibles/", label: "Appareils" },
] as const;
