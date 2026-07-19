# DealUp Backend

API FastAPI de DealUp : Clerk, Piloterr, compatibilité iPhone/MacBook, PostgreSQL, RevenueCat, quotas, rapports V2, médias privés et orchestration AWS Lambda.

Clerk synchronise l’e-mail, le nom et le fournisseur de connexion lors de la première requête authentifiée, puis au maximum une fois par jour.
PostHog utilise exclusivement l’UUID interne renvoyé par `GET /v1/me`.

## Démarrage local

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload
```

Pour un test rapide sans PostgreSQL, utiliser `DATABASE_URL=sqlite:///./dealup.db`, `APP_ENV=local` et `AUTO_CREATE_TABLES=true`.

Pour le développement complet, démarrer PostgreSQL depuis la racine avec `docker compose up -d postgres`, garder `AUTO_CREATE_TABLES=false` et appliquer Alembic. Le guide fournisseur complet est dans [`../docs/operations/configuration.md`](../docs/operations/configuration.md).

La documentation interactive est disponible sur `http://localhost:8000/docs`.

## Architecture

```text
app/api/v1/       routes HTTP et mapping des réponses
app/schemas/      contrats Pydantic
app/services/     règles métier et transactions
app/repositories/ accès PostgreSQL uniquement
app/models/       modèles SQLAlchemy
app/integrations/ SDK et API externes
app/db/           moteur et sessions
app/core/         configuration, auth et erreurs
app/domain/       catalogue local, compatibilité et adaptation legacy
```

Les routes ne font aucun accès SQL direct. Les repositories ne font jamais de `commit`. Le service délimite et valide la transaction.

## Commandes

```bash
pytest
alembic upgrade head
alembic revision --autogenerate -m "description"
```

`ANALYSIS_INVOKE_MODE=disabled` conserve les jobs en `pending` pour le développement. En environnement déployé, utiliser `aws`.

Les suppressions S3 échouées restent sous forme de jobs idempotents. Un scheduler peut relancer :

```bash
python -m app.tasks.retry_deletions
```

## Flux d’analyse

1. `POST /v1/listings/identify` appelle Piloterr, détecte la compatibilité et crée une identification privée.
2. Une annonce non compatible s’arrête avant paywall et quota.
3. `POST /v1/analyses` vérifie RevenueCat, réserve une unité et crée le job.
4. FastAPI commit puis invoque la Lambda de façon asynchrone.
5. La Lambda réserve le job, appelle Gemini une fois et écrit candidat interne, rapport public et métriques.
6. L’app lit `GET /v1/analyses/{analysis_id}`.

Endpoints principaux :

```text
GET    /v1/catalog/compatible-devices
POST   /v1/listings/identify
POST   /v1/analyses
GET    /v1/analyses
GET    /v1/analyses/{id}
GET    /v1/analyses/{id}/media
POST   /v1/analyses/{id}/reanalyze
POST   /v1/analyses/{id}/refresh
DELETE /v1/analyses/{id}
POST   /v1/devices
DELETE /v1/devices/{id}
DELETE /v1/me
```

Une réanalyse conserve les versions du parent et ne consomme pas de quota. Un refresh capture les versions courantes, rappelle Piloterr et consomme une unité. Les rapports `1.0` restent lisibles par un adaptateur de réponse.

Il n’existe aucun cache partagé entre utilisateurs.
