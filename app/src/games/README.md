# Juegos

Un juego = una carpeta por `GameId` (ver `src/domain/schema.ts`), p. ej. `src/games/kana-recognize/`.

Convención:

- La carpeta exporta (en `index.ts`) un componente React con props `GameProps`:
  `{ lessonId?: string; items: ... }` — los ítems que el juego debe practicar.
- El juego no toca `localStorage`. Reporta cada respuesta con la acción del store
  `useProgress.getState().recordAnswer(itemId, kind, correct)` (o el selector de React).
- Muestra todo texto japonés con `<JaText>` para respetar lo desbloqueado.
- Los tests del juego viven junto al componente (`*.test.tsx`).
