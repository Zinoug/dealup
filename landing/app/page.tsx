import { DeviceMockup } from "@/components/device-mockup";
import { DeviceCategories } from "@/components/device-categories";
import { FeatureShowcase } from "@/components/feature-showcase";
import { ChevronDownIcon } from "@/components/icons";
import { PageView } from "@/components/page-view";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { StoreBadges } from "@/components/store-badges";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const faqs = [
  {
    question: "Que vérifie DealUp AI ?",
    answer:
      "DealUp AI analyse les informations de l’annonce, les photos, le prix, les preuves disponibles et ton mode d’achat. Le rapport fait ressortir les incohérences, les vérifications prioritaires et la prochaine action utile.",
  },
  {
    question: "Quels appareils sont compatibles ?",
    answer:
      "Au lancement : les iPhone 11 et suivants, les iPhone SE de 2e et 3e génération, ainsi que les MacBook Air et MacBook Pro avec une puce Apple M1 ou plus récente.",
  },
  {
    question: "Puis-je ajouter la réponse du vendeur ?",
    answer:
      "Oui. Tu peux ajouter un message ou des captures du vendeur. DealUp AI reprend le rapport existant sans consommer une nouvelle analyse.",
  },
  {
    question: "DealUp AI garantit-il l’achat ?",
    answer:
      "Non. DealUp AI est une aide à la décision et ne certifie ni l’authenticité, ni l’absence de vol, ni l’état réel de l’appareil. L’application t’aide à poser les bonnes questions et à effectuer les bons contrôles.",
  },
] as const;

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map(({ question, answer }) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: { "@type": "Answer", text: answer },
  })),
};

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SITE_NAME,
  applicationCategory: "ShoppingApplication",
  operatingSystem: "iOS",
  url: SITE_URL,
  description:
    "Application iOS d’aide à la décision pour analyser des annonces Leboncoin d’iPhone et de MacBook d’occasion.",
};

function RatingStars() {
  return (
    <svg aria-hidden="true" className="minimal-social-proof__stars" viewBox="0 0 104 18">
      {[0, 21.5, 43, 64.5, 86].map((x) => (
        <path d="M9 1.4 11.35 6l5.15.73-3.72 3.59.88 5.08L9 13l-4.66 2.4.88-5.08L1.5 6.73 6.65 6 9 1.4Z" key={x} transform={`translate(${x} 0)`} />
      ))}
    </svg>
  );
}

export default function Home() {
  return (
    <>
      <PageView page="home" />
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        type="application/ld+json"
      />
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
        type="application/ld+json"
      />

      <SiteHeader />

      <main className="minimal-landing">
        <section className="minimal-hero">
          <div className="page-container minimal-hero__inner">
            <div className="minimal-hero__copy">
              <div aria-label="Note de 4,9 étoiles sur 5 sur l’App Store" className="minimal-social-proof">
                <span aria-hidden="true" className="minimal-social-proof__laurel minimal-social-proof__laurel--left" />
                <span className="minimal-social-proof__copy">
                  <RatingStars />
                  <strong>4,9 sur l’App Store</strong>
                </span>
                <span aria-hidden="true" className="minimal-social-proof__laurel minimal-social-proof__laurel--right" />
              </div>
              <h1>Vérifie l’appareil avant de l’acheter.</h1>
              <p>
                DealUp AI analyse le prix, les photos et les preuves d’une annonce Leboncoin. Tu sais quoi vérifier, quoi proposer et quand passer ton tour.
              </p>
              <StoreBadges location="hero" />
            </div>

            <div className="minimal-hero__phones" aria-label="Captures réelles de l’application DealUp AI">
              <DeviceMockup
                alt="Accueil de l’application DealUp AI"
                className="minimal-hero__phone minimal-hero__phone--home"
                priority
                screenshot="/screens/official/home.webp"
              />
              <DeviceMockup
                alt="Rapport d’analyse DealUp AI"
                className="minimal-hero__phone minimal-hero__phone--report"
                priority
                screenshot="/screens/official/report-overview.webp"
              />
            </div>
          </div>
        </section>

        <section className="minimal-intro">
          <div className="page-container minimal-intro__inner">
            <h2>Une annonce ne raconte jamais toute l’histoire.</h2>
            <p>
              DealUp AI rassemble les informations dispersées et les transforme en une décision simple : acheter, négocier, vérifier d’abord ou passer.
            </p>
          </div>
        </section>

        <section className="minimal-features" id="rapport">
          <div className="page-container">
            <div className="minimal-heading">
              <h2>Le rapport qui t’aide vraiment à décider.</h2>
              <p>Clique sur une fonctionnalité pour voir l’écran correspondant.</p>
            </div>
            <FeatureShowcase />
          </div>
        </section>

        <section className="minimal-steps" id="fonctionnement">
          <div className="page-container">
            <div className="minimal-heading minimal-heading--left">
              <h2>Trois étapes, pas de détour.</h2>
            </div>
            <ol>
              <li>
                <span>01</span>
                <strong>Partage l’annonce</strong>
                <p>Depuis Leboncoin ou en collant son URL.</p>
              </li>
              <li>
                <span>02</span>
                <strong>Ajoute ton contexte</strong>
                <p>Sur place, livraison et échanges avec le vendeur.</p>
              </li>
              <li>
                <span>03</span>
                <strong>Décide avec le rapport</strong>
                <p>Prix, risques, message vendeur et checklist.</p>
              </li>
            </ol>
          </div>
        </section>

        <section className="minimal-devices" id="appareils">
          <div className="page-container">
            <div className="minimal-heading minimal-heading--left minimal-heading--dark">
              <h2>Appareils compatibles.</h2>
              <p>Sélectionne une catégorie pour voir les modèles pris en charge.</p>
            </div>
            <DeviceCategories />
          </div>
        </section>

        <section className="minimal-faq" id="faq">
          <div className="page-container minimal-faq__inner">
            <h2>Questions fréquentes</h2>
            <div>
              {faqs.map(({ question, answer }) => (
                <details key={question}>
                  <summary>{question}<ChevronDownIcon /></summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="minimal-final">
          <div className="page-container minimal-final__inner">
            <div>
              <h2>Achète avec plus de certitudes.</h2>
              <p>DealUp AI arrive bientôt sur mobile.</p>
            </div>
            <StoreBadges location="final_cta" />
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
