# Juegos

Un juego = una carpeta por `GameId` (ver `src/domain/schema.ts`), p. ej. `src/games/kana-recognize/`,
con un `index.ts` que exporta el componente. Se registra en `src/games/registry.ts`.

## Contrato

```ts
// src/games/types.ts
interface GameProps {
  kana: KanaEntry[];      // kana a practicar
  words: Word[];          // palabras legibles con lo desbloqueado (+ kana nuevos de la lección)
  newKana?: string[];     // kana nuevos de la lección (kana-recognize usa opción múltiple mientras son nuevos)
  rounds?: number;        // rondas; undefined = práctica libre (botón «Terminar»)
  sequential?: boolean;   // recorrer en orden (cola de repasos) en vez del selector ponderado
  onFinish?: (stats: GameStats) => void;   // una sola vez, al acabar las rondas o al pulsar «Terminar»
}
```

`GameStats = { total, correct, bestStreak, items: Record<itemKey, { label, correct, wrong }> }`.
Una ronda cuenta una vez, según el primer intento.

## Registro (`registry.ts`)

- `GAME_REGISTRY: Record<GameId, GameMeta>` con `{ id, name, description, component? }` (nombre y descripción en español).
  Sin `component` el juego aún no existe: las lecciones sin ningún juego disponible salen como «próximamente».
- `getGame(id)`, `isImplemented(id)`, `implementedGameIds()`.
- Para añadir un juego: crear la carpeta, exportar el componente y poner `component` en su entrada del registro.

## Reglas

- No tocar `localStorage`. Cada respuesta se reporta con `useGameSession().report(itemId, kind, label, correct)`,
  que llama a `useProgress.getState().recordAnswer` y lleva racha y estadísticas.
- Elegir ítems con `useQuestionPicker(kind, sequential)` (selector ponderado del motor).
- Comparar respuestas escritas con `checkAnswer` (contra kana, no romaji); para romaji de un kana `judgeRomaji` (`kanaUtils.ts`).
- Mostrar palabras con `<JaText>`; en lecciones, los kana nuevos se tratan como conocidos vía `ExtraKanaContext`.
- Piezas compartidas en `shared/`: `GameFrame` (barra de progreso, racha, «Terminar»), `TypingRound` (respuesta escrita; si falla,
  se muestra la correcta y hay que reescribirla), `ChoiceRound` (opción múltiple; la errónea se deshabilita), `Feedback`
  (color + icono + texto, `role="status"`), `playSfx` (solo si `settings.sound`).
- Respetar `settings.showRomaji` para ayudas de romaji; animaciones con `prefers-reduced-motion` (ya en `games.module.css`).
- Tests junto al código (`*.test.tsx`).

## Katakana (etapa 3)

- `kana-recognize` en lecciones de katakana: las confusiones clásicas (`confusables.ts`: シ/ツ, ソ/ン, ク/ケ/タ, ワ/ウ/フ, ヌ/ス, チ/テ…)
  salen con más frecuencia, sirven de distractores (solo kana ya conocidos) y los kana conocidos que se parecen a uno nuevo vuelven como repaso.
  Además hay rondas «hiragana ↔ katakana» (`kana-recognize/recognizeLogic.ts`: ver あ y elegir ア, o al revés). Toda la lógica es pura y está testeada.
- `kana-write`: las palabras solo en katakana se escriben con el IME katakana (`-` o la vocal repetida dan ー). Si el romaji no produce el kana
  (ティ necesita `thi`, ウォ `who`), se muestra la ayuda de escritura (`typingHints`).
- `read-words`: «¿Qué significa?» y, tras responder, «Pronunciación original» con `Word.origin` (opcional, p. ej. `inglés: television`).
