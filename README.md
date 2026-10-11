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
bash tools/content/gen/_run_all.sh   # regenera los JSON en el orden correcto
python3 tools/content/validate.py                                   # coherencia: ids, desbloqueos, lecciones, kana
python3 tools/content/verify_kanji.py                               # lecturas, trazos y palabras contra KANJIDIC/JMdict/Kanjium
```

Más detalle en `tools/content/README.md` y `app/src/domain/CONTENT_FORMAT.md`. Si un archivo de contenido es inválido, la app descarta
las entradas erróneas y lo avisa con un cartel.

## Progreso y copias de seguridad

En Ajustes se puede exportar el progreso, importarlo y reiniciarlo. Cambiar de navegador o borrar los datos del sitio elimina el progreso local.
Un progreso guardado dañado se ignora con un aviso y se conserva una copia en bruto (`nihongo-dojo:v1:corrupto`).

## Despliegue estático (GitHub Pages)

La app es 100 % cliente: todo el estado vive en `localStorage` (clave `nihongo-dojo:v1`) y no hay backend. Por eso puede servirse como sitio estático.

**Aviso:** publicar en GitHub Pages hace el sitio **público**, aunque el repositorio sea privado (los repos privados necesitan GitHub Pro/Team para usar Pages). El contenido incluye material derivado de Genki, sujeto a copyright: publícalo solo si estás seguro. Por eso el workflow es solo manual y **no está activado**.

- **Build para un sub-ruta:** `cd app && VITE_BASE=/nihongo-dojo/ npm run build`. Sin `VITE_BASE` la base es `/` (Docker). El router usa `import.meta.env.BASE_URL` como `basename`. El build genera `dist/404.html` (copia de `index.html`, fallback SPA para enlaces profundos) y `dist/.nojekyll`.
- **Vista previa local (imita Pages):** `node scripts/serve-pages.mjs /nihongo-dojo/ 4173` desde `app/` tras el build, y abrir `http://localhost:4173/nihongo-dojo/`. Las rutas desconocidas devuelven `404.html`, como en Pages.
- **Activar el workflow:** en GitHub, Settings > Pages > Source = "GitHub Actions"; luego Actions > "Deploy to GitHub Pages" > Run workflow. Compila con `VITE_BASE=/<nombre-del-repo>/`, ejecuta los tests y despliega.
- **Copias de seguridad:** Ajustes exporta `nihongo_dojo_backup_AAAA-MM-DD.json` e importa desde un selector de archivos (`.json`). Al guardar se pide `navigator.storage.persist()` (mejor esfuerzo).

### Audio

La voz principal es la Web Speech API (`speechSynthesis`, voz `ja`). Si no hay voz japonesa o falla, `useSpeech` reproduce un clip estático de `${BASE_URL}audio/<clave>.mp3`, pero **solo si la clave figura en `app/public/audio/manifest.json`** (`{ "clips": ["ありがとう", …] }`), que se descarga una vez al iniciar: así nunca se piden archivos inexistentes. La clave es el texto normalizado (NFKC, sin espacios, puntuación ni símbolos); el nombre en disco es esa clave, p. ej. `ありがとう.mp3`. Para añadir audio: copiar los `.mp3` a `app/public/audio/` y listarlos en el manifiesto. Hoy el manifiesto está vacío, así que un dispositivo sin voz japonesa no tiene audio.

### Antes de publicar en una web de pruebas (checklist)

1. **Decidir la visibilidad:** GitHub Pages es público. El repo contiene vocabulario, listas de kanji y orden de lecciones derivados de Genki y de los apuntes del profesor (los libros y fotos en `Docs/` no están en git).
2. **Probar en dispositivos reales** una vez: un Android con Gboard y un iPhone (teclado, `100dvh`, descarga del respaldo). Las pruebas automáticas emulan móviles con Chromium.
3. **Correr todo:** `cd app && npm test && npm run test:qa && npm run lint && docker compose up -d --build` (desde la raíz) y `npm run test:e2e:all`.
4. **Publicar:** Settings > Pages > Source = "GitHub Actions", luego Actions > "Deploy to GitHub Pages" > Run workflow.
5. Pendientes conocidos (bajos): ver `QA_REPORT.md`, Parte 3, secciones 4, 6 y 7.

## Atribuciones

- Vocabulario y kanji derivados de [JMdict](https://www.edrdg.org/jmdict/j_jmdict.html) y KANJIDIC (EDRDG), licencia CC BY‑SA 4.0; parecidos de kanji de Kanjium.
- Ideas y datos de kana de [vedxyz/kana](https://github.com/vedxyz/kana) (MIT). Conversión romaji/kana: WanaKana (MIT).
- **Genki** (3.ª ed.) se usa solo como referencia personal de estudio: el contenido del libro no se distribuye (las frases de ejercicio son nuevas y el repo es privado).
- Tipografía: Noto Sans JP (SIL Open Font License).
- LightKanji se conserva únicamente como referencia (`LightKanji/`, fuera del repositorio).
