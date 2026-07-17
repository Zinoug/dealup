# Contrats d’analyse DealUp

Ces fichiers sont la source versionnée des règles Analyse V2. Ils ne contiennent aucun secret, aucune donnée client et aucun code exécutable.

- `manifest.json` épingle les versions actives.
- `device-catalog.v1.json` définit les familles compatibles.
- `taxonomy.*.v1.json` limite les constats Gemini.
- `checklists.v1.json` contient les libellés contrôlés par DealUp.
- `scoring.v1.json` contient les poids et plafonds déterministes.
- `prompts/` contient les instructions versionnées.

Le bundle Lambda de production doit embarquer ce dossier sous `contracts/analysis/` ou fournir `DEALUP_CONTRACTS_DIR`.
