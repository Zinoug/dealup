# DealUp

DealUp est une application iOS qui analyse une annonce Leboncoin d’iPhone ou de MacBook compatible avant achat : prix, risques, preuves manquantes et négociation.

La V1 cible l’acheteur occasionnel français. L’utilisateur crée un compte, partage ou colle une annonce, voit un teaser personnalisé, s’abonne, puis reçoit un rapport et l’action la plus utile à effectuer.

Le produit et les décisions business sont décrits dans [docs/product/product.md](docs/product/product.md).

## Décisions V1

- iOS et Leboncoin uniquement ;
- iPhone 11+, iPhone SE 2/3 et MacBook Air/Pro Apple Silicon M1+ ;
- compatibilité vérifiée avant paywall et quota ;
- Leboncoin comme seule source ;
- compte Clerk obligatoire ;
- connexion Apple, Google ou email ;
- partage Leboncoin vers DealUp via une extension iOS native ;
- hard paywall sans essai ni analyse complète gratuite ;
- Weekly à 4,99 € pour 15 annonces ;
- Monthly à 12,99 € pour 60 annonces ;
- top-up de 10 analyses à 4,99 € ;
- réanalyses vendeur incluses pour une annonce débloquée ;
- landing `joindealup.com` limitée à la présentation et au renvoi vers l’App Store.

## Architecture

```mermaid
flowchart LR
    M["Expo iOS"] --> API["FastAPI"]
    API --> DB[("PostgreSQL")]
    API --> P["Piloterr"]
    API --> L["AWS Lambda"]
    L --> G["Gemini — un appel structuré"]
    L --> S3["S3 privé"]
    L -. "refresh" .-> P
    L --> DB
    R["RevenueCat"] --> API
```

Le dépôt garde quatre projets indépendants :

- `mobile/` — Expo, React Native, TypeScript et Expo Router ;
- `landing/` — Next.js et TypeScript ;
- `backend/` — FastAPI et PostgreSQL ;
- `workers/analysis-lambda/` — traitement Piloterr + Gemini.

Il n’y a ni package racine, ni dossier `apps/`, ni déploiement automatique.

Les contrats d’analyse partagés restent de simples fichiers JSON/TXT versionnés dans `contracts/analysis/`. Le worker valide un candidat Gemini interne, puis calcule de façon déterministe le score, le verdict, le prix, l’action et le template public.

## Prérequis

- Node.js 22 et npm ;
- Python 3.12 ;
- Xcode pour le build iOS et l’extension de partage.

## Mobile

L’interface iOS couvre le parcours V1 complet et démarre par défaut avec des services simulés, sans trafic vers FastAPI, Clerk ou RevenueCat. Le laboratoire mock expose les quatre verdicts pour iPhone et MacBook. Le détail se trouve dans [`mobile/README.md`](mobile/README.md).

```bash
cd mobile
cp .env.example .env
npm install
npm start
```

Vérifications :

```bash
npm run lint
npm run typecheck
```

## Landing

```bash
cd landing
cp .env.example .env.local
npm install
npm run dev
```

Vérifications :

```bash
npm run lint
npm run typecheck
npm run build
```

## Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
uvicorn app.main:app --reload
```

Migrations : `alembic upgrade head`  
Documentation API : `http://localhost:8000/docs`  
Tests : `pytest`

## Worker d’analyse

```bash
cd workers/analysis-lambda
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
pytest
```

Point d’entrée Lambda : `handler.handler`.

L’identification Piloterr est privée au parcours utilisateur. DealUp ne partage ni payload, ni résultat, ni cache d’annonce entre utilisateurs. Les photos analysées sont archivées dans S3 privé et supprimées avec l’analyse ou le compte.

## Intégrations

| Besoin | Service |
| --- | --- |
| Authentification | Clerk |
| Abonnements et top-up | RevenueCat |
| Analytics | PostHog |
| Erreurs | Sentry |
| Extraction Leboncoin | Piloterr |
| Analyse multimodale et recherche web | Gemini |

Les fichiers `.env.example` documentent les variables attendues. Aucun secret ne doit être ajouté au dépôt.
