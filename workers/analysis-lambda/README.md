# DealUp Analysis Lambda

Worker idempotent qui transforme une annonce Leboncoin en rapport DealUp structuré.

## Traitement

1. réserve atomiquement l’analyse `pending` ;
2. charge l’extraction Piloterr privée créée pendant le teaser ;
3. rappelle Piloterr uniquement pour un refresh ou un job sans payload ;
4. archive jusqu’à 10 photos d’annonce et prépare jusqu’à 10 médias vendeur via S3 privé ;
5. fournit l’annonce normalisée, le contexte et la seule taxonomie pertinente à Gemini ;
6. effectue exactement un appel Gemini avec Google Search et `GeminiCandidateV2` ;
7. calcule score, plafonds, verdict, prix, action, checklist et template localement ;
8. stocke candidat interne, rapport public, sources internes, modèle et métriques ;
9. recrédite l’unité en cas d’échec terminal ;
10. envoie une notification Expo si le traitement dépasse le seuil configuré.

Gemini utilise l’Interactions API en mode stateless par défaut : `GEMINI_STORE_INTERACTIONS=false`.

Les règles viennent de `../../contracts/analysis/`. Gemini garde des textes personnalisés bornés, mais ne contrôle pas les codes métier, le score ou verdict final, les montants recalculés, l’ordre UI, les assets ou les libellés de checklist.

## Vérification locale

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
pytest
```

Point d’entrée AWS Lambda : `handler.handler`.

Événement attendu :

```json
{
  "analysis_id": "uuid"
}
```
