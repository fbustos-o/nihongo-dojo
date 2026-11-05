# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: q3.mobile.e2e.ts >> Q3 ruby a 360×640 con progreso hasta h-na >> QA-037: el calendario cabe en 360 px con fuente normal
- Location: e2e/q3.mobile.e2e.ts:105:3

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: locator.evaluate: Test timeout of 120000ms exceeded.
Call log:
  - waiting for getByTestId('month-grid')

```

# Page snapshot

```yaml
- generic [ref=f1e1]:
  - generic [ref=f1e3]:
    - banner [ref=f1e4]:
      - generic [ref=f1e5]:
        - generic [aria-hidden] [ref=f1e6]: 道
        - generic [ref=f1e7]: Nihongo Dojo 日本語道場
      - link "Acerca de" [ref=f1e8] [cursor=pointer]:
        - /url: /acerca-de
    - navigation "Navegación principal" [ref=f1e11]:
      - link "Inicio" [ref=f1e12] [cursor=pointer]:
        - /url: /
      - link "Camino" [ref=f1e18] [cursor=pointer]:
        - /url: /camino
      - link "Vocabulario" [ref=f1e23] [cursor=pointer]:
        - /url: /vocabulario
      - link "Repaso" [ref=f1e28] [cursor=pointer]:
        - /url: /repaso
      - link "Práctica" [ref=f1e36] [cursor=pointer]:
        - /url: /practica
      - link "Ajustes" [ref=f1e42] [cursor=pointer]:
        - /url: /ajustes
    - main [ref=f1e48]:
      - generic [ref=f1e49]:
        - 'heading "Calendario: meses, días y semana" [level=1] [ref=f1e50]'
        - link "Salir" [ref=f1e51] [cursor=pointer]:
          - /url: /camino
      - list "Fases de la lección" [ref=f1e52]:
        - listitem [ref=f1e53]: 1 · Introducción
        - listitem [ref=f1e54]: 2 · Práctica
        - listitem [ref=f1e55]: 3 · Resultado
      - paragraph [ref=f1e56]:
        - text: "Juego 1 de 3:"
        - strong [ref=f1e57]: Calendario
        - text: — Fechas y días de la semana.
      - generic [ref=f1e58]:
        - generic [ref=f1e59]:
          - progressbar "Progreso" [ref=f1e60]
          - generic "Aciertos seguidos" [ref=f1e61]: "Racha: 0"
        - status [ref=f1e65]
        - generic [ref=f1e66]:
          - generic [ref=f1e67]:
            - paragraph [ref=f1e68]:
              - generic [ref=f1e69]:
                - generic [ref=f1e70]:
                  - text: きょ
                  - generic [ref=f1e71]: kyo
                - text: うは
                - generic [ref=f1e72]:
                  - text: ど
                  - generic [ref=f1e73]: do
                - text: よう
                - generic [ref=f1e74]:
                  - text: び
                  - generic [ref=f1e75]: bi
                - generic [ref=f1e76]:
                  - text: で
                  - generic [ref=f1e77]: de
                - text: す。あしたは？
            - paragraph [ref=f1e78]: Hoy es sábado. ¿Qué día es mañana?
          - generic [ref=f1e79]:
            - generic [ref=f1e80]:
              - textbox "Día de la semana en hiragana" [active] [ref=f1e81]:
                - /placeholder: Escribe en romaji o kana
              - button "Cambiar a escribir en romaji" [ref=f1e82] [cursor=pointer]: abc
            - button "Comprobar" [ref=f1e83] [cursor=pointer]
    - status
  - group "Teclado de kana" [ref=f1e84]:
    - button "Fila あ" [pressed] [ref=f1e85] [cursor=pointer]: あ
    - button "Fila か" [ref=f1e86] [cursor=pointer]: か
    - button "Fila さ" [ref=f1e87] [cursor=pointer]: さ
    - button "Fila た" [ref=f1e88] [cursor=pointer]: た
    - button "Fila な" [ref=f1e89] [cursor=pointer]: な
    - button "Fila は" [ref=f1e90] [cursor=pointer]: は
    - button "Fila ま" [ref=f1e91] [cursor=pointer]: ま
    - button "Fila や" [ref=f1e92] [cursor=pointer]: や
    - button "Fila ら" [ref=f1e93] [cursor=pointer]: ら
    - button "Fila わ" [ref=f1e94] [cursor=pointer]: わ
    - button "あ" [ref=f1e95] [cursor=pointer]
    - button "い" [ref=f1e96] [cursor=pointer]
    - button "う" [ref=f1e97] [cursor=pointer]
    - button "え" [ref=f1e98] [cursor=pointer]
    - button "お" [ref=f1e99] [cursor=pointer]
    - button "Dakuten (゛) en el último kana" [ref=f1e100] [cursor=pointer]: ゛
    - button "Handakuten (゜) en el último kana" [ref=f1e101] [cursor=pointer]: ゜
    - button "Kana pequeño (ゃゅょっぁ) en el último" [ref=f1e102] [cursor=pointer]: 小
    - button "Alargamiento ー" [ref=f1e103] [cursor=pointer]: ー
    - button "Cambiar a katakana" [ref=f1e104] [cursor=pointer]: ア
    - button "Borrar último carácter" [ref=f1e105] [cursor=pointer]: ⌫
    - button "Borrar todo" [disabled] [ref=f1e106]: ✕
    - button "Espacio" [ref=f1e107] [cursor=pointer]: ␣
    - button "Ocultar teclado" [ref=f1e108] [cursor=pointer]: ⌄
    - 'button "Enter: comprobar" [ref=f1e109] [cursor=pointer]': Comprobar ⏎
```

# Test source

```ts
  9   | import { buildProgress, readProgress, seed } from './support/state';
  10  | import { measure, openLessonGame } from './support/flow';
  11  | import { shot, stubSpeech } from './support/mobile';
  12  | 
  13  | const SMALL = { width: 360, height: 640 };
  14  | 
  15  | interface Audit { rubies: number; rtPx: number[]; basePx: number[]; docOverflowX: number; overflowing: string[]; rtOutsideBox: string[]; rtOverlaps: number; inlineRomaji: string[] }
  16  | 
  17  | /** Ruby metrics in <main>: rt font sizes, horizontal page overflow, boxes whose content overflows, rt clipped by its box. */
  18  | async function rubyAudit(page: Page): Promise<Audit> {
  19  |   return page.evaluate(() => {
  20  |     const vw = document.documentElement.clientWidth;
  21  |     const rts = [...document.querySelectorAll('main ruby[data-testid=kana-ruby] rt')] as HTMLElement[];
  22  |     const px = (el: Element) => Math.round(parseFloat(getComputedStyle(el).fontSize) * 10) / 10;
  23  |     const boxes = [...document.querySelectorAll('main button, main [class*="_bubble_"], main [class*="_tile_"], main [class*="_option_"]')] as HTMLElement[];
  24  |     const overflowing = boxes
  25  |       .filter((el) => el.offsetParent !== null && (el.scrollWidth > el.clientWidth + 1 || el.getBoundingClientRect().right > vw + 1 || el.getBoundingClientRect().left < -1))
  26  |       .map((el) => (el.textContent ?? '').slice(0, 40));
  27  |     const rtOutsideBox = rts
  28  |       .filter((rt) => {
  29  |         const b = rt.closest('button, [class*="_bubble_"], [class*="_tile_"]');
  30  |         if (!b) return false;
  31  |         const r = rt.getBoundingClientRect();
  32  |         const bb = b.getBoundingClientRect();
  33  |         return r.top < bb.top - 1 || r.left < bb.left - 1 || r.right > bb.right + 1;
  34  |       })
  35  |       .map((rt) => (rt.closest('button, [class*="_bubble_"], [class*="_tile_"]')!.textContent ?? '').slice(0, 30));
  36  |     let rtOverlaps = 0;
  37  |     const rects = rts.map((r) => r.getBoundingClientRect()).filter((r) => r.width > 0);
  38  |     for (let i = 0; i < rects.length; i++)
  39  |       for (let j = i + 1; j < rects.length; j++) {
  40  |         const a = rects[i]!, b = rects[j]!;
  41  |         if (Math.abs(a.top - b.top) < 2 && a.left < b.right - 0.5 && b.left < a.right - 0.5) rtOverlaps++;
  42  |       }
  43  |     const inlineRomaji = [...document.querySelectorAll('main [class*="_romaji_"]')].map((e) => e.textContent ?? '').slice(0, 10);
  44  |     return {
  45  |       rubies: rts.length,
  46  |       rtPx: [...new Set(rts.map(px))].sort((a, b) => a - b),
  47  |       basePx: [...new Set(rts.map((rt) => px(rt.parentElement!)))].sort((a, b) => a - b),
  48  |       docOverflowX: document.documentElement.scrollWidth - vw,
  49  |       overflowing,
  50  |       rtOutsideBox: [...new Set(rtOutsideBox)],
  51  |       rtOverlaps,
  52  |       inlineRomaji,
  53  |     };
  54  |   });
  55  | }
  56  | 
  57  | async function auditRounds(page: Page, info: TestInfo, label: string, game: GameName, rounds = 3): Promise<Audit[]> {
  58  |   const out: Audit[] = [];
  59  |   for (let r = 0; r < rounds; r++) {
  60  |     await page.waitForTimeout(400);
  61  |     const a = await rubyAudit(page);
  62  |     out.push(a);
  63  |     if (r === 0 || (r === rounds - 1 && game === 'Diálogos')) await shot(page, info, `q3-ruby-${label}-r${r}`);
  64  |     if ((await currentGame(page)) !== game) break;
  65  |     await answerRound(page, game);
  66  |   }
  67  |   measure(info, `q3 ruby ${label}`, out);
  68  |   for (const a of out) {
  69  |     expect.soft(a.docOverflowX, `${label}: no horizontal page scroll`).toBeLessThanOrEqual(0);
  70  |     expect.soft(a.overflowing, `${label}: no box overflows`).toEqual([]);
  71  |     expect.soft(a.rtOutsideBox, `${label}: rt stays inside its box`).toEqual([]);
  72  |     expect.soft(a.inlineRomaji, `${label}: no inline romaji mixed into kana`).toEqual([]);
  73  |   }
  74  |   return out;
  75  | }
  76  | 
  77  | test.describe('Q3 ruby a 360×640 con progreso hasta h-na', () => {
  78  |   test.beforeEach(async ({ page }) => {
  79  |     await stubSpeech(page, true);
  80  |     await page.setViewportSize(SMALL);
  81  |   });
  82  | 
  83  |   test('l-saludos: Leer palabras (opciones) y Diálogos (burbujas + respuestas)', async ({ page, consoleLog }, info) => {
  84  |     void consoleLog;
  85  |     await openLessonGame(page, 'l-saludos', 'Leer palabras');
  86  |     const rw = await auditRounds(page, info, 'l-saludos-leer', 'Leer palabras');
  87  |     await openLessonGame(page, 'l-saludos', 'Diálogos');
  88  |     const dl = await auditRounds(page, info, 'l-saludos-dialogos', 'Diálogos', 5);
  89  |     expect([...rw, ...dl].some((a) => a.rubies > 0), 'h-na level: some ruby is shown').toBe(true);
  90  |   });
  91  | 
  92  |   test('práctica de gramática tras l-saludos: Diálogos; l-desu en su puerta (h-ma): Sintaxis y Partículas', async ({ page, consoleLog }, info) => {
  93  |     void consoleLog;
  94  |     await seed(page, buildProgress({ completed: [...lessonsUpTo('l-saludos', true)] }), '/practica');
  95  |     const sel = page.locator('section[aria-labelledby="grammar-free"] select');
  96  |     await sel.selectOption('dialogues');
  97  |     await page.getByRole('button', { name: 'Practicar gramática' }).click();
  98  |     await auditRounds(page, info, 'practica-dialogos', 'Diálogos', 4);
  99  |     await openLessonGame(page, 'l-desu', 'Sintaxis');
  100 |     await auditRounds(page, info, 'l-desu-sintaxis', 'Sintaxis');
  101 |     await openLessonGame(page, 'l-desu', 'Partículas');
  102 |     await auditRounds(page, info, 'l-desu-particulas', 'Partículas');
  103 |   });
  104 | 
  105 |   test('QA-037: el calendario cabe en 360 px con fuente normal', async ({ page, consoleLog }, info) => {
  106 |     void consoleLog;
  107 |     await openLessonGame(page, 'l-fechas', 'Calendario');
  108 |     const grid = page.getByTestId('month-grid');
> 109 |     const m = await grid.evaluate((g) => {
      |                          ^ Error: locator.evaluate: Test timeout of 120000ms exceeded.
  110 |       const cap = g.querySelector('caption')!;
  111 |       const td = g.querySelector('td')!;
  112 |       const r = g.getBoundingClientRect();
  113 |       return { captionPx: parseFloat(getComputedStyle(cap).fontSize), cellPx: parseFloat(getComputedStyle(td).fontSize), width: Math.round(r.width), height: Math.round(r.height), vw: document.documentElement.clientWidth };
  114 |     });
  115 |     measure(info, 'q3 calendar', m);
  116 |     await shot(page, info, 'q3-calendar-360');
  117 |     expect(m.captionPx).toBeLessThanOrEqual(24);
  118 |     expect(m.cellPx).toBeLessThanOrEqual(20);
  119 |     expect(m.width).toBeLessThanOrEqual(m.vw);
  120 |     expect(m.height).toBeLessThan(400);
  121 |   });
  122 | });
  123 | 
  124 | test('Q3 recorrido exploratorio móvil: nuevo → h-a … h-na → l-saludos (sugerida) → gramática → repaso → memoria → ajustes', async ({ page, consoleLog }, info) => {
  125 |   test.skip(info.project.name !== 'pixel7', 'journey on Pixel 7 only');
  126 |   test.setTimeout(900_000);
  127 |   void consoleLog;
  128 |   await stubSpeech(page, true);
  129 |   await page.goto('/');
  130 |   await expect(page.getByRole('heading', { level: 1 })).toContainText('ようこそ');
  131 |   const log: string[] = [];
  132 |   for (const id of ['h-a', 'h-ka', 'h-sa', 'h-ta', 'h-na']) {
  133 |     const next = page.locator('section[aria-labelledby="home-next"]');
  134 |     const title = curriculum.find((l) => l.id === id)!.title;
  135 |     await expect(next).toContainText(title);
  136 |     await next.getByRole('link', { name: 'Empezar' }).click();
  137 |     await expect(page).toHaveURL(new RegExp(`/leccion/${id}$`));
  138 |     await page.getByRole('button', { name: 'Empezar práctica' }).click();
  139 |     const r = await playUntil(page, lessonResultVisible(page), { lessonKana: curriculum.find((l) => l.id === id)!.kana });
  140 |     await expect(page.getByRole('heading', { name: '¡Lección completada!' })).toBeVisible();
  141 |     log.push(`${id}: ${r.rounds} rondas ${r.games.join('/')}`);
  142 |     if (id === 'h-ka') await shot(page, info, 'q3-journey-hka-result');
  143 |     await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'Inicio' }).click();
  144 |   }
  145 |   // Home suggests the first grammar lesson
  146 |   const next = page.locator('section[aria-labelledby="home-next"]');
  147 |   const homeText = (await next.innerText()).replace(/\s+/g, ' ');
  148 |   log.push(`home: ${homeText}`);
  149 |   await shot(page, info, 'q3-journey-home-after-hna', true);
  150 |   const saludos = curriculum.find((l) => l.id === 'l-saludos')!.title;
  151 |   expect(homeText, 'Home suggests l-saludos after h-na').toContain(saludos);
  152 |   if (await next.getByRole('link', { name: saludos }).count()) await next.getByRole('link', { name: saludos }).click();
  153 |   else await next.getByRole('link', { name: 'Empezar' }).click();
  154 |   await expect(page).toHaveURL(/\/leccion\/l-saludos$/);
  155 |   await page.getByRole('button', { name: 'Empezar práctica' }).click();
  156 |   const rs = await playUntil(page, lessonResultVisible(page), {});
  157 |   log.push(`l-saludos: ${rs.rounds} rondas ${rs.games.join('/')}`);
  158 |   await expect(page.getByRole('heading', { name: '¡Lección completada!' })).toBeVisible();
  159 |   // Práctica (gramática)
  160 |   await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'Práctica' }).click();
  161 |   const sel = page.locator('section[aria-labelledby="grammar-free"] select');
  162 |   const enabled: Record<string, boolean> = {};
  163 |   for (const g of ['syntax', 'particles', 'conjugation', 'dialogues', 'mini-reading', 'numbers', 'clock', 'calendar']) {
  164 |     await sel.selectOption(g);
  165 |     enabled[g] = await page.getByRole('button', { name: 'Practicar gramática' }).isEnabled();
  166 |   }
  167 |   log.push(`gramática habilitada tras l-saludos: ${JSON.stringify(enabled)}`);
  168 |   await sel.selectOption('dialogues');
  169 |   await page.getByRole('button', { name: 'Practicar gramática' }).click();
  170 |   for (let i = 0; i < 4; i++) {
  171 |     const g = await currentGame(page);
  172 |     if (g) await answerRound(page, g);
  173 |   }
  174 |   await shot(page, info, 'q3-journey-practica-dialogos');
  175 |   await page.getByRole('button', { name: 'Terminar' }).click();
  176 |   await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible();
  177 |   // Conjugation/numbers right after l-saludos: what does free practice show?
  178 |   for (const g of ['conjugation', 'numbers']) {
  179 |     await page.goto('/practica');
  180 |     await page.locator('section[aria-labelledby="grammar-free"] select').selectOption(g);
  181 |     if (!(await page.getByRole('button', { name: 'Practicar gramática' }).isEnabled())) continue;
  182 |     await page.getByRole('button', { name: 'Practicar gramática' }).click();
  183 |     await page.waitForTimeout(800);
  184 |     log.push(`práctica ${g} tras l-saludos: ${(await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 220)}`);
  185 |     await shot(page, info, `q3-journey-practica-${g}`);
  186 |   }
  187 |   // /repaso
  188 |   await page.goto('/repaso');
  189 |   await page.waitForTimeout(500);
  190 |   log.push(`repaso: ${(await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 200)}`);
  191 |   await shot(page, info, 'q3-journey-repaso');
  192 |   // /memoria/aprendiz
  193 |   await page.goto('/');
  194 |   await page.getByTestId('srs-Aprendiz').getByRole('link').click();
  195 |   await expect(page).toHaveURL(/\/memoria\/aprendiz$/);
  196 |   await expect(page.getByTestId('memory-row').first()).toBeVisible();
  197 |   const rows = await page.getByTestId('memory-row').count();
  198 |   log.push(`memoria/aprendiz: ${rows} filas`);
  199 |   await shot(page, info, 'q3-journey-memoria-aprendiz');
  200 |   // Ajustes: kana input modes and export / import
  201 |   await page.goto('/ajustes');
  202 |   const mode = page.getByRole('combobox', { name: 'Escritura de kana' });
  203 |   const modes = await mode.locator('option').allInnerTexts();
  204 |   log.push(`modos de escritura: ${modes.join(' | ')}`);
  205 |   for (const v of await mode.locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value))) {
  206 |     await mode.selectOption(v);
  207 |     expect((await readProgress(page))!.settings).toMatchObject({ kanaInput: v });
  208 |   }
  209 |   const before = (await readProgress(page))!;
```