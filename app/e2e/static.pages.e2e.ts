/* Q2 — static build for GitHub Pages (VITE_BASE=/nihongo-dojo/, served by scripts/serve-pages.mjs, which answers
 * unknown paths with 404.html like Pages). npm run test:e2e:pages builds and serves it (playwright.config webServer). */
import fs from 'node:fs';
import { test, expect } from './support/fixtures';
import { answerRound, currentGame } from './support/solver';
import { buildProgress } from './support/state';
import { measure } from './support/flow';
import { shot } from './support/mobile';

const BASE = '/nihongo-dojo/';

// option fixtures take [value, options]: the regex list must be wrapped
test.use({ allowConsole: [[/404 \(Not Found\)/, /status of 404/], { scope: 'test' }] as never });

test('Pages: carga, navegación, chunks perezosos bajo la base y recarga de enlaces profundos', async ({ page, consoleLog }, info) => {
  void consoleLog;
  const bad: string[] = [];
  const assets: string[] = [];
  page.on('response', (r) => {
    const u = new URL(r.url());
    if (u.pathname.includes('/assets/')) assets.push(u.pathname);
    // documents of deep links come back as 404.html with status 404 (as on GitHub Pages): expected
    if (r.status() >= 400 && !u.pathname.includes('/audio/') && r.request().resourceType() !== 'document') bad.push(`${r.status()} ${u.pathname}`);
  });
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('ようこそ');
  await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'Camino' }).click();
  await expect(page).toHaveURL(new RegExp(`${BASE}camino$`));
  await page.getByRole('link', { name: /Hiragana: あ い う え お/ }).click();
  await expect(page).toHaveURL(new RegExp(`${BASE}leccion/h-a$`));
  await page.getByRole('button', { name: 'Empezar práctica' }).click();
  for (let i = 0; i < 6; i++) await answerRound(page, (await currentGame(page))!);
  // deep-link reloads (Pages answers 404.html with status 404 for them)
  const reloads: Record<string, number | undefined> = {};
  for (const path of ['camino', 'leccion/h-a', 'memoria/guru', 'ajustes', 'repaso', 'practica', 'no-existe']) {
    const r = await page.goto(path);
    reloads[path] = r?.status();
    await expect(page.locator('header')).toContainText('Nihongo Dojo');
  }
  await page.goto('memoria/guru');
  await expect(page).toHaveURL(new RegExp(`${BASE}(memoria/guru)?$`));
  const unknownText = await (async () => { await page.goto('no-existe'); return (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 120); })();
  measure(info, 'pages', { reloadStatus: reloads, assetsLoaded: [...new Set(assets)].length, allUnderBase: assets.every((a) => a.startsWith(`${BASE}assets/`)), bad, unknownRoute: unknownText });
  await shot(page, info, 'pages-unknown-route');
  expect(bad).toEqual([]);
  expect(assets.every((a) => a.startsWith(`${BASE}assets/`))).toBe(true);
});

test('Pages: exportar con nombre fechado e importar desde un archivo (perfil móvil)', async ({ page, consoleLog }, info) => {
  void consoleLog;
  await page.goto('ajustes');
  await page.evaluate((v) => localStorage.setItem('nihongo-dojo:v1', v), JSON.stringify(buildProgress({ completed: ['h-a'], xp: 77 })));
  await page.reload();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar progreso' }).tap()]);
  const file = await dl.path();
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  // the visible button opens the (hidden) file input: a file chooser must appear
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Importar progreso' }).tap()]);
  await chooser.setFiles(file);
  await expect(page.getByText('Progreso importado correctamente.')).toBeVisible();
  const xp = await page.evaluate(() => JSON.parse(localStorage.getItem('nihongo-dojo:v1')!).xp);
  measure(info, 'pages export/import', { name: dl.suggestedFilename(), xp, bytes: fs.statSync(file).size });
  expect(dl.suggestedFilename()).toMatch(/^nihongo_dojo_backup_\d{4}-\d{2}-\d{2}\.json$/);
  expect(xp).toBe(77);
});

test('Pages: sin voz japonesa, el audio consulta solo el manifiesto bajo la base (sin .mp3 inexistentes) y el botón se desactiva', async ({ page, consoleLog }, info) => {
  void consoleLog;
  await page.addInitScript(() => { delete (window as unknown as Record<string, unknown>).speechSynthesis; });
  const audio: string[] = [];
  page.on('request', (r) => { if (r.url().includes('/audio/')) audio.push(new URL(r.url()).pathname); });
  await page.goto('leccion/h-a');
  const btn = page.getByRole('button', { name: 'Oír' }).first();
  await btn.tap();
  await expect(btn).toBeDisabled();
  measure(info, 'static audio fallback', { requests: audio.map(decodeURIComponent) });
  expect(audio).toEqual([`${BASE}audio/manifest.json`]);
});
