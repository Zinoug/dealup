import type { Metadata } from "next";
import Link from "next/link";
import { InformationPage } from "@/components/information-page";

export const metadata: Metadata = {
  title: "Support",
  description: "Contacter simplement le support DealUp.",
  alternates: { canonical: "/support/" },
};

export default function SupportPage() {
  return (
    <InformationPage
      eyebrow="Support"
      intro="Une question sur ton compte, un achat ou une analyse ? Écris-nous simplement par e-mail."
      title="Comment peut-on t’aider ?"
    >
      <section className="support-contact">
        <h2>Contacter DealUp</h2>
        <p>Pense à indiquer l’adresse liée à ton compte et à décrire brièvement le problème rencontré.</p>
        <a href="mailto:support@joindealup.com">support@joindealup.com</a>
      </section>

      <section>
        <h2>Achats et abonnement</h2>
        <p>
          Tu peux restaurer tes achats depuis l’application. La gestion ou l’annulation d’un abonnement s’effectue
          depuis les réglages de ton compte Apple.
        </p>
      </section>

      <section>
        <h2>Compte et données</h2>
        <p>
          La suppression du compte est disponible directement dans l’application. Tu peux consulter notre
          <Link href="/confidentialite/"> politique de confidentialité</Link> pour en savoir plus.
        </p>
      </section>
    </InformationPage>
  );
}
