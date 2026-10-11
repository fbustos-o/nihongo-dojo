# QA_REPORT — Nihongo Dojo · Parte 1 (Q1: lingüística, invariantes, SRS, salud del código)

Fecha: 2026-10-11 · Autor: QA (Opus) · Base: `main` en `dc845e9` (incluye M3, M4 y M5 ya fusionados).
Alcance según `PLAN_V2.md` (tarea **Q1**): auditoría lingüística, invariantes pedagógicos a nivel de contenido / `renderPlan` /
lógica de juegos, corrección de SRS y progreso, y salud del código. La UX, el diseño responsive, la accesibilidad, el rendimiento y
los recorridos e2e completos quedan para **Q2** (Parte 2). No se modificó código de la app, contenido ni generadores.

---

## 1. Resumen ejecutivo

**Estado general: bueno en datos y motores, con dos fallos críticos que hay que corregir antes del estudio diario.**

- Los motores lingüísticos son sólidos. `conjugateVerb` coincide con las tablas del profesor en los **49 verbos** comprobados (ます,
  ました, ません, ませんでした, ましょう(か), たいです, て, てください, ています). Los números, la hora, las fechas y los
  contadores coinciden con las hojas *Language Focus* y con Genki. Los 144 kanji pasan `verify_kanji.py` (0 errores) y los grupos
  verbales de `vocab.json` son correctos, incluidos かえる, はいる, しる, いる/いる y にる.
- Hay **un error de conjugación real**: かわいい se conjuga como si fuera いい (**かわよかったです**). Además encontré una docena
  de errores menores de contenido: glosas cortadas, romaji «ha» por «wa», una partícula mal usada en un diálogo y tablas S‑O‑V
  incoherentes.
- La regla «nunca mostrar lo no desbloqueado» **se rompe con el yōon**. Al desbloquear きゃ como dígrafo, `renderKana` comprueba
  carácter a carácter y muestra **«きyaく», «きyoう», «しyaしん»**, y esto afecta a todo el contenido desde la etapa 2. Los
  distractores de «Escuchar» también muestran kana que aún no se han visto.
- **El SRS no espacia.** Cada acierto sube una etapa aunque el ítem no estuviera vencido. Una lección o unos minutos de práctica
  libre llevan los ítems a Guru o a Quemado. Además, los ítems de números, hora y fechas que vencen nunca se preguntan en el repaso,
  así que se acumulan sin fin.

### Top‑10 de lo que hay que corregir

| # | Id | Sev. | Qué |
|---|---|---|---|
| 1 | QA-001 | Crítica | Yōon renderizado como «きyaく» en todo el contenido (`renderKana` no entiende dígrafos) |
| 2 | QA-002 | Crítica | El SRS avanza en cada acierto, aunque el ítem no esté vencido: se queman ítems en minutos |
| 3 | QA-004 | Alta | かわいい → かわよかったです / かわよくないです (motor de adjetivos い) |
| 4 | QA-005 | Alta | Los ítems vencidos de números, hora y fechas nunca se preguntan en el repaso, y la cola crece sin fin |
| 5 | QA-009 | Alta | «Escribir kana» pide «o», «ji» o «zu» y exige を/ぢ/づ (indistinguibles de お/じ/ず) |
| 6 | QA-003 | Alta | «Escuchar» ofrece como distractores kana no desbloqueados (か, き… en la lección あいうえお) |
| 7 | QA-024 | Media | Fichas de Sintaxis pegadas por la coma: «はい、がくせい», «おきて、シャワー», «あつい から、みず» |
| 8 | QA-010 | Media | Sintaxis acepta órdenes incorrectos con の / や («うえ に つくえ の ほん が あります») |
| 9 | QA-015 | Media | Lecciones sin patrones o diálogos propios usan TODO el corpus, incluida gramática aún no enseñada |
| 10 | QA-020/023/025 | Media | Contenido: 7 glosas cortadas, romaji «ha»/«teha», diálogo «その えんぴつ も いくら ですか» |

**Recomendación:** no está listo para el estudio diario mientras sigan QA-001 y QA-002. Con QA-001, QA-002, QA-004, QA-005 y QA-009
corregidos (lote F2 o F3 más un par de cambios en F1), la app es confiable para estudiar a diario. El resto puede ir en paralelo.

**Hallazgos por severidad: Crítica 2 · Alta 4 · Media 12 · Baja 16 (total 34)**, más 24 errores lingüísticos puntuales (sección 3),
algunos solapados con hallazgos.

---

## 2. Tabla de hallazgos

Las rutas son relativas a `app/src/` salvo que se indique otra cosa. «Test» indica la prueba que documenta el fallo: los `it.fails` y
`test.fail` pasan mientras el fallo existe y fallarán al corregirlo; ese es el momento de quitarles la marca.

| Id | Sev. | Área | Título | Ubicación | Reproducción | Esperado / Actual | Arreglo sugerido |
|---|---|---|---|---|---|---|---|
| QA-001 | Crítica | Invariantes / render | Los dígrafos yōon desbloqueados se muestran con romaji | `domain/renderPlan.ts:65-99` (`renderKana`) | Completar h-yoon-1 (o toda la etapa 1) y ver cualquier palabra con yōon: きょう, しゃしん, としょかん, じゅうじ… Test: `tools/qa/invariants.qa.test.ts` QA-001/001b; e2e `invariants.e2e.ts` (QA-001). | Esperado «きゃく». Actual «き**ya**く»: las lecciones desbloquean «きゃ» como unidad, `knownKana` nunca contiene «ゃ» y `renderKana` evalúa carácter a carácter. Afecta a JaText en todas las etapas. | En `renderKana`, agrupar base + kana pequeño (como hace `splitKanaUnits`) y mostrar la unidad si `knownKana` tiene el dígrafo o ambos caracteres. |
| QA-002 | Crítica | SRS | Cada respuesta mueve el SRS aunque el ítem no esté vencido | `state/progressStore.ts:60-91` (`recordAnswer`) → `engine/srs.ts:83` (`applyAnswer`) | Práctica libre → fila あ → 45 aciertos. Test: `srs.qa.test.ts` QA-002; e2e `practice.e2e.ts` (QA-002). | Esperado: un ítem no vencido conserva su etapa (o sube como mucho una por sesión). Actual: 9 aciertos seguidos → etapa 9 «Quemado», `nextDue = NEVER_DUE`. En una lección, cada kana se pregunta 2‑3 veces por juego × 4 juegos, así que termina en Aprendiz 4 o Guru el mismo día. | Avanzar la etapa solo si el ítem es nuevo o `isDue`. Fuera de eso, actualizar solo contadores y `weight`. Opcional: una sola actualización SRS por ítem y sesión (la primera respuesta). |
| QA-003 | Alta | Invariantes | Distractores de «Escuchar» con kana no desbloqueados | `games/listen/Listen.tsx:35` (`kanaChoices(entry, 4, content.kana)`) | Lección h-a → juego 4 «Escuchar». Test: `invariants.qa.test.ts` QA-003; e2e `invariants.e2e.ts` (QA-003). | Esperado: opciones solo de あいうえお. Actual: aparecen か, き, く… También en katakana. | Pasar como `all` los kana conocidos más los de la lección (como hace `buildRecognizeQuestion` con `known`). |
| QA-004 | Alta | Lingüística / motor | かわいい se conjuga como いい | `engine/adjectives.ts:57` (`dict.endsWith('いい')`) | `conjugateIAdjective('かわいい')`. Test: `linguistic.qa.test.ts` QA-004. | Esperado かわいかったです / かわいくないです (tabla del profesor, foto 144252, n.º 5). Actual かわよかったです / かわよくないです. | Irregular solo para `いい` y una lista explícita de compuestos (`かっこいい`, `あたまがいい`…), no para todo lo que termina en «いい». |
| QA-005 | Alta | SRS / repaso | Los ítems vencidos de números, hora y fecha nunca se repasan | `review/reviewLogic.ts:207-210` (`default:` sin `onlyItems`), `games/numbers/numbersLogic.ts:106-145`, `clockLogic.ts:76`, `calendarLogic.ts:154` | Tener `word:number:4173` vencido → /repaso. Test: `srs.qa.test.ts` QA-005. | Esperado: se pregunta 4173. Actual: el juego genera números al azar entre 0 y 99 999, cada respuesta crea un ítem SRS nuevo y el vencido sigue vencido. «Seguir repasando» nunca vacía la cola y el contador del inicio crece. | Generar la pregunta desde el id (`number:N`, `time:h:m`, `date:m:d[:wd]`) cuando viene `onlyItems`. Mejor aún: guardar ítems agregados (p. ej. `counter:nin`, `number:tier2`, `time:half`) en vez de uno por valor. |
| QA-006 | Media | Juegos / pedagogía | «Audio → cifras» muestra siempre el kana y el romaji de la respuesta | `games/numbers/Numbers.tsx:55` | Lección l-numeros, modo «hear». | Esperado: solo audio (texto solo sin voz o después de responder). Actual: el kana y el romaji siempre visibles, así que no es un ejercicio de escucha. | Mostrar `KanaWithRomaji` solo si `!audio` o tras responder. |
| QA-007 | Media | Funcionalidad | No hay práctica libre de los juegos de la etapa 2; el modo libre de Conjugación es inalcanzable | `pages/PracticePage.tsx:16` (`PRACTICE_GAMES`), `games/conjugation/Conjugation.tsx` (rama `free`) | /practica solo ofrece los 4 juegos de kana y el de kanji. | El PLAN pide Conjugación con modo tabla, Números, Reloj, etc. también como práctica. Hoy la única vía es repetir una lección. La UI de casillas «Formas a practicar» es código muerto. | Añadir esos juegos a Práctica (con `lessonId` indefinido) o eliminar el código muerto. |
| QA-008 | Media | Invariantes | La retroalimentación usa `word.kana` en crudo (katakana en la etapa 2) | `games/read-words/ReadWords.tsx:46`, `games/listen/Listen.tsx:78` | l-kore → Leer palabras → acertar «テレビ». e2e `invariants.e2e.ts` (QA-008). | Esperado «¡Correcto! てれび…» (vía `renderPlan`). Actual «¡Correcto! テレビ = TV». | Formar el texto con `renderPlan` o renderizar `<JaText>` dentro del Feedback. |
| QA-009 | Alta | Juegos / equidad | «Escribir kana» muestra un romaji ambiguo para を, ぢ, づ, ヲ, ヂ, ヅ | `games/kana-write/KanaWrite.tsx:45` (`romaji = entry.romaji`) y comprobación estricta en la línea 14 | h-wa-n → Escribir kana: se pide «o» y escribir お cuenta como error. Igual con «ji»/ぢ y «zu»/づ en h-dakuten-2. Test: `invariants.qa.test.ts` QA-009. | Esperado: una pista inequívoca («wo (partícula)», «di», «du») o aceptar ambas. Actual: imposible acertar salvo por azar. | Usar `alt[0]` cuando el romaji se repite en el mismo silabario, o añadir una pista en español. |
| QA-010 | Media | Juegos / lingüística | Sintaxis acepta órdenes agramaticales | `games/syntax/syntaxLogic.ts:50-79` (`chunkKeys`/`isValidOrder`) | Frase «つくえ の うえ に ほん が あります» → armar «うえ に つくえ の ほん が あります». Test QA-010/010b. | Esperado: incorrecto (el modificador con の va pegado al sustantivo siguiente; lo mismo con や). Actual: «¡Correcto!». | Fusionar los bloques que terminan en の / や con el bloque siguiente antes de permutar. |
| QA-011 | Baja | Juegos | Distractor de partícula que también es correcto | `games/particles/particleLogic.ts:37` (`INTERCHANGEABLE`) | «ともだち ＿ あいます» (respuesta に): se ofrece と. «ねこ ＿ すき»: se ofrece も. Test QA-011. | と y も también son gramaticales ahí. | Excluir por ejemplo (lista por frase) o ampliar `INTERCHANGEABLE` según el verbo. |
| QA-012 | Baja | Equidad | La tolerancia は→わ / へ→え solo se aplica al final de la cadena | `engine/answer.ts:111` | `checkAnswer('わたしわがくせいです', 'わたしはがくせいです')` → falso. Test QA-012. | Hoy afecta poco (casi no se escriben frases), pero romperá cualquier juego futuro de frase escrita. | Aplicar la variante a cada partícula aislada (tokens) o a cualquier posición seguida de un límite de palabra. |
| QA-013 | Baja | Equidad | «Reconocer kana» no acepta «nn» para ん ni romaji Kunrei (si, ti, tu, hu, zi) | `content/kana.json` (`alt`), `games/kanaUtils.ts:7` | Escribir «nn» para ん. Test QA-013. | Son entradas habituales de IME. | Añadir `alt` en `build_kana.py`. |
| QA-014 | Media | Juegos / lingüística | «Leer palabras» ofrece como distractor el significado de un homófono o un sinónimo | `games/wordUtils.ts:9-22` (`meaningChoices`) | あつい: opciones «caluroso (clima)» y «caliente (cosas)», ambas correctas para el kana. También いる (estar / necesitar), ふく (limpiar / soplar), トイレ «baño» frente a ふろ «baño (bañera)», ともだち «amigo/a» frente a ゆうじん «amigo (más formal)». Test QA-014. | Solo una opción puede ser defendible. | Excluir los distractores cuya palabra tenga el mismo `kana`, o con glosas que compartan la primera palabra. |
| QA-015 | Media | Invariantes / orden | Sin patrones o diálogos propios, los juegos usan TODO el corpus | `games/mini-reading/MiniReading.tsx:23-25`, `games/syntax/Syntax.tsx:31`, `games/particles/Particles.tsx:26`, `games/dialogues/dialoguesLogic.ts:38` | l-vacaciones → Mini‑lectura (0 patrones) y k-prestamos-lugares → Diálogos (0 diálogos: usa los 19, con てください / てもいい / たい antes de l-te-kudasai). Informe de pools en la sección 4. | Esperado: solo lo enseñado hasta esa lección. Actual: frases de cualquier lección. | Fallback a los patrones o diálogos de las lecciones ancestro (no a todo), o asignar contenido propio a esas lecciones. |
| QA-016 | Media | Práctica | La práctica libre de filas no desbloqueadas muestra las palabras en romaji | `pages/PracticePage.tsx:86` (sin `ExtraKanaContext`) | Usuario nuevo → Práctica → fila あ → «Leer palabras»: aparece «ao» y se pide escribir su romaji. e2e `practice.e2e.ts` (QA-016). | Esperado: los kana seleccionados se tratan como conocidos durante la práctica. | Envolver el juego en `ExtraKanaContext.Provider value={kana seleccionados}`. |
| QA-017 | Baja | Progreso | No hay migración de esquema: `version` es un literal 1 | `state/progressSchema.ts:43` | Importar un JSON con `version: 2`. Test QA-017. | Cualquier cambio futuro de versión invalidará los respaldos. | Implementar `migrate(json)` por versión antes del `safeParse`. |
| QA-018 | Media | Progreso | Si guardar falla (cuota llena o modo privado), solo se ve un `console.warn` | `state/persistence.ts:58` (`saveProgress`) | Safari privado o cuota llena. Test QA-018. | Esperado: un aviso visible («tu progreso no se está guardando, exporta»). Actual: se pierde el progreso sin aviso. | Exponer el error (como `loadIssue`) y mostrar el banner del `Layout`. |
| QA-019 | Baja | Progreso | Repetir una lección ya completada suma otra «Lección» al contador de hoy | `state/progressStore.ts:124` | Completar h-a dos veces. Test QA-019. | Discutible; si se mantiene, debería llamarse «lecciones jugadas». | Sumar solo la primera vez, o renombrar el contador. |
| QA-020 | Media | Contenido | 7 glosas cortadas por el `split(';')` | `tools/content/gen/build_vocab.py:39` | okaasan, otousan, aru, iru, dekakeru, tsumetai, oazukari (p. ej. «estar (cosas» + «lugar に cosa が)»). Test QA-020. | Se muestran como opciones cortadas. | Usar otro separador en la fuente o no partir dentro de paréntesis. |
| QA-021 | Baja | Contenido | Nota interna en inglés en una glosa | `vocab.json` atsui | «caliente (teacher: hot)». Test QA-021. | — | «caliente». |
| QA-022 | Baja | Contenido | `kana` de チリ人 escrito ちりじん | `vocab.json` chirijin; `patterns.json` noun-desu (tabla) | Test QA-022. | «チリじん» (como アメリカじん y el diálogo «チリじん です»). | Corregir en los datos de `build_vocab.py` y `patterns_data.py`. |
| QA-023 | Media | Contenido | Romaji de la partícula は escrito «ha» | `patterns.json` te-wa-ikemasen:0‑3; `dialogues.json` en-clase:4, presentacion:3 | Romaji visible con `showRomaji`. Test QA-023. | «tottewa», «tabetewa», «haittewa», «suttewa», «ropesu san wa?». | Corregir en `patterns_data.py` / `dialogues_data.py`. |
| QA-024 | Media | Contenido / juegos | La puntuación interna crea fichas imposibles en Sintaxis | `games/syntax/syntaxLogic.ts:17-22` (split solo por espacios) + 14 ejemplos con «、» | ka-question:1 «はい、がくせい», te-form-connect:0 «おきて、シャワー» y «あびて、がっこう», kara-because «あつい から、みず»; counters:4 «カレーライス、ふたつ、おねがいします» queda como una sola ficha y se descarta. Test QA-024/024b. | Fichas por palabra, con «、» separado o eliminado. | En `tokenize`, separar por «、» (y tratarlo como ficha fija) o reescribir los ejemplos. |
| QA-025 | Media | Contenido / lingüística | も mal usada en una pregunta de precio | `dialogues.json` papeleria:2 | «その えんぴつ も いくら ですか？». Test QA-025. | «その えんぴつ は いくら ですか？» (も + palabra interrogativa no significa «¿y…?»). | Corregir en `dialogues_data.py`. |
| QA-026 | Baja | Pedagogía | Lecciones de っ con un único kana en 10 rondas; las vocales largas no se practican | `curriculum.json` h-tsu-long, k-small-tsu | Informe de pools (sección 4). | 10 rondas de «っ → xtsu». | Añadir palabras con っ y vocal larga a los juegos de lectura y escritura de esas lecciones, o reducir las rondas. |
| QA-027 | Baja | Pedagogía | Pools de diálogo finos (2‑6 turnos del alumno para 15 rondas) | l-vacaciones (2), l-te-imasu-tai (2), l-desu, l-invitar, l-aru-iru, l-fechas, l-permisos (3) | Informe de pools. | El mismo diálogo se repite 3‑5 veces. | Rondas = turnos disponibles, o más diálogos. |
| QA-028 | Baja | Código / a11y | `aria-keyshortcuts="1..4"` sin manejador de teclado | `games/shared/ChoiceRound.tsx:55`, `games/dialogues/Dialogues.tsx:82` | Pulsar «1». | Se anuncia un atajo que no existe. | Implementar el atajo o quitar el atributo. |
| QA-029 | Baja | Código | `now` congelado con `useState` en el Inicio, Práctica y Memoria | `pages/HomePage.tsx:22`, `pages/PracticePage.tsx:43`, `pages/MemoryPage.tsx:62` | Dejar el Inicio abierto 4 h. | Los «repasos pendientes» no se actualizan hasta navegar. | Refrescar con un intervalo, o al enfocar la ventana. |
| QA-030 | Baja | Código | Lógica y constantes duplicadas | `XP_PER_CORRECT` en `state/progressStore.ts:19` y `lesson/lessonLogic.ts:12`; `ancestors()` reimplementado; el patrón «primer intento + deshabilitar error» repetido en `ChoiceRound`, `ReplyChoice` y `ClockSetView` | — | Riesgo de divergencia (XP mostrado ≠ XP sumado). | Una sola constante exportada; un hook `useFirstAttempt`. |
| QA-031 | Baja | Invariantes | Partículas japonesas dentro de glosas en español | `vocab.json` (`es`): iku, kaeru, kiku, au, aru, iru, noru, hairu… | En h-ka o h-ta, «Leer palabras» o «Escribir kana» muestran «ir (destino に/へ)». Test QA-031. | Muestra に/へ/が antes de h-na/h-ha. | Escribir «(destino con ni/e)» o marcar esas glosas como posteriores a la etapa 1. |
| QA-032 | Baja | Orden pedagógico | Gramática usada antes de enseñarla en frases fijas | l-saludos (よかった, おいしかった), l-particulas y k-prestamos-comida to-with:0 «みました», l-invitar «わかりました», l-transporte como-llegar:1 «まがって ください» | Informe de gramática (sección 4). | Las frases hechas son aceptables. «みました» en Sintaxis y Partículas antes de l-conj-masu es evitable. | Cambiar to-with:0 a «みます», o adelantar el pasado. |
| QA-033 | Baja | Pedagogía | Conjugación pide formas sin sentido | `games/conjugation/conjugationLogic.ts:204` (`conjEntries`: todas las formas para todos los verbos) | l-te-kudasai: «ある → あってください», «ある → ありましょうか», l-te-imasu-tai: «わかる → わかりたいです». | Formas válidas morfológicamente pero no naturales. | Lista de exclusión por verbo (ある, わかる, いる-necesitar…) para たい, ましょう(か) y てください. |
| QA-034 | Baja | Juegos | La fila «Estructura española» de Sintaxis muestra los huecos del patrón, no los de la frase | `games/syntax/Syntax.tsx:80` | ka-question:1 «はい、がくせい です» aparece con «Sujeto · Ser/estar · Sustantivo». | Etiquetas que no corresponden a la frase. | Derivar la estructura de la frase (como hace `buildSolutionTable`) u ocultarla en las respuestas cortas. |

---

## 3. Errores lingüísticos

Fuentes: **P** = hojas del profesor (fotos `Docs/2026*.jpg`); **G** = Genki I 3.ª ed.; **N** = norma general del japonés (uso estándar).

| Id | Archivo / id | Actual | Correcto | Fuente |
|---|---|---|---|---|
| L-01 | motor `conjugateIAdjective('かわいい')` | かわよかったです / かわよくないです / かわよくなかったです | かわいかったです / かわいくないです / かわいくなかったです | P (tabla de adjetivos い, n.º 5) |
| L-02 | `dialogues.json` papeleria:2 | その えんぴつ も いくら ですか？ | その えんぴつ は いくら ですか？ | N |
| L-03 | `dialogues.json` presentacion:3 (romaji) | … ropesu san ha? | … ropesu san wa? | G (lección 1: は se lee «wa») |
| L-04 | `patterns.json` te-wa-ikemasen:0‑3; `dialogues.json` en-clase:4 (romaji) | totteha / tabeteha / haitteha / sutteha ikemasen | tottewa / tabetewa / haittewa / suttewa ikemasen | G (lección 6) |
| L-05 | `vocab.json` chirijin (`kana`) y `patterns.json` noun-desu (tabla, N) | ちりじん | チリじん | N (チリ va en katakana; el diálogo ya usa チリじん) |
| L-06 | `vocab.json` okaasan / otousan | «madre (de otro» + «o la propia al hablarle)» | «madre (de otro, o la propia al hablarle)» | dato cortado |
| L-07 | `vocab.json` aru | «estar (cosas» + «lugar に cosa が)» | «estar (cosas: lugar に cosa が あります)» | dato cortado |
| L-08 | `vocab.json` iru | «haber (personas/animales» + «lugar に persona が)» | una sola glosa | dato cortado |
| L-09 | `vocab.json` dekakeru / tsumetai / oazukari | glosas partidas por «;» | una sola glosa por significado | dato cortado |
| L-10 | `vocab.json` atsui | «caliente (teacher: hot)» | «caluroso (clima)» (y «caliente» está en atsui-cosa) | P / N |
| L-11 | `patterns.json` adj-desu:0, noun-janai:4, to-with:3 | おかあさん … = «Mi madre…» | Hablando a terceros de la propia madre: はは, o traducir «la madre (de alguien)» / «mamá» | G (lección 2: おかあさん / はは) |
| L-12 | `patterns.json` to-with:3 | おかあさん と かいもの に いきます = «Voy a la tienda con mi madre» | «Voy de compras con mamá» | N |
| L-13 | `patterns.json` ni-time:4 | traducción «Mañana voy a la escuela (sin に)» con una frase que lleva に | traducción «Mañana voy a la escuela»; la nota «あした no lleva に» va en `explanationEs` | N |
| L-14 | `patterns.json` koko-soko-asoko:3 | そこ は レストラン です = «Ahí es un restaurante» | «Eso (ahí) es un restaurante» / «Ahí hay un restaurante» | N |
| L-15 | `patterns.json` de-place-action:3 | … たべます = «Cenamos…» | «Ceno…» (primera persona, como el resto) | N |
| L-16 | `patterns.json` dare-no (tabla) | EN «¿De quién / es este bolso», JA «だれ[の] / かばん / ですか» | JA «これ[は] / だれ[の] かばん / ですか» (la tabla debe cubrir «este») | P (tablas S‑V‑O → S‑O‑V) |
| L-17 | `patterns.json` nanji-desu-ka (tabla) | S = いま[は] | いま (sin は, como en los ejemplos y en el diálogo) | G (lección 1) |
| L-18 | `patterns.json` adj-kunai (tabla) | ADJ = «おいし» / BE = «くないです» | ADJ = «おいしくない» / BE = «です» (fichas que sean palabras) | P |
| L-19 | `patterns.json` masen-ka:0, mashou:0; `dialogues.json` planes-almuerzo:2 | いっしょ に (partícula separada; Partículas puede vaciar ese «に») | いっしょに (adverbio) | G (lección 3) |
| L-20 | `patterns.json` y `dialogues.json`, todo el romaji con «、» | «hai,gakusei desu.», «jaa,are o kudasai.» | «hai, gakusei desu.» (espacio tras la coma) | formato |
| L-21 | `vocab.json` tiishatsu | ティーシャツ | Tシャツ (es la grafía de Genki; ティーシャツ también existe) | G (lección 2) |
| L-22 | `vocab.json` hayai | «temprano/(también 速い: rápido)» | «temprano; rápido» | formato |
| L-23 | `vocab.json`, etiquetas de lección (a verificar en las páginas de vocabulario de Genki) | shiru G9, hataraku G12, deru G6, iu G0 | しる G7, はたらく G7, でる G9, いう G8 | G (vocabulario de las lecciones 7‑9; verificar) |
| L-24 | motor `readTime` / `readCounter('fun')` | よんぷん solo (よんふん, de uso frecuente, no se acepta) | aceptar よんふん como alternativa | N |

**Verificado como correcto** (sin errores): 49 verbos × 10 formas frente a las tablas P (ます, た, て, ています, ましょう(か),
たいです); 28 adjetivos い × 4 formas; los grupos verbales de los 96 verbos (かえる, はいる, しる y いる-necesitar son u; いる-estar,
にる, きる y みる son ru; する y くる más compuestos irregulares); números 0‑100 000 con irregulares (さんびゃく, ろっぴゃく,
はっぴゃく, さんぜん, はっせん, よえん); hora (よじ, しちじ, くじ, いっぷん, さんぷん, ろっぷん, はっぷん, じゅっぷん/じっぷん,
はん); días del mes 1‑31 (ついたち…とおか, じゅうよっか, はつか, にじゅうよっか, じゅうくにち); meses (しがつ, しちがつ, くがつ);
contadores つ / にん / かい (さんがい) / さい (はたち); 144 kanji (`verify_kanji.py`: 0 errores; lecciones, lecturas y palabras frente
a KANJIDIC y JMdict) más 15 comprobaciones puntuales de lectura y lección. He revisado a mano los 768 ítems de vocabulario, los 229
ejemplos de patrones y las 118 líneas de los 19 diálogos; todo lo que no aparece en esta tabla me pareció correcto y natural.

---

## 4. Invariantes pedagógicos: resultados

Scripts: `tools/qa/invariants.qa.test.ts` (contenido y lógica) y `app/e2e/invariants.e2e.ts` (UI).

1. **Nunca mostrar kana o kanji no desbloqueados**
   - `renderPlan`: correcto para katakana bloqueado (→ hiragana), kanji bloqueado (→ lectura), kanji desbloqueado (→ ruby), Guru
     (→ sin furigana) y los ajustes `siempre` / `nunca`. **Falla con el yōon (QA-001).**
   - Palabras de las lecciones de las etapas 1 y 3: todas legibles con los kana conocidos más los de la lección (✓, las 30 lecciones).
   - Distractores: «Reconocer kana» (opciones en romaji, ✓), «Reconocer kana» en katakana (solo conocidos, ✓), «Escuchar»
     (**falla, QA-003**), Kanji (solo desbloqueados más los de la lección, ✓), Diálogos, Sintaxis, Partículas y Mini‑lectura (vía
     JaText, ✓).
   - Retroalimentación con `word.kana` en crudo (**falla, QA-008**); glosas en español con partículas japonesas (**falla leve,
     QA-031**).
   - La tabla de kana de la introducción muestra el silabario completo. Es intencionado (referencia) y no lo cuento como fallo.
   - Números, Reloj y Calendario usan hiragana sin filtrar. Es correcto mientras esas lecciones requieran toda la etapa 1. Con M3
     (gramática intercalada desde h-na) **conviene revisarlo en Q2**: l-numeros o l-hora podrían abrirse antes de conocer todo el
     hiragana.
2. **Orden de la gramática** (informe automático): el て‑form aparece una sola vez antes de l-te-kudasai (como-llegar:1, en
   l-transporte), y el pasado antes de l-conj-masu en to-with:0 y en frases hechas (QA-032). Las lecciones que caen al «corpus
   completo» rompen el orden (QA-015).
3. **Las 66 lecciones son jugables**: todos los juegos de todas las lecciones tienen un pool no vacío o un fallback. Pools finos o
   con fallback:
   - Reconocer kana con 1 kana: h-tsu-long y k-small-tsu (QA-026). Con 3 kana: h-wa-n y k-wa-n. Con 5 kana para 13 rondas: el resto
     (aceptable).
   - Diálogos: 2‑6 turnos para 15 rondas en 13 lecciones (QA-027). l-te-kudasai infiere 13 diálogos; k-prestamos-lugares usa los 19.
   - Mini‑lectura: l-vacaciones y kanji-3 a kanji-12 no tienen patrones y usan los 50 patrones (QA-015; en las lecciones de kanji es
     aceptable porque ya se completó la etapa 2).
   - Sintaxis: l-pasado y l-contadores, con 4 frases para 15 rondas.
   - Números, Reloj y Calendario: preguntas aleatorias (sin límite).
4. **Equidad al corregir respuestas**: ✓ espacios, ー con «-» o vocal repetida, っ, ん + vocal con «n'», katakana = hiragana,
   こんにちわ aceptado fuera de Partículas, は ≠ わ en Partículas, alternativas (しち/なな, じっぷん, ではありません…). ✗ «Escribir
   kana» con を/ぢ/づ (QA-009); ✗ «nn» y Kunrei (QA-013); ✗ わ en medio de frase (QA-012); ✗ homófonos (QA-014); ✗ distractores de
   partícula válidos (QA-011); ✗ Sintaxis acepta órdenes erróneos (QA-010).

## 5. SRS y progreso: resultados

Script: `tools/qa/srs.qa.test.ts` (con `TZ=America/Santiago`).

| Aspecto | Resultado |
|---|---|
| Intervalos 4 h, 8 h, 1 d, 2 d, 1 sem, 2 sem, 1 mes, 4 meses, Quemado | ✓ |
| Cambios de etapa (+1; penalización ×2 desde Guru; mínimo 1; un ítem nuevo fallado queda en 0 y vence ya) | ✓ |
| Quemados y no vistos nunca vencen; cola ordenada por atraso y limitada a 50 | ✓ |
| SRS en lecciones y práctica | **✗ QA-002** |
| Repaso de números, hora y fecha | **✗ QA-005** |
| XP (+10 por acierto, +30 la primera vez) y curva de niveles (100 / 250 / 450 / … / 2700) | ✓ |
| Crédito parcial de kanji (solo SRS, una vez por sesión, sin XP ni racha) | ✓ |
| `unlockKanji` (Aprendiz 1, vence en 4 h, conserva el progreso previo) | ✓ |
| `daily.reviews` solo cuenta los ítems vencidos | ✓ |
| `daily.lessons` cuenta las repeticiones | QA-019 |
| Racha: mismo día, día siguiente, hueco | ✓ |
| Racha en Chile: estudio a las 22:00 (01:00 UTC) → día local | ✓ |
| Cambios de hora 2026‑04‑05 y 2026‑09‑06 | ✓ |
| Racha «viva» en el Inicio (hoy o ayer) | ✓ (revisado en el código) |
| Siete días (D L M X J V S) y retención de 90 días | ✓ |
| Importar: ida y vuelta, valores por defecto de saves antiguos, JSON inválido o datos inválidos rechazados con mensaje en español | ✓ |
| Importar: datos semánticamente absurdos (lecciones o kana inexistentes) | se aceptan (riesgo bajo) |
| Migración de versión | **✗ QA-017** |
| Progreso guardado dañado → se ignora y se conserva una copia `:corrupto` | ✓ |
| Fallo de `setItem` | silencioso, **QA-018** |

## 6. Salud del código (resumen)

- **Riesgos de estado:** QA-002 (SRS) y QA-005 (ítems generados). `now` congelado en tres páginas (QA-029). La sincronización
  `syncKnownKana` en `App.tsx` depende solo de `completedLessons.length`: tras importar un progreso con el mismo número de lecciones
  no se resincroniza. No causa daño porque el archivo importado trae su propio `knownKana`, pero es frágil.
- **Efectos y voz:** `useAutoSpeak` vuelve a hablar si cambia la velocidad o la voz (porque `speak` está en las dependencias).
  `useSpeech` no cancela la locución al desmontar: el audio sigue al salir de un juego. El único temporizador (Celebrations) se limpia
  bien.
- **Código muerto:** el modo libre de Conjugación (QA-007). `unlockedLessons` se guarda pero nunca se usa para el bloqueo (se usa
  `completedLessons`).
- **Duplicación:** QA-030.
- **Huecos de pruebas en rutas críticas:** no había pruebas de: SRS frente a respuestas no vencidas, render de dígrafos, distractores
  de Escuchar, conjugación de adjetivos que terminan en «いい» sin ser compuestos de いい, ni repaso de ítems generados. Todas quedan
  cubiertas ahora por `tools/qa/*.qa.test.ts`. Las 1065 pruebas existentes de `npm test` pasan.

---

## 7. Qué se probó y cómo

- **Revisión manual de contenido:** 768 entradas de vocabulario (todas, no solo 150), 50 patrones con 229 ejemplos y sus tablas S‑O‑V,
  19 diálogos (118 líneas), contrastados con las fotos del profesor: tablas de conjugación 144126, 144330, 144139, 144202, 144303,
  144337, 144343 y 144349; adjetivos 144252; hoja de contadores; y con el conocimiento de Genki I.
- **QA automatizado (Vitest, `tools/qa/`):** 266 pruebas: **242 pasan y 24 son fallos esperados** (`it.fails`, cada uno referenciado
  a un QA-xxx).
  - `linguistic.qa.test.ts`: tablas del profesor, grupos verbales, números, hora, fechas, contadores, calidad de datos y kanji.
  - `invariants.qa.test.ts`: `renderPlan`, distractores, pools de las 66 lecciones (imprime el informe), gramática antes de tiempo,
    lógica de Sintaxis y Partículas, equidad.
  - `srs.qa.test.ts`: motor SRS, store, repaso de ítems generados, racha y zona horaria, niveles, importar y exportar, localStorage.
- **Validadores existentes:** `validate.py` (0 errores) y `verify_kanji.py` (0 errores, 0 avisos).
- **E2E (Playwright, contra Docker en :8081):** 14 pruebas, **14 OK** (incluidos 5 `test.fail` que documentan QA-001, QA-002, QA-003,
  QA-008 y QA-016).
  - `journey.e2e.ts`: primera visita → camino → h-a superada → h-ka desbloqueada, con XP, racha y contadores; suspender por debajo
    del 80 %; umbral del 75 %.
  - `practice.e2e.ts`: los 4 juegos de kana en práctica libre, más QA-002 y QA-016.
  - `invariants.e2e.ts`: kana visibles en h-a … h-wa-n, yōon, katakana en la etapa 2.
  - Incluyen un *solver* genérico (`e2e/support/solver.ts`) que sabe responder los 13 juegos (para Q2) y un fixture que hace fallar
    la prueba ante errores de consola o avisos de React (ninguno apareció).

## 8. Qué NO se probó (queda para Q2 o fuera de alcance)

- La UX, el diseño responsive (360/768/1280), la accesibilidad (teclado, foco, aria del reloj y el calendario, contraste, movimiento
  reducido), el rendimiento (bundle, carga con red lenta, caché de nginx, tamaño de la imagen Docker) y las capturas de pantalla.
- Recorridos e2e de: /repaso con estado inyectado, los juegos de la etapa 2 en el navegador (el solver ya los soporta), katakana k-a
  con ー, kanji-3 con furigana y ajustes, ida y vuelta de exportar e importar en la UI, enlaces profundos y ruta desconocida. Cubiertos
  a nivel de unidad cuando aplica.
- Los cambios de V2 (M1‑M5: diseño móvil, gating intercalado, página de memoria, build estática). Los e2e escritos antes de M3
  pueden necesitar ajustes de texto en Q2. La comprobación página a página del vocabulario de Genki (por eso L‑23 está marcado «a
  verificar»). No leí en detalle las fotos de sintaxis ni las de diálogos del profesor; las revisé como referencia de patrones, no
  frase por frase.

## 9. Cómo ejecutar

```sh
cd app
npm run test:qa        # Vitest QA (tools/qa/*.qa.test.ts), TZ=America/Santiago; --silent=false muestra los informes de pools y gramática
npm test               # suite existente (no incluye e2e ni QA)

# E2E contra la build de Docker
cd .. && docker compose up -d --build && cd app
npx playwright install chromium   # la primera vez
npm run test:e2e                  # Playwright (app/e2e/*.e2e.ts); BASE_URL=http://localhost:5173 para el servidor de desarrollo
npx playwright show-report        # informe HTML (app/playwright-report/)
```

Los archivos e2e se llaman `*.e2e.ts` para que Vitest (y por tanto `npm test` dentro de la build de Docker) no los recoja.
Configuración: `app/playwright.config.ts` (locale es-CL, zona America/Santiago) y `app/vitest.qa.config.ts` (raíz en el repositorio,
alias de dependencias hacia `app/node_modules`). Al corregir un hallazgo, su `it.fails` o `test.fail` empezará a «fallar»: hay que
quitarle la marca.
