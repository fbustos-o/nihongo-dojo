/* Q2 — acceptance of the user's mobile feedback (Docs/feedback_y_requerimientos_de_mejora_mobile_nihongo_dojo.md),
 * point by point. Runs in the pixel7 and iphone14 projects (npm run test:e2e:mobile). Screenshots: QA_SHOTS. */
import type { Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { curriculum, lessonsUpTo } from './support/content';
import { answerRound, currentGame, kbType } from './support/solver';
import { box, clearSpoken, fold, lowest, shot, spoken, stubSpeech } from './support/mobile';
import { measure, openLessonGame } from './support/flow';
import { buildProgress, seed, type ItemState } from './support/state';

const SMALL = { width: 360, height: 640 };
const IPHONE = { width: 390, height: 844 };

async function openPractice(page: Page, game: string, row: string, completed: string[], settings: Record<string, unknown> = {}) {
  await seed(page, buildProgress({ completed, settings: settings as never }), '/practica');
  await page.getByRole('combobox', { name: 'Juego:' }).selectOption(game);
  await page.getByRole('checkbox', { name: 'Básicos (hiragana)' }).uncheck();
  await page.getByRole('button', { name: row, exact: true }).first().click();
  await page.getByRole('button', { name: 'Empezar' }).click();
}

const inside = (b: { top: number; bottom: number }, top: number, bottom: number) => b.top >= top - 1 && b.bottom <= bottom + 1;

// ---------------------------------------------------------------------------------------------
// 1.1 Virtual keyboard
// ---------------------------------------------------------------------------------------------
test.describe('1.1 teclado virtual', () => {
  for (const [game, row, label, kanaInput] of [
    ['kana-recognize', 'か', 'Reconocer kana (romaji)', 'auto'],
    ['kana-write', 'か', 'Escribir kana (IME romaji)', 'romaji'],
  ] as const) {
    test(`teclado del sistema: ${label} — input y pregunta visibles al encoger el viewport`, async ({ page, consoleLog }, info) => {
      void consoleLog;
      await stubSpeech(page, false);
      const size = page.viewportSize()!;
      await openPractice(page, game, row, ['h-a', 'h-ka'], { kanaInput });
      const input = page.locator('main form input');
      await input.focus();
      // Android/iOS keyboard: ~45 % of the screen. visualViewport + innerHeight shrink, as with resizes-content.
      const kbHeight = Math.round(size.height * 0.45);
      await page.setViewportSize({ width: size.width, height: size.height - kbHeight });
      await page.waitForTimeout(900);
      const state = await page.evaluate(() => ({ keyboard: document.documentElement.dataset.keyboard ?? null, navHidden: document.querySelector('nav')?.hidden ?? null, scrollY: Math.round(scrollY) }));
      const f = await fold(page);
      const inBox = await box(input);
      const prBox = await box(page.getByTestId('prompt'));
      measure(info, `1.1 ${label}`, { viewport: f.viewport, ...state, input: [inBox.top, inBox.bottom], prompt: [prBox.top, prBox.bottom] });
      await shot(page, info, `1.1-system-kb-${game}`);
      expect(state.keyboard).toBe('open');
      expect(state.navHidden).toBe(true);
      expect(inside(inBox, 0, f.viewport), 'input visible above the keyboard').toBe(true);
      expect(inside(prBox, 0, f.viewport), 'prompt visible above the keyboard').toBe(true);
      await page.setViewportSize(size);
      await expect.poll(() => page.evaluate(() => document.documentElement.dataset.keyboard ?? null)).toBeNull();
    });
  }

  for (const vp of [SMALL, IPHONE]) {
    test(`teclado kana en pantalla (${vp.width}×${vp.height}): no tapa el campo ni la pregunta, también al fallar`, async ({ page, consoleLog }, info) => {
      void consoleLog;
      await stubSpeech(page, true);
      await page.setViewportSize(vp);
      await openLessonGame(page, 'h-ka', 'Escribir kana');
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), 'touch device -> auto = teclado').toBe(true);
      for (let r = 0; r < 4; r++) {
        await expect(page.getByRole('group', { name: 'Teclado de kana' })).toBeVisible();
        await page.waitForTimeout(700); // smooth scroll settles
        const f = await fold(page);
        const inBox = await box(page.locator('main form input'));
        const prBox = await box(page.getByTestId('prompt'));
        measure(info, `1.1 kana-kb ${vp.width}x${vp.height} round ${r}`, { kbTop: f.kbTop, input: [inBox.top, inBox.bottom], prompt: [prBox.top, prBox.bottom] });
        if (r === 0) await shot(page, info, `1.1-kana-kb-${vp.width}x${vp.height}`);
        expect(inBox.bottom).toBeLessThanOrEqual(f.kbTop!);
        expect(prBox.top).toBeGreaterThanOrEqual(0);
        if (r === 2) {
          // wrong answer -> correct answer shown + retype, everything above the keyboard
          await page.locator('main form input').click();
          await kbType(page, 'ぬぬ');
          await expect(page.getByTestId('correct-answer')).toBeVisible();
          await page.waitForTimeout(700);
          const ans = await box(page.getByTestId('correct-answer'));
          const in2 = await box(page.locator('main form input'));
          const f2 = await fold(page);
          measure(info, `1.1 kana-kb ${vp.width}x${vp.height} retype`, { kbTop: f2.kbTop, answer: [ans.top, ans.bottom], input: [in2.top, in2.bottom] });
          await shot(page, info, `1.1-kana-kb-retype-${vp.width}x${vp.height}`);
          expect(in2.bottom).toBeLessThanOrEqual(f2.kbTop!);
          expect(ans.top).toBeGreaterThanOrEqual(0);
        }
        await answerRound(page, 'Escribir kana');
      }
    });
  }
});

// ---------------------------------------------------------------------------------------------
// 1.2 Scale: speaker button, options above the fold
// ---------------------------------------------------------------------------------------------
test('1.2 botón de audio compacto (≤ 56 px, sin texto en móvil) en Escuchar y Dictado', async ({ page, consoleLog }, info) => {
  void consoleLog;
  await stubSpeech(page, true);
  await page.setViewportSize(SMALL);
  await openLessonGame(page, 'h-ka', 'Escuchar');
  const btn = page.getByRole('button', { name: 'Escuchar otra vez' });
  const b = await box(btn);
  const labelShown = await btn.locator('.speak-label').isVisible();
  measure(info, '1.2 SpeakButton Escuchar 360', { w: b.width, h: b.height, labelShown });
  await shot(page, info, '1.2-listen-360');
  expect(b.width).toBeLessThanOrEqual(56);
  expect(b.height).toBeLessThanOrEqual(56);
  expect(b.height).toBeGreaterThanOrEqual(44);
  expect(labelShown).toBe(false);
});

const LAST_ACTION = 'main [class*="_choices_"] button, main form button[type=submit], main [role="group"][aria-label="Respuestas posibles"] button, main button:has-text("Comprobar")';

for (const vp of [SMALL, IPHONE]) {
  test(`1.2 opciones / confirmar en el primer pliegue (${vp.width}×${vp.height}): 4 juegos de kana`, async ({ page, consoleLog }, info) => {
    void consoleLog;
    await stubSpeech(page, true);
    await page.setViewportSize(vp);
    await openLessonGame(page, 'h-ka', null);
    const seen = new Set<string>();
    const rows: string[] = [];
    for (let i = 0; i < 200 && seen.size < 4; i++) {
      const g = await currentGame(page);
      if (!g) break;
      if (!seen.has(g)) {
        seen.add(g);
        await page.evaluate(() => scrollTo(0, 0));
        await page.waitForTimeout(800);
        const f = await fold(page);
        const usesKb = f.kbTop !== null;
        // with the kana keyboard, its own «Comprobar ⏎» key is the confirm action; the field must stay above it
        const bottom = usesKb ? (await box(page.locator('main form input'))).bottom : await lowest(page.locator(LAST_ACTION));
        const scrollY = await page.evaluate(() => Math.round(scrollY));
        rows.push(`${g}: bottom=${bottom} fold=${f.fold} scrollY=${scrollY}${usesKb ? ' (teclado kana)' : ''}`);
        await shot(page, info, `1.2-fold-${vp.width}x${vp.height}-${g.replace(/\s/g, '_')}`);
        expect.soft(bottom, `${g}: last option / confirm above the fold`).toBeLessThanOrEqual(f.fold);
      }
      await answerRound(page, g);
    }
    measure(info, `1.2 fold ${vp.width}x${vp.height}`, rows.join(' | '));
    expect(seen.size).toBe(4);
  });
}

// ---------------------------------------------------------------------------------------------
// 2.1 Game 1: instruction + condensed reinforcement
// ---------------------------------------------------------------------------------------------
test('2.1 juego 1: la instrucción no queda bajo la barra superior y el refuerzo no mueve la cuadrícula', async ({ page, consoleLog }, info) => {
  void consoleLog;
  await page.setViewportSize(SMALL);
  await openLessonGame(page, 'h-ka', 'Reconocer kana');
  const instr = page.locator('main p.muted', { hasText: /^Juego 1 de \d+:/ });
  const header = await box(page.locator('header'));
  const ib = await box(instr);
  const headerPos = await page.locator('header').evaluate((h) => getComputedStyle(h).position);
  const grid = page.locator('main [class*="_choices_"]');
  const before = await box(grid);
  const prompt = (await page.getByTestId('prompt').locator('span[lang="ja"]').first().textContent())!.trim();
  await answerRound(page, 'Reconocer kana');
  const fb = page.locator('main section > [role="status"]').first();
  await expect(fb).toContainText(`${prompt} = `);
  await expect(fb).toContainText('fila か');
  const fbText = (await fb.innerText()).trim();
  const after = await box(grid);
  measure(info, '2.1', { headerBottom: header.bottom, headerPos, instruction: [ib.top, ib.bottom], instructionText: await instr.innerText(), feedback: fbText, gridTopBefore: before.top, gridTopAfter: after.top });
  await shot(page, info, '2.1-recognize-feedback');
  expect(ib.top).toBeGreaterThanOrEqual(header.bottom);
  expect(after.top).toBe(before.top);
});

// ---------------------------------------------------------------------------------------------
// 2.2 Game 2: Lectura / Dictado + on-screen keyboard
// ---------------------------------------------------------------------------------------------
test('2.2 Escribir kana — Dictado: sin transcripción antes de responder; Lectura: audio solo después', async ({ page, consoleLog }, info) => {
  void consoleLog;
  await stubSpeech(page, true);
  await openPractice(page, 'kana-write', 'か', ['h-a', 'h-ka']);
  const modes = page.getByRole('group', { name: 'Modo de escritura' });

  // Dictado (the input has the focus and the kana keyboard is open: close it first, see QA-035)
  await page.locator('main form input').blur();
  await modes.getByRole('button', { name: 'Dictado' }).click();
  await expect(page.getByTestId('write-mode')).toContainText('Dictado');
  const promptText = (await page.getByTestId('prompt').innerText()).replace(/\s+/g, ' ');
  const said = (await spoken(page)).at(-1)!;
  measure(info, '2.2 Dictado prompt', { promptText, spoken: said });
  expect(promptText).not.toMatch(/[ぁ-ゖァ-ヺ]/u);
  expect(promptText).not.toMatch(/\b(ka|ki|ku|ke|ko)\b/);
  expect(said).toMatch(/^[かきくけこ]$/u);
  await page.locator('main form input').click();
  await kbType(page, said);
  await expect(page.locator('main section > [role="status"]').first()).toContainText(`¡Correcto! ${said}`);
  await shot(page, info, '2.2-dictado-after');

  // Lectura
  await page.locator('main form input').blur();
  await modes.getByRole('button', { name: 'Lectura' }).click();
  await clearSpoken(page);
  await expect(page.getByTestId('romaji')).toBeVisible();
  await page.waitForTimeout(300);
  expect(await spoken(page), 'no audio before answering in Lectura').toEqual([]);
  await expect(page.getByTestId('prompt').getByRole('button', { name: /Escuchar/ })).toHaveCount(0);
  const r = (await page.getByTestId('romaji').innerText()).trim();
  const kana = { ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ' }[r]!;
  await page.locator('main form input').click();
  await kbType(page, kana);
  await expect.poll(() => spoken(page)).toEqual([kana]);
  measure(info, '2.2 Lectura', { romaji: r, spokenAfter: await spoken(page) });
});

test('2.2 Escribir kana sin voz japonesa: el Dictado se sustituye por Lectura con aviso', async ({ page, consoleLog }, info) => {
  void consoleLog;
  await stubSpeech(page, false);
  await openPractice(page, 'kana-write', 'か', ['h-a', 'h-ka']);
  await page.locator('main form input').blur();
  await page.getByRole('group', { name: 'Modo de escritura' }).getByRole('button', { name: 'Dictado' }).click();
  await expect(page.getByTestId('dictado-fallback')).toBeVisible();
  await expect(page.getByTestId('romaji')).toBeVisible();
  measure(info, '2.2 sin voz', await page.getByTestId('dictado-fallback').innerText());
});

test('QA-035: con el teclado kana abierto, el primer toque en «Escuchar otra vez» (Dictado) o en un chip se pierde', async ({ page, consoleLog }, info) => {
  test.fail(true, 'QA-035: blur -> el teclado se cierra y el scroll salta antes del click; hace falta un segundo toque');
  void consoleLog;
  await stubSpeech(page, true);
  await openPractice(page, 'kana-write', 'か', ['h-a', 'h-ka']);
  await page.locator('main form input').blur();
  await page.getByRole('button', { name: 'Dictado' }).click();
  await page.locator('main form input').tap();
  await expect(page.getByRole('group', { name: 'Teclado de kana' })).toBeVisible();
  await page.waitForTimeout(800);
  const before = await page.evaluate(() => Math.round(scrollY));
  await clearSpoken(page);
  const sp = await box(page.getByRole('button', { name: 'Escuchar otra vez' }));
  await page.touchscreen.tap(sp.left + sp.width / 2, sp.top + sp.height / 2);
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => Math.round(scrollY));
  const said = await spoken(page);
  measure(info, 'QA-035 speaker tap with kana keyboard open', { scrollBefore: before, scrollAfter: after, spoken: said });
  expect(said.length, 'one tap on the speaker replays the audio').toBe(1);
});

// ---------------------------------------------------------------------------------------------
// 2.3 Game 3: previous feedback visible without overlapping
// ---------------------------------------------------------------------------------------------
test('2.3 Leer palabras: la retroalimentación anterior queda visible sin tapar la nueva pregunta', async ({ page, consoleLog }, info) => {
  void consoleLog;
  await page.setViewportSize(SMALL);
  await openLessonGame(page, 'h-ka', 'Leer palabras');
  const fb = page.locator('main section > [role="status"]').first();
  const rows: unknown[] = [];
  let wrongDone = false;
  for (let r = 0; r < 5; r++) {
    const isChoice = (await page.locator('main [class*="_choices_"]').count()) > 0;
    const wrong = isChoice && !wrongDone && r >= 2;
    await answerRound(page, 'Leer palabras', { wrong });
    if (wrong) wrongDone = true;
    await expect(fb).toContainText(wrong ? /Era .+ = .+/ : /¡Correcto! .+ = .+/);
    const fbB = await box(fb.locator('p'));
    const prB = await box(page.getByTestId('prompt'));
    rows.push({ round: r, wrong, feedback: (await fb.innerText()).replace(/\s+/g, ' ').trim(), fb: [fbB.top, fbB.bottom], prompt: [prB.top, prB.bottom] });
    expect(fbB.bottom, 'feedback above the new prompt').toBeLessThanOrEqual(prB.top);
    if (r === 1) await shot(page, info, '2.3-read-words');
  }
  const cards = await page.locator('main [class*="_choices_"] button').evaluateAll((bs) => bs.map((b) => Math.round(b.getBoundingClientRect().height)));
  measure(info, '2.3', { rows, optionHeights: cards });
  for (const h of cards) expect(h).toBeGreaterThanOrEqual(44);
});

// ---------------------------------------------------------------------------------------------
// 2.4 Game 4: feedback «Kana: mi» / «おなか (onaka) = estómago»
// ---------------------------------------------------------------------------------------------
test('2.4 Escuchar: «Kana: ka» para kana y «palabra (romaji) = significado» para palabras', async ({ page, consoleLog }, info) => {
  void consoleLog;
  await stubSpeech(page, true);
  await openLessonGame(page, 'h-ka', 'Escuchar');
  const fb = page.locator('main section > [role="status"]').first();
  const texts: string[] = [];
  for (let i = 0; i < 4; i++) {
    await answerRound(page, 'Escuchar');
    texts.push((await fb.innerText()).trim());
  }
  measure(info, '2.4 feedback', texts);
  await shot(page, info, '2.4-listen-feedback');
  expect(texts.some((t) => /^✓?\s*Kana: k[aiueo]$/u.test(t.replace(/\s+/g, ' ').replace('✓ ', '')))).toBe(true);
  expect(texts.some((t) => /\S+ \([a-z']+\) = .+/u.test(t))).toBe(true);
});

// ---------------------------------------------------------------------------------------------
// 3.1 Interleaved unlocking
// ---------------------------------------------------------------------------------------------
test('3.1 la gramática básica (saludos) se desbloquea tras あ‑な y el inicio la sugiere', async ({ page, consoleLog }, info) => {
  void consoleLog;
  const saludos = curriculum.find((l) => l.id === 'l-saludos')!;
  await seed(page, buildProgress({ completed: lessonsUpTo('h-ta', true) }), '/camino');
  await expect(page.getByRole('link', { name: new RegExp(saludos.title) })).toHaveCount(0);
  await seed(page, buildProgress({ completed: lessonsUpTo('h-na', true) }), '/camino');
  await expect(page.getByRole('link', { name: new RegExp(saludos.title) })).toBeVisible();
  await shot(page, info, '3.1-camino-after-hna', true);
  await page.goto('/');
  const next = page.locator('section[aria-labelledby="home-next"]');
  const text = (await next.innerText()).replace(/\s+/g, ' ');
  measure(info, '3.1 home next (after h-na, 5 kana lessons in a row)', text);
  await shot(page, info, '3.1-home-next');
  expect(text).toContain(saludos.title);
});

// ---------------------------------------------------------------------------------------------
// 3.2 SRS cards
// ---------------------------------------------------------------------------------------------
test('3.2 tarjetas de memoria clicables con lista de ítems, precisión, próximo repaso y ayuda (?)', async ({ page, consoleLog }, info) => {
  void consoleLog;
  const now = Date.now();
  const it = (kind: ItemState['kind'], itemId: string, srsStage: number, correct: number, wrong: number): ItemState => ({ itemId, kind, srsStage, correct, wrong, lastSeen: now - 3_600_000, nextDue: now + (srsStage + 1) * 86_400_000, weight: 1 });
  await seed(page, buildProgress({ completed: lessonsUpTo('h-ka', true), items: [it('kana', 'あ', 5, 9, 1), it('kana', 'か', 5, 4, 4), it('word', 'akai', 6, 6, 0), it('kana', 'い', 2, 2, 0)] }), '/');
  const guru = page.getByTestId('srs-Guru');
  await expect(guru).toContainText('3');
  const gb = await box(guru.getByRole('link'));
  await guru.getByRole('link').click();
  await expect(page).toHaveURL(/\/memoria\/guru$/);
  const rows = page.getByTestId('memory-row');
  await expect(rows).toHaveCount(3);
  const rowTexts = (await rows.allInnerTexts()).map((t) => t.replace(/\s+/g, ' '));
  measure(info, '3.2 guru rows', { cardTarget: [gb.width, gb.height], rows: rowTexts });
  expect(rowTexts.join(' ')).toContain('90%');
  expect(rowTexts.join(' ')).toContain('50%');
  await shot(page, info, '3.2-memoria-guru', true);
  const help = page.getByRole('button', { name: 'Ayuda: cómo funciona la memoria' });
  await help.click();
  const dlg = page.getByRole('dialog');
  await expect(dlg).toBeVisible();
  const dlgText = (await dlg.innerText()).replace(/\s+/g, ' ');
  measure(info, '3.2 help', dlgText.slice(0, 400));
  expect(dlgText).toMatch(/4 h|4 horas/);
  await shot(page, info, '3.2-help');
  await page.keyboard.press('Escape');
  await expect(dlg).toHaveCount(0);
  await expect(help).toBeFocused();
  expect(gb.height).toBeGreaterThanOrEqual(44);
});

// ---------------------------------------------------------------------------------------------
// 1.2 (extension) stage-2 / kanji games above the fold at 360×640
// ---------------------------------------------------------------------------------------------
const STAGE2: [string, import('./support/solver').GameName][] = [
  ['l-saludos', 'Diálogos'],
  ['l-numeros', 'Números y precios'],
  ['l-desu', 'Sintaxis'],
  ['l-desu', 'Partículas'],
  ['l-hora', 'Reloj'],
  ['l-verbos-1', 'Conjugación'],
  ['l-particulas', 'Mini-lectura'],
  ['l-fechas', 'Calendario'],
  ['kanji-3', 'Kanji'],
];
for (const [lesson, game] of STAGE2) {
  test(`1.2 primer pliegue 360×640: ${game} (${lesson})`, async ({ page, consoleLog }, info) => {
    void consoleLog;
    await stubSpeech(page, true);
    await page.setViewportSize(SMALL);
    await openLessonGame(page, lesson, game);
    const rows: string[] = [];
    const known: Record<string, string> = {
      'Diálogos': 'QA-041: la conversación y las respuestas quedan bajo el pliegue',
      'Reloj': 'QA-041: el reloj ocupa todo el ancho y los controles quedan bajo el pliegue',
      'Calendario': 'QA-037: el calendario hereda la fuente gigante del prompt',
      'Sintaxis': 'QA-041: «Comprobar» queda bajo la barra inferior',
      'Mini-lectura': 'QA-041: el texto completo va antes de la pregunta; las opciones quedan ~1 pantalla más abajo',
    };
    if (known[game]) test.fail(true, known[game]);
    for (let r = 0; r < 3; r++) {
      // with the kana keyboard the app scrolls the field into view itself: do not undo it
      if (!(await page.getByRole('group', { name: 'Teclado de kana' }).count())) await page.evaluate(() => scrollTo(0, 0));
      await page.waitForTimeout(700);
      const f = await fold(page);
      const usesKb = f.kbTop !== null;
      const bottom = usesKb ? (await box(page.locator('main form input'))).bottom : await lowest(page.locator(LAST_ACTION));
      const top = await box(page.locator('main section:visible').first());
      const scrollY = await page.evaluate(() => Math.round(scrollY));
      rows.push(`r${r}: bottom=${bottom} fold=${f.fold} frameTop=${top.top} scrollY=${scrollY}${usesKb ? ' kb' : ''}`);
      if (r === 0) await shot(page, info, `1.2-fold-360-${lesson}-${game.replace(/\s/g, '_')}`);
      expect.soft(bottom, `${game} r${r}: confirm/options above the fold`).toBeLessThanOrEqual(f.fold);
      if ((await currentGame(page)) !== game) break;
      await answerRound(page, game);
    }
    measure(info, `1.2 fold 360x640 ${game}`, rows.join(' | '));
  });
}
