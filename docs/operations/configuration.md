# Configuration de DealUp — développement et production

Ce guide sépare les clés publiques intégrées à l’app des secrets serveur. Ne copie jamais une clé Piloterr, Gemini, RevenueCat secrète, AWS ou Clerk secrète dans une variable `EXPO_PUBLIC_*`.

## 1. Environnement local complet

### PostgreSQL

Sur ce Mac, PostgreSQL 17 Homebrew est déjà actif sur `localhost:5432` et la base `dealup` a été créée/migrée. Vérifie-la avec :

```bash
pg_isready -h localhost -p 5432
```

Sur une autre machine où PostgreSQL ne tourne pas, utilise le Compose fourni :

```bash
docker compose up -d postgres
docker compose ps
```

La base locale est disponible sur `localhost:5432`, base/utilisateur/mot de passe de développement `dealup`.

### FastAPI

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload
```

Valeurs locales importantes dans `backend/.env` :

```dotenv
APP_ENV=local
DATABASE_URL=postgresql+psycopg://dealup:dealup@localhost:5432/dealup
AUTO_CREATE_TABLES=false
AUTH_DISABLED=false
ANALYSIS_INVOKE_MODE=disabled
AWS_REGION=eu-west-3
MEDIA_BUCKET=dealup-private-media-dev-<account-id>
```

`ANALYSIS_INVOKE_MODE=disabled` est volontaire : la Lambda AWS ne peut pas joindre le PostgreSQL de ton Mac. Le worker local récupère les jobs `pending` dans un deuxième terminal.

### Worker local réel

```bash
cd workers/analysis-lambda
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
python run_local.py --watch
```

Valeurs nécessaires dans `workers/analysis-lambda/.env` :

```dotenv
APP_ENV=local
DATABASE_URL=postgresql+psycopg://dealup:dealup@localhost:5432/dealup
PILOTERR_API_KEY=<même clé que le backend>
GEMINI_API_KEY=<clé Gemini de développement>
GEMINI_MODEL=<identifiant exact choisi après tes tests manuels>
GEMINI_THINKING_LEVEL=low
GEMINI_TIMEOUT_SECONDS=60
AWS_REGION=eu-west-3
MEDIA_BUCKET=dealup-private-media-dev-<account-id>
```

Le backend appelle Piloterr lors de l’identification. Le worker réutilise ce payload, archive les photos dans S3, appelle Gemini exactement une fois et met à jour PostgreSQL. Pour un refresh explicite seulement, le worker rappelle Piloterr.

### App iOS

```bash
cd mobile
cp .env.example .env
npm install --include=dev
npx expo prebuild --platform ios
npx expo run:ios
```

Puis, lors des lancements suivants :

```bash
npx expo start --dev-client
```

Pour le simulateur iOS, `EXPO_PUBLIC_API_URL=http://localhost:8000` fonctionne. Sur un iPhone physique, utilise l’adresse LAN du Mac, par exemple `http://192.168.1.20:8000`, et lance Uvicorn avec `--host 0.0.0.0`.

Les notifications distantes ne fonctionnent pas dans le simulateur. Après `eas init`, vérifie que l’identifiant de projet EAS est disponible dans `Constants.easConfig.projectId` (ou `expo.extra.eas.projectId`), reconstruis le dev client sur un iPhone réel, accepte la demande en fin d’onboarding puis vérifie qu’une ligne est créée dans `devices`.

## 2. Clerk

Dans le projet Clerk :

1. active Apple, Google et la connexion par code e-mail ;
2. configure l’app iOS `com.joindealup.app` ;
3. ajoute le schéma de retour `dealup://` aux redirections OAuth autorisées ;
4. copie la Publishable Key dans `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` ;
5. copie la Secret Key uniquement dans `backend/CLERK_SECRET_KEY` ;
6. renseigne côté backend l’URL JWKS et l’issuer de l’instance Clerk ;
7. laisse `AUTH_DISABLED=false` pour tester le vrai tunnel.

Backend :

```dotenv
CLERK_JWKS_URL=https://<frontend-api-clerk>/.well-known/jwks.json
CLERK_ISSUER=https://<frontend-api-clerk>
CLERK_AUDIENCE=
CLERK_AUTHORIZED_PARTIES=
```

Le mobile transmet le session token Clerk à chaque endpoint privé. Le backend utilise `sub` comme `clerk_user_id`, récupère le profil via l’API Clerk lors de la première requête puis le rafraîchit au maximum une fois par jour. Cet UUID interne exposé par `/v1/me` est l’identifiant PostHog unique. Le Clerk ID reste le `app_user_id` RevenueCat.

## 3. RevenueCat et App Store Connect

Créer dans App Store Connect :

| Produit | Type | Prix produit |
| --- | --- | ---: |
| `dealup_premium_weekly` | abonnement renouvelable | 4,99 € / semaine |
| `dealup_premium_monthly` | abonnement renouvelable | 12,99 € / mois |
| `dealup_analysis_topup_10` | achat consommable | 4,99 € |

Dans RevenueCat :

1. relie l’app iOS et la clé App Store Connect ;
2. importe les trois produits ;
3. crée l’entitlement `premium` et attache uniquement les deux abonnements ;
4. crée une offering courante contenant les trois produits ;
5. copie la clé SDK publique iOS dans `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` ;
6. copie une clé API serveur RevenueCat V1 uniquement dans `backend/REVENUECAT_API_KEY` ;
7. configure le webhook `https://<api>/v1/webhooks/revenuecat` ;
8. choisis une valeur Authorization longue et aléatoire, puis configure exactement la même chaîne dans RevenueCat et `REVENUECAT_WEBHOOK_AUTHORIZATION`.

Exemple :

```dotenv
REVENUECAT_ENTITLEMENT_ID=premium
REVENUECAT_WEEKLY_PRODUCT_ID=dealup_premium_weekly
REVENUECAT_MONTHLY_PRODUCT_ID=dealup_premium_monthly
REVENUECAT_TOPUP_PRODUCT_ID=dealup_analysis_topup_10
REVENUECAT_WEBHOOK_AUTHORIZATION=Bearer <secret-aléatoire>
REVENUECAT_WEBHOOK_HMAC_SECRET=
```

Le HMAC reste vide tant qu’aucun proxy ne signe `X-RevenueCat-Webhook-Signature`. L’Authorization suffit pour le webhook RevenueCat natif. Les prix affichés par l’app viennent de StoreKit/RevenueCat, jamais d’une constante d’interface. Le backend resynchronise aussi l’abonnement et les top-ups après achat ou restauration ; le webhook reste la source asynchrone principale.

Pour tester, utilise un compte Sandbox App Store et vérifie successivement : Mensuel, Hebdomadaire, restauration, expiration Sandbox et plusieurs achats du top-up consommable.

## 4. S3 privé et AWS Lambda

Choix retenu : AWS `eu-west-3`, avec deux buckets privés distincts :

```text
dealup-private-media-dev-<account-id>
dealup-private-media-prod-<account-id>
```

Sur chaque bucket : Block Public Access complet, Object Ownership « bucket owner enforced », chiffrement par défaut et aucune politique de lecture publique. Le mobile ne reçoit que des URL signées courtes après contrôle d’appartenance.

Permissions minimales du backend :

- `s3:PutObject`, `s3:GetObject`, `s3:HeadObject`, `s3:DeleteObject` sur son bucket ;
- `lambda:InvokeFunction` sur la fonction d’analyse.

Permissions minimales de la Lambda :

- les mêmes actions S3 ;
- `secretsmanager:GetSecretValue` sur son secret ;
- accès réseau TLS à PostgreSQL, Piloterr, Gemini, PostHog et Sentry.

Crée une Lambda Python 3.12 `dealup-analysis-dev` puis `dealup-analysis-prod`, mémoire initiale 1024 Mo, timeout 90 secondes, handler `handler.handler`. Le zip contient uniquement `handler.py`, `analysis_worker/` et les dépendances. Le prompt et les règles sont embarqués dans `analysis_worker/`.

Variables non secrètes Lambda :

```dotenv
APP_ENV=production
AWS_REGION=eu-west-3
MEDIA_BUCKET=dealup-private-media-prod-<account-id>
DEALUP_SECRET_ARN=arn:aws:secretsmanager:eu-west-3:<account-id>:secret:dealup-analysis-prod
GEMINI_MODEL=<modèle validé manuellement>
GEMINI_THINKING_LEVEL=low
GEMINI_TIMEOUT_SECONDS=60
GEMINI_STORE_INTERACTIONS=false
EXPO_PUSH_ENDPOINT=https://exp.host/--/api/v2/push/send
```

Le secret Secrets Manager doit être un objet JSON :

```json
{
  "DATABASE_URL": "postgresql+psycopg://...",
  "PILOTERR_API_KEY": "...",
  "GEMINI_API_KEY": "...",
  "POSTHOG_API_KEY": "...",
  "SENTRY_DSN": "..."
}
```

En production FastAPI : `ANALYSIS_INVOKE_MODE=aws`, `ANALYSIS_LAMBDA_NAME=dealup-analysis-prod`, `AUTO_CREATE_TABLES=false`. PostgreSQL doit être joignable à la fois par FastAPI et par la Lambda. Si tu choisis RDS privé, place la Lambda dans le VPC et prévois une sortie Internet/NAT pour les fournisseurs ; avec un PostgreSQL managé public, impose TLS et une restriction réseau adaptée.

## 5. PostHog et Sentry

PostHog : crée un projet UE et utilise la même clé projet sur mobile, backend et worker. La clé projet n’est pas un secret d’administration.

```dotenv
EXPO_PUBLIC_POSTHOG_API_KEY=phc_...
EXPO_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
POSTHOG_API_KEY=phc_...
POSTHOG_HOST=https://eu.i.posthog.com
```

DealUp définit l’e-mail, le fournisseur d’authentification et le forfait comme propriétés de personne. Il n’envoie pas les URLs d’annonces, messages vendeur, photos ou payloads Piloterr. Le replay de session mobile est désactivé.

Sentry : crée trois projets ou trois environnements distincts pour mobile, API et worker. Le mobile reçoit uniquement son DSN public. `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` et `SENTRY_PROJECT` servent au build des sourcemaps et restent des secrets EAS, jamais des variables `EXPO_PUBLIC_*`.

## 6. Variables EAS preview/production

Après `eas init`, crée les variables de chaque environnement. Exemple de noms à renseigner dans EAS :

```text
EXPO_PUBLIC_API_URL
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID
EXPO_PUBLIC_REVENUECAT_WEEKLY_PRODUCT_ID
EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID
EXPO_PUBLIC_REVENUECAT_TOPUP_PRODUCT_ID
EXPO_PUBLIC_POSTHOG_API_KEY
EXPO_PUBLIC_POSTHOG_HOST
EXPO_PUBLIC_SENTRY_DSN
SENTRY_AUTH_TOKEN
SENTRY_ORG
SENTRY_PROJECT
```

`eas.json` force déjà `EXPO_PUBLIC_DEV_TOOLS=false` en preview et production. Ne configure jamais `EXPO_PUBLIC_USE_MOCKS` : cette variable n’existe plus.

## 7. Checklist avant une vraie analyse

1. `docker compose ps` indique PostgreSQL healthy ;
2. `alembic current` est sur la dernière révision ;
3. `/health` et `/ready` répondent ;
4. l’app crée une vraie session Clerk ;
5. `/v1/billing/sync` retourne le plan attendu ;
6. le bucket S3 est privé et le backend peut présigner un upload ;
7. `python run_local.py --watch` tourne en local, ou la Lambda est invocable en environnement distant ;
8. une identification compatible crée un job et une seule requête Gemini ;
9. les photos de l’annonce apparaissent dans l’accueil, l’historique, le rapport et le replay développeur via URL signée ;
10. sur iPhone réel, le token Expo est enregistré après consentement et une fin/erreur d’analyse produit une notification sans donnée privée dans son texte.

## 8. Gabarits complets par environnement

Mobile développement (`mobile/.env`) :

```dotenv
EXPO_PUBLIC_APP_ENV=development
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=<pk_test_...>
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=<clé SDK publique iOS>
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=
EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=premium
EXPO_PUBLIC_REVENUECAT_WEEKLY_PRODUCT_ID=dealup_premium_weekly
EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID=dealup_premium_monthly
EXPO_PUBLIC_REVENUECAT_TOPUP_PRODUCT_ID=dealup_analysis_topup_10
EXPO_PUBLIC_POSTHOG_API_KEY=<phc_...>
EXPO_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
EXPO_PUBLIC_SENTRY_DSN=<dsn mobile dev>
EXPO_PUBLIC_DEV_TOOLS=true
```

Backend production (dans le gestionnaire de secrets de l’hébergeur API) :

```dotenv
APP_ENV=production
DEBUG=false
DATABASE_URL=postgresql+psycopg://<user>:<password>@<host>:5432/<database>?sslmode=require
AUTO_CREATE_TABLES=false
CLERK_SECRET_KEY=<sk_live_...>
CLERK_JWKS_URL=https://<clerk>/.well-known/jwks.json
CLERK_ISSUER=https://<clerk>
CLERK_AUDIENCE=
CLERK_AUTHORIZED_PARTIES=
AUTH_DISABLED=false
AWS_REGION=eu-west-3
ANALYSIS_LAMBDA_NAME=dealup-analysis-prod
ANALYSIS_INVOKE_MODE=aws
MEDIA_BUCKET=dealup-private-media-prod-<account-id>
MEDIA_UPLOAD_MAX_BYTES=10000000
PILOTERR_API_KEY=<secret>
PILOTERR_BASE_URL=https://api.piloterr.com
REVENUECAT_API_KEY=<clé serveur secrète V1>
REVENUECAT_ENTITLEMENT_ID=premium
REVENUECAT_WEBHOOK_AUTHORIZATION=Bearer <secret-aléatoire>
REVENUECAT_WEBHOOK_HMAC_SECRET=
REVENUECAT_WEEKLY_PRODUCT_ID=dealup_premium_weekly
REVENUECAT_MONTHLY_PRODUCT_ID=dealup_premium_monthly
REVENUECAT_TOPUP_PRODUCT_ID=dealup_analysis_topup_10
POSTHOG_API_KEY=<phc_...>
POSTHOG_HOST=https://eu.i.posthog.com
SENTRY_DSN=<dsn backend prod>
CORS_ORIGINS=https://joindealup.com
```

Les identifiants AWS du backend doivent venir d’un rôle IAM en production, pas de `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` statiques. Pour l’app production, reprends le bloc mobile avec les clés live, l’URL API HTTPS, `EXPO_PUBLIC_APP_ENV=production` et `EXPO_PUBLIC_DEV_TOOLS=false` dans l’environnement EAS `production`.
