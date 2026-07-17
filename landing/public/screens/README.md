# Captures DealUp pour la landing

## Captures actives

Les captures officielles fournies sont conservées dans `official/` :

- `home.webp` — accueil ;
- `report-overview.webp` — verdict et score ;
- `report-pricing.webp` — prix et action ;
- `report-risks.webp` — risques et checklist ;
- `seller-response.webp` — ajout du contexte vendeur ;
- `checklist.webp` — checklist complète ;
- `actions.webp` — actions disponibles.

Le hero utilise `home.png` et `report-overview.png`. Le showcase interactif utilise
les trois captures du rapport. Il ne reconstruit aucun écran en HTML ou CSS.

## Format attendu

- PNG ou WebP en portrait ;
- 1179 × 2556 px recommandé, ou tout format au même ratio ;
- capture brute issue de l’iPhone ou du simulateur iOS ;
- aucun cadre d’appareil ;
- aucun fond marketing ;
- aucune ombre portée ;
- aucun coin arrondi ajouté à l’image ;
- aucune donnée personnelle ou annonce réelle identifiable.

Le composant `components/device-mockup.tsx` applique déjà le masque de l’écran et le
châssis. Si le nom du fichier change, mettre à jour sa prop `screenshot` dans
`app/page.tsx`.

Les variantes web mesurent 804 × 1748 px. Elles sont générées depuis les captures
PNG originales avec `cwebp -q 92 -sharp_yuv` afin de rester nettes dans le cadre sans
alourdir le chargement. Les nouvelles captures doivent conserver ce ratio.
