import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import { PageView } from "@/components/page-view";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { StoreBadges } from "@/components/store-badges";

export const metadata: Metadata = {
  title: "Appareils compatibles",
  description:
    "Consulte les iPhone et MacBook compatibles avec l’analyse DealUp : iPhone 11 et suivants, SE 2/3 et MacBook Apple Silicon M1 ou plus récent.",
  alternates: {
    canonical: "/appareils-compatibles/",
  },
  openGraph: {
    title: "Appareils compatibles avec DealUp",
    description:
      "iPhone 11 et suivants, iPhone SE 2/3 et MacBook Air ou Pro avec puce Apple M1 ou plus récente.",
    url: "/appareils-compatibles/",
  },
};

const supportedDevices = [
  {
    details: [
      "iPhone 11, 11 Pro et 11 Pro Max",
      "Gammes iPhone 12 et 13",
      "iPhone SE 2 et SE 3",
      "iPhone 14 et générations suivantes",
    ],
    name: "iPhone",
    scope: "Modèle, stockage, batterie, pièces, Face ID, iCloud et cohérence des photos.",
  },
  {
    details: [
      "MacBook Air avec puce Apple M1 ou plus récente",
      "MacBook Pro 13 pouces Apple Silicon",
      "MacBook Pro 14 et 16 pouces Apple Silicon",
    ],
    name: "MacBook",
    scope: "Puce, mémoire, stockage, cycles batterie, Activation Lock, MDM et état général.",
  },
] as const;

export default function CompatibleDevicesPage() {
  return (
    <>
      <PageView page="compatible_devices" />
      <SiteHeader />
      <main className="minimal-compatible">
        <section className="minimal-compatible__hero">
          <div className="page-container">
            <h1>Appareils compatibles.</h1>
            <p>
              DealUp commence par les iPhone récents et les MacBook Apple Silicon pour garder des analyses précises.
            </p>
            <Link href="/#fonctionnement">
              Voir comment fonctionne DealUp <ArrowRightIcon />
            </Link>
          </div>
        </section>

        <section className="minimal-compatible__catalog">
          <div className="page-container">
            {supportedDevices.map((device, index) => (
              <article key={device.name}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h2>{device.name}</h2>
                  <p>{device.scope}</p>
                </div>
                <ul>
                  {device.details.map((detail) => <li key={detail}>{detail}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="minimal-compatible__guardrail">
          <div className="page-container">
            <div>
              <h2>La compatibilité est vérifiée avant le paiement.</h2>
              <p>
                Si l’appareil n’est pas reconnu ou n’est pas encore pris en charge, aucune analyse n’est consommée.
              </p>
            </div>
            <dl>
              <div><dt>MacBook Intel</dt><dd>Non compatible</dd></div>
              <div><dt>iPad</dt><dd>À venir</dd></div>
              <div><dt>Apple Watch</dt><dd>À venir</dd></div>
              <div><dt>Android</dt><dd>À venir</dd></div>
            </dl>
          </div>
        </section>

        <section className="minimal-final">
          <div className="page-container minimal-final__inner">
            <div>
              <h2>Ton appareil est compatible ?</h2>
              <p>DealUp arrive bientôt sur mobile.</p>
            </div>
            <StoreBadges location="compatible_devices_final" />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
