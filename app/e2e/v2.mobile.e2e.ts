/* QA v2 (Parte 4), mobile (Pixel 7 / iPhone 14 emulation): the same Core 1000 / English / deep-link journeys as
 * v2.e2e.ts, plus the layout checks of the new pages (no horizontal scroll, 6-entry tab bar, Path jump button). */
import { test, expect } from './support/fixtures';
import { lessonsUpTo } from './support/content';
import { stubSpeech } from './support/mobile';
import { buildProgress, seed } from './support/state';
import { coreLessonJourney, deepLinkRestore, englishJourney, learnJourney, vocabJourney } from './support/v2';

test.beforeEach(async ({ page }) => {
  await stubSpeech(page, true);
});

test('c-01 completa en móvil (teclado kana en el dictado)', async ({ page, consoleLog }) => {
  void consoleLog;
  test.setTimeout(300_000);
  await coreLessonJourney(page);
});

test('/vocabulario en móvil: buscar, filtrar, «Ya la sé»', async ({ page, consoleLog }) => {
  void consoleLog;
  await vocabJourney(page);
});

test('/aprender en móvil', async ({ page, consoleLog }) => {
  void consoleLog;
  test.setTimeout(180_000);
  await learnJourney(page);
});

test('inglés en móvil', async ({ page, consoleLog }) => {
  void consoleLog;
  await englishJourney(page);
});

test('?r= en móvil', async ({ page, consoleLog }) => {
  void consoleLog;
  await deepLinkRestore(page);
});

test('páginas v2 sin scroll horizontal; barra inferior con 6 entradas; «Ir a la lección actual»', async ({ page, consoleLog }) => {
  void consoleLog;
  await seed(page, buildProgress({ completed: lessonsUpTo('c-03') }), '/');
  for (const path of ['/', '/camino', '/vocabulario', '/aprender', '/ajustes', '/leccion/c-03']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const { sw, w } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
    expect(sw, `${path}: scrollWidth ${sw} > ${w}`).toBeLessThanOrEqual(w);
  }
  const nav = page.getByRole('navigation', { name: 'Navegación principal' });
  await expect(nav.getByRole('link')).toHaveCount(6);
  for (const link of await nav.getByRole('link').all()) {
    const b = (await link.boundingBox())!;
    expect(b.height).toBeGreaterThanOrEqual(44);
    expect(b.width).toBeGreaterThanOrEqual(44);
  }
  await page.goto('/camino');
  await page.getByTestId('path-jump').click();
  const current = page.locator('main a[aria-current="step"]');
  await expect(current).toBeFocused();
  await expect(current).toBeInViewport();
});
