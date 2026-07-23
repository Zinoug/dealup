# Mémo produit — Préférences de l’acheteur

Statut : idée post-V1, à ne pas intégrer au moteur actuel sans décision produit dédiée.

## Objectif

Personnaliser la recommandation DealUp selon ce que l’acheteur accepte réellement,
sans affaiblir les contrôles objectifs de sécurité.

Exemple : une rayure légère peut être acceptable pour un acheteur si le prix la
compense, alors qu’un autre préférera payer davantage pour un appareil impeccable.

## Principe

Séparer deux dimensions :

- **sécurité et fiabilité de la transaction** : preuves de propriété, verrouillage
  d’activation, MDM, cohérence de l’appareil, paiement risqué et autres contrôles
  objectifs ;
- **adéquation avec l’acheteur** : état cosmétique accepté, batterie, accessoires,
  garantie, réparations et contraintes personnelles.

Les préférences peuvent modifier la recommandation personnalisée, les explications,
le prix cible et l’action proposée. Elles ne doivent jamais neutraliser un risque
objectif de fraude, de propriété ou de verrouillage.

## Questionnaire envisagé

Questions courtes et facultatives :

1. Quel niveau de traces d’usage acceptes-tu ?
2. Quelle santé de batterie minimale souhaites-tu ?
3. Acceptes-tu un appareil réparé ou doté de pièces remplacées ?
4. La facture d’origine ou une garantie est-elle indispensable pour toi ?
5. Le chargeur et les accessoires sont-ils importants ?
6. Pour un MacBook, acceptes-tu un clavier différent ou des marques sur l’écran ?
7. Quel est ton budget maximal et à quel point ton achat est-il urgent ?
8. Préfères-tu une remise en main propre ou une livraison sécurisée ?

## Données et versionnement

- Stocker les réponses dans un profil de préférences modifiable et supprimable.
- Versionner le questionnaire et ses choix.
- Capturer un instantané des préférences utilisées pour chaque analyse afin que le
  résultat reste explicable dans le temps.
- Ne collecter aucune caractéristique sensible ou sans rapport avec l’achat.

## Effet attendu sur le rapport

Le rapport pourra distinguer :

- le score objectif DealUp ;
- l’adéquation de l’appareil avec les préférences de l’acheteur ;
- les compromis acceptables ;
- les défauts incompatibles avec ses critères ;
- le prix auquel un défaut accepté devient intéressant.

## Points à décider avant implémentation

- Questionnaire dans l’onboarding, au lancement de l’analyse, ou dans l’Espace.
- Préférences globales ou ajustables pour chaque annonce.
- Présentation sous forme d’un second indicateur ou intégration discrète dans la
  recommandation.
- Influence exacte des préférences sur le prix cible et sur le verdict.
- Mesure de l’utilité : complétion, modification, effet sur l’ouverture du rapport
  et sur les actions recommandées.
