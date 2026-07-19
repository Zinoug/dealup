# DealUp Mobile

Application iOS Expo, React Native et TypeScript. Le runtime normal est entièrement connecté à FastAPI, Clerk et RevenueCat : il n’existe plus de faux compte, faux achat, faux quota ou faux historique.

## Démarrage

Cette app contient du code natif (RevenueCat, Apple Sign-In, notifications, Sentry et extension de partage). Expo Go ne suffit pas.

```bash
cp .env.example .env
npm install --include=dev
npx expo prebuild --platform ios
npx expo run:ios
```

Après le premier build natif, démarrer Metro séparément lors des sessions suivantes :

```bash
npx expo start --dev-client
```

Si l’app affiche `No script URL provided`, Metro n’est pas lancé ou le build précédent a échoué. Vérifier aussi l’espace disque disponible avant de reconstruire.

## Intégrations actives

- Clerk : Apple, Google et code reçu par e-mail ;
- FastAPI : token Clerk envoyé dans `Authorization: Bearer …` ;
- RevenueCat : achats, restauration et prix App Store réels ;
- PostHog : UUID interne `/v1/me`, e-mail et fournisseur comme propriétés de personne, événements sans contenu privé ;
- Sentry : erreurs sans PII explicite ;
- historique, quota, rapports et photos : chargés depuis l’API au lancement.
- notifications Expo Push : demandées après une première inscription, réactivables dans « Ton espace », puis envoyées par le worker à la fin d’une analyse.

Les outils de développement sont contrôlés par `EXPO_PUBLIC_DEV_TOOLS`. Ils donnent accès aux huit fixtures visuelles et ajoutent sur un vrai rapport le bouton « Revoir l’animation d’analyse ». Ce replay relit les photos privées déjà archivées et le rapport localement ; il ne crée aucun job, n’appelle ni Piloterr ni Gemini et ne consomme aucun quota. En preview et production, ces outils sont désactivés.

## Variables

Voir `.env.example` et le guide complet [`../docs/operations/configuration.md`](../docs/operations/configuration.md). Les variables `EXPO_PUBLIC_*` sont intégrées au bundle et ne doivent jamais contenir une clé secrète serveur.

## EAS

`eas.json` contient trois profils sans déploiement automatique :

- `development` : dev client interne avec outils développeur ;
- `preview` : build interne connecté au staging, sans fixtures ;
- `production` : build App Store, sans fixtures.

Avant le premier build cloud, exécuter `eas init`, configurer les variables EAS puis :

```bash
eas build --platform ios --profile development
eas build --platform ios --profile production
```

## Vérifications

```bash
NODE_ENV=development npm run lint
npm run typecheck
npx expo export --platform ios
```

L’extension de partage utilise le bundle `com.joindealup.app.ShareExtension` et l’App Group `group.com.joindealup.app`. Le bundle principal est `com.joindealup.app`.

Les spécifications des assets sont dans [`assets/README.md`](assets/README.md).
