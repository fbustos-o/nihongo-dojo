/* Q3 (final verification): romaji-ruby legibility / overflow at 360×640 at h-na-level progress, explicit calendar size
 * check (QA-037), and a mobile exploratory journey (new user → h-a … h-na → l-saludos from the Home suggestion →
 * Práctica de gramática → /repaso → /memoria/aprendiz → Ajustes). Console errors fail the test (fixture). */
import fs from 'node:fs';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { curriculum, lessonsUpTo } from './support/content';
import { answerRound, currentGame, lessonResultVisible, playUntil, type GameName } from './support/solver';
import { buildProgress, readProgress, seed } from './support/state';
import { measure, openLessonGame } from './support/flow';
import { shot, stubSpeech } from './support/mobile';

const SMALL = { width: 360, height: 640 };

interface Audit { rubies: number; rtPx: number[]; basePx: number[]; docOverflowX: number; overflowing: string[]; rtOutsideBox: string[]; rtOverlaps: number; inlineRomaji: string[] }

/** Ruby metrics in <main>: rt font sizes, horizontal page overflow, boxes whose content overflows, rt clipped by its box. */
async function rubyAudit(page: Page): Promise<Audit> {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const rts = [...document.querySelectorAll('main ruby[data-testid=kana-ruby] rt')] as HTMLElement[];
    const px = (el: Element) => Math.round(parseFloat(getComputedStyle(el).fontSize) * 10) / 10;
    const boxes = [...document.querySelectorAll('main button, main [class*="_bubble_"], main [class*="_tile_"], main [class*="_option_"]')] as HTMLElement[];
    const overflowing = boxes
      .filter((el) => el.offsetParent !== null && (el.scrollWidth > el.clientWidth + 1 || el.getBoundingClientRect().right > vw + 1 || el.getBoundingClientRect().left < -1))
      .map((el) => (el.textContent ?? '').slice(0, 40));
    const rtOutsideBox = rts
      .filter((rt) => {
        const b = rt.closest('button, [class*="_bubble_"], [class*="_tile_"]');
        if (!b) return false;
        const r = rt.getBoundingClientRect();
        const bb = b.getBoundingClientRect();
        return r.top < bb.top - 1 || r.left < bb.left - 1 || r.right > bb.right + 1;
      })
      .map((rt) => (rt.closest('button, [class*="_bubble_"], [class*="_tile_"]')!.textContent ?? '').slice(0, 30));
    let rtOverlaps = 0;
    const rects = rts.map((r) => r.getBoundingClientRect()).filter((r) => r.width > 0);
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i]!, b = rects[j]!;
        if (Math.abs(a.top - b.top) < 2 && a.left < b.right - 0.5 && b.left < a.right - 0.5) rtOverlaps++;
      }
    const inlineRomaji = [...document.querySelectorAll('main [class*="_romaji_"]')].map((e) => e.textContent ?? '').slice(0, 10);
    return {
      rubies: rts.length,
      rtPx: [...new Set(rts.map(px))].sort((a, b) => a - b),
      basePx: [...new Set(rts.map((rt) => px(rt.parentElement!)))].sort((a, b) => a - b),
      docOverflowX: document.documentElement.scrollWidth - vw,
      overflowing,
      rtOutsideBox: [...new Set(rtOutsideBox)],
      rtOverlaps,
      inlineRomaji,
    };
  });
}

async function auditRounds(page: Page, info: TestInfo, label: string, game: GameName, rounds = 3): Promise<Audit[]> {
  const out: Audit[] = [];
  for (let r = 0; r < rounds; r++) {
    await page.waitForTimeout(400);
    const a = await rubyAudit(page);
    out.push(a);
    if (r === 0 || (r === rounds - 1 && game === 'Diálogos')) await shot(page, info, `q3-ruby-${label}-r${r}`);
    if ((await currentGame(page)) !== game) break;
    await answerRound(page, game);
  }
  measure(info, `q3 ruby ${label}`, out);
  for (const a of out) {
    expect.soft(a.docOverflowX, `${label}: no horizontal page scroll`).toBeLessThanOrEqual(0);
    expect.soft(a.overflowing, `${label}: no box overflows`).toEqual([]);
    expect.soft(a.rtOutsideBox, `${label}: rt stays inside its box`).toEqual([]);
    expect.soft(a.inlineRomaji, `${label}: no inline romaji mixed into kana`).toEqual([]);
  }
  return out;
}

test.describe('Q3 ruby a 360×640 con progreso hasta h-na', () => {
  test.beforeEach(async ({ page }) => {
    await stubSpeech(page, true);
    await page.setViewportSize(SMALL);
  });

  test('l-saludos: Leer palabras (opciones) y Diálogos (burbujas + respuestas)', async ({ page, consoleLog }, info) => {
    void consoleLog;
    await openLessonGame(page, 'l-saludos', 'Leer palabras');
    const rw = await auditRounds(page, info, 'l-saludos-leer', 'Leer palabras');
    await openLessonGame(page, 'l-saludos', 'Diálogos');
    const dl = await auditRounds(page, info, 'l-saludos-dialogos', 'Diálogos', 5);
    expect([...rw, ...dl].some((a) => a.rubies > 0), 'h-na level: some ruby is shown').toBe(true);
  });

  test('práctica de gramática tras l-saludos: Diálogos; l-desu en su puerta (h-ma): Sintaxis y Partículas', async ({ page, consoleLog }, info) => {
    void consoleLog;
    await seed(page, buildProgress({ completed: [...lessonsUpTo('l-saludos', true)] }), '/practica');
    const sel = page.locator('section[aria-labelledby="grammar-free"] select');
    await sel.selectOption('dialogues');
    await page.getByRole('button', { name: 'Practicar gramática' }).click();
    await auditRounds(page, info, 'practica-dialogos', 'Diálogos', 4);
    await openLessonGame(page, 'l-desu', 'Sintaxis');
    await auditRounds(page, info, 'l-desu-sintaxis', 'Sintaxis');
    await openLessonGame(page, 'l-desu', 'Partículas');
    await auditRounds(page, info, 'l-desu-particulas', 'Partículas');
  });

  test('QA-037: el calendario cabe en 360 px con fuente normal', async ({ page, consoleLog }, info) => {
    void consoleLog;
    await openLessonGame(page, 'l-fechas', 'Calendario');
    const grid = page.getByTestId('month-grid');
    const m = await grid.evaluate((g) => {
      const cap = g.querySelector('caption')!;
      const td = g.querySelector('td')!;
      const r = g.getBoundingClientRect();
      return { captionPx: parseFloat(getComputedStyle(cap).fontSize), cellPx: parseFloat(getComputedStyle(td).fontSize), width: Math.round(r.width), height: Math.round(r.height), vw: document.documentElement.clientWidth };
    });
    measure(info, 'q3 calendar', m);
    await shot(page, info, 'q3-calendar-360');
    expect(m.captionPx).toBeLessThanOrEqual(24);
    expect(m.cellPx).toBeLessThanOrEqual(20);
    expect(m.width).toBeLessThanOrEqual(m.vw);
    expect(m.height).toBeLessThan(400);
  });
});

test('Q3 recorrido exploratorio móvil: nuevo → h-a … h-na → l-saludos (sugerida) → gramática → repaso → memoria → ajustes', async ({ page, consoleLog }, info) => {
  test.skip(info.project.name !== 'pixel7', 'journey on Pixel 7 only');
  test.setTimeout(900_000);
  void consoleLog;
  await stubSpeech(page, true);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('ようこそ');
  const log: string[] = [];
  for (const id of ['h-a', 'h-ka', 'h-sa', 'h-ta', 'h-na']) {
    const next = page.locator('section[aria-labelledby="home-next"]');
    const title = curriculum.find((l) => l.id === id)!.title;
    await expect(next).toContainText(title);
    await next.getByRole('link', { name: 'Empezar' }).click();
    await expect(page).toHaveURL(new RegExp(`/leccion/${id}$`));
    await page.getByRole('button', { name: 'Empezar práctica' }).click();
    const r = await playUntil(page, lessonResultVisible(page), { lessonKana: curriculum.find((l) => l.id === id)!.kana });
    await expect(page.getByRole('heading', { name: '¡Lección completada!' })).toBeVisible();
    log.push(`${id}: ${r.rounds} rondas ${r.games.join('/')}`);
    if (id === 'h-ka') await shot(page, info, 'q3-journey-hka-result');
    await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'Inicio' }).click();
  }
  // Home suggests the first grammar lesson
  const next = page.locator('section[aria-labelledby="home-next"]');
  const homeText = (await next.innerText()).replace(/\s+/g, ' ');
  log.push(`home: ${homeText}`);
  await shot(page, info, 'q3-journey-home-after-hna', true);
  const saludos = curriculum.find((l) => l.id === 'l-saludos')!.title;
  expect(homeText, 'Home suggests l-saludos after h-na').toContain(saludos);
  if (await next.getByRole('link', { name: saludos }).count()) await next.getByRole('link', { name: saludos }).click();
  else await next.getByRole('link', { name: 'Empezar' }).click();
  await expect(page).toHaveURL(/\/leccion\/l-saludos$/);
  await page.getByRole('button', { name: 'Empezar práctica' }).click();
  const rs = await playUntil(page, lessonResultVisible(page), {});
  log.push(`l-saludos: ${rs.rounds} rondas ${rs.games.join('/')}`);
  await expect(page.getByRole('heading', { name: '¡Lección completada!' })).toBeVisible();
  // Práctica (gramática)
  await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'Práctica' }).click();
  const sel = page.locator('section[aria-labelledby="grammar-free"] select');
  const enabled: Record<string, boolean> = {};
  for (const g of ['syntax', 'particles', 'conjugation', 'dialogues', 'mini-reading', 'numbers', 'clock', 'calendar']) {
    await sel.selectOption(g);
    enabled[g] = await page.getByRole('button', { name: 'Practicar gramática' }).isEnabled();
  }
  log.push(`gramática habilitada tras l-saludos: ${JSON.stringify(enabled)}`);
  await sel.selectOption('dialogues');
  await page.getByRole('button', { name: 'Practicar gramática' }).click();
  for (let i = 0; i < 4; i++) {
    const g = await currentGame(page);
    if (g) await answerRound(page, g);
  }
  await shot(page, info, 'q3-journey-practica-dialogos');
  await page.getByRole('button', { name: 'Terminar' }).click();
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible();
  // Conjugation/numbers right after l-saludos: what does free practice show?
  for (const g of ['conjugation', 'numbers']) {
    await page.goto('/practica');
    await page.locator('section[aria-labelledby="grammar-free"] select').selectOption(g);
    if (!(await page.getByRole('button', { name: 'Practicar gramática' }).isEnabled())) continue;
    await page.getByRole('button', { name: 'Practicar gramática' }).click();
    await page.waitForTimeout(800);
    log.push(`práctica ${g} tras l-saludos: ${(await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 220)}`);
    await shot(page, info, `q3-journey-practica-${g}`);
  }
  // /repaso
  await page.goto('/repaso');
  await page.waitForTimeout(500);
  log.push(`repaso: ${(await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 200)}`);
  await shot(page, info, 'q3-journey-repaso');
  // /memoria/aprendiz
  await page.goto('/');
  await page.getByTestId('srs-Aprendiz').getByRole('link').click();
  await expect(page).toHaveURL(/\/memoria\/aprendiz$/);
  await expect(page.getByTestId('memory-row').first()).toBeVisible();
  const rows = await page.getByTestId('memory-row').count();
  log.push(`memoria/aprendiz: ${rows} filas`);
  await shot(page, info, 'q3-journey-memoria-aprendiz');
  // Ajustes: kana input modes and export / import
  await page.goto('/ajustes');
  const mode = page.getByRole('combobox', { name: 'Escritura de kana' });
  const modes = await mode.locator('option').allInnerTexts();
  log.push(`modos de escritura: ${modes.join(' | ')}`);
  for (const v of await mode.locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value))) {
    await mode.selectOption(v);
    expect((await readProgress(page))!.settings).toMatchObject({ kanaInput: v });
  }
  const before = (await readProgress(page))!;
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar progreso' }).click()]);
  const file = await download.path();
  const exported = JSON.parse(fs.readFileSync(file, 'utf8'));
  await page.getByRole('button', { name: 'Reiniciar progreso' }).tap();
  await page.getByRole('button', { name: 'Sí, borrar todo' }).tap();
  await page.getByTestId('import-file').setInputFiles(file);
  await expect(page.getByText('Progreso importado correctamente.')).toBeVisible();
  const after = (await readProgress(page))!;
  log.push(`export ${download.suggestedFilename()} xp=${exported.xp}; tras importar xp=${after.xp}, lecciones=${after.completedLessons.length}`);
  expect(after.xp).toBe(before.xp);
  expect(after.completedLessons).toEqual(before.completedLessons);
  await shot(page, info, 'q3-journey-ajustes', true);
  measure(info, 'q3 journey', log);
  console.log(`[q3 journey]\n${log.join('\n')}`);
});

// QA-051: the «Escritura de kana» select (long option «Automático (teclado de kana en móvil, romaji en escritorio)») is
// 463 px wide, so Ajustes scrolled horizontally on every phone. Fixed: shorter label + select max-width.
test('QA-051: Ajustes no tiene scroll horizontal a 360 px', async ({ page, consoleLog }, info) => {
  void consoleLog;
  await page.setViewportSize(SMALL);
  await page.goto('/ajustes');
  await expect(page.getByRole('combobox', { name: 'Escritura de kana' })).toBeVisible();
  const m = await page.evaluate(() => ({ vw: document.documentElement.clientWidth, scrollW: document.documentElement.scrollWidth, inner: innerWidth }));
  measure(info, 'QA-051 ajustes', m);
  expect(m.scrollW).toBeLessThanOrEqual(m.vw);
  expect(m.inner).toBeLessThanOrEqual(360);
});
