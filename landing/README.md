# DealUp AI Landing

Landing marketing statique de DealUp AI destinée à `joindealup.com`.

Elle présente uniquement l’application, son fonctionnement, ses rapports et les appareils compatibles. Les tarifs restent volontairement absents de la landing. Elle n’intègre ni analyse web, ni waitlist, ni parrainage.

## Démarrage

```bash
cp .env.example .env.local
npm install
npm run dev
```

Le site est disponible sur [http://localhost:3000](http://localhost:3000).

## Variables

```text
NEXT_PUBLIC_SITE_URL=https://joindealup.com
NEXT_PUBLIC_APP_STORE_URL=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
```

- laisser `NEXT_PUBLIC_APP_STORE_URL` vide ouvre une modale « Bientôt disponible » depuis les badges officiels ;
- renseigner l’URL App Store transforme automatiquement tous les CTA en liens suivis ;
- PostHog reste désactivé proprement quand sa clé est absente.

## Pages indexables

- `/` : présentation complète de DealUp AI ;
- `/support/` : contact support par e-mail ;
- `/confidentialite/` : politique de confidentialité ;
- `/conditions/` : conditions d’utilisation ;
- `/robots.txt` ;
- `/sitemap.xml` ;
- `/manifest.webmanifest`.

La page inclut les métadonnées canonique/Open Graph/Twitter, les données structurées `Organization`, `WebSite`, `SoftwareApplication` et `FAQPage`, ainsi qu’une image sociale générée au build.

## Vérifications

```bash
npm run lint
npm run typecheck
npm run build
```

Le build produit un export statique dans `out/`. Aucun déploiement automatique n’est configuré.

## Visuels mobiles

La landing utilise les badges officiels App Store et Google Play fournis dans
`public/store-badges/`. Tant qu’un store n’est pas disponible, cliquer sur son badge
ouvre une modale discrète au lieu d’un lien mort.

Chaque téléphone assemble deux images séparées :

- `public/device/iphone-16-pro-black.png` : châssis réaliste d’iPhone 16 Pro ;
- une vraie capture fournie depuis `public/screens/official/`.

Le hero présente l’accueil et le rapport. Le showcase change réellement de capture
au clic entre le verdict, le prix et les vérifications. Aucun écran de l’app n’est
reconstruit en HTML ou CSS.

Le châssis provient du projet open source
[Maya](https://github.com/ronaldo-avalos/Maya) et est utilisé sous licence MIT. Une
copie de la licence est conservée dans `public/vendor/maya/LICENSE`.
