# Production — Railway, AWS Lambda et EAS

Architecture : FastAPI + PostgreSQL sur Railway, worker conteneurisé sur AWS
Lambda, médias privés sur S3. Il n'existe ni staging, ni Function URL publique.

## Ressources AWS créées

| Ressource | Valeur |
| --- | --- |
| Région | `eu-west-3` |
| S3 privé | `dealup-private-media-prod-540751377796` |
| ECR | `540751377796.dkr.ecr.eu-west-3.amazonaws.com/dealup-analysis-production` |
| Lambda | `dealup-analysis-production` |
| Rôle Lambda | `arn:aws:iam::540751377796:role/dealup-analysis-production-role` |
| Secret worker | `arn:aws:secretsmanager:eu-west-3:540751377796:secret:dealup/production/analysis-worker-35TlmS` |
| Rôle GitHub OIDC | `arn:aws:iam::540751377796:role/dealup-github-actions-production` |
| Utilisateur Railway | `dealup-railway-production` |

S3 bloque tout accès public. ECR conserve les 20 dernières images. Les logs
Lambda sont conservés 30 jours. La Lambda sera créée lors du premier passage
du workflow `deploy-analysis-worker.yml`, une fois une image disponible.

## 1. Railway

1. Créer un projet production et ajouter PostgreSQL.
2. Ajouter le dépôt GitHub comme service avec **Root Directory** `/backend`.
3. Copier `backend/.env.production` dans les variables Railway.
4. Remplacer `DATABASE_URL` par `${{Postgres.DATABASE_URL}}`.
5. Compléter Clerk Production, Piloterr, RevenueCat, PostHog et Sentry.
6. Attacher `api.joindealup.com` au service et configurer son DNS.

Railway utilise `backend/Dockerfile`. `backend/railway.json` exécute
`alembic upgrade head` avant le démarrage et vérifie `/health`.

Vérifications :

```bash
curl -fsS https://api.joindealup.com/health
curl -fsS https://api.joindealup.com/ready
```

## 2. Connexion Lambda vers PostgreSQL Railway

La Lambda doit recevoir l'URL **publique** PostgreSQL Railway avec TLS. Après
création de PostgreSQL, mettre à jour le secret sans afficher les autres clés :

```bash
aws secretsmanager get-secret-value \
  --secret-id dealup/production/analysis-worker \
  --query SecretString --output text > /tmp/dealup-worker-secret.json

jq --arg database_url 'URL_PUBLIQUE_RAILWAY_AVEC_SSLMODE_REQUIRE' \
  '.DATABASE_URL = $database_url' /tmp/dealup-worker-secret.json \
  > /tmp/dealup-worker-secret.updated.json

aws secretsmanager put-secret-value \
  --secret-id dealup/production/analysis-worker \
  --secret-string file:///tmp/dealup-worker-secret.updated.json
```

Supprimer immédiatement les deux fichiers temporaires après exécution.

## 3. Déploiement automatique du worker

Dans GitHub, créer uniquement la variable de dépôt :

```text
GEMINI_MODEL=<identifiant exact validé manuellement>
```

Le workflow `.github/workflows/deploy-analysis-worker.yml` utilise GitHub OIDC :
aucune clé AWS GitHub n'est nécessaire. Un push sur `main` touchant le worker
construit l'image AMD64, la pousse dans ECR, puis crée ou met à jour la Lambda.

Après le premier passage :

```bash
aws lambda get-function-configuration \
  --function-name dealup-analysis-production \
  --query '{Arn:FunctionArn,State:State,Update:LastUpdateStatus,Timeout:Timeout,Memory:MemorySize}'
```

## 4. RevenueCat et Clerk

- Clerk : utiliser l'instance **Production**, activer e-mail + mot de passe,
  vérification e-mail, Apple et Google, puis copier les clés production.
- RevenueCat : utiliser les produits App Store Connect réels, l'entitlement
  `premium`, et les produits weekly/monthly/top-up 15/top-up 40.
- Webhook RevenueCat :
  `https://api.joindealup.com/v1/webhooks/revenuecat` avec la valeur
  `REVENUECAT_WEBHOOK_AUTHORIZATION` du fichier backend.

## 5. EAS / application iOS

Copier les valeurs publiques finalisées depuis `mobile/.env.production` dans
l'environnement EAS Production. Garder `EXPO_PUBLIC_DEV_TOOLS=false`.
`SENTRY_AUTH_TOKEN`, `SENTRY_ORG` et `SENTRY_PROJECT` sont des secrets de build,
pas des variables `EXPO_PUBLIC_*`.

Commandes à exécuter par le fondateur :

```bash
cd /Users/zineddine/Documents/dealup/mobile
npx eas-cli@latest init
npx eas-cli@latest credentials -p ios
npx eas-cli@latest build -p ios --profile production
npx eas-cli@latest submit -p ios --profile production --latest
```

Avant soumission : tester sur TestFlight l'inscription Clerk, un abonnement et
les deux top-ups, l'identification Leboncoin, une analyse complète, une
réanalyse, la suppression du compte et la restauration des achats.
