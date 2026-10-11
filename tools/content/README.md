# Generadores de contenido

Fuente de `app/src/content/*.json` (E1). Los datos se transcribieron de `Docs/` (Genki I y apuntes del profesor).

```sh
bash tools/content/gen/_run_all.sh   # regenera los JSON en el orden correcto
python3 tools/content/validate.py                                   # valida (requiere app/node_modules)
```

Los ids de juegos deben coincidir con `GameId` en `app/src/domain/schema.ts`.

Kanji: `python3 tools/content/verify_kanji.py` contrasta lecturas, trazos y palabras de ejemplo de `kanji.json`/`vocab.json`
con KANJIDIC/JMdict/Kanjium (`LightKanji/assets/dictionaries/`) y con las listas y lecturas de Genki (`gen/genki_kanji.py`).
