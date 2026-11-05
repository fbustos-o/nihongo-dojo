/* QA v2 (Parte 4): Core 1000 (lesson c-01, /vocabulario, /aprender), English interface and deep-link restore.
 * Desktop Chromium. Shared flows live in ./support/v2.ts so the mobile file runs the same journeys. */
import { test, expect } from './support/fixtures';
import { stubSpeech } from './support/mobile';
import { readProgress } from './support/state';
import { coreLessonJourney, deepLinkRestore, englishJourney, learnJourney, stage5Leaks, vocabJourney } from './support/v2';

test.beforeEach(async ({ page }) => {
  await stubSpeech(page, true);
});

test('c-01 completa: 25 tarjetas → leer → escuchar → dictado; cuenta 25 palabras nuevas una sola vez', async ({ page, consoleLog }) => {
  void consoleLog;
  test.setTimeout(240_000);
  await coreLessonJourney(page);
  const p = await readProgress(page);
  expect(p?.completedLessons).toContain('c-01');
});

test('/vocabulario: buscar, filtrar y «Ya la sé» → sale de /aprender y queda para repaso', async ({ page, consoleLog }) => {
  void consoleLog;
  await vocabJourney(page);
});

test('/aprender: tarjetas → leer palabras, en orden de rango y solo con kana conocidos; la tarjeta Hoy cuenta las nuevas', async ({ page, consoleLog }) => {
  void consoleLog;
  test.setTimeout(180_000);
  await learnJourney(page);
});

test('Ajustes → inglés: Inicio, Camino y un juego en inglés; los significados no mezclan idiomas', async ({ page, consoleLog }) => {
  void consoleLog;
  await englishJourney(page);
});

test('enlace profundo con ?r=: /?r=camino termina en /camino', async ({ page, consoleLog }) => {
  void consoleLog;
  await deepLinkRestore(page);
});

test('etapa 5 (c-01 tras な, c-13 tras や・ら, c-29 tras が・ざ): ningún juego muestra kana ni kanji sin desbloquear', async ({ page, consoleLog }) => {
  void consoleLog;
  test.setTimeout(300_000);
  for (const id of ['c-01', 'c-13', 'c-29']) expect(await stage5Leaks(page, id), id).toEqual([]);
});
