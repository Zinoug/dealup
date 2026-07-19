import type {
  AnalysisResult,
  DeviceCategory,
  DeviceProfile,
  ListingTeaser,
  ReportTemplate,
} from '@/types/domain';

const FIXTURE_LISTING_URL =
  'https://www.leboncoin.fr/ad/telephones_objets_connectes/2893317712';

export const demoListing: ListingTeaser = {
  identificationId: 'listing_demo_iphone_15',
  sourceUrl: FIXTURE_LISTING_URL,
  title: 'iPhone 15 Pro — 256 Go — Titane naturel',
  priceCents: 75000,
  currency: 'EUR',
  previewPhotoUrls: [],
  location: 'Paris 11e',
  photoCount: 7,
  facts: ['256 Go', 'Batterie 91 %', 'Facture annoncée', 'Remise en main propre'],
  sellerName: 'Vendeur Leboncoin',
  postedLabel: 'Mise en ligne aujourd’hui',
  compatibility: {
    status: 'SUPPORTED',
    device: {
      category: 'IPHONE',
      profileCode: 'IPHONE_15_PRO',
      displayName: 'iPhone 15 Pro',
      specs: { storage: '256 Go', color: 'Titane naturel' },
      catalogVersion: '1.0',
    },
  },
};

const templateCopy: Record<ReportTemplate, { score: number; headline: string; explanation: string }> = {
  BUY: {
    score: 88,
    headline: 'Une très bonne base pour acheter sereinement',
    explanation: 'Le prix, l’état visible et les preuves fournies sont cohérents. Termine les contrôles essentiels avant le paiement.',
  },
  NEGOTIATE: {
    score: 78,
    headline: 'Bon appareil, mais le prix peut encore baisser',
    explanation: 'L’annonce est cohérente. Le prix reste au-dessus de la zone d’accord la plus intéressante.',
  },
  VERIFY_FIRST: {
    score: 59,
    headline: 'Intéressant, mais trois preuves manquent encore',
    explanation: 'Ne fais pas d’offre avant d’avoir confirmé la propriété, la batterie et l’absence de verrouillage.',
  },
  PASS: {
    score: 24,
    headline: 'Trop de signaux critiques pour continuer',
    explanation: 'Les incohérences confirmées dépassent le niveau de risque acceptable pour cet achat.',
  },
};

function buildMockReport(template: ReportTemplate, category: DeviceCategory): AnalysisResult {
  const isMac = category === 'MACBOOK';
  const copy = templateCopy[template];
  const listing: ListingTeaser = isMac
    ? {
        ...demoListing,
        identificationId: `listing_demo_macbook_${template.toLowerCase()}`,
        title: 'MacBook Air M2 — 16 Go — 512 Go',
        priceCents: 94000,
        location: 'Lyon 2e',
        facts: ['Puce M2', '16 Go RAM', '512 Go', 'Chargeur inclus'],
      }
    : { ...demoListing, identificationId: `listing_demo_iphone_${template.toLowerCase()}` };
  const device: DeviceProfile = isMac
    ? {
        category: 'MACBOOK' as const,
        profileCode: 'MACBOOK_AIR_M2',
        displayName: 'MacBook Air M2',
        specs: { memory: '16 Go', storage: '512 Go', chip: 'M2' },
        catalogVersion: '1.0',
      }
    : {
        category: 'IPHONE' as const,
        profileCode: 'IPHONE_15_PRO',
        displayName: 'iPhone 15 Pro',
        specs: { storage: '256 Go', color: 'Titane naturel' },
        catalogVersion: '1.0',
      };
  listing.compatibility = { status: 'SUPPORTED', device };
  const asking = listing.priceCents;
  const fair = isMac ? 90000 : 69000;
  const opening = isMac ? 84000 : 65000;
  const agreementLow = isMac ? 87000 : 67000;
  const agreementHigh = isMac ? 90000 : 70000;
  const pass = template === 'PASS';
  const verify = template === 'VERIFY_FIRST';
  const buy = template === 'BUY';

  return {
    id: `analysis_${category.toLowerCase()}_${template.toLowerCase()}`,
    schemaVersion: '2.0',
    templateId: template,
    listing,
    device,
    createdAt: new Date().toISOString(),
    purchaseMode: 'face_to_face',
    verdict: {
      type: template,
      dealScore: copy.score,
      confidence: pass ? 'HIGH' : 'MEDIUM',
      headline: copy.headline,
      explanation: copy.explanation,
    },
    scoreBreakdown: {
      PRICE_VALUE: { score: buy ? 91 : 74, rationale: 'Le prix a été comparé au marché français actuel.' },
      CONDITION: { score: pass ? 35 : 82, rationale: 'Les photos montrent un état globalement cohérent.' },
      PROOFS_OWNERSHIP: { score: verify ? 38 : 78, rationale: 'Les preuves disponibles ont été distinguées des déclarations.' },
      LISTING_CONSISTENCY: { score: pass ? 30 : 86, rationale: 'Le texte, les photos et les caractéristiques ont été comparés.' },
      TRANSACTION_SAFETY: { score: pass ? 20 : 80, rationale: 'La remise en main propre réduit certains risques.' },
    },
    primaryAction: {
      type: pass ? 'AVOID_LISTING' : verify ? 'REQUEST_PROOFS' : buy ? 'START_CHECKLIST' : 'MAKE_OFFER',
      label: pass ? 'Analyser une autre annonce' : verify ? 'Demander les preuves manquantes' : buy ? 'Démarrer la checklist' : `Préparer une offre à ${Math.round(opening / 100)} €`,
      reason: pass ? 'Les points critiques sont confirmés.' : verify ? 'Ces éléments peuvent faire évoluer fortement le verdict.' : 'Cette action est la plus utile avant de poursuivre.',
    },
    pricing: {
      status: pass ? 'UNAVAILABLE' : 'AVAILABLE',
      currency: 'EUR',
      askingPriceCents: asking,
      marketLowCents: pass ? null : fair - 5000,
      marketMedianCents: pass ? null : fair + 2000,
      marketHighCents: pass ? null : fair + 9000,
      fairPriceCents: pass ? null : fair,
      openingOfferCents: pass ? null : opening,
      agreementZoneLowCents: pass ? null : agreementLow,
      agreementZoneHighCents: pass ? null : agreementHigh,
      maxRecommendedCents: pass ? null : agreementHigh + 1000,
      potentialSavingsCents: pass ? null : Math.max(asking - Math.round((agreementLow + agreementHigh) / 2), 0),
      confidence: pass ? 'LOW' : 'HIGH',
      commentary: pass ? 'Le prix ne doit pas guider la décision tant que les incohérences critiques restent présentes.' : 'La zone d’accord tient compte de la configuration et de l’état visible.',
    },
    risks: {
      level: pass ? 'CRITICAL' : verify ? 'HIGH' : 'MEDIUM',
      items: [
        {
          code: isMac ? 'ACTIVATION_LOCK_UNVERIFIED' : 'IMEI_STATUS_UNVERIFIED',
          canonicalTitle: isMac ? 'Verrouillage d’activation non vérifié' : 'Statut IMEI non vérifié',
          status: pass ? 'CONFIRMED' : 'UNVERIFIED',
          severity: pass ? 'CRITICAL' : 'HIGH',
          displayTitle: isMac ? 'Activation Lock reste à contrôler' : 'L’IMEI doit encore être vérifié',
          commentary: pass ? 'Les éléments transmis confirment un blocage incompatible avec un achat sûr.' : 'Aucune preuve exploitable ne permet encore de lever ce point.',
          recommendedCheck: isMac ? 'Demande une déconnexion complète du compte Apple devant toi.' : 'Demande une photo du numéro partiellement masqué puis compare-le sur place.',
        },
        {
          code: isMac ? 'BATTERY_CYCLES_UNVERIFIED' : 'BATTERY_HEALTH_UNVERIFIED',
          canonicalTitle: 'État de batterie non vérifié',
          status: 'UNVERIFIED',
          severity: 'MEDIUM',
          displayTitle: 'La batterie mérite une preuve claire',
          commentary: isMac ? 'Le nombre de cycles n’apparaît sur aucune photo.' : 'Le pourcentage annoncé n’est pas confirmé par une capture.',
          recommendedCheck: isMac ? 'Demande la capture Informations système › Alimentation.' : 'Demande la capture Réglages › Batterie.',
        },
      ],
    },
    positiveSignals: [
      { code: 'MATCHING_PHOTO_SET', label: 'Les photos semblent appartenir au même appareil' },
      { code: 'PRICE_PLAUSIBLE', label: 'Le prix n’est pas anormalement bas' },
      { code: 'IN_PERSON_MEETING_ACCEPTED', label: 'La remise en main propre est possible' },
    ],
    missingInformation: [
      { code: 'PROOF_OF_PURCHASE', priority: 'BLOCKING', label: 'La preuve d’achat reste à confirmer', reason: 'La boîte est mentionnée, mais aucun justificatif correspondant à cet appareil n’est visible.', question: 'Peux-tu envoyer une photo de la preuve d’achat en masquant tes données personnelles ?', evidence: ['DESCRIPTION'] },
      { code: isMac ? 'MDM_STATUS' : 'ACTIVATION_LOCK_STATUS', priority: 'BLOCKING', label: isMac ? 'Le statut MDM reste inconnu' : 'Le verrouillage d’activation reste à contrôler', reason: isMac ? 'Aucune capture ne montre les profils de gestion installés.' : 'Les photos ne permettent pas de confirmer que Localiser sera désactivé.', question: isMac ? 'Peux-tu confirmer que le Mac ne dépend d’aucune entreprise ?' : 'Peux-tu confirmer que Localiser sera désactivé ?', evidence: ['PHOTO_1'] },
    ],
    messages: {
      requestProofs: isMac
        ? 'Bonjour, votre MacBook m’intéresse. Pourriez-vous m’envoyer une capture des cycles de batterie, des caractéristiques système et confirmer l’absence de MDM ? Merci !'
        : 'Bonjour, votre iPhone m’intéresse. Pourriez-vous m’envoyer une capture de la batterie, une preuve d’achat et le numéro IMEI partiellement masqué ? Merci !',
      makeOffer: `Bonjour, si tout est conforme lors des vérifications, je peux vous proposer ${Math.round(opening / 100)} € en remise en main propre.`,
      decline: 'Merci pour votre retour. Je préfère ne pas donner suite à cette transaction. Bonne vente !',
    },
    checklist: {
      beforeMeeting: [
        { code: 'CONFIRM_SAFE_TRANSACTION', label: 'Confirmer un rendez-vous dans un lieu sûr', critical: true },
        { code: 'NO_ADVANCE_PAYMENT', label: 'Ne verser aucun acompte avant vérification', critical: true },
      ],
      duringMeeting: isMac
        ? [
            { code: 'MACBOOK_CHECK_ACTIVATION_LOCK', label: 'Vérifier Activation Lock et Localiser', critical: true },
            { code: 'MACBOOK_CHECK_MDM', label: 'Vérifier l’absence de gestion MDM', critical: true },
            { code: 'MACBOOK_CHECK_BATTERY', label: 'Contrôler l’état et les cycles de batterie', critical: true },
          ]
        : [
            { code: 'IPHONE_CHECK_ACTIVATION_LOCK', label: 'Vérifier que Localiser est désactivé', critical: true },
            { code: 'IPHONE_CHECK_BATTERY', label: 'Contrôler la santé et les cycles de batterie', critical: true },
            { code: 'IPHONE_TEST_FACE_ID', label: 'Configurer et tester Face ID', critical: true },
          ],
      beforePayment: [
        { code: 'WITNESS_SIGN_OUT_AND_ERASE', label: 'Voir le vendeur effacer l’appareil', critical: true },
        { code: 'ACTIVATE_AS_BUYER', label: 'Commencer l’activation avec ton compte', critical: true },
      ],
    },
    availableActions: pass ? ['COMPARE_ANOTHER', 'AVOID_LISTING'] : ['REQUEST_PROOFS', 'MAKE_OFFER', 'START_CHECKLIST', 'COMPARE_ANOTHER'],
    expertNote: 'DealUp distingue les preuves visibles des simples déclarations du vendeur.',
    changeSummary: [],
  };
}

export const reportFixtures = Object.fromEntries(
  (['IPHONE', 'MACBOOK'] as const).flatMap((category) =>
    (['BUY', 'NEGOTIATE', 'VERIFY_FIRST', 'PASS'] as const).map((template) => [
      `${category}_${template}`,
      buildMockReport(template, category),
    ]),
  ),
) as Record<`${DeviceCategory}_${ReportTemplate}`, AnalysisResult>;

export const demoAnalysis = reportFixtures.IPHONE_NEGOTIATE;
