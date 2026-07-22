# DealUp — comportements invisibles et validation avant publication

Dernière vérification statique : 22 juillet 2026.

Ce document décrit le comportement réellement implémenté dans l’app iOS. Il sert de source de vérité pour valider les notifications, les demandes d’avis, les paywalls, les quotas et la préparation TestFlight/App Review.

Légende :

- ✅ vérifié dans le code ;
- ⚠️ décision ou contrôle manuel nécessaire ;
- ⬜ test à réaliser sur un vrai iPhone/TestFlight.

## 1. Décisions produit à valider

- [ ] Rappel local quotidien à **18 h 30**.
- [ ] Texte du rappel : **« Une annonce en vue ? Vérifie-la avec DealUp avant de te décider. »**
- [ ] Demande d’autorisation de notification uniquement au dernier écran de l’onboarding, avec « Plus tard » disponible.
- [ ] Deux occasions automatiques maximum pour demander un avis : première identification compatible, puis premier rapport premium terminé.
- [ ] Paywall sans essai gratuit et sans analyse Gemini gratuite.
- [ ] Mensuel sélectionné par défaut ; Hebdomadaire disponible en second.
- [ ] Recharge de **40 analyses** sélectionnée par défaut ; recharge de 15 disponible.
- [ ] Conserver le prix mensuel ramené à la semaine comme prix principal malgré le risque App Review décrit plus bas.
- [ ] Aucun push serveur pour la V1 ; le rappel reste local, mais le token Expo est enregistré dans l’API pour préparer une activation ultérieure.
- [ ] Outils développeur absents des builds preview et production.

## 2. Notification quotidienne

### Comportement actuel

✅ Le rappel est **local** : il est programmé par iOS et ne passe ni par FastAPI ni par la Lambda. Après consentement, le token Expo Push est toutefois enregistré dans l’API ; aucun service ne l’utilise encore pour envoyer une notification distante.

| Élément | Valeur actuelle |
| --- | --- |
| Heure | 18 h 30, heure locale de l’iPhone |
| Répétition | Tous les jours |
| Titre | Une annonce en vue ? |
| Corps | Vérifie-la avec DealUp avant de te décider. |
| Son | Non |
| Badge | Non |
| Identifiant interne | `dealup_daily_reminder` |

Le dernier écran de l’onboarding présente le rappel :

- « M’avertir » déclenche la demande système iOS ;
- « Plus tard » termine l’onboarding sans demander l’autorisation ;
- un refus ne bloque jamais l’app ;
- « Ton espace » → « Rappel quotidien » permet de retenter ;
- si iOS interdit une nouvelle demande, l’utilisateur doit réactiver les notifications dans Réglages.

Au lancement, l’app vérifie silencieusement qu’un rappel existe **uniquement si l’autorisation est déjà accordée**. Elle ne fait jamais surgir le prompt système au démarrage.

### Comment modifier le rappel

Fichier : `mobile/src/services/notifications.ts`.

- modifier `title` et `body` pour le texte ;
- modifier `hour` et `minute` pour l’heure ;
- garder `DAILY_REMINDER_KIND` stable tant que le comportement reste le même.

Attention : changer le texte ou l’heure dans le code ne remplace pas automatiquement un rappel déjà planifié chez un utilisateur existant. Le remplacement se produit quand il réactive le rappel. Pour migrer tout le monde automatiquement, il faudra versionner le rappel ou forcer une reprogrammation unique au lancement.

### Test TestFlight

- [ ] Installation propre → choisir « M’avertir » → le prompt iOS apparaît une seule fois.
- [ ] Autoriser → vérifier la présence de DealUp dans Réglages → Notifications.
- [ ] Choisir « Plus tard » → aucun prompt et onboarding terminé.
- [ ] Refuser → l’app reste utilisable.
- [ ] Tester « Rappel quotidien » depuis « Ton espace » après autorisation et après refus.
- [ ] Pour tester rapidement, changer temporairement l’heure à quelques minutes dans une branche locale, puis remettre 18 h 30 avant le build final.

## 3. Demandes d’avis App Store

### Occasions automatiques

| Occasion | Déclenchement | Délai | Répétition interne |
| --- | --- | ---: | --- |
| Première identification compatible | La page avec les vraies photos et le résumé de l’annonce est affichée | 1 seconde | Une fois par installation/stockage sécurisé |
| Premier rapport premium terminé | Le premier rapport initial terminé est ouvert | 1 seconde | Une fois par installation/stockage sécurisé |

✅ Une réanalyse ne déclenche pas la deuxième occasion.

✅ Les deux jalons sont mémorisés séparément dans le stockage sécurisé. Le jalon est enregistré avant l’appel à iOS, donc un même jalon ne boucle pas si l’appel échoue.

⚠️ DealUp peut demander l’affichage, mais **iOS décide si le prompt apparaît réellement**. Il peut le supprimer selon ses propres limites et le contexte. Il ne faut donc jamais considérer l’absence du prompt comme un bug métier.

« Ton espace » → « Noter DealUp » ouvre manuellement la fiche App Store avec l’action d’écriture d’un avis lorsque `EXPO_PUBLIC_APP_STORE_URL` est configurée.

Fichiers :

- logique : `mobile/src/services/app-review.ts` ;
- première identification : `mobile/src/app/listing-preview.tsx` ;
- premier rapport : `mobile/src/app/analysis/[id].tsx` ;
- URL App Store : `EXPO_PUBLIC_APP_STORE_URL`.

### Décision recommandée avant publication

Le prompt une seconde après l’identification est très tôt. Ce n’est pas un blocage technique, mais il peut produire des avis peu qualifiés. À valider volontairement :

- [ ] garder les deux occasions actuelles ; ou
- [ ] conserver uniquement le premier rapport terminé.

### Test TestFlight

- [ ] Tester sur une installation propre ; les anciennes clés SecureStore empêchent sinon un nouveau test.
- [ ] Vérifier que le prompt n’empêche aucune navigation.
- [ ] Vérifier qu’une annonce incompatible ne déclenche rien.
- [ ] Vérifier qu’une réanalyse ne déclenche rien.
- [ ] Vérifier « Noter DealUp » avec l’URL publique définitive.

## 4. Paywalls et contexte

### Paywall d’abonnement

Il existe trois contextes visuels mais un seul écran et les mêmes produits RevenueCat.

| Contexte | Moment | Titre |
| --- | --- | --- |
| Analyse iPhone | Après le mode d’achat et le contexte vendeur, au clic final | « Sache si cet iPhone vaut vraiment le coup. » |
| Analyse MacBook | Même moment | « Sache si ce MacBook vaut vraiment le coup. » |
| Générique | Ouvert depuis « Ton espace » | « Prends la bonne décision, annonce après annonce. » |
| Limite d’identification gratuite | Deuxième URL distincte d’un compte gratuit, avant Piloterr | Titre générique, car le nouvel appareil n’est pas encore identifié |

Après achat :

- contexte analyse → lancement immédiat de l’analyse réelle ;
- contexte limite d’identification → identification de l’URL en attente, puis rapport existant ou teaser ;
- contexte générique → retour à l’accueil.

Le paywall est fermable, propose la restauration des achats et contient les liens Conditions, Confidentialité et Aide.

### Plans

| Plan | Quota inclus | Présentation |
| --- | ---: | --- |
| Mensuel | 60 nouvelles analyses par mois | sélectionné par défaut, badge « Le plus populaire » |
| Hebdomadaire | 15 nouvelles analyses par semaine | second choix |

Les prix et la devise viennent de RevenueCat/App Store. L’équivalent hebdomadaire du Mensuel est calculé avec `prix mensuel / (31 / 7)` et affiché dans la même devise que le produit.

⚠️ **Risque App Review à valider** : le prix ramené à la semaine est actuellement en grand, alors que le montant réellement facturé par mois est secondaire. Les règles d’abonnement Apple demandent que le montant réellement facturé soit l’élément tarifaire le plus visible. Le fondateur a choisi ce rendu, mais il peut provoquer une demande de correction en review.

Option la plus sûre : rendre « 12,99 € par mois » au moins aussi visible que « 2,93 € / semaine » et conserver l’équivalence comme information secondaire.

### Quota et recharges

Les recharges sont réservées aux abonnés actifs :

| Recharge | Prix produit attendu | Comportement |
| --- | ---: | --- |
| 15 analyses | 4,99 € | paiement unique |
| 40 analyses | 9,99 € | paiement unique, sélectionnée par défaut |

- les prix/devise affichés viennent de RevenueCat ;
- chaque renouvellement ajoute 15 ou 60 crédits inclus et les crédits inclus non utilisés restent cumulés ;
- les crédits sont ajoutés au solde et n’expirent pas ;
- le quota inclus est consommé avant les recharges ;
- un abonné Mensuel épuisé voit les deux recharges ;
- un abonné Hebdomadaire épuisé voit les deux recharges et peut passer au Mensuel ;
- l’achat est resynchronisé avec l’API avant d’afficher le nouveau solde ;
- RevenueCat et le backend sont l’autorité, jamais le téléphone seul.

### Consommation

- première analyse d’une nouvelle annonce : 1 unité ;
- réponse du vendeur/réanalyse : gratuite ;
- rafraîchissement explicite de l’annonce : 1 unité ;
- échec fournisseur après débit : recrédit idempotent ;
- échec d’une réanalyse gratuite : aucun faux message de recrédit ;
- compte gratuit : une seule nouvelle identification Piloterr ;
- même URL déjà identifiée : réutilisation privée sans nouvel appel Piloterr ;
- deuxième URL distincte gratuite : paywall avant Piloterr ;
- annonce déjà analysée : ouverture du rapport existant ;
- annonce identifiée mais non analysée : visible dans l’historique avec « À analyser ».

### Test RevenueCat/TestFlight

- [ ] Produits hebdomadaire, mensuel, top-up 15 et top-up 40 présents dans l’offering de production.
- [ ] Entitlement `premium` attaché aux deux abonnements seulement.
- [ ] Recharges configurées comme consommables.
- [ ] Achat Mensuel, Hebdomadaire, recharge 15 et recharge 40 avec compte sandbox.
- [ ] Annulation de la feuille Apple sans message d’erreur trompeur.
- [ ] Échec réseau pendant achat puis restauration/synchronisation.
- [ ] « Restaurer mes achats » sur une seconde installation.
- [ ] Prix français en EUR et test d’un storefront avec une autre devise.
- [ ] Solde backend augmenté exactement une fois après recharge.
- [ ] Webhook RevenueCat reçu une seule fois par événement et signature vérifiée.
- [ ] Expiration/annulation d’abonnement correctement reflétée par `/v1/billing/sync`.

## 5. Autres comportements invisibles

### Outils développeur

✅ `eas.json` force `EXPO_PUBLIC_DEV_TOOLS=false` en preview et production.

Le laboratoire de rapports et la relecture de l’animation ne sont disponibles qu’avec `__DEV__` et les outils développeur actifs. Ils réutilisent un rapport existant et ne doivent appeler ni Piloterr, ni Gemini, ni consommer de quota.

### Données et télémétrie

- PostHog utilise l’UUID interne DealUp comme `distinct_id` ;
- l’e-mail et le fournisseur d’authentification sont seulement des propriétés de personne ;
- les URL complètes, messages vendeur, photos et payloads fournisseur ne doivent jamais être envoyés ;
- Sentry reçoit les erreurs et un identifiant interne, avec contexte nettoyé ;
- RevenueCat reçoit l’UUID interne comme App User ID et `$email` comme attribut d’affichage ;
- les médias privés sont servis avec des URL S3 signées et temporaires.

### Authentification et suppression

- compte Clerk obligatoire avant l’identification ;
- e-mail/mot de passe, Apple et Google disponibles ;
- Apple « Masquer mon e-mail » doit fonctionner ;
- « Supprimer mon compte » demande la saisie de « supprimer » puis supprime les données privées et médias ;
- la déconnexion/suppression doit revenir à l’authentification sans laisser l’interface connectée derrière une sheet.

## 6. Checklist TestFlight complète

### Build et environnement

- [ ] Build **production**, pas development client.
- [ ] `EXPO_PUBLIC_APP_ENV=production` et `EXPO_PUBLIC_DEV_TOOLS=false`.
- [ ] URL API HTTPS de production.
- [ ] Clé Clerk **production**.
- [ ] Clé publique RevenueCat iOS de production.
- [ ] IDs exacts des quatre produits et de l’entitlement.
- [ ] Clé/host PostHog UE, DSN Sentry et URL App Store.
- [ ] Aucun secret serveur dans une variable `EXPO_PUBLIC_*`.
- [ ] Backend `/health` et `/ready` verts ; migration Alembic appliquée.
- [ ] Lambda, Gemini, Piloterr, S3, RevenueCat webhook et e-mail Clerk opérationnels.

### Appareils et affichage

- [ ] iPhone 13/14 ou petit écran supporté.
- [ ] iPhone Pro Max/récent.
- [ ] Taille de texte normale et au moins une taille augmentée.
- [ ] Mode sombre imposé cohérent, safe areas, clavier et rotation portrait.
- [ ] Aucun texte coupé, bouton masqué, sheet refermable ou scroll bloqué.
- [ ] Réduire les animations activé : rapport et onboarding restent utilisables.

### Auth et onboarding

- [ ] Inscription e-mail, mot de passe, confirmation, OTP et reconnexion.
- [ ] Connexion Apple réelle, dont « Masquer mon e-mail ».
- [ ] Connexion Google réelle.
- [ ] Déconnexion puis reconnexion.
- [ ] Onboarding affiché seulement au nouveau compte.
- [ ] Les cinq écrans tiennent sur les appareils ciblés.
- [ ] Autoriser/refuser/ignorer les notifications.
- [ ] Conditions et Confidentialité ouvrent les bonnes pages.

### Identification et partage

- [ ] Coller une URL Leboncoin valide.
- [ ] URL invalide : erreur flottante claire, sans casser la mise en page.
- [ ] iPhone supporté, MacBook supporté, appareil inconnu et appareil refusé.
- [ ] Galerie, plein écran, fermeture et photos HD.
- [ ] Première identification gratuite ; deuxième URL → paywall sans appel Piloterr.
- [ ] Même URL → teaser ou rapport existant, sans duplication.
- [ ] Action Extension « Analyser avec DealUp » connectée.
- [ ] Action Extension quand l’app est déconnectée : auth → onboarding si nécessaire → URL conservée → identification.
- [ ] Ouverture à froid et à chaud depuis Leboncoin.

### Analyse et rapport

- [ ] Main propre, livraison, « je ne sais pas ».
- [ ] Avec et sans réponse vendeur ; texte éditable et médias ajoutables.
- [ ] Paywall seulement sur l’action finale pour le compte gratuit.
- [ ] Analyse réelle terminée en premier plan et après retour d’arrière-plan.
- [ ] Échec, timeout, réponse Gemini invalide : animation arrêtée et message simple.
- [ ] Débit unique et recrédit unique après échec payant.
- [ ] Rapport BUY, NEGOTIATE, VERIFY_FIRST et PASS.
- [ ] Prix indisponible sans disparition du rapport.
- [ ] Sticky bar, réorganisation des sections, checklist et copie du message.
- [ ] Confirmation visuelle après copie.
- [ ] Réanalyse gratuite sans débit ; refresh payant avec débit.
- [ ] Historique et accueil affichent les vraies miniatures.
- [ ] Suppression d’analyse puis suppression du compte.

### Observabilité

- [ ] Événements PostHog principaux reçus avec l’UUID interne.
- [ ] Aucun contenu privé dans PostHog.
- [ ] Erreur de test visible dans Sentry avec release/build, sans secret.
- [ ] RevenueCat affiche l’utilisateur, l’e-mail et les achats attendus.
- [ ] Logs backend/worker contiennent request/analysis IDs, sans payload privé.

### Réseau et résilience

- [ ] Wi-Fi, 4G/5G, réseau lent et coupure pendant chaque étape critique.
- [ ] Test sur réseau IPv6-only si possible.
- [ ] API indisponible : message récupérable, pas de boucle infinie.
- [ ] Double clic achat/analyse : idempotence et aucun double débit.

## 7. Checklist App Store Connect et App Review

### Métadonnées

- [ ] Nom affiché sur iPhone : **DealUp** ; nom App Store : **DealUp AI**.
- [ ] Description fidèle, sans promesse de certification, d’authenticité ou d’absence d’arnaque garantie.
- [ ] Captures 6,5/6,7 pouces dans le bon ordre et sans prix obsolète.
- [ ] URL support : `https://joindealup.com/support/`.
- [ ] URL confidentialité : `https://joindealup.com/confidentialite/`.
- [ ] Conditions/EULA accessibles dans l’app et dans la description si nécessaire.
- [ ] Classification d’âge et catégories renseignées honnêtement.
- [ ] Chine continentale désactivée pour la V1 sauf validation spécifique du service IA.
- [ ] Droits/licences vérifiés pour les visuels Apple, Leboncoin et cadres d’appareils utilisés dans les captures.

### Confidentialité

- [ ] Questionnaire « App Privacy » aligné avec Clerk, RevenueCat, PostHog, Sentry, Piloterr, Gemini, S3 et l’API DealUp.
- [ ] Déclarer notamment identifiants de compte, e-mail, achats, contenu utilisateur, photos, diagnostics et données d’usage selon leur utilisation réelle.
- [ ] Politique publique cohérente avec le traitement IA, les médias privés, la conservation et la suppression.
- [ ] `PrivacyInfo.xcprivacy` et manifests des SDK présents dans l’archive.
- [ ] Tracking déclaré « non » seulement si aucun usage réel ne relève de l’ATT/tracking inter-apps.

⚠️ Le manifest applicatif actuel contient les raisons d’accès système mais `NSPrivacyCollectedDataTypes` est vide. Il faut le réconcilier avec la collecte réelle et surtout avec le questionnaire App Privacy avant soumission.

### Achats intégrés

- [ ] Les deux abonnements et deux consommables sont « Ready to Submit » et attachés à la version.
- [ ] Localisations, prix, captures de review et textes de chaque IAP remplis.
- [ ] Groupe d’abonnements correctement configuré.
- [ ] Restauration accessible.
- [ ] Conditions et Confidentialité accessibles depuis le paywall.
- [ ] Valeur continue de l’abonnement clairement expliquée.
- [ ] Hiérarchie tarifaire validée malgré le risque signalé.

### Compte de review et notes Apple

- [ ] Créer `appreview@joindealup.com` dans Clerk production avec mot de passe stable et e-mail vérifié.
- [ ] Se connecter une fois afin de créer l’utilisateur interne et RevenueCat.
- [ ] Accorder temporairement l’entitlement premium via RevenueCat pour toute la review.
- [ ] Vérifier que ce compte voit les analyses et peut lancer tout le parcours sans OTP supplémentaire.
- [ ] Ne jamais fournir un Apple ID personnel.

Notes App Review recommandées :

```text
DealUp AI aide un acheteur à évaluer une annonce Leboncoin d’appareil d’occasion.
L’app analyse les informations et photos de l’annonce, puis génère un rapport d’aide à la décision. Elle ne certifie ni l’authenticité, ni l’identité du vendeur.

Compte de démonstration :
E-mail : appreview@joindealup.com
Mot de passe : [À RENSEIGNER DANS APP STORE CONNECT UNIQUEMENT]

Le compte possède un accès premium afin de tester une analyse complète.
Parcours conseillé : connexion → coller une URL de test fournie ci-dessous → répondre aux deux questions → lancer l’analyse → consulter le rapport et la checklist.

URL Leboncoin de test : [URL STABLE À RENSEIGNER]

L’Action Extension iOS apparaît dans la feuille de partage sous « Analyser avec DealUp ».
Les notifications de la V1 sont locales et facultatives. Aucun push marketing serveur n’est envoyé.
Le traitement d’analyse utilise des prestataires externes et les données restent privées au compte.
```

### Contrôle final avant « Submit for Review »

- [ ] Build TestFlight exact validé, sans nouveau commit/configuration après test.
- [ ] Aucun crash bloquant dans Sentry sur ce build.
- [ ] Backend et worker production testés avec le compte App Review.
- [ ] Abonnements achetables dans l’environnement Apple attendu.
- [ ] Liens juridiques publics et support répondant.
- [ ] Vidéo courte du parcours sur appareil réel disponible pour les notes si Apple en a besoin.
- [ ] Export compliance renseigné (`ITSAppUsesNonExemptEncryption=false` si toujours exact).
- [ ] Toutes les questions App Privacy validées une dernière fois.
- [ ] Prix réellement facturé suffisamment clair sur chaque paywall.

## 8. Résultat de l’audit statique actuel

### Déjà en place

- ✅ rappel local facultatif ;
- ✅ deux jalons d’avis séparés ;
- ✅ paywalls fermables avec restauration et liens juridiques ;
- ✅ suppression du compte dans l’app ;
- ✅ Sign in with Apple présent avec Google/e-mail ;
- ✅ Privacy Manifest présent ;
- ✅ outils développeur désactivés en preview/production ;
- ✅ recharges 15/40 et upsell Mensuel pour l’Hebdomadaire ;
- ✅ Action Extension et App Group déclarés.

### À trancher ou corriger avant soumission

1. ⚠️ valider ou corriger la hiérarchie « équivalent semaine » / montant mensuel facturé ;
2. ⚠️ aligner App Privacy et le manifest avec les données réellement collectées ;
3. ⚠️ décider si le prompt d’avis après une seconde d’identification est conservé ;
4. ⬜ tester Apple, Google, RevenueCat et l’Action Extension dans le build TestFlight production ;
5. ⬜ créer et valider le compte premium App Review ;
6. ⬜ vérifier les droits de tous les visuels commerciaux et captures App Store ;
7. ⬜ effectuer la matrice TestFlight ci-dessus sur au moins deux tailles d’iPhone.

## 9. Plan PostHog recommandé

Cette section décrit la cible analytique à valider avant implémentation. Le principe est de garder un événement par étape métier et d’utiliser des propriétés pour les variantes.

### Funnel principal

```text
sign_up_completed / sign_in_completed
→ onboarding_step_viewed
→ onboarding_completed
→ listing_url_submitted
→ listing_identified ou listing_identification_failed
→ analysis_form_started
→ analysis_form_completed
→ paywall_viewed
→ purchase_started
→ purchase_completed
→ analysis_started
→ analysis_completed ou analysis_failed
→ report_opened
→ recommended_action_used / seller_message_copied
```

### Événements à conserver

| Événement | Propriétés principales |
| --- | --- |
| `sign_up_completed`, `sign_in_completed` | `method` |
| `onboarding_step_viewed` | `step`, `step_key`, `step_count` |
| `onboarding_completed` | aucune propriété privée |
| `notification_permission_finished` | `result`, ajouter `source` |
| `listing_url_submitted` | `source`: manual/share_extension/notification |
| `listing_identified` | `source`, `compatibility_status`, `device_category`, `photo_count` |
| `listing_identification_failed` | `source`, `error_code` |
| `analysis_form_started`, `analysis_form_completed` | catégorie, mode d’achat, contexte vendeur, nombre de médias |
| `paywall_viewed` | `context`, produit sélectionné, catégorie, `entry_source` |
| `paywall_plan_selected` | `plan`, `context` |
| `purchase_started`, `purchase_completed`, `purchase_cancelled`, `purchase_failed` | type, plan/quantité, contexte, source d’attribution, code d’erreur si échec |
| `purchases_restored` | surface d’origine |
| `analysis_started` | `kind`, catégorie, mode, source du quota, contexte vendeur |
| `analysis_completed` | `kind`, catégorie, template, verdict, tranche de score, durée et nombres d’images |
| `analysis_failed` | `kind`, catégorie, `error_code`, étape, durée, `is_timeout` |
| `report_opened` | catégorie, verdict, template, tranche de score |
| `seller_message_copied` | type de message, surface, catégorie/verdict si utile |
| `recommended_action_used` | type d’action, surface, catégorie/verdict |
| `account_deleted` | aucune donnée privée |

Les identifiants d’analyse peuvent rester sur les événements techniques pour relier un échec, mais ils ne doivent pas devenir une propriété de personne.

### Événements à fusionner ou retirer

- retirer `listing_incompatible` : `listing_identified.compatibility_status` contient déjà l’information ;
- retirer `paywall_required_after_identification_limit` : utiliser `paywall_viewed.context=identification_limit` ;
- fusionner `topup_purchased` dans `purchase_completed` avec `product_type=top_up` et `quantity` ;
- fusionner `reanalysis_completed` dans `analysis_completed` avec `kind=reanalysis` ;
- fusionner `analysis_timed_out` dans `analysis_failed` avec `is_timeout=true` et le code d’erreur ;
- retirer `seller_reply_added` : `analysis_started.kind=reanalysis` et `has_seller_context` suffisent ;
- retirer `reanalysis_started` côté mobile : l’événement serveur `analysis_started` confirme que le job existe réellement ;
- retirer `onboarding_step_completed` si l’étape suivante est vue : `onboarding_step_viewed` plus `onboarding_completed` suffisent pour le funnel ;
- conserver `analysis_retried`, `topup_sync_pending` et les événements de mot de passe comme événements de diagnostic, hors dashboard acquisition/conversion.

### Événements à ajouter

| Événement | Pourquoi |
| --- | --- |
| `paywall_dismissed` | mesurer l’abandon réel par contexte et plan sélectionné |
| `daily_reminder_scheduled` | confirmer que le rappel local a réellement été programmé |
| `notification_opened` | mesurer le clic sur le rappel quotidien |
| `app_review_requested` | remplacer le nom trompeur `app_review_prompt_finished` |
| `app_review_cta_clicked` | mesurer le bouton manuel « Noter DealUp » |

Il n’est pas possible de savoir de manière fiable qu’une notification locale a été **vue ou livrée** lorsque l’app est fermée. On peut mesurer :

- l’autorisation ;
- la programmation locale ;
- le clic/ouverture ;
- le parcours effectué après ce clic.

Il ne faut pas créer un faux événement `notification_sent` : aucun serveur ne l’envoie et iOS ne garantit pas un accusé de livraison exploitable.

### Attribution notification → paiement

Lors d’un `notification_opened`, l’app doit mémoriser localement :

```text
entry_source=daily_reminder
notification_kind=dealup_daily_reminder
notification_opened_at=<timestamp>
```

Pendant une fenêtre de **24 heures**, ces propriétés sont copiées dans `listing_url_submitted`, `paywall_viewed`, `purchase_started` et `purchase_completed` :

```text
attribution_source=daily_reminder
attribution_window_hours=24
```

Ainsi, le paiement venant d’une notification se mesure directement sur `purchase_completed`; aucun événement séparé n’est nécessaire. Après 24 heures, ou après un achat attribué, l’attribution locale est effacée.

### Contextes de paywall obligatoires

```text
analysis
identification_limit
generic_profile
quota_exhausted
topup_from_profile
```

Le code actuel classe encore le contexte d’identification comme générique dans `paywall_viewed`. Cela doit être corrigé avant de construire les funnels.

### Propriétés de personne

À conserver :

```text
email
auth_provider
plan
subscription_active
quota_limit
quota_used
quota_remaining
topup_remaining
onboarding_completed
account_created_at
```

Ne pas ajouter comme propriétés de personne : URL Leboncoin, titre d’annonce, texte vendeur, photos, score détaillé, IMEI, ville précise ou identifiant d’analyse.

La version de l’app, le build, iOS, le modèle d’appareil et la locale peuvent rester des propriétés automatiques d’événement. Les jalons `first_identification` et `first_analysis` sont calculables depuis les événements et n’ont pas besoin d’être dupliqués sur la personne.

### Dashboards minimaux

1. **Activation** : inscription → onboarding terminé → première identification compatible.
2. **Conversion** : paywall vu → plan choisi → achat commencé → achat terminé, segmenté par `context`.
3. **Analyse** : formulaire commencé → analyse démarrée → terminée/échouée → rapport ouvert.
4. **Valeur** : message copié, action utilisée, réanalyse lancée.
5. **Notifications** : autorisation → rappel programmé → rappel ouvert → paywall/achat attribué.
6. **Fiabilité** : taux d’échec/timeout, durée p50/p95, étape et code d’erreur.
