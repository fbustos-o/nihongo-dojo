# Nihongo Dojo (日本語道場)

Aplicación web personal para aprender japonés paso a paso, de hiragana a kanji, siguiendo el orden de **Genki I** y los apuntes
de sintaxis, conjugación, números, hora y fechas de un profesor. Vite + React + TypeScript, sin backend: el progreso se guarda en
el `localStorage` del navegador (con exportar / importar a JSON). Interfaz y significados en español; el romaji es un andamiaje
que se puede desactivar. El plan completo está en `PLAN.md`.

## Las 4 etapas

1. **Hiragana**: filas あ→ん, dakuten, yōon, っ y vocales largas, con palabras que solo usan los kana ya vistos.
2. **Gramática en hiragana**: です, これ/それ/あれ, verbos en ます y sus formas, partículas, あります/います, adjetivos い/な, て, たい, ています; números, contadores, hora, fechas y diálogos.
3. **Katakana**: filas katakana, parecidos clásicos (シ/ツ, ソ/ン…), préstamos y el contenido de la etapa 2 con katakana real.
4. **Kanji**: los 144 kanji de Genki en orden, con furigana progresivo (se retira al llegar a Guru) y palabras conocidas que «se transforman».

Regla de la app: **nunca se muestra un kana o kanji que todavía no se ha desbloqueado** (`<JaText>` usa romaji, hiragana o furigana según el progreso).

## Juegos (13)

Reconocer kana · Escribir kana · Leer palabras · Escuchar · Sintaxis (tablas del profesor: S‑V‑O → S‑O‑V con fichas) · Partículas ·
Conjugación (preguntas y tabla) · Números y precios · Reloj · Calendario · Diálogos · Mini‑lectura · Kanji.

## Progreso y gamificación

- Repaso espaciado (SRS) estilo WaniKani: Aprendiz → Guru → Maestro → Iluminado → Quemado.
- **Inicio**: nivel y barra de XP, racha con los últimos 7 días (D L M X J V S), actividad de hoy, repasos pendientes, siguiente lección, distribución SRS y progreso por etapa.
- **Repaso** (`/repaso`): una sesión de hasta 50 ítems vencidos de todos los tipos, ejecutada juego a juego, con resumen final.
- **Camino**: mapa de lecciones como un sendero con desbloqueo.
- Pequeñas celebraciones (lección, nivel, racha) que respetan «reducir movimiento»; el sonido es opcional (Ajustes).

## Ejecutar con Docker

```sh
docker compose up -d --build
```

Abrir http://localhost:8081 (puerto en `.env`: `DOJO_PORT`). La build ejecuta los tests (`npm test`) y falla si alguno no pasa.
El cliente Flutter original (LightKanji, solo referencia) está en el perfil `legacy`:
`docker compose --profile legacy up -d --build lightkanji` (puerto 8084).

## Desarrollo y pruebas

```sh
cd app
npm install
npm run dev      # servidor de desarrollo
npm test         # Vitest (una pasada)
npx tsc --noEmit # tipos
npm run lint     # ESLint
npm run build    # tipos + build de producción en app/dist (páginas y juegos en chunks perezosos)
```

Estructura de `app/src`: `domain/` (esquemas zod, carga de contenido, regla de renderizado), `engine/` (conjugador, lector de números,
SRS, selector ponderado, niveles), `state/` (progreso, racha, actividad diaria, celebraciones), `games/` (ver `games/README.md`, incluye
las convenciones de ids de ítems), `review/` (repaso unificado), `lesson/`, `pages/`, `components/`.

## Contenido: cómo se genera y valida

`app/src/content/*.json` **no se edita a mano**: lo generan los scripts de `tools/content/gen/` (datos transcritos de Genki I y de los apuntes).

```sh
cd tools/content/gen && for f in build_*.py; do python3 $f; done   # regenera los JSON
python3 tools/content/validate.py                                   # coherencia: ids, desbloqueos, lecciones, kana
python3 tools/content/verify_kanji.py                               # lecturas, trazos y palabras contra KANJIDIC/JMdict/Kanjium
```

Más detalle en `tools/content/README.md` y `app/src/domain/CONTENT_FORMAT.md`. Si un archivo de contenido es inválido, la app descarta
las entradas erróneas y lo avisa con un cartel.

## Progreso y copias de seguridad

En Ajustes se puede exportar el progreso, importarlo y reiniciarlo. Cambiar de navegador o borrar los datos del sitio elimina el progreso local.
Un progreso guardado dañado se ignora con un aviso y se conserva una copia en bruto (`nihongo-dojo:v1:corrupto`).

## Atribuciones

- Vocabulario y kanji derivados de [JMdict](https://www.edrdg.org/jmdict/j_jmdict.html) y KANJIDIC (EDRDG), licencia CC BY‑SA 4.0; parecidos de kanji de Kanjium.
- Ideas y datos de kana de [vedxyz/kana](https://github.com/vedxyz/kana) (MIT). Conversión romaji/kana: WanaKana (MIT).
- **Genki** (3.ª ed.) se usa solo como referencia personal de estudio: el contenido del libro no se distribuye (las frases de ejercicio son nuevas y el repo es privado).
- Tipografía: Noto Sans JP (SIL Open Font License).
- LightKanji se conserva únicamente como referencia (`LightKanji/`, fuera del repositorio).
