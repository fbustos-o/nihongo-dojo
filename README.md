# Nihongo Dojo (日本語道場)

Aplicación web personal para aprender japonés paso a paso, de hiragana a kanji (ver `PLAN.md`).
Vite + React + TypeScript, sin backend; el progreso se guarda en el `localStorage` del navegador.

## Ejecutar con Docker

```sh
docker compose up -d --build
```

Abrir http://localhost:8081. El puerto se define en `.env` (`DOJO_PORT`, por defecto 8081).
La build ejecuta los tests (`npm test`) y falla si alguno no pasa.

## Desarrollo

```sh
cd app
npm install
npm run dev      # servidor de desarrollo con recarga
npm test         # Vitest (una pasada, sin interfaz)
npm run lint     # ESLint
npm run build    # comprobación de tipos + build de producción en app/dist
```

Estructura de `app/src`: `domain/` (esquemas zod, carga de contenido, regla de renderizado),
`state/` (progreso y persistencia), `components/`, `pages/`, `hooks/`, `games/` (ver su README) y
`content/` (JSON de contenido; formato en `domain/CONTENT_FORMAT.md`).

## Progreso

En Ajustes se puede exportar el progreso a un archivo JSON, importarlo y reiniciarlo.
Cambiar de navegador o borrar los datos del sitio elimina el progreso local.

## Cliente Flutter original (perfil `legacy`)

[LightKanji](https://github.com/alatasnova/LightKanji) se conserva solo como referencia y no arranca por defecto:

```sh
docker compose --profile legacy up -d --build lightkanji
```

Se sirve en http://localhost:8084 (`LIGHTKANJI_PORT`). Su Dockerfile es `docker/Dockerfile.lightkanji`.
