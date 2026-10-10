# Juegos

Un juego = una carpeta por `GameId` (ver `src/domain/schema.ts`), p. ej. `src/games/kana-recognize/`,
con un `index.ts` que exporta el componente. Se registra en `src/games/registry.ts`.

## Contrato

```ts
// src/games/types.ts (resumen; ver el archivo para todos los campos)
interface GameProps {
  kana: KanaEntry[];        // kana a practicar
  words: Word[];            // palabras legibles con lo desbloqueado (+ kana nuevos de la lección)
  kanji?: Kanji[];          // kanji a practicar (juego de kanji)
  newKana?: string[];       // kana nuevos de la lección (kana-recognize usa opción múltiple mientras son nuevos)
  patterns?: SentencePattern[];   // patrones de la lección (sintaxis, partículas, mini-lectura)
  dialogueIds?: string[];   // diálogos a jugar (ids de dialogues.json): los de la lección o los vencidos en un repaso
  onlyItems?: string[];     // repaso: limita el conjunto de preguntas a estos ids de ítem (sintaxis, partículas, conjugación)
  rounds?: number;          // rondas; undefined = práctica libre (botón «Terminar»)
  sequential?: boolean;     // recorrer en orden (cola de repasos) en vez del selector ponderado
  onFinish?: (stats: GameStats) => void;   // una sola vez, al acabar las rondas o al pulsar «Terminar»
}
```

`GameStats = { total, correct, bestStreak, items: Record<itemKey, { label, correct, wrong }> }`.
Una ronda cuenta una vez, según el primer intento.

## Ids de ítems (progreso y repaso)

El progreso guarda `ItemState { kind, itemId }` y la clave es `kind:itemId`. Los juegos escriben estos ids y
`src/review/reviewLogic.ts` (`classifyItem`) los clasifica **por kind y prefijo** para el repaso unificado y el panel de inicio:

| kind | `itemId` | lo escribe | repaso en |
|---|---|---|---|
| `kana` | `あ` | kana-recognize, kana-write, escuchar | kana-recognize |
| `kanji` | `食` | kanji | kanji |
| `word` | `taberu` (id de `vocab.json`) | leer palabras, kana-write, escuchar | read-words |
| `word` | `taberu:kanji` | kanji (rondas de lectura y «transformación») | kanji |
| `word` | `verb:taberu:te`, `iadj:…`, `naadj:…`, `noun:…` (`<categoría>:<palabra>:<forma>`) | conjugación | conjugation |
| `word` | `number:416`, `counter:nin:3` | números y precios | numbers |
| `word` | `time:7:30` | reloj | clock |
| `word` | `date:3:14`, `date:3:14:wd`, `date:wd:2:next` | calendario | calendar |
| `pattern` | `<patrón>:<n>` (n = índice del ejemplo) | sintaxis, mini-lectura | syntax |
| `pattern` | `particle:<patrón>:<n>` | partículas | particles |
| `dialogue` | `dialogue:<id>:<línea>` | diálogos | dialogues |

Números, hora, fecha y contador usan kind `word` (decisión de E4: no se añadió un kind nuevo al esquema guardado);
se distinguen por prefijo, así que **ningún id de `vocab.json` puede empezar por `number:`, `counter:`, `time:`, `date:`, `verb:`,
`iadj:`, `naadj:`, `noun:`** ni contener `:` (hay un test). Si se añade un tipo de ítem nuevo, hay que añadirlo a `classifyItem`.

### Repaso unificado (`/repaso`)

`planReview` toma los ítems vencidos (`srs.reviewQueue`, máximo 50, más atrasados primero), los agrupa por juego y la página
ejecuta cada grupo en secuencia con `sequential`. `batchProps` convierte los ids en props del juego. Sintaxis, partículas y
conjugación respetan el ítem exacto (`onlyItems`); diálogos reciben `dialogueIds`; kana, palabras y kanji reciben justo los
elementos vencidos. Números, reloj y calendario generan preguntas aleatorias (ponderadas por SRS): se hacen tantas rondas como ítems
vencidos, pero no se garantiza preguntar cada ítem exacto.

### Crédito parcial en kanji

En el juego de kanji, acertar a la primera una palabra (`<id>:kanji`) cuenta una vez por sesión como repaso correcto
(`recordAnswer(..., { partial: true })`: solo SRS, sin XP ni contadores) de cada kanji desbloqueado de esa palabra.
Fallar no penaliza a los kanji.

## Registro (`registry.ts`)

- `GAME_REGISTRY: Record<GameId, GameMeta>` con `{ id, name, description, component? }` (nombre y descripción en español).
  Sin `component` el juego aún no existe: las lecciones sin ningún juego disponible salen como «próximamente».
- `getGame(id)`, `isImplemented(id)`, `implementedGameIds()`.
- Para añadir un juego: crear la carpeta, exportar el componente y añadir su cargador a `LOADERS` en `registry.ts`. Los componentes del registro son
  `React.lazy` (cada juego es un chunk): renderizarlos dentro de `<Suspense>`; `preloadGame(id)` empieza la descarga.

## Reglas

- No tocar `localStorage`. Cada respuesta se reporta con `useGameSession().report(itemId, kind, label, correct)`,
  que llama a `useProgress.getState().recordAnswer` y lleva racha y estadísticas.
- Elegir ítems con `useQuestionPicker(kind, sequential)` (selector ponderado del motor).
- Si el alumno ESCRIBE una palabra con ティ/ディ/ウォ… (el romaji habitual no produce ese kana: `ti` da チ), mostrar `<TypingHint text={kana} />` (usa `typingHints`). Ya está en escribir kana, leer palabras (ronda escrita), lectura de kanji y conjugación.
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

## Kanji (etapa 4)

`kanji/KanjiGame.tsx` (lógica pura en `kanjiLogic.ts`) alterna cuatro rondas: kanji → significado; lecturas + significado → elegir el kanji
entre parecidos (`Kanji.similar`); palabra en kanji → escribir la lectura con KanaInput (sin furigana); y «transformación»: una frase conocida
de la etapa 2 con sus palabras ahora en kanji (JaText con furigana) → elegir su significado. Registra `kanji:<char>` y `word:<id>:kanji`.
Props: `kanji` (a practicar), `words`; con `sequential` recorre los ítems vencidos (repaso). En las lecciones, `ExtraKanjiContext` trata
los kanji nuevos como desbloqueados mientras se practica; al aprobar, `finishLesson` llama a `unlockKanji` (SRS 1).
