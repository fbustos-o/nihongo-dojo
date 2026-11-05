# Formato del contenido

Los archivos viven en `app/src/content/` y se cargan con `import.meta.glob`
(`contentLoader.ts`). Todos son opcionales: si falta uno se usa un arreglo vacío; si una entrada no
valida contra su esquema zod (`schema.ts`) se descarta con un `console.warn`.

| Archivo | Forma | Esquema |
|---|---|---|
| `kana.json` | `KanaEntry[]` — `{ char, romaji, script: 'hiragana'\|'katakana', row, group: 'gojuon'\|'dakuten'\|'handakuten'\|'yoon'\|'extended' }` | `KanaEntrySchema` |
| `vocab.json` | `Word[]` | `WordSchema` |
| `kanji.json` | `Kanji[]` | `KanjiSchema` |
| `patterns.json` | `SentencePattern[]` | `SentencePatternSchema` |
| `dialogues.json` | `Dialogue[]` | `DialogueSchema` |
| `curriculum.json` | `Lesson[]` | `LessonSchema` |
| `numbers.json` | objeto libre (`unknown` hasta E2) | — |

Las formas completas están en `PLAN.md` ("Modelo de contenido"); los `GameId` válidos son:
`kana-recognize`, `kana-write`, `read-words`, `listen`, `syntax`, `particles`, `conjugation`,
`numbers`, `clock`, `calendar`, `dialogues`, `mini-reading`, `kanji`.

## Reglas de datos

- `Word.kana` es la lectura en el silabario natural (`たべる`, `コーヒー`); `Word.kanji` es la grafía
  (`食べる`). `alignFurigana` (ver `furigana.ts`) alinea ambas quitando el okurigana común al inicio y
  al final; no separa lecturas por kanji (学生 lleva una sola lectura sobre 学生).
- Los ids referenciados en `Lesson` (`words`, `patterns`, `kanji`, `dialogues`) deben existir en sus archivos.

## Kanji (etapa 4)

- `Kanji` (kanji.json) añade, opcionales: `teach` (lecturas que imprime Genki, subconjunto de `on`+`kun`, mismo formato;
  la interfaz las resalta), `strokes` (trazos, KANJIDIC) y `similar` (kanji parecidos del conjunto Genki: Kanjium + misma
  radical; distractores del juego). Los genera `tools/content/gen/build_kanji.py`; las lecturas de Genki están en
  `gen/genki_kanji.py` y `tools/content/verify_kanji.py` las contrasta con KANJIDIC/JMdict (LightKanji).
- `Word.furigana` (opcional): segmentos `[texto, lectura]` (lectura `''` = kana) que sustituyen a `alignFurigana`.
  `alignFurigana` ya reparte las lecturas alrededor del kana intercalado (持ち物 → 持(も)ち物(もの)); los jukugo
  irregulares (今日, 一人, 大人) salen como un único ruby sobre toda la palabra, sin datos extra.
- Ajuste `settings.furigana`: `auto` (se quita al llegar a Guru, SRS ≥ 5) | `siempre` | `nunca`.
- Ítems de progreso: `kanji:<char>`; palabras preguntadas en el juego de kanji: `word:<id>:kanji`.

`patterns.json`: cada patrón puede llevar `examples: [{ es, ja, romaji }]` (opcional, validado por `SentencePatternSchema`); `ja` va en kana con espacios entre partículas/bunsetsu.

## Kanjikana Core 1000 y etapa 5

Lista de frecuencia de 1000 palabras (Kanjikana Core 1000, CC BY 4.0: «Word list: Kanjikana Core 1000 by Kanjikana»;
`tools/content/gen/core1000/`), fusionada en `vocab.json` por `build_vocab.py`. Campos nuevos de `Word`, todos opcionales:

- `rank` (1..1000, único): posición en la lista. Lo llevan las ~425 palabras ya existentes que coinciden y las nuevas.
- `en` (`string[]`): significados en inglés (mismos sentidos que `es`). Sin él se cae al español (`glosses(word, lang)`).
- `noteEn`: versión inglesa de `note`.
- `written`: grafía habitual con kanji **fuera** de los 144 de Genki, solo informativa. Debe contener kanji y diferir de `kana`.
  `kanji` sigue siendo solo kanji de Genki, así los juegos nunca muestran kanji no enseñados.
- `source: 'core1000'` y `lesson: 'C<n>'` (`n = ceil(rank/25)`) para las palabras nuevas; `tags` incluye al menos una etiqueta
  temática (`suru` marca sustantivos que admiten する). `pos`/`verbGroup` salen de `tools/content/gen/core1000_pos.txt`.
- Ids nuevos: `slug(romaji)`, o con sufijo de glosa si chocan (`toru-tomar`); nunca contienen `:`.

`Lesson.stage = 5`: paquetes `c-01`…`c-40` («Vocabulario esencial 1–25»…, `titleEn` «Essential vocabulary 1–25»…), `words` = los 25
rangos del paquete (incluidos los que ya están en lecciones de Genki), `games: ['flashcards','read-words','listen','kana-write']`.
`requires` = paquete anterior + hito de hiragana (`h-na` para `c-01`, hasta `h-dakuten-1`); nunca gramática, katakana ni kanji.
Todas las lecciones llevan `titleEn`. Detalles del generador y de `core1000_matches.txt` / `core1000_pos.txt` / `vocab_en.txt`:
`tools/content/README.md`.
