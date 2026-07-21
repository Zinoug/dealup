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

Le rappel quotidien est une notification locale iOS. Il ne dépend ni d’EAS, ni d’un token Expo Push, ni du worker. Sur un iPhone, accepte la demande en fin d’onboarding puis vérifie dans « Ton espace » que le rappel peut être activé de nouveau.

## 2. Clerk

Les instances Clerk `development` et `production` ont des réglages indépendants. Reproduis donc la configuration suivante dans les deux instances :

1. dans **Configure → User & authentication → Email, phone, username**, rends l’adresse e-mail obligatoire et active la connexion par mot de passe ;
2. conserve la vérification de l’adresse par code e-mail à l’inscription ; le code n’est plus proposé comme mode de connexion normal dans l’interface DealUp ;
3. autorise la récupération du mot de passe par code e-mail ;
4. impose au minimum huit caractères et active la protection contre les mots de passe compromis si elle est disponible dans ton offre Clerk ;
5. active Apple et Google ; si Google reste proposé sur iOS, Apple doit rester proposé lui aussi ;
6. configure l’app iOS `com.joindealup.app` ;
7. ajoute le schéma de retour `dealup://` aux redirections OAuth autorisées ;
8. copie la Publishable Key de l’instance dans `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` ;
9. copie la Secret Key uniquement dans `backend/CLERK_SECRET_KEY` ;
10. renseigne côté backend l’URL JWKS et l’issuer de la même instance Clerk ;
11. laisse `AUTH_DISABLED=false` pour tester le vrai tunnel.

Le parcours e-mail final est : adresse → mot de passe + confirmation → code de vérification à la première inscription → session. Les connexions suivantes demandent uniquement l’adresse et le mot de passe. « Mot de passe oublié » envoie un code, puis demande un nouveau mot de passe. La confirmation reste locale au téléphone ; le mobile transmet uniquement le mot de passe choisi à Clerk et jamais à FastAPI, PostHog ou Sentry.

Après activation de ce mode, un ancien compte créé auparavant par code e-mail peut ne pas encore posséder de mot de passe. Utilise alors « Mot de passe oublié » une première fois pour lui en définir un.

Backend :

```dotenv
CLERK_JWKS_URL=https://<frontend-api-clerk>/.well-known/jwks.json
CLERK_ISSUER=https://<frontend-api-clerk>
CLERK_AUDIENCE=
CLERK_AUTHORIZED_PARTIES=
```

Le mobile transmet le session token Clerk à chaque endpoint privé. Le backend utilise `sub` comme `clerk_user_id`, récupère le profil via l’API Clerk lors de la première requête puis le rafraîchit au maximum une fois par jour. Cet UUID interne exposé par `/v1/me` est l’identifiant PostHog unique. Le Clerk ID reste le `app_user_id` RevenueCat.

### Compte stable pour App Review

Dans l’instance Clerk de production, crée une adresse dédiée, par exemple `appreview@joindealup.com`, avec une boîte e-mail que tu contrôles et un mot de passe stable. Vérifie son adresse puis connecte-toi une fois dans le build de production afin que le compte interne et le client RevenueCat existent. Dans RevenueCat, retrouve le client à partir de son Clerk ID et accorde-lui l’entitlement promotionnel `premium` pour toute la durée de la review. Indique l’e-mail, le mot de passe et le parcours de test dans les notes App Review d’App Store Connect. Ne fournis jamais ton Apple ID personnel et ne crée pas de contournement spécial dans l’application.

## 3. RevenueCat et App Store Connect

Créer dans App Store Connect :

| Produit | Type | Prix produit |
| --- | --- | ---: |
| `dealup_premium_weekly` | abonnement renouvelable | 4,99 € / semaine |
| `dealup_premium_monthly` | abonnement renouvelable | 12,99 € / mois |
| `dealup_analysis_topup_15` | achat consommable | 4,99 € |
| `dealup_analysis_topup_40` | achat consommable | 9,99 € |

Dans RevenueCat :

1. relie l’app iOS et la clé App Store Connect ;
2. importe les quatre produits ;
3. crée l’entitlement `premium` et attache uniquement les deux abonnements ;
4. crée une offering courante contenant les quatre produits ;
5. copie la clé SDK publique iOS dans `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` ;
6. copie une clé API serveur RevenueCat V1 uniquement dans `backend/REVENUECAT_API_KEY` ;
7. configure le webhook `https://<api>/v1/webhooks/revenuecat` ;
8. choisis une valeur Authorization longue et aléatoire, puis configure exactement la même chaîne dans RevenueCat et `REVENUECAT_WEBHOOK_AUTHORIZATION`.

Exemple :

```dotenv
REVENUECAT_ENTITLEMENT_ID=premium
REVENUECAT_WEEKLY_PRODUCT_ID=dealup_premium_weekly
REVENUECAT_MONTHLY_PRODUCT_ID=dealup_premium_monthly
REVENUECAT_TOPUP_15_PRODUCT_ID=dealup_analysis_topup_15
REVENUECAT_TOPUP_40_PRODUCT_ID=dealup_analysis_topup_40
REVENUECAT_WEBHOOK_AUTHORIZATION=Bearer <secret-aléatoire>
REVENUECAT_WEBHOOK_HMAC_SECRET=
```

Le HMAC reste vide tant qu’aucun proxy ne signe `X-RevenueCat-Webhook-Signature`. L’Authorization suffit pour le webhook RevenueCat natif. Les prix affichés par l’app viennent de StoreKit/RevenueCat, jamais d’une constante d’interface. Le backend resynchronise aussi l’abonnement et les top-ups après achat ou restauration ; le webhook reste la source asynchrone principale.

Pour tester, utilise un compte Sandbox App Store et vérifie successivement : Mensuel, Hebdomadaire, restauration, expiration Sandbox et plusieurs achats de chacune des deux recharges consommables.

## 4. Production Railway, S3 privé et AWS Lambda

La production utilise FastAPI et un unique PostgreSQL sur Railway, puis une
Lambda et un unique bucket S3 sur AWS `eu-west-3` :

```text
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

La Lambda `dealup-analysis-production` est publiée comme image Linux depuis le
`Dockerfile` du worker. Le prompt et les règles sont embarqués dans
`analysis_worker/`. Le runbook et toutes les commandes AWS CLI sont dans
[`production.md`](production.md).

Variables non secrètes Lambda :

```dotenv
APP_ENV=production
AWS_REGION=eu-west-3
MEDIA_BUCKET=dealup-private-media-prod-<account-id>
DEALUP_SECRET_ARN=arn:aws:secretsmanager:eu-west-3:<account-id>:secret:dealup/production/analysis-worker
GEMINI_MODEL=<modèle validé manuellement>
GEMINI_THINKING_LEVEL=low
GEMINI_TIMEOUT_SECONDS=60
GEMINI_STORE_INTERACTIONS=false
```

Le secret Secrets Manager doit contenir l'URL PostgreSQL **publique** Railway
avec TLS, car Lambda ne se trouve pas dans le réseau privé Railway :

```json
{
  "DATABASE_URL": "postgresql://...?sslmode=require",
  "PILOTERR_API_KEY": "...",
  "GEMINI_API_KEY": "...",
  "POSTHOG_API_KEY": "...",
  "SENTRY_DSN": "..."
}
```

FastAPI utilise `${{Postgres.DATABASE_URL}}` sur le réseau Railway.
`ANALYSIS_LAMBDA_NAME` reçoit l'ARN complet privé de la Lambda ; aucune Function
URL publique n'est créée. Railway utilise un utilisateur IAM limité à
`lambda:InvokeFunction` et aux objets du bucket.

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
EXPO_PUBLIC_REVENUECAT_TOPUP_15_PRODUCT_ID
EXPO_PUBLIC_REVENUECAT_TOPUP_40_PRODUCT_ID
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
10. sur iPhone réel, le rappel local quotidien est planifié après consentement ; aucune fin ou erreur d’analyse ne déclenche de push serveur.

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
EXPO_PUBLIC_REVENUECAT_TOPUP_15_PRODUCT_ID=dealup_analysis_topup_15
EXPO_PUBLIC_REVENUECAT_TOPUP_40_PRODUCT_ID=dealup_analysis_topup_40
EXPO_PUBLIC_POSTHOG_API_KEY=<phc_...>
EXPO_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
EXPO_PUBLIC_SENTRY_DSN=<dsn mobile dev>
EXPO_PUBLIC_DEV_TOOLS=true
```

Backend production (dans le gestionnaire de secrets de l’hébergeur API) :

```dotenv
APP_ENV=production
DEBUG=false
DATABASE_URL=${{Postgres.DATABASE_URL}}
AUTO_CREATE_TABLES=false
CLERK_SECRET_KEY=<sk_live_...>
CLERK_JWKS_URL=https://<clerk>/.well-known/jwks.json
CLERK_ISSUER=https://<clerk>
CLERK_AUDIENCE=
CLERK_AUTHORIZED_PARTIES=
AUTH_DISABLED=false
AWS_REGION=eu-west-3
AWS_ACCESS_KEY_ID=<clé IAM Railway limitée>
AWS_SECRET_ACCESS_KEY=<secret IAM Railway>
AWS_SESSION_TOKEN=
ANALYSIS_LAMBDA_NAME=<ARN complet dealup-analysis-production>
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
REVENUECAT_TOPUP_15_PRODUCT_ID=dealup_analysis_topup_15
REVENUECAT_TOPUP_40_PRODUCT_ID=dealup_analysis_topup_40
POSTHOG_API_KEY=<phc_...>
POSTHOG_HOST=https://eu.i.posthog.com
SENTRY_DSN=<dsn backend prod>
CORS_ORIGINS=
```

Railway n'expose pas de rôle IAM natif : ses identifiants AWS appartiennent à un
utilisateur IAM dédié et limité au bucket et à la Lambda. Ne jamais réutiliser
les identifiants d'un compte administrateur. Pour l’app production, reprends le
bloc mobile avec les clés live, l’URL API HTTPS,
`EXPO_PUBLIC_APP_ENV=production` et `EXPO_PUBLIC_DEV_TOOLS=false` dans
l’environnement EAS `production`.
