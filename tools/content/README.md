# Generadores de contenido

Fuente de `app/src/content/*.json` (E1). Los datos se transcribieron de `Docs/` (Genki I y apuntes del profesor).

```sh
bash tools/content/gen/_run_all.sh   # regenera los JSON en el orden correcto
python3 tools/content/validate.py                                   # valida (requiere app/node_modules)
```

Los ids de juegos deben coincidir con `GameId` en `app/src/domain/schema.ts`.

Kanji: `python3 tools/content/verify_kanji.py` contrasta lecturas, trazos y palabras de ejemplo de `kanji.json`/`vocab.json`
con KANJIDIC/JMdict/Kanjium (`LightKanji/assets/dictionaries/`) y con las listas y lecturas de Genki (`gen/genki_kanji.py`).

## Inglés del contenido

Capa inglesa del contenido existente (rama `v2`). El español sigue siendo la fuente; el inglés son campos adicionales
que la app lee con los helpers de `i18n` y, si faltan, cae al español.

| Contenido | Archivo fuente | Campos emitidos |
|---|---|---|
| Vocabulario | `gen/vocab_en.txt` | `en` (array) y `noteEn` por palabra; los lee `build_vocab.py` (lo implementa C1) |
| Patrones | `gen/patterns_en.py` | `titleEn`, `explanationEn`, `examples[].en` |
| Diálogos | `gen/dialogues_en.py` | `titleEn`, `lines[].en` |
| Kanji | `gen/kanji_en.py` | `en` (1–3 significados) |
| Números | `gen/build_numbers.py` (bloque «English layer») | claves hermanas `en` / `*En` (ver abajo) |

- **`vocab_en.txt`**: una línea por palabra de `vocab.json`, `id | en (glosas separadas por ;) | noteEn (opcional)`; líneas con `#`
  son comentarios; el separador de campos es ` | ` (espacio, barra, espacio). Traduce el sentido de `es` (no el japonés en abstracto)
  y conserva los matices entre paréntesis. Una palabra con `note` en español necesita `noteEn`. Las palabras nuevas que añada
  otro agente (p. ej. Core 1000) no deben repetirse aquí: este archivo cubre solo las 768 palabras originales y su `en` tiene
  prioridad sobre el de Core. Comprobación: `python3 tools/content/gen/check_vocab_en.py` (ids existentes, sin duplicados,
  sin `en` vacío, `noteEn` donde hay `note`, cobertura total; `-v` lista las palabras cuyo número de glosas difiere del español).
- **Patrones y diálogos**: `patterns_en.py` mapea `id` -> `(titleEn, explanationEn, [en de cada ejemplo])` y `dialogues_en.py`
  `id` -> `(titleEn, [en de cada línea])`. Los builders comprueban que la longitud de las listas coincide con la del español
  (el build falla si no). El japonés dentro de las explicaciones no se traduce. Ojo: `patterns.json -> english[]` (la
  estructura S-V-O de ejemplo, con texto en español como «el almuerzo») no tiene campo inglés en el esquema y queda en español.
- **Kanji**: `kanji_en.py` guarda los significados elegidos a mano de entre los de KANJIDIC (`kanjidict.meaning`) que corresponden
  a los `es`; `build_kanji.py` avisa (`WARN`) si algún significado no aparece en KANJIDIC y exige 1–3 por kanji.
- **`numbers.json`**: el motor (`engine/numbers.ts`) solo lee las claves numéricas/de lectura; los textos explicativos se
  duplican en inglés con claves hermanas, sin tocar las existentes: `rulesEn[]`, `powers.tenThousand.noteEn`, `hours.noteEn`,
  `hours.ampm[].en`, `*.ask.en`, `minutes.rulesEn`, `days/months/years.noteEn`, `weekdays.items[].en|elementEn`, `weekdays.noteEn`,
  `counters.{tsu,nin,kai,sai}.useEn|noteEn`, `counters.sai.special[].noteEn`. `meta` (notas de desarrollo) no se traduce.
- `build_kanji.py` necesita `LightKanji/` (no versionado) para generar; en un worktree enlázalo con
  `ln -s <repo>/LightKanji LightKanji`.
