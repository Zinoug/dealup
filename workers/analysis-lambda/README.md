# DealUp Analysis Lambda

Worker idempotent qui transforme une annonce Leboncoin privée en rapport DealUp.

## Traitement

1. réserve atomiquement une analyse `pending` ;
2. charge l’extraction Piloterr déjà créée pendant le teaser ;
3. rappelle Piloterr uniquement pour un refresh ou si le payload manque ;
4. archive jusqu’à 10 photos d’annonce et prépare jusqu’à 10 médias vendeur dans S3 privé ;
5. construit un dossier court en français avec des lignes `Libellé : valeur`, sans champs vides ;
6. effectue exactement un appel Gemini avec les images utiles et Google Search ;
7. extrait le premier objet JSON de la réponse et le nettoie de façon tolérante ;
8. calcule localement score, plafonds, verdict, prix, action, checklist et template ;
9. stocke séparément le candidat Gemini compact et le rapport public ;
10. recrédite l’unité en cas d’échec terminal.

Le prompt, l’exemple JSON de réponse et les règles sont embarqués dans le worker :

- `analysis_worker/integrations/gemini.py` : instruction système, exemple JSON, dossier naturel et appel fournisseur ;
- `analysis_worker/rules.py` : taxonomies, score, checklists et métadonnées d’audit ;
- `analysis_worker/services/postprocessor.py` : nettoyage tolérant et calcul déterministe.

Il n’existe ni chargeur de contrats partagé, ni fichiers suffixés par une version, ni JSON Schema envoyé à Gemini. Git versionne l’implémentation. Le worker utilise `store=false`, un thinking level `low` et un timeout de 60 secondes par défaut.

## Vérification locale

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
pytest
```

Pour consommer les jobs créés par FastAPI sur PostgreSQL local :

```bash
python run_local.py --watch
```

Pour afficher exactement l’exemple JSON demandé à Gemini sans appeler un fournisseur :

```bash
python run_local.py --response-example
```

Le terminal affiche l’identifiant d’analyse, l’étape, la durée, le modèle, la taille du prompt, le nombre d’images et le code d’erreur. Il n’affiche jamais le payload Leboncoin, les messages vendeur, les URLs signées, le prompt complet ou la réponse Gemini brute.

Point d’entrée AWS Lambda : `handler.handler`.

L'image de production est construite avec le `Dockerfile` Lambda puis publiée
dans ECR. Ne jamais envoyer le `.venv` macOS dans Lambda. Le runbook complet est
dans [`../../docs/operations/production.md`](../../docs/operations/production.md).

Les secrets de production peuvent être chargés depuis AWS Secrets Manager avec `DEALUP_SECRET_ARN`. Voir [`../../docs/operations/configuration.md`](../../docs/operations/configuration.md).

Événement attendu :

```json
{
  "analysis_id": "uuid"
}
```
