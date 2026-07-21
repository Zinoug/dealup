# Assets DealUp à fournir

Les écrans utilisent déjà l’icône DealUp fournie. Les autres emplacements restent volontairement dessinés en code afin que l’application puisse démarrer sans dépendre d’assets manquants.

## Déjà intégré

| Fichier | Usage |
| --- | --- |
| `images/dealup-app-icon.png` | icône, splash et logo affiché dans l’application |
| `images/dealup-app-icon-ios.png` | icône locale transparente actuellement utilisée par Expo et Xcode |
| `images/dealup-app-icon-app-store.png` | variante opaque 1024 × 1024 à sélectionner avant l’envoi App Store |
| `hero/home-tag-background.png` | fond photographique plein bord du hero d’accueil |
| `backgrounds/entry-auth-background.png` | fond exact des écrans d’entrée, démonstration onboarding et connexion |
| `devices/onboarding-listing.png` | vraie photo Leboncoin réservée à la démonstration statique post-inscription |
| `devices/iphone-family-apple.webp` | visuel de famille iPhone identique à la landing, page de compatibilité uniquement |
| `devices/macbook-family-apple.webp` | visuel de famille MacBook identique à la landing, page de compatibilité uniquement |
| `brands/google-g.png` | marque Google officielle dans le bouton de connexion |
| `brands/dealup-action-icon.svg` | source vectorielle fournie pour le pictogramme « Analyser avec DealUp » |
| `brands/dealup-action-icon-source.png` | masque maître transparent validé, extrait du pictogramme noir plein de référence |
| `brands/dealup-action-icon-{40,80,120}.png` | rendus template iOS 1×, 2× et 3× du pictogramme de l’Action Extension |
| `guides/leboncoin-share-step-1.png` | capture officielle montrant le bouton Partager dans une annonce Leboncoin |
| `guides/leboncoin-share-step-2.jpg` | capture officielle montrant l’action « Analyser avec DealUp » dans la feuille de partage iOS |

Les trois rendus sont copiés directement dans le bundle natif de l’Action Extension sous les noms `DealUpActionIcon.png`, `DealUpActionIcon@2x.png` et `DealUpActionIcon@3x.png`. Ils ne passent volontairement pas par un catalogue AppIcon : iOS utilise leur canal alpha comme masque monochrome, tandis que l’icône principale colorée de DealUp reste inchangée.

Les cinq références de fond fournies le 16 juillet servent uniquement de direction artistique. Elles ne sont pas embarquées dans l’application. Les fonds secondaires sont dessinés en SVG adaptatif dans `src/components/brand-background.tsx`, avec des variantes `tag`, `beams`, `focus`, `soft` et `light`.

Le fichier officiel fourni le 16 juillet 2026 est correctement rogné et ne contient plus de fond blanc. Il est utilisé sans zoom ni recadrage supplémentaire dans l’interface.

## Images d’appareils

- les surfaces liées à une annonce affichent seulement sa vraie vignette ou les médias privés fournis par l’utilisateur ;
- sans vraie image, elles restent textuelles : aucun faux iPhone, faux MacBook ou pictogramme produit de remplacement ;
- une future banque d’images officielles ou licenciées sera limitée à la page des appareils compatibles, à l’onboarding et au marketing ;
- une image officielle ne doit jamais apparaître dans un rapport comme si elle constituait une preuve de l’annonce.

La démonstration onboarding est entièrement statique : trois étapes terminées et la quatrième mise en évidence. La photo fournie n’est jamais réutilisée dans un rapport réel.

## Illustration de réponse vendeur — optionnelle

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
- pendant l’analyse, l’icône DealUp originale reste intacte et statique, sans halo pulsant ; aucune variante redessinée du logo n’est utilisée.

## Animation d’inspection des images

Cette animation ne demande aucun asset supplémentaire : elle utilise les images privées déjà présentes dans le flux.

- faisceau lime dessiné en code, aller-retour de 1 250 ms ;
- jusqu’à six vraies photos de l’annonce issues de l’identification privée, puis les médias vendeur ;
- changement de photo toutes les 1 250 ms pendant toute la durée de l’analyse ;
- libellé distinct « Annonce Leboncoin » ou « Ajout vendeur » et compteur par source ;
- coins de détection et état « Inspection terminée » dessinés en code ;
- aucune image de remplacement si la vignette est absente ;
- avec « Réduire les animations », le faisceau et le halo restent statiques ;
- l’effet ne représente pas la chronologie réelle de Gemini et ne constitue pas une preuve d’authenticité.
