import type { Metadata } from "next";
import { InformationPage } from "@/components/information-page";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Comment DealUp AI collecte, utilise et protège les données de ses utilisateurs.",
  alternates: { canonical: "/confidentialite/" },
};

export default function PrivacyPage() {
  return (
    <InformationPage
      eyebrow="Confidentialité"
      intro="Cette politique explique quelles données DealUp AI utilise pour analyser une annonce et faire fonctionner l’application."
      title="Tes données restent privées."
      updated="19 juillet 2026"
    >
      <section>
        <h2>Les données traitées</h2>
        <p>DealUp AI peut traiter les catégories de données suivantes :</p>
        <ul>
          <li>les informations de compte, comme ton adresse e-mail, ton identifiant utilisateur et ton mode de connexion ;</li>
          <li>les annonces que tu soumets, leurs photos, leur contenu et les informations publiques du vendeur présentes dans l’annonce ;</li>
          <li>les messages, captures et photos que tu ajoutes volontairement pour compléter une analyse ;</li>
          <li>les rapports générés, ton historique, tes quotas et ton statut d’abonnement ;</li>
          <li>des données techniques limitées permettant de mesurer l’usage, diagnostiquer une erreur et sécuriser le service.</li>
        </ul>
        <p>DealUp AI ne stocke jamais ton mot de passe ni tes coordonnées bancaires.</p>
      </section>

      <section>
        <h2>Pourquoi ces données sont utilisées</h2>
        <p>
          Elles servent à créer et sécuriser ton compte, identifier une annonce, produire et conserver ton rapport,
          gérer ton accès, restaurer tes achats, répondre au support et améliorer la fiabilité de DealUp AI.
        </p>
        <p>
          Le traitement repose selon le cas sur l’exécution du service demandé, ton consentement, les obligations
          applicables ou l’intérêt légitime de DealUp AI à sécuriser et améliorer l’application.
        </p>
      </section>

      <section>
        <h2>Conservation et suppression</h2>
        <p>
          Les analyses et leurs médias privés sont conservés tant que tu ne les supprimes pas ou tant que ton compte
          reste actif. Tu peux supprimer une analyse ou ton compte depuis l’application. La suppression du compte
          entraîne la suppression de ses analyses et médias privés, sous réserve des données minimales devant être
          conservées pour des raisons légales, de sécurité ou de prévention des abus.
        </p>
      </section>

      <section>
        <h2>Tes droits</h2>
        <p>
          Tu peux demander l’accès, la rectification, l’effacement, la limitation, l’opposition ou la portabilité de
          tes données lorsque ces droits s’appliquent.
        </p>
        <p>
          Pour toute demande, écris à <a href="mailto:support@joindealup.com">support@joindealup.com</a> depuis
          l’adresse associée à ton compte.
        </p>
      </section>
    </InformationPage>
  );
}
