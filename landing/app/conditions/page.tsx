import type { Metadata } from "next";
import { InformationPage } from "@/components/information-page";

export const metadata: Metadata = {
  title: "Conditions d’utilisation",
  description: "Les conditions essentielles d’utilisation de DealUp.",
  alternates: { canonical: "/conditions/" },
};

export default function TermsPage() {
  return (
    <InformationPage
      eyebrow="Conditions"
      intro="Les règles essentielles pour utiliser DealUp et comprendre le rôle de ses analyses."
      title="Conditions d’utilisation."
      updated="19 juillet 2026"
    >
      <section>
        <h2>1. Définitions</h2>
        <p>
          « Application » désigne l’application mobile DealUp. « Service » désigne l’Application, le site et les
          fonctionnalités associées. « Contenu utilisateur » désigne les liens, textes, photos, captures et autres
          informations que tu transmets. « Tu » désigne toute personne utilisant le Service.
        </p>
      </section>

      <section>
        <h2>2. Acceptation</h2>
        <p>
          En créant un compte ou en utilisant DealUp, tu acceptes ces Conditions et la Politique de confidentialité.
          Si tu ne les acceptes pas, tu ne dois pas utiliser le Service.
        </p>
      </section>

      <section>
        <h2>3. Le Service</h2>
        <p>
          DealUp aide à évaluer certaines annonces Leboncoin d’appareils d’occasion compatibles. L’Application fournit une
          estimation, des points de vigilance, des questions à poser et une checklist pour préparer ta décision.
        </p>
        <p>
          DealUp ne certifie ni l’authenticité, ni la propriété, ni l’absence de vol, ni l’état réel d’un appareil.
          Le rapport ne remplace pas les vérifications sur place. La décision d’achat et la transaction restent sous
          ta responsabilité.
        </p>
      </section>

      <section>
        <h2>4. Compte</h2>
        <p>
          Tu dois fournir des informations exactes, protéger l’accès à ton compte et utiliser DealUp uniquement à des
          fins personnelles et licites. Tu es responsable des actions réalisées depuis ton compte. Tu peux supprimer
          ton compte directement depuis l’Application.
        </p>
      </section>

      <section>
        <h2>5. Contenu utilisateur</h2>
        <p>
          Tu conserves tes droits sur ton Contenu utilisateur. Tu accordes à DealUp une autorisation limitée,
          non exclusive et uniquement nécessaire pour héberger, traiter, analyser et afficher ce contenu afin de te
          fournir le Service.
        </p>
        <p>
          Tu dois disposer des droits nécessaires sur le contenu transmis et éviter d’envoyer des informations
          personnelles inutiles, illicites ou portant atteinte aux droits d’un tiers.
        </p>
      </section>

      <section>
        <h2>6. Usages interdits</h2>
        <p>Il est interdit d’utiliser DealUp pour :</p>
        <ul>
          <li>transmettre un contenu illégal, trompeur, nuisible ou portant atteinte aux droits d’un tiers ;</li>
          <li>contourner les quotas, protections techniques ou mécanismes de paiement ;</li>
          <li>accéder au compte ou aux données d’une autre personne sans autorisation ;</li>
          <li>perturber, copier, revendre ou tenter de désassembler le Service.</li>
        </ul>
      </section>

      <section>
        <h2>7. Abonnements et achats</h2>
        <p>
          Les prix, durées, quotas et conditions affichés au moment de l’achat font foi. Les paiements, renouvellements,
          annulations et éventuels remboursements sont gérés par Apple. Un abonnement peut être géré ou annulé depuis
          les réglages du compte Apple.
        </p>
      </section>

      <section>
        <h2>8. Services tiers</h2>
        <p>
          Certaines fonctions reposent sur des plateformes ou services tiers. Leurs propres conditions peuvent
          s’appliquer à leur utilisation. DealUp ne contrôle pas leurs interruptions ou leurs décisions.
        </p>
      </section>

      <section>
        <h2>9. Propriété intellectuelle</h2>
        <p>
          Le Service, la marque, l’interface et les contenus fournis par DealUp restent la propriété de DealUp ou de
          ses concédants. Aucun droit de copie, modification, distribution ou revente ne t’est accordé.
        </p>
      </section>

      <section>
        <h2>10. Disponibilité et évolution</h2>
        <p>
          Le Service est fourni selon sa disponibilité. DealUp peut évoluer, être temporairement indisponible ou
          refuser une annonce non compatible. Certaines fonctionnalités peuvent être modifiées ou retirées.
        </p>
      </section>

      <section>
        <h2>11. Suspension et suppression</h2>
        <p>
          DealUp peut suspendre ou fermer un compte en cas de fraude, d’abus, de risque de sécurité ou de violation de
          ces Conditions. Tu peux cesser d’utiliser le Service et supprimer ton compte depuis l’Application.
        </p>
      </section>

      <section>
        <h2>12. Responsabilité</h2>
        <p>
          Les résultats automatisés peuvent être incomplets ou inexacts. DealUp n’est pas partie à la transaction entre
          l’acheteur et le vendeur et ne répond pas des actes du vendeur, de l’état réel de l’appareil ou de la décision
          finale d’achat. Rien dans ces Conditions ne limite les droits impératifs dont tu bénéficies en tant que
          consommateur.
        </p>
      </section>

      <section>
        <h2>13. Modification des Conditions</h2>
        <p>
          Ces Conditions peuvent être mises à jour pour refléter une évolution du Service ou des règles applicables.
          Une modification importante sera signalée par un moyen raisonnable avant son entrée en vigueur.
        </p>
      </section>

      <section>
        <h2>14. Droit applicable</h2>
        <p>
          Ces Conditions sont régies par le droit français, sans priver un consommateur des protections impératives
          prévues par le droit de son pays de résidence. En cas de difficulté, contacte d’abord le support afin de
          rechercher une solution amiable.
        </p>
      </section>

      <section>
        <h2>15. Contact</h2>
        <p>
          Une question sur ces conditions ? Écris à <a href="mailto:support@joindealup.com">support@joindealup.com</a>.
        </p>
      </section>
    </InformationPage>
  );
}
