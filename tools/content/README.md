# Generadores de contenido

Fuente de `app/src/content/*.json` (E1). Los datos se transcribieron de `Docs/` (Genki I y apuntes del profesor).

```sh
bash tools/content/gen/_run_all.sh   # regenera los JSON en el orden correcto
python3 tools/content/validate.py                                   # valida (requiere app/node_modules)
```

Los ids de juegos deben coincidir con `GameId` en `app/src/domain/schema.ts`.

Kanji: `python3 tools/content/verify_kanji.py` contrasta lecturas, trazos y palabras de ejemplo de `kanji.json`/`vocab.json`
con KANJIDIC/JMdict/Kanjium (`LightKanji/assets/dictionaries/`) y con las listas y lecturas de Genki (`gen/genki_kanji.py`).

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
