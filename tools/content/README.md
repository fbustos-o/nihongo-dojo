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
  (el build falla si no). El japonés dentro de las explicaciones no se traduce. Los huecos S-V-O de
  `patterns.json -> english[]` llevan `textEn` desde `SLOTS_EN` en `patterns_en.py`.
- **Kanji**: `kanji_en.py` guarda los significados elegidos a mano de entre los de KANJIDIC (`kanjidict.meaning`) que corresponden
  a los `es`; `build_kanji.py` avisa (`WARN`) si algún significado no aparece en KANJIDIC y exige 1–3 por kanji.
- **`numbers.json`**: el motor (`engine/numbers.ts`) solo lee las claves numéricas/de lectura; los textos explicativos se
  duplican en inglés con claves hermanas, sin tocar las existentes: `rulesEn[]`, `powers.tenThousand.noteEn`, `hours.noteEn`,
  `hours.ampm[].en`, `*.ask.en`, `minutes.rulesEn`, `days/months/years.noteEn`, `weekdays.items[].en|elementEn`, `weekdays.noteEn`,
  `counters.{tsu,nin,kai,sai}.useEn|noteEn`, `counters.sai.special[].noteEn`. `meta` (notas de desarrollo) no se traduce.
- `build_kanji.py` necesita `LightKanji/` (no versionado) para generar; en un worktree enlázalo con
  `ln -s <repo>/LightKanji LightKanji`.

## Kanjikana Core 1000 (etapa 5)

`gen/core1000/kanjikana-core-1000.json` (CC BY 4.0, ver `gen/core1000/README.md`) se fusiona en `vocab.json` desde
`gen/build_vocab.py` (`merge_core`). Archivos de entrada, todos a mano y versionados:

| Archivo | Formato | Para qué |
|---|---|---|
| `gen/core1000_matches.txt` | `rank \| id-existente` o `rank \| NEW [\| id-nuevo]` | Decisiones manuales de emparejado (homófonos como かみ/はし/さん/いる, glosas distintas). Una línea gana a la regla automática. |
| `gen/core1000_pos.txt` | `rank \| pos \| verbGroup \| tags` | `pos`, grupo verbal y tags de **cada** palabra nueva (Core no trae tipo). Cada rango NEW debe estar y ninguno más. |
| `gen/vocab_en.txt` | `id \| en (;) \| noteEn` | Inglés de las palabras (lo produce el agente de inglés); su `en` gana al de Core. Opcional. |

Regla automática de emparejado: coincide si `reading == kana` y (mismo `kanji`, o la palabra Core se escribe en kana, o
la palabra actual no tiene `kanji` y comparte un lema de la glosa `es`). Si hay 0 candidatos la palabra es nueva; si hay
más de uno o una palabra existente la reclaman dos rangos, el generador se detiene y hay que decidir en `core1000_matches.txt`.

- Coincidentes: se añade `rank`, `en` y, si la grafía Core usa kanji fuera de los 144 de Genki y difiere de `kanji`, `written`.
- Nuevas: `id = slug(romaji)` (si choca, sufijo con la primera glosa: `toru-tomar`), `source: core1000`, `lesson: C<n>`
  (`n = ceil(rank/25)`), `es`/`en` = glosas de Core (máx. 5), `kanji` solo si todos sus kanji son de Genki; si no, `written`.
- Currículo (`build_curriculum.py`): las palabras nuevas **no** entran en las etapas 1–4 (se construyen con el vocabulario
  original); la etapa 5 son `c-01`…`c-40` (25 rangos cada una, incluidas las ya presentes en lecciones de Genki como repaso).
  Desbloqueo = paquete anterior + hito de hiragana con la medida de legibilidad de la etapa 2 (suelo 50 %/55 %, objetivo
  70 %/70 %, tope de ritmo: `h-ta` + una fila más cada 3 paquetes); katakana, kanji y gramática nunca gatean.
- `validate.py` comprueba: `source`/`lesson C\d+` coherentes, `rank` único y completo (1..1000), `lesson` = `ceil(rank/25)`,
  `en` no vacío, `written` con kanji y distinto de `kana`, `titleEn` en todas las lecciones, y la forma de la etapa 5.
  Para los verbos -u que parecen -ru acepta compuestos por la grafía (`気に入る`) y no confunde homógrafos ru (`着る`, `変える`).

Atribución obligatoria: «Word list: Kanjikana Core 1000 by Kanjikana, licensed under CC BY 4.0» (enlace en `gen/core1000/README.md`).
