# Plan V2: mejoras mobile, metodología y despliegue estático

Fuente: `Docs/feedback_y_requerimientos_de_mejora_mobile_nihongo_dojo.md` (feedback del usuario
probando en su teléfono) + la QA E8 interrumpida (pruebas e2e parciales en `app/e2e/`, `tools/qa/`).

Roles: **planificador y revisor = Opus** (sesión principal), **QA = Opus**, **implementación = Sonnet**.
Cada agente Sonnet trabaja en su propio **git worktree** (rama `v2/<id>`); el planificador revisa,
fusiona a `main`, corre tests y Docker entre oleadas. Nadie hace push salvo el planificador.

## Oleada 1 (en paralelo)

| Id | Agente | Alcance | Archivos dueños |
|---|---|---|---|
| **M1 Layout mobile** | Sonnet | 1.1 teclado virtual: `dvh`, `scrollIntoView` del input y del ítem activo, compactar con `:focus-within`, `visualViewport` para el teclado; 1.2 escala: botón de audio compacto (≤ 56 px), tipografía de preguntas en < 480 px, opciones/botón de confirmar siempre visibles en el primer pliegue; instrucción del juego 1 no tapada por la barra superior; feedback como banner compacto que no desplaza las opciones | `src/styles/`, `src/components/Layout*`, `SpeakButton`, `src/games/shared/*` (GameFrame, Feedback, ChoiceRound, TypingRound, CSS) |
| **M3 Progresión** | Sonnet | 3.1 desbloqueo intercalado: cada lección de gramática exige el hito de hiragana que la hace legible (calculado con datos: % de kana del contenido ya conocidos), primera gramática (saludos) tras あ‑な; gramática intercalada cada 2–3 filas; validador + tests; el mapa del Camino muestra las dependencias cruzadas | `tools/content/gen/build_curriculum.py`, `validate.py`, `src/content/curriculum.json`, tests de `src/lesson/` |
| **M4 SRS detalle** | Sonnet | 3.2 tarjetas Aprendiz/Guru/… clicables → vista `/memoria/:etapa` con lista de ítems (cómo se ve, tipo, % de acierto, próximo repaso); ayuda (?) con los intervalos para subir/bajar | `src/pages/HomePage*`, nueva `src/pages/MemoryPage*`, ruta en `App.tsx` |
| **M5 Estático / Pages** | Sonnet | 4.1 build 100 % estático con `base` configurable (`VITE_BASE`), `basename` del router, `404.html` como fallback SPA, workflow `.github/workflows/pages.yml` **desactivado (solo `workflow_dispatch`)**; exportación como `nihongo_dojo_backup_AAAA-MM-DD.json`; revisar import; audio: Web Speech + gancho de fallback a clips estáticos (`public/audio/<id>.mp3` si existe) sin generar audios | `vite.config.ts`, `src/main.tsx`, `src/state/download.ts`, `useSpeech`, `.github/`, README |
| **Q1 QA lingüística** | **Opus** | retoma E8, solo áreas que no cambian en V2: auditoría lingüística (conjugaciones vs tablas del profesor, vocab, 229 ejemplos, 19 diálogos, números, kanji), invariantes pedagógicos de contenido, SRS/progreso, salud de código → `QA_REPORT.md` parte 1 | `app/e2e/`, `tools/qa/`, `QA_REPORT.md` (solo lectura del resto) |

## Oleada 2 (depende de M1)

| Id | Agente | Alcance |
|---|---|---|
| **M2 UX de juegos** | Sonnet | 2.1 refuerzo condensado en toast; 2.2 **teclado kana en pantalla** (gojūon + dakuten/yōon/っ/ー, conmutable hiragana/katakana) como entrada por defecto en móvil y opcional en escritorio, más atributos de input móvil (`autocapitalize=off`, `autocorrect=off`, `spellcheck=false`, `enterkeyhint`); separar los modos de kana-write: **lectura** (se ve el romaji, audio solo tras responder) y **dictado** (solo audio, sin texto antes de responder); 2.3 feedback de la palabra previa visible sin tapar la nueva pregunta; 2.4 feedback del juego de audio: kana → `Kana: mi`, palabra → `おなか (onaka) = estómago` |

## Oleada 3: QA funcional y mobile (Opus)

**Q2**: e2e con Playwright en perfiles móviles (Pixel 7, iPhone 14) y escritorio contra Docker
y contra el build estático (`vite preview --base /nihongo-dojo/`). Revisa los 5 puntos del
documento del usuario uno por uno, más los recorridos de E8. Resultado: `QA_REPORT.md` parte 2.

## Oleada 4: correcciones (Sonnet, en paralelo por área)

El planificador reparte los hallazgos de Q1+Q2 en lotes sin solapamiento de archivos:
**F1 contenido** (vía generadores), **F2 juegos**, **F3 estado/SRS/infra**. Cierre con una
verificación corta de Opus sobre los hallazgos Críticos/Altos.

## Decisión pendiente del usuario

Publicar en GitHub Pages expone el sitio y su contenido (derivado de Genki y del profesor)
públicamente, y con repo privado requiere GitHub Pro. M5 deja todo listo sin publicar.
