# Référence du payload Piloterr Leboncoin

Version : 1.0  
Source : payload réel vérifié le 17 juillet 2026, documenté sans donnée d’annonce ni donnée vendeur.

Ce document décrit la forme observée du payload `GET /v2/leboncoin/ad` utilisé par DealUp. Il ne constitue pas une copie du payload reçu : les URL, identifiants, coordonnées, textes, prix et informations vendeur ne doivent jamais être ajoutés au dépôt.

## Structure observée

| Chemin | Type observé | Usage DealUp |
| --- | --- | --- |
| `url` | `string` | Source privée, jamais journalisée ni exposée telle quelle |
| `list_id` | `integer` | Identifiant externe privé |
| `subject` | `string` | Titre de l’annonce |
| `body` | `string` | Description déclarative du vendeur |
| `brand` | `string` | Marketplace source |
| `status` | `string` | État de publication |
| `ad_type` | `string` | Type d’annonce |
| `category_id` | `string` | Catégorie Leboncoin |
| `category_name` | `string` | Libellé de catégorie |
| `price` | `number[]` | Prix en euros, solution de repli |
| `price_cents` | `integer` | Prix canonique en centimes |
| `images.urls` | `string[]` | Galerie standard |
| `images.urls_large` | `string[]` | Galerie haute définition pour archivage et analyse |
| `images.urls_thumb` | `string[]` | Miniatures pour l’interface |
| `images.small_url` | `string` | Première image compacte |
| `images.thumb_url` | `string` | Première miniature |
| `images.nb_images` | `integer` | Nombre déclaré de photos |
| `owner` | `object` | Données vendeur privées à filtrer strictement |
| `location` | `object` | Localisation, dont coordonnées précises privées |
| `attributes` | `object[]` | Caractéristiques et métadonnées hétérogènes |
| `options` | `object` | Options commerciales de l’annonce |
| `counters.favorites` | `integer` | Signal de demande, jamais signal de confiance |
| `has_phone` | `boolean` | Présence d’un contact téléphonique |
| `first_publication_date` | `string` | Première publication, sans fuseau explicite |
| `index_date` | `string` | Date d’indexation, sans fuseau explicite |
| `is_boosted` | `boolean` | Mise en avant commerciale, jamais risque en soi |

Un attribut suit la forme suivante :

```json
{
  "key": "phone_model",
  "value": "<valeur_machine>",
  "values": ["<valeur_machine>"],
  "generic": true,
  "key_label": "<libellé>",
  "value_label": "<valeur_affichée>"
}
```

`key_label` et `value_label_reader` ne sont pas garantis. Les booléens présents dans `attributes` sont des chaînes `"true"` ou `"false"`, pas des booléens JSON.

## Normalisation retenue

```text
external_id            <- list_id
title                  <- subject
description            <- body, limité à 12 000 caractères
asking_price_cents     <- price_cents, sinon price[0] × 100
currency               <- EUR
thumbnail              <- images.thumb_url, sinon images.urls_thumb[0], sinon images.urls[0]
analysis_photos        <- images.urls_large, sinon images.urls, maximum 10
preview_photos         <- images.urls, sinon images.urls_thumb, maximum 6
photo_count            <- taille réelle de la galerie retenue
city                   <- location.city
postal_code            <- location.zipcode
device attributes      <- dictionnaire indexé par attributes[].key
publication date       <- first_publication_date
```

Les longueurs de `urls`, `urls_large` et `urls_thumb` doivent être contrôlées. En cas de désaccord avec `nb_images`, la liste réellement exploitable prévaut et l’écart est enregistré comme métrique technique assainie.

`listing_identifications.teaser` et `listing_identifications.normalized_payload` sont déjà des documents JSONB. L’ajout de `preview_photo_urls` ne nécessite donc aucune colonne ni migration. Après démarrage de l’analyse, les copies privées sont reliées à `media.analysis_id` avec `role`, `ordinal`, `sha256` et `status` ; le schéma V2 existant couvre déjà la galerie complète.

## Attributs utiles observés

### Produit et état

- `condition`
- `phone_product`
- `phone_brand`
- `phone_model`
- `phone_memory`
- `is_import`

### Transaction

- `shipping_type`
- `shippable`
- `payment_methods`
- `negotiation_cta_visible`
- `is_eligible_to_warranty`

### Vendeur

- `rating_score`
- `rating_count`

Pour l’intégration V1, `rating_score` est interprété sur une échelle de 0 à 1, borné à cet intervalle puis multiplié par 5 et arrondi à une décimale. Il est toujours accompagné de `rating_count` dans le prompt, par exemple `3,4/5 sur 4 avis`. Si le score sort de l’intervalle ou ne peut pas être converti, il est omis.

`is_eligible_to_warranty` décrit une éligibilité de plateforme. Ce champ ne prouve ni une garantie Apple, ni la présence d’une facture, ni l’origine légitime de l’appareil.

## Données à exclure des contrats publics

- `owner.name`, `owner.user_id`, `owner.store_id` et URL de photo de profil ;
- latitude, longitude et géométrie précise ;
- URL complète de l’annonce ;
- payload brut et URL d’images permanentes ;
- attributs logistiques sans valeur produit, comme poids et taille de colis ;
- identifiants ou paramètres techniques du fournisseur.

Le mobile reçoit uniquement une projection autorisée et des URL temporaires ou explicitement sélectionnées pour le parcours privé de l’utilisateur.

## Règles d’interprétation

- Une batterie mentionnée dans `body` reste une déclaration vendeur `UNVERIFIED` sans photo exploitable.
- `condition` est une déclaration de l’annonce, pas une conclusion DealUp.
- Une option urgente, boostée ou mise en avant ne constitue pas un risque.
- Le nombre de favoris mesure l’intérêt pour l’annonce, pas la fiabilité du vendeur.
- L’absence de facture dans le texte devient une information à vérifier, jamais une accusation.
- Les modes présents dans `shipping_type.values` sont des possibilités ; `shipping_type.value` peut représenter le mode principal.
- Les coordonnées précises ne sont pas nécessaires au rapport : ville et code postal suffisent.

## Cohérence du payload de référence

Le payload reçu est structurellement cohérent :

- le prix en euros correspond au prix en centimes ;
- le nombre annoncé de photos correspond aux trois listes d’images ;
- le titre, la marque, le modèle et le stockage sont compatibles entre eux ;
- les dates de publication et d’indexation sont ordonnées de manière plausible ;
- la description et l’état déclaré ne présentent pas de contradiction structurelle, mais leurs affirmations restent à vérifier ;
- la note vendeur est portée par `attributes`, et non par l’objet `owner`.

## Points encore à confirmer

1. Échelle et sémantique exactes de `rating_score`.
2. Stabilité et durée de validité des différentes URL d’images.
3. Sémantique exacte de `index_date`.
4. Clés d’attributs MacBook, à confirmer avec un payload réel MacBook.
5. Variations de forme sur une annonce professionnelle, supprimée ou sans photo.
