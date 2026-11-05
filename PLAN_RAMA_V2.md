# Plan rama `v2`: Core 1000, inglés completo y nueva estética

Decisiones del usuario (2026-11-06): integrar la lista **Kanjikana Core 1000** como quinta rama de
aprendizaje, **inglés de interfaz completa** (interfaz + significados + gramática + diálogos), publicar
la rama `v2` en `/nihongo-dojo/v2/` junto a la versión actual (que sigue en la raíz) y fusionar a `main`
solo con su aprobación. El repo queda público mientras se prueba.

Roles: planificador/revisor = sesión principal; implementación = agentes en **worktrees** (una rama por
agente); el planificador fusiona a `v2`, regenera el contenido, corre tests, lint, build y Docker. Nadie
hace push salvo el planificador. Docker local se mantiene **apagado** (petición del usuario): las e2e se
corren contra `vite preview` / `scripts/serve-pages.mjs`.

## Andamiaje común (ya en `v2`, no lo cambien los agentes salvo que se indique)

- `app/src/domain/schema.ts`: `Word.en?`, `Word.noteEn?`, `Word.rank?`, `Word.written?`, `source: 'core1000'`,
  `Kanji.en?`, `PatternExample.en?`, `SentencePattern.titleEn?/explanationEn?`, `Dialogue.titleEn?` y
  `line.en?`, `Lesson.stage` 1–5, `Lesson.titleEn?`, `GameId` incluye `'flashcards'`.
- `app/src/state/progressSchema.ts`: ajustes `uiLang`, `meaningLang` (`'es' | 'en'`, por defecto `es`) y
  `newWordsPerDay` (10). Los guardados viejos cargan por los `.default()`.
- `app/src/i18n/`: `useT()` / `t()` / `useLang()` / `useMeaningLang()` / `localeOf()`. Diccionarios por área en
  `i18n/messages/<area>.ts` exportando `{ es, en }` con las **mismas claves** (`i18n.test.ts` lo exige) y
  registrados en `i18n/messages/index.ts` (`AREAS`). Claves `area.nombre`, únicas entre áreas; valores con
  `{placeholders}`. **Cada agente crea sus propios archivos de área** (no edita los de otros) y añade una
  línea en `AREAS`.
- `app/src/domain/glosses.ts`: `glosses(word, lang)`, `kanjiMeanings`, `lessonTitle`, `patternTitle`,
  `patternExplanation`, `exampleTranslation`, `dialogueTitle`, `lineTranslation`, `wordNote`. Siempre con
  fallback al español: **nunca** leer `word.es` directamente en la interfaz.
- `app/src/games/registry.ts`: `flashcards` registrado sin componente (lo pone G1).
- `tools/content/gen/core1000/`: JSON vendorizado (CC BY 4.0) + LICENSE + README.

Regla pedagógica intacta: `<JaText>` muestra kana/romaji hasta que el kana o kanji se desbloquea. Las
palabras Core con kanji fuera de los 144 de Genki guardan el kanji solo en `written` (información) y
`kanji` queda vacío, así los juegos nunca muestran kanji no enseñados.

## Oleada 1 (en paralelo)

| Id | Alcance | Archivos dueños |
|---|---|---|
| **C1 Core 1000 + etapa 5** | Fusionar la lista en `vocab.json` (451 coincidencias reciben `rank`, `en`, `written`; 549 nuevas con `source: core1000`, `lesson: C<n>`, pos revisado a mano en `core1000_pos.txt`, coincidencias ambiguas en `core1000_matches.txt`); `vocab_en.txt` (de C2) tiene prioridad sobre el `en` de Core; 40 lecciones de etapa 5 `c-01`…`c-40` («Vocabulario esencial 1–25»…) con `titleEn`, juegos `flashcards, read-words, listen, kana-write`, desbloqueo = paquete anterior + hito de hiragana calculado con la misma regla de legibilidad de la etapa 2 (nunca exige gramática); `titleEn` de las 66 lecciones existentes; `validate.py` acepta lo nuevo (source, `C\d+`, etapa 5, `written`, `rank` único, `en` no vacío) | `tools/content/gen/build_vocab.py`, `build_curriculum.py`, `core1000_pos.txt`, `core1000_matches.txt`, `tools/content/validate.py`, `tools/content/README.md`, `app/src/domain/CONTENT_FORMAT.md`, tests en `app/src/lesson/gating.test.ts` (añadir, no reescribir) |
| **C2 Inglés del contenido** | `vocab_en.txt` (`id \| en (;) \| noteEn`) para las 768 palabras actuales traduciendo el sentido de `es`; `titleEn`, `explanationEn` y `en` de cada ejemplo en `patterns_data.py` + emisión en `build_patterns.py`; `titleEn` y `en` por línea en `dialogues_data.py` + `build_dialogues.py`; `en` de kanji desde KANJIDIC (`LightKanji/assets/dictionaries/kanjidb.sqlite`, tabla `kanjidict`) en `build_kanji.py`; textos en español de `numbers.json` (si los hay) con equivalente `en` | `vocab_en.txt`, `patterns_data.py`, `build_patterns.py`, `dialogues_data.py`, `build_dialogues.py`, `kanji_data.py`, `build_kanji.py`, `build_numbers.py`. **No toca** `build_vocab.py` ni `build_curriculum.py` |
| **I1 i18n de la interfaz** | Todas las cadenas visibles de páginas, juegos, lección, repaso, memoria, ajustes, celebraciones y errores pasan a `t()`; `word.es` → `glosses()`, líneas de diálogo, explicaciones, títulos de lección y de patrón con los helpers; `<html lang>` y `Intl` con `localeOf`; en Ajustes: idioma de interfaz, idioma de significados y meta diaria de palabras nuevas; nombres/descr. de juegos del registro traducibles; tests de cambio de idioma | Todo `app/src/**/*.tsx` y `*.ts` con texto, **excepto**: `components/Layout.tsx`, `pages/PathPage.tsx`, `games/shared/GameFrame.tsx` (A1), `lesson/lessonLogic.ts` (G1), archivos nuevos de G1. Áreas `i18n/messages/{home,lesson,games,review,settings,about,memory,practice}.ts` |
| **G1 Tarjetas, Vocabulario, plan diario** | Juego `flashcards` (contrato de `games/README.md`, voltear, «Ya la sé / Todavía no», `sequential`, `rounds`, `onFinish`, registrado en `registry.ts`, quitar `PENDING` del test `b-followups`); página `/vocabulario` (buscar, filtrar por rango/estado SRS/fuente, audio, marcar «ya la sé» con acción `markKnown` del store, insignia «Core #n»); `state/dailyPlan.ts` + `pages/home/TodayCard.tsx` (repasos + palabras nuevas del día + siguiente lección, una sola acción principal) y página `/aprender` (siguientes N palabras Core legibles con los kana conocidos: tarjetas → leer palabras); contador `newWords` en `state/daily.ts`; `lessonLogic.ts`: las lecciones de etapa 5 entregan todas sus palabras a `flashcards` | `games/flashcards/**`, `games/registry.ts`, `games/b-followups.test.tsx`, `pages/VocabPage*`, `pages/LearnNewPage*`, `pages/home/**`, `state/dailyPlan*`, `state/daily.ts`, acción nueva en `state/progressStore.ts`, `lesson/lessonLogic.ts`, `App.tsx` (rutas nuevas), área `i18n/messages/vocab.ts` |
| **A1 Estética** | Tokens de color por etapa `--stage-1…5` (claro/oscuro), iconos SVG (`lucide-react`, MIT) vía `components/Icon.tsx` en vez de emoji; Camino como sendero (conectores SVG, nodos circulares con color de etapa, lección actual destacada, etapas completas plegables, numerales 一二三四五); cabecera y barra de navegación (añadir «Vocabulario» → `/vocabulario`); `GameFrame`/`Feedback` (CSS y estructura); jerarquía tipográfica sin fuentes JP nuevas; contraste ≥ 4.5:1, objetivos táctiles ≥ 44 px, `prefers-reduced-motion` | `styles/index.css`, todos los `*.module.css`, `components/Layout.tsx`, `components/Icon.tsx`, `pages/PathPage.tsx`, `games/shared/GameFrame.tsx`, `games/shared/Feedback.tsx`, `app/package.json` (solo la dependencia), área `i18n/messages/layout.ts` |

Criterio de aceptación por agente: `npx tsc --noEmit`, `npm test`, `npm run lint` en verde dentro de su
worktree; commit(s) en su rama con mensaje claro; informe final con: rama, archivos tocados fuera de su
lista (si los hubo y por qué), decisiones pedagógicas o de datos dudosas, y qué debería probar la QA.

Conflictos previstos y cómo se resuelven: `i18n/messages/index.ts` (una línea por agente, lo fusiona el
planificador), JSON generados (`app/src/content/*.json`: el planificador los regenera con
`tools/content/gen/_run_all.sh` tras fusionar C1 y C2), `registry.ts` (I1 solo traduce nombres; G1 añade
el cargador).

## Oleada 2

Fusión, regeneración de contenido, `HomePage` con `TodayCard` y estilo nuevo, página «Acerca de» con la
atribución CC BY de Kanjikana, workflow de Pages con doble build (`main` en `/nihongo-dojo/`, `v2` en
`/nihongo-dojo/v2/`), QA (Playwright escritorio + móvil contra `vite preview`, invariantes pedagógicos,
auditoría de las traducciones y del pos de Core), correcciones, publicación de `v2`.
