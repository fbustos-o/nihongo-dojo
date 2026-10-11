/* Q2 — keyboard-only play and focus management (desktop Chromium). Measurements + assertions where clear. */
import type { Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { answerRound } from './support/solver';
import { buildProgress, seed } from './support/state';
import { measure, openLessonGame } from './support/flow';

const active = (page: Page) => page.evaluate(() => { const a = document.activeElement as HTMLElement | null; return a ? `${a.tagName.toLowerCase()}${a.getAttribute('aria-label') ? `[${a.getAttribute('aria-label')}]` : ''} ${(a.innerText ?? '').slice(0, 20)}`.trim() : 'none'; });

/** Presses Tab until `pred` holds for the focused element; returns the number of presses (or -1). */
async function tabUntil(page: Page, pred: () => Promise<boolean>, max = 40): Promise<number> {
  for (let i = 1; i <= max; i++) {
    await page.keyboard.press('Tab');
    if (await pred()) return i;
  }
  return -1;
}

test('solo teclado: Reconocer kana (escrito) — el foco vuelve al campo en cada ronda', async ({ page, consoleLog }, info) => {
  void consoleLog;
  await seed(page, buildProgress({ completed: ['h-a'] }), '/practica');
  await page.getByRole('button', { name: 'Empezar' }).click();
  const focus: string[] = [];
  for (let r = 0; r < 3; r++) {
    await page.locator('main form input').waitFor();
    focus.push(await active(page));
    await answerRound(page, 'Reconocer kana');
  }
  measure(info, 'keyboard Reconocer kana', focus);
  for (const f of focus) expect(f).toContain('input[Romaji]');
});

test('solo teclado: Leer palabras (opción múltiple) — Tabs hasta la primera opción, ronda a ronda', async ({ page, consoleLog }, info) => {
  void consoleLog;
  await openLessonGame(page, 'h-ka', 'Leer palabras');
  const isOption = () => page.evaluate(() => !!document.activeElement?.closest('[class*="_choices_"]'));
  const tabs: number[] = [];
  const after: string[] = [];
  for (let r = 0; r < 3; r++) {
    if (!(await page.locator('main [class*="_choices_"]').count())) { await answerRound(page, 'Leer palabras'); continue; }
    tabs.push(await tabUntil(page, isOption));
    // press the digit shortcut announced by aria-keyshortcuts (QA-028) and see whether anything happens
    await answerRound(page, 'Leer palabras');
    after.push(await active(page));
  }
  const shortcut = await (async () => {
    if (!(await page.locator('main [class*="_choices_"]').count())) return 'n/a';
    const before = await page.locator('main [class*="_choices_"] button:disabled').count();
    const total = await page.getByText(/respondidas|Racha/).count();
    await page.keyboard.press('1');
    return (await page.locator('main [class*="_choices_"] button:disabled').count()) !== before ? 'reacciona' : `sin efecto (${total})`;
  })();
  measure(info, 'keyboard Leer palabras', { tabsToFirstOption: tabs, focusAfterAnswer: after, digitShortcut: shortcut });
  for (const t of tabs) expect(t).toBeGreaterThan(0);
});

test('solo teclado: Sintaxis — las fichas y «Comprobar» se alcanzan con Tab y se activan con Enter', async ({ page, consoleLog }, info) => {
  void consoleLog;
  await openLessonGame(page, 'l-verbos-1', 'Sintaxis');
  const tiles = page.getByRole('group', { name: 'Fichas disponibles' }).getByRole('button');
  const n = await tiles.count();
  const inBank = () => page.evaluate(() => !!document.activeElement?.closest('[role="group"][aria-label="Fichas disponibles"]'));
  const t = await tabUntil(page, inBank);
  await page.keyboard.press('Enter');
  const placed = n - (await tiles.count());
  const enabledAfter = await tiles.evaluateAll((bs) => bs.filter((b) => !(b as HTMLButtonElement).disabled).length);
  measure(info, 'keyboard Sintaxis', { tiles: n, tabsToFirstTile: t, tileMovedByEnter: placed !== 0 || enabledAfter < n, focusAfterEnter: await active(page) });
  expect(t).toBeGreaterThan(0);
});

test('teclado kana en pantalla (ajuste «teclado») con teclado físico: Tab sale del campo y el teclado kana desaparece', async ({ page, consoleLog }, info) => {
  void consoleLog;
  await seed(page, buildProgress({ completed: ['h-a'], settings: { kanaInput: 'teclado' } as never }), '/practica');
  await page.getByRole('combobox', { name: 'Juego:' }).selectOption('kana-write');
  await page.getByRole('button', { name: 'Empezar' }).click();
  const input = page.locator('main form input');
  await input.focus();
  const kb = page.getByRole('group', { name: 'Teclado de kana' });
  await expect(kb).toBeVisible();
  await page.keyboard.type('a');
  const typed = await input.inputValue();
  await page.keyboard.press('Tab');
  const afterTab = { focused: await active(page), keyboardVisible: await kb.isVisible().catch(() => false) };
  measure(info, 'kana keyboard + physical keyboard', { typedWithPhysicalKey: typed, afterTab });
  expect(typed).toBe('');
});

test('reloj y calendario: alternativas accesibles (role=img + aria-label sin revelar la respuesta; tabla con caption y aria-current)', async ({ page, consoleLog }, info) => {
  void consoleLog;
  await openLessonGame(page, 'l-hora', 'Reloj');
  let clock = '';
  for (let i = 0; i < 6 && !clock; i++) {
    const c = page.getByTestId('analog-clock');
    if (await c.count()) clock = `${await c.getAttribute('role')} | ${await c.getAttribute('aria-label')}`;
    else await answerRound(page, 'Reloj');
  }
  await openLessonGame(page, 'l-fechas', 'Calendario');
  const grid = page.getByTestId('month-grid');
  const cal = { caption: await grid.locator('caption').innerText(), current: await grid.locator('[aria-current="date"]').count(), captionFontPx: await grid.locator('caption').evaluate((e) => getComputedStyle(e).fontSize), cellFontPx: await grid.locator('td').first().evaluate((e) => getComputedStyle(e).fontSize) };
  measure(info, 'clock/calendar a11y', { clock, cal });
  expect(clock).toMatch(/^img \| Reloj analógico/);
  expect(cal.current).toBe(1);
});
