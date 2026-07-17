# Assets DealUp à fournir

Les écrans utilisent déjà l’icône DealUp fournie. Les autres emplacements restent volontairement dessinés en code afin que l’application puisse démarrer sans dépendre d’assets manquants.

## Déjà intégré

| Fichier | Usage |
| --- | --- |
| `images/dealup-app-icon.png` | icône, splash et logo affiché dans l’application |
| `hero/home-tag-background.png` | fond photographique plein bord du hero d’accueil |
| `backgrounds/entry-auth-background.png` | fond exact des écrans d’entrée, démonstration onboarding et connexion |

Les cinq références de fond fournies le 16 juillet servent uniquement de direction artistique. Elles ne sont pas embarquées dans l’application. Les fonds secondaires sont dessinés en SVG adaptatif dans `src/components/brand-background.tsx`, avec des variantes `tag`, `beams`, `focus`, `soft` et `light`.

Le fichier officiel fourni le 16 juillet 2026 est correctement rogné et ne contient plus de fond blanc. Il est utilisé sans zoom ni recadrage supplémentaire dans l’interface.

## Familles compatibles — optionnel

```text
assets/devices/iphone-family-placeholder.webp
assets/devices/macbook-family-placeholder.webp
```

- iPhone : WebP transparent, 1200 × 1200 px, cadrage carré sûr, moins de 250 Ko ;
- MacBook : WebP transparent, 1600 × 1200 px, cadrage horizontal sûr, moins de 300 Ko ;
- sans texte, ombre ou fond intégré ;
- pas d’animation ;
- utilisés uniquement sur la page compatible et en fallback, jamais à la place d’une vraie photo d’annonce.

En leur absence, les icônes vectorielles iPhone/MacBook dessinées en code restent visibles.

## Priorité 1 — photos de l’annonce démo

```text
assets/demo/iphone-15-pro-main.webp
assets/demo/iphone-15-pro-thumb.webp
assets/demo/comparable-01.webp
assets/demo/comparable-02.webp
assets/demo/comparable-03.webp
```

- WebP, sans texte ni coins arrondis intégrés ;
- photo principale : 1200 × 1200 px minimum, cadrage carré sûr ;
- miniatures : 400 × 400 px minimum ;
- même iPhone 15 Pro naturel, avec de légères traces d’usage ;
- aucune donnée personnelle ou IMEI visible ;
- pas d’animation.

Ces fichiers remplaceront les blocs photo sombres visibles sur l’accueil, le teaser, le paywall, le chargement et les comparables de prix.

## Priorité 2 — pictogramme Leboncoin

```text
assets/partners/leboncoin-mark.png
```

- PNG transparent, carré, 128 × 128 px ;
- marque officielle uniquement si son utilisation est autorisée ;
- pas d’animation.

Sans ce fichier, l’application garde une pastille orange neutre.

## Priorité 3 — illustration de réponse vendeur

```text
assets/illustrations/seller-reply.webp
```

- WebP transparent, 1200 × 900 px ;
- trois bulles de discussion vertes, sans texte ;
- composition centrée et lisible sur fond vert très sombre ;
- pas d’animation dans la V1.

Sans cet asset, les bulles restent construites en code.

## Recommandations de production

- garder le système natif iOS pour la typographie : les maquettes emploient une esthétique proche de SF Pro ;
- jauges, glows, progression, boutons et fonds restent en code pour être nets et adaptatifs ;
- ne pas intégrer de texte dans les images ;
- fournir les photos en WebP et les logos partenaires en PNG transparent ;
- pendant l’analyse, l’icône DealUp originale reste intacte et un halo vert/lime animé pulse derrière elle ; aucune variante redessinée du logo n’est utilisée.
