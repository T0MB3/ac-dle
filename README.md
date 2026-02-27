# AC DLE - Base Architecture

## Structure
- `data/ac_characters.json`: base des personnages
- `public/`: frontend statique (HTML/CSS/JS)
- `src/config/gameConfig.json`: configuration gameplay
- `src/lib/normalize.mjs`: normalisation des entrées
- `src/lib/gameLogic.mjs`: logique de comparaison d'un essai
- `src/types/character.schema.json`: schéma JSON des personnages
- `src/scripts/checkData.mjs`: validation rapide de la base

## Start
- Exécuter `npm run check` pour valider le JSON.
- Exécuter `npm start` pour lancer l'application locale.
- Ouvrir `http://localhost:3000`.

## API
- `GET /api/daily`
  - Réponse: `{ day, characterCount }`
- `GET /api/characters`
  - Réponse: `{ characters: string[] }`
- `POST /api/guess`
  - Body JSON: `{ "guess": "Ezio" }` (nom, alias ou id)
  - Réponse: `{ day, guess, isCorrect, feedback }`
