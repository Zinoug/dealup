import type { Metadata, Viewport } from "next";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "DealUp — Analyse une annonce Leboncoin avant d’acheter",
    template: "%s | DealUp",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "analyser annonce Leboncoin",
    "acheter iPhone occasion",
    "vérifier iPhone occasion",
    "estimation prix iPhone occasion",
    "MacBook occasion",
    "arnaque Leboncoin iPhone",
    "checklist achat iPhone",
  ],
  authors: [{ name: "DealUp", url: SITE_URL }],
  creator: "DealUp",
  publisher: "DealUp",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [{ url: "/dealup-app-icon.png", type: "image/png" }],
    apple: [{ url: "/dealup-app-icon.png" }],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: "DealUp — Vérifie l’appareil avant de l’acheter",
    description: SITE_DESCRIPTION,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "DealUp analyse une annonce Leboncoin avant l’achat" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "DealUp — Vérifie l’appareil avant de l’acheter",
    description: SITE_DESCRIPTION,
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  category: "shopping",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: "#002c20",
  width: "device-width",
  initialScale: 1,
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/dealup-app-icon.png`,
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  inLanguage: "fr-FR",
  description: SITE_DESCRIPTION,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>
        <script
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
          type="application/ld+json"
        />
        <script
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
          type="application/ld+json"
        />
        {children}
      </body>
    </html>
  );
}

