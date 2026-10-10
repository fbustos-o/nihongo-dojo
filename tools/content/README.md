# Generadores de contenido

Fuente de `app/src/content/*.json` (E1). Los datos se transcribieron de `Docs/` (Genki I y apuntes del profesor).

```sh
cd tools/content/gen && for f in build_*.py; do python3 $f; done   # regenera los JSON
python3 tools/content/validate.py                                   # valida (requiere app/node_modules)
```

Los ids de juegos deben coincidir con `GameId` en `app/src/domain/schema.ts`.
