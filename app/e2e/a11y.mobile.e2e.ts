/* Q2 — UX / a11y / performance probes on phones (pixel7, iphone14). Mostly measurements (annotations), with
 * assertions only where the requirement is clear. */
import { test, expect } from './support/fixtures';
import { lessonsUpTo } from './support/content';
import { answerRound } from './support/solver';
import { buildProgress, seed } from './support/state';
import { measure, openLessonGame } from './support/flow';

test('touch targets < 44 px en las pantallas principales (360×640)', async ({ page, consoleLog }, info) => {
  void consoleLog;
  await page.setViewportSize({ width: 360, height: 640 });
  const small: Record<string, string[]> = {};
  const scan = async (name: string) => {
    await page.locator('main h1, main form input').first().waitFor();
    await page.getByTestId('loading').waitFor({ state: 'detached' }).catch(() => undefined);
    small[name] = await page.evaluate(() => {
      const out: string[] = [];
      document.querySelectorAll('button, a[href], select, input:not([type=hidden]), [role=button]').forEach((el) => {
        const r = (el as HTMLElement).getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        if (r.width < 44 || r.height < 44) out.push(`${((el as HTMLElement).getAttribute('aria-label') ?? (el as HTMLElement).innerText ?? el.tagName).replace(/\s+/g, ' ').slice(0, 30)} ${Math.round(r.width)}×${Math.round(r.height)}`);
      });
      return Array.from(new Set(out));
    });
  };
  await seed(page, buildProgress({ completed: lessonsUpTo('h-ka', true) }), '/');
  await scan('inicio');
  await page.goto('/camino'); await scan('camino');
  await page.goto('/practica'); await scan('practica');
  await page.goto('/ajustes'); await scan('ajustes');
  await page.getByRole('combobox', { name: 'Escritura de kana' }).selectOption('romaji');
  await page.goto('/practica');
  await page.getByRole('combobox', { name: 'Juego:' }).selectOption('kana-write');
  await page.getByRole('button', { name: 'Empezar' }).click();
  await page.locator('main form input').waitFor();
  await scan('escribir-kana');
  await page.goto('/memoria/aprendiz');
  await scan('memoria');
  measure(info, 'targets < 44px', small);
  expect(Object.keys(small).length).toBe(6);
});

test('movimiento reducido: animaciones del feedback y del teclado kana desactivadas', async ({ page, consoleLog }, info) => {
  void consoleLog;
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openLessonGame(page, 'h-ka', 'Escribir kana');
  const kbAnim = await page.getByRole('group', { name: 'Teclado de kana' }).evaluate((el) => getComputedStyle(el).animationName + ' ' + getComputedStyle(el).animationDuration);
  await answerRound(page, 'Escribir kana');
  const fb = await page.locator('main section > [role=status] p').first().evaluate((el) => getComputedStyle(el).animationName + ' ' + getComputedStyle(el).animationDuration);
  const smooth = await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);
  measure(info, 'reduced motion', { kanaKeyboard: kbAnim, feedback: fb, scrollBehavior: smooth });
  expect(kbAnim.startsWith('none') || /0\.00001s|1e-05s|0s/.test(kbAnim)).toBe(true);
});

test('carga inicial con red lenta (Fast 3G, CPU ×4) y caché', async ({ page, consoleLog, browserName }, info) => {
  void consoleLog;
  test.skip(browserName !== 'chromium');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  let bytes = 0;
  const files: string[] = [];
  page.on('response', async (r) => {
    const len = Number((await r.allHeaders())['content-length'] ?? 0);
    bytes += len;
    files.push(`${new URL(r.url()).pathname} ${len}`);
  });
  const t0 = Date.now();
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 60_000 });
  const firstView = Date.now() - t0;
  const nav = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming; return { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) }; });
  const fcp = await page.evaluate(() => Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? -1));
  const t1 = Date.now();
  await page.goto('/leccion/h-a');
  await page.getByRole('button', { name: 'Empezar práctica' }).click();
  await expect(page.getByTestId('prompt')).toBeVisible({ timeout: 60_000 });
  const toFirstGame = Date.now() - t1;
  const t2 = Date.now();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 60_000 });
  const warmReload = Date.now() - t2;
  measure(info, 'throttled load', { firstViewMs: firstView, fcp, ...nav, transferredBytesFirstView: bytes, toFirstGameMs: toFirstGame, warmReloadMs: warmReload, files: files.slice(0, 12) });
  expect(firstView).toBeLessThan(10_000);
});
