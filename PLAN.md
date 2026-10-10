# Plan: Nihongo Dojo — reconstrucción del entrenador de japonés

Uso personal. Objetivo: un sitio web (Docker + nginx) que lleve al usuario paso a paso
desde hiragana hasta kanji, siguiendo **Genki I (3.ª ed., español)** y el **método de su
profesor** (tablas de sintaxis inglés→japonés, tablas de conjugación, números/hora/fechas,
diálogos prácticos).

## Material fuente (en `Docs/`)

- `GENKI_ ... (Tercera edicion) Version en espanol.pdf` (389 págs., **escaneado, sin texto**:
  leer páginas renderizadas con `pdftoppm -r 100` y mirarlas como imagen).
- `GENKI_ ... [Libro de ejercicios] ....pdf` (154 págs., igual).
- `2026*.jpg` (39 fotos, ~7 MB c/u: reducir con `magick X -auto-orient -resize 1600x1600`
  antes de mirarlas). Contienen:
  - **Japanese Syntax for verbs ①②③**: inglés S‑V‑O → japonés S‑O‑V. Patrones:
    `わたし は X を V-ます`, `わたし は X を します`, `わたし は LUGAR に いきます`.
  - **Japanese Syntax for nouns and adjectives ①②**: `X は Y です`, `X は ADJ です`,
    negativos `じゃないです` / `くないです`.
  - **Tablas de conjugación** (どうし, grupos I/II/III, ~36 verbos): ます, ました, ません,
    ませんでした, て, てください, ています, ましょう, ましょうか, たいです.
  - **Tabla de adjetivos い** (~30): です, かったです, くないです, くなかったです.
  - **Language Focus**: números (0–100.000+), contadores つ/人/階/歳, hora (じ, はん, ふん),
    años/meses/días del mes/días de la semana, precios (えん), pisos.
  - **Diálogos**: restaurante (いらっしゃいませ, おかいけい…), direcciones/transporte
    (きっぷはどこですか, いくらですか, どのぐらいかかりますか).
  - Hojas tipo *Japanese for Busy People* (Key sentences / Word power / Notes): あります/います,
    ～から～まで, で (medio de transporte), に (tiempo).

**Copyright:** el contenido queda local y privado (no se publica el repo). Las frases de
ejercicio se escriben nuevas; del material se toman vocabulario, orden de lecciones y
patrones gramaticales.

## Decisiones técnicas

- **Nueva app en `app/`**: Vite + React + TypeScript, sin backend. Razones: juegos ricos en UI
  (arrastrar fichas, reloj, calendario), `wanakana` (MIT) para escribir romaji→kana, Web Speech
  API para audio japonés, build y bundle mucho más livianos que Flutter web, y reutilización
  directa de ideas/código de `vedxyz/kana` (MIT).
- `LightKanji/` queda como **referencia**: se reutilizan sus datos (`assets/dictionaries/*.json`,
  derivados de JMdict → atribución CC‑BY‑SA) y se porta la idea del selector ponderado.
  No tiene licencia: no copiar su código literalmente.
- Estado: `localStorage` versionado + **exportar/importar progreso (JSON)** para respaldo.
- Tests: Vitest (unidad), Playwright (e2e, etapa QA).
- Docker: build `node:22-alpine` → `nginx:1.29-alpine`, mismo `.env`/puerto 8081.
  El Dockerfile de Flutter se conserva como `docker/Dockerfile.lightkanji` (servicio opcional).
- Interfaz y significados **en español**; romaji visible como andamiaje, desactivable.
- Git: el proyecto raíz se inicializa como repo (`LightKanji/` y `Docs/` en `.gitignore`;
  Docs pesa ~450 MB).

## Modelo de contenido (`app/src/content/*.json`, validado con zod)

```ts
type Script = 'hiragana' | 'katakana' | 'kanji';
interface Word {            // vocab.json
  id: string;               // "taberu", "koohii"
  kana: string;             // lectura en el silabario natural: "たべる", "コーヒー"
  kanji?: string;           // "食べる" (si existe y se usa en Genki I)
  romaji: string;
  es: string[];             // significados en español
  pos: 'noun'|'verb'|'i-adj'|'na-adj'|'adverb'|'expression'|'counter'|'particle'|'pronoun';
  verbGroup?: 'u'|'ru'|'irregular';   // grupo I / II / III
  lesson: string;           // "G1".."G12" (Genki) o "P1".. (profesor)
  tags: string[];           // "tiempo", "comida", "lugar"...
  source: 'genki'|'profesor'|'propio';
}
interface Kanji { char: string; on: string[]; kun: string[]; es: string[]; genkiLesson: number; words: string[] }
interface SentencePattern { // patterns.json — método del profesor
  id: string; title: string; lesson: string;
  english: { slot: 'S'|'V'|'O'|'DIR'|'BE'|'ADJ'|'N'; text: string }[];   // orden S-V-O
  japanese: { slot: string; text: string; particle?: string }[];        // orden S-O-V
  explanationEs: string;
}
interface Dialogue { id: string; title: string; lesson: string; lines: { speaker: 'A'|'B'; ja: string; romaji: string; es: string }[] }
interface Lesson {          // curriculum.json — el camino
  id: string; stage: 1|2|3|4; title: string;
  requires: string[];       // ids de lecciones previas
  kana?: string[];          // kana que introduce
  words?: string[]; patterns?: string[]; kanji?: string[]; dialogues?: string[];
  games: GameId[];
}
```

**Regla de renderizado (núcleo pedagógico):** cada palabra se guarda una vez; el componente
`<JaText>` decide cómo mostrarla según lo desbloqueado: kana desconocido ⇒ romaji;
katakana no desbloqueado ⇒ hiragana equivalente; kanji desbloqueado ⇒ kanji + furigana;
kanji dominado (SRS ≥ Guru) ⇒ kanji sin furigana.

## El camino (4 etapas de aprendizaje)

1. **Hiragana**: filas あ→ん, dakuten, yōon, っ y vocales largas. Tras cada fila, palabras que
   solo usan filas conocidas.
2. **Palabras y gramática solo en hiragana** (Genki L1–L6 + profesor): です/じゃないです,
   これ/それ/あれ, verbos ます y sus 4 tiempos, を/に/で/へ/は/も/の/と/から/まで,
   あります/います, adjetivos い/な, て‑form, てください, ましょう, たい, ています; números,
   contadores, hora, fechas, precios; diálogos.
3. **Katakana + hiragana**: filas katakana, préstamos (コーヒー, テニス, レストラン, ジム),
   el mismo contenido de la etapa 2 ahora con katakana real.
4. **Kanji**: orden de kanji de Genki L3–L12, furigana progresivo, palabras ya conocidas que
   “se transforman”.

## Juegos

| Juego | Etapa | Descripción |
|---|---|---|
| Reconocer kana | 1,3 | kana → escribir romaji (estilo vedxyz, ponderado por errores) |
| Escribir kana | 1,3 | romaji/audio → escribir kana con IME wanakana |
| Leer palabras | 1–4 | palabra → significado (elección múltiple o escrito) |
| Escuchar | 1–4 | audio TTS → elegir la palabra/frase |
| **Sintaxis** (método del profesor) | 2–4 | se muestra la frase en español/inglés S‑V‑O; el usuario arma S‑O‑V con fichas y partículas |
| Partículas | 2–4 | completar は/を/に/で/へ/も/の/と/が |
| **Conjugación** | 2–4 | verbo/adjetivo + forma pedida → escribirla; modo “tabla” como la del profesor |
| Números y precios | 2 | número ↔ lectura; precios ¥ de objetos |
| Reloj | 2 | esfera analógica → いま なんじですか |
| Calendario | 2 | fecha/día de la semana ↔ lectura (ついたち, はつか…) |
| Diálogos | 2–4 | rol: elegir/armar la respuesta correcta en restaurante, estación, tienda |
| Mini‑lectura | 2–4 | texto corto con solo lo desbloqueado + preguntas |
| Kanji | 4 | kanji → lectura en palabra real; furigana que se retira |

Progreso: SRS por ítem (Aprendiz 1–4 → Guru → Maestro → Iluminado → Quemado), XP, racha,
mapa de lecciones con desbloqueo, cola diaria de repasos.

## Etapas de desarrollo

Cada etapa la ejecuta **un agente Sonnet** (salvo la QA, que usa **Opus**). Criterio común de
aceptación: `npm test` en verde, `npm run build` sin errores, `docker compose build` OK,
contenedor sirviendo en :8081, commit al final de la etapa. Entre etapas, el orquestador
revisa y prueba.

| # | Etapa | Agente | Depende de | Entregable |
|---|---|---|---|---|
| E0 | Fundación | Sonnet | — | git init, `app/` Vite+React+TS, router, tema, i18n es, store de progreso + export/import, `<JaText>`, TTS, input wanakana, esquemas zod del modelo, Docker node→nginx |
| E1 | Contenido | Sonnet | esquemas de este plan | `app/src/content/*.json` desde fotos del profesor + Genki L1–L6 (vocab, verbos con grupo, adjetivos, patrones, números, diálogos, kanji L3–L12, curriculum). Informe de lo extraído y dudas |
| E2 | Motores | Sonnet | E0 | conjugador verbos/adjetivos, lector de números/contadores/hora/fechas (irregulares: よんひゃく, さんびゃく, ろっぴゃく, はっせん, よじ, しちじ, くじ, いっぷん, ついたち, はつか…), SRS, selector ponderado, filtro “solo kana conocidos”. Tests contra las tablas del profesor |
| E3 | Etapa 1: Hiragana | Sonnet | E1, E2 | lecciones por fila, reconocer/escribir/escuchar, leer palabras desbloqueadas |
| E4 | Etapa 2: Hiragana + gramática | Sonnet | E3 | Sintaxis, Partículas, Conjugación, Números/Precios, Reloj, Calendario, Diálogos, Mini‑lectura |
| E5 | Etapa 3: Katakana | Sonnet | E4 | filas katakana, préstamos, contenido mixto |
| E6 | Etapa 4: Kanji | Sonnet | E5 | kanji Genki, furigana progresivo, datos JMdict de LightKanji |
| E7 | Integración y gamificación | Sonnet | E6 | dashboard, mapa de lecciones, cola SRS, XP/racha, ajustes, responsive, pulido |
| E8 | **QA y diagnóstico** | **Opus** | E7 | Playwright e2e en Docker, auditoría lingüística (conjugaciones, lecturas, partículas, contadores), coherencia pedagógica (nunca mostrar kana/kanji no desbloqueados), móvil/accesibilidad, rendimiento. Informe `QA_REPORT.md` con severidades. No corrige |
| E9 | Correcciones | Sonnet | E8 | arreglar hallazgos críticos/altos del informe |

E1 corre **en paralelo** con E0→E2 (no toca código, solo JSON siguiendo los esquemas de arriba).
