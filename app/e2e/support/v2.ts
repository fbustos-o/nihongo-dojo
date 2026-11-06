/* QA v2 (Parte 4) journeys shared by v2.e2e.ts (desktop) and v2.mobile.e2e.ts (Pixel 7 / iPhone 14). */
import { expect, type Page } from '@playwright/test';
import { toHiragana } from 'wanakana';
import { isReadableWith } from '../../src/engine/kanaFilter';
import { curriculum, kana, lessonsUpTo, norm, vocab } from './content';
import { answerRound, currentGame, jaText, lessonResultVisible, playUntil } from './solver';
import { buildProgress, readProgress, seed } from './state';

interface CoreWord { id: string; kana: string; rank?: number; source: string; en?: string[]; es: string[] }
const words = vocab as unknown as CoreWord[];
const ALL_HIRAGANA = lessonsUpTo('h-tsu-long', true);
const SPANISH_CHARS = /[áéíóúñ¿¡]/u;
/** Kana of a JaText that may show locked kana as romaji («おhaよう» -> おはよう). */
const asKana = (shown: string): string => norm(toHiragana(shown.replace(/\s+/g, ''), { passRomaji: false }));

/** Core words /aprender offers with `known` kana and no progress, in rank order (same rule as state/dailyPlan.ts). */
export function expectedNewWords(known: ReadonlySet<string>, exclude: readonly string[] = []): CoreWord[] {
  return words
    .filter((w) => w.rank !== undefined && !exclude.includes(w.id) && isReadableWith(w.kana, known))
    .sort((a, b) => a.rank! - b.rank!);
}
const hiragana = new Set(kana.filter((k) => k.script === 'hiragana').map((k) => k.char));

/** Plays the flashcard on screen: flip, check the front, «Ya la sé». */
async function flashcard(page: Page, expectedKana?: string): Promise<void> {
  const card = page.getByTestId('flashcard');
  if (expectedKana) expect(asKana(await jaText(page.getByTestId('flashcard-front')))).toBe(norm(expectedKana));
  await card.click();
  await expect(page.getByTestId('flashcard-back')).toBeVisible();
  await page.getByRole('button', { name: 'Ya la sé', exact: true }).click();
}

/** Kana and kanji visible in the game area, without the `written` info of cards, furigana/ruby, inputs and the title. */
async function visibleScript(page: Page): Promise<string[]> {
  return page.locator('main').evaluate((main) => {
    const c = main.cloneNode(true) as HTMLElement;
    // kana-ruby: a locked kana shown with its romaji on top (QA-036 decision), the accepted way to show it
    c.querySelectorAll('h1, input, rt, ruby[data-testid="kana-ruby"], [data-testid="flashcard-back"] [lang="ja"], [class*="_romaji_"]').forEach((n) => n.remove());
    return [...new Set(c.innerText.match(/[ぁ-ゖァ-ヺ一-鿿]/gu) ?? [])];
  });
}

/**
 * Plays a stage 5 lesson and returns the kana / kanji shown that the learner has not unlocked (JaText invariant):
 * known kana = those of the completed lessons, no kanji unlocked.
 */
export async function stage5Leaks(page: Page, lessonId: string): Promise<string[]> {
  const done = lessonsUpTo(lessonId);
  await seed(page, buildProgress({ completed: done }), `/leccion/${lessonId}`);
  const allowed = new Set(curriculum.filter((l) => done.includes(l.id)).flatMap((l) => l.kana ?? []).flatMap((k) => [...k]));
  await page.getByRole('button', { name: 'Empezar práctica' }).click();
  const leaks = new Map<string, string>();
  const finished = lessonResultVisible(page);
  for (let i = 0; i < 250 && !(await finished()); i++) {
    const game = await currentGame(page);
    if (!game) { await page.waitForTimeout(100); continue; }
    for (const ch of await visibleScript(page)) if (!allowed.has(ch) && !leaks.has(ch)) leaks.set(ch, game);
    await answerRound(page, game);
  }
  return [...leaks].map(([ch, game]) => `${ch} (${game})`);
}

export async function coreLessonJourney(page: Page): Promise<void> {
  await seed(page, buildProgress({ completed: lessonsUpTo('c-01') }), '/leccion/c-01');
  await page.getByRole('button', { name: 'Empezar práctica' }).click();
  await expect(page.getByTestId('flashcard-counter')).toHaveText('Tarjeta 1 de 25');
  const result = await playUntil(page, lessonResultVisible(page), { maxRounds: 250 });
  expect(result.games).toEqual(['Tarjetas', 'Leer palabras', 'Escuchar', 'Escribir kana']);
  await expect(page.getByRole('heading', { name: '¡Lección completada!' })).toBeVisible();
  // every card was new and answered «Ya la sé» once: 25 new words today, counted once each
  const p = await readProgress(page);
  expect(Object.values(p!.daily).map((d) => (d as { newWords?: number }).newWords)).toEqual([25]);
  await page.goto('/');
  await expect(page.getByTestId('today-plan-new')).toHaveText('Palabras nuevas: 25 de 10');
}

export async function vocabJourney(page: Page): Promise<void> {
  await seed(page, buildProgress({ completed: ALL_HIRAGANA }), '/vocabulario');
  await expect(page.getByTestId('vocab-known')).toHaveText('Sabes 0 de 1000 palabras del Core 1000');
  await expect(page.getByTestId('vocab-count')).toHaveText('1000 palabras');

  await page.getByRole('searchbox', { name: 'Buscar' }).fill('neko');
  await expect(page.getByTestId('vocab-row').first()).toContainText('ねこ');
  await page.getByRole('searchbox', { name: 'Buscar' }).fill('');

  await page.getByRole('combobox', { name: 'Rango' }).selectOption('1-100');
  await page.getByRole('combobox', { name: 'Fuente' }).selectOption('core1000');
  const newCore = words.filter((w) => w.source === 'core1000' && w.rank! <= 100).length;
  await expect(page.getByTestId('vocab-count')).toHaveText(`${newCore} palabras`);
  await page.getByRole('combobox', { name: 'Fuente' }).selectOption('');
  await expect(page.getByTestId('vocab-count')).toHaveText('100 palabras');

  // rank 1 is はい: «Ya la sé» -> Guru, counted as known, out of /aprender, due later as a review
  const first = page.getByTestId('vocab-row').first();
  await expect(first).toContainText('Core #1');
  const toggle = first.getByRole('button', { name: 'Ya la sé: はい' });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(first).toContainText('Guru');
  await expect(page.getByTestId('vocab-known')).toHaveText('Sabes 1 de 1000 palabras del Core 1000');
  const item = (await readProgress(page))!.items['word:hai']!;
  expect(item.srsStage).toBe(5);
  expect(item.nextDue).toBeGreaterThan(Date.now());

  await page.goto('/aprender');
  await page.getByRole('button', { name: 'Empezar' }).click();
  const next = expectedNewWords(hiragana, ['hai'])[0]!;
  expect(next.rank).toBe(2);
  expect(asKana(await jaText(page.getByTestId('flashcard-front')))).toBe(norm(next.kana));
}

export async function learnJourney(page: Page): Promise<void> {
  await seed(page, buildProgress({ completed: ALL_HIRAGANA }), '/');
  await expect(page.getByTestId('today-plan-new')).toHaveText('Palabras nuevas: 0 de 10');
  await expect(page.getByTestId('today-primary')).toHaveText('Aprender 10 palabras nuevas');
  await page.getByTestId('today-primary').click();
  await expect(page).toHaveURL(/\/aprender$/);
  await page.getByRole('button', { name: 'Empezar' }).click();
  const batch = expectedNewWords(hiragana).slice(0, 10);
  // only readable with the known kana (no katakana yet), and in rank order
  for (const w of batch) expect(isReadableWith(w.kana, hiragana)).toBe(true);
  for (const w of batch) {
    expect((await visibleScript(page)).filter((ch) => !hiragana.has(ch)), `card ${w.kana}`).toEqual([]);
    await flashcard(page, w.kana);
  }
  await expect(page.getByRole('listitem').filter({ hasText: '2 · Leer palabras' })).toHaveAttribute('aria-current', 'step');
  for (let i = 0; i < 40 && !(await page.getByTestId('learn-summary').count()); i++) {
    if (await page.getByTestId('word-prompt').count()) await answerRound(page, 'Leer palabras');
    else await page.waitForTimeout(100);
  }
  await expect(page.getByTestId('learn-summary')).toContainText('Palabras vistas: 10');
  await page.goto('/');
  await expect(page.getByTestId('today-plan-new')).toHaveText('Palabras nuevas: 10 de 10');
  // the 10 words now have progress and the daily target is met: the primary action moves on
  await expect(page.getByTestId('today-primary')).not.toHaveText(/Aprender/);

  // «Palabras nuevas por día» is reflected on the Today card
  await page.goto('/ajustes');
  await page.getByRole('spinbutton', { name: 'Palabras nuevas por día' }).fill('15');
  await page.goto('/');
  await expect(page.getByTestId('today-plan-new')).toHaveText('Palabras nuevas: 10 de 15');
  await expect(page.getByTestId('today-card')).toContainText('Aprender 5 palabras nuevas');
}

export async function englishJourney(page: Page): Promise<void> {
  await seed(page, buildProgress({ completed: lessonsUpTo('c-01') }), '/ajustes');
  await page.getByRole('combobox', { name: 'Idioma de la interfaz' }).selectOption('en');
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Meanings language' }).selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await page.goto('/');
  await expect(page.getByRole('heading', { name: "Today's activity" })).toBeVisible();
  await expect(page.getByTestId('today-plan-new')).toHaveText('New words: 0 of 10');
  expect(await page.locator('main').innerText()).not.toMatch(SPANISH_CHARS);

  await page.goto('/camino');
  await expect(page.getByRole('heading', { level: 1, name: 'Path' })).toBeVisible();
  const path = await page.locator('main').innerText();
  expect(path).not.toMatch(SPANISH_CHARS);
  expect(path).toContain('Essential vocabulary 1–25');

  await page.goto('/leccion/c-01');
  await page.getByRole('button', { name: 'Start practice' }).click();
  await expect(page.getByText(/^Game 1 of 4:/)).toBeVisible();
  await expect(page.getByTestId('flashcard-counter')).toHaveText('Card 1 of 25');
  const front = asKana(await jaText(page.getByTestId('flashcard-front')));
  await page.getByTestId('flashcard').click();
  const back = await page.getByTestId('flashcard-back').innerText();
  expect(back).not.toMatch(SPANISH_CHARS);
  const shown = words.find((w) => w.rank !== undefined && w.rank <= 25 && norm(w.kana) === front);
  expect(shown, `card ${front}`).toBeDefined();
  expect(back).toContain(shown!.en![0]!);
  await expect(page.getByRole('button', { name: 'I know it' })).toBeVisible();
  expect(await page.locator('main').innerText()).not.toMatch(SPANISH_CHARS);
}

export async function deepLinkRestore(page: Page): Promise<void> {
  await seed(page, buildProgress({ completed: lessonsUpTo('h-ka', true) }), '/?r=camino');
  await expect(page).toHaveURL(/\/camino$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Camino' })).toBeVisible();
  await page.goto('/?r=leccion/h-sa');
  await expect(page).toHaveURL(/\/leccion\/h-sa$/);
  await expect(page.getByRole('button', { name: 'Empezar práctica' })).toBeVisible();
  await page.goto('/?r=vocabulario');
  await expect(page.getByRole('heading', { level: 1, name: 'Vocabulario' })).toBeVisible();
}

/** The flag switcher in the shell: one click sets interface + meanings; the html lang and the nav follow. */
export async function flagSwitch(page: Page): Promise<void> {
  await seed(page, buildProgress({ completed: lessonsUpTo('c-01') }), '/');
  const sw = page.getByTestId('lang-switch');
  await expect(sw.getByRole('button', { name: 'Español' })).toHaveAttribute('aria-pressed', 'true');
  await sw.getByRole('button', { name: 'English' }).click();
  await expect(sw.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: "Today's activity" })).toBeVisible();
  await page.goto('/vocabulario');
  expect(await page.locator('main').innerText()).not.toMatch(SPANISH_CHARS);
  const saved = await readProgress(page);
  expect(saved!.settings.uiLang).toBe('en');
  expect(saved!.settings.meaningLang).toBe('en');
  await sw.getByRole('button', { name: 'Español' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.getByRole('heading', { level: 1, name: 'Vocabulario' })).toBeVisible();
}
