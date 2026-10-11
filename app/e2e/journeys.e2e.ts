/* Q2 — functional journeys Parte 1 did not reach: unified review, katakana k-a with ー, kanji furigana settings,
 * export -> reset -> import, save-failure banner. Desktop Chromium (no Japanese voice). */
import fs from 'node:fs';
import { test, expect } from './support/fixtures';
import { curriculum, lessonsUpTo } from './support/content';
import { answerRound, currentGame, lessonResultVisible } from './support/solver';
import { buildProgress, dueItem, readProgress, seed, STORAGE_KEY } from './support/state';
import { measure } from './support/flow';
import { shot } from './support/mobile';

test('repaso unificado: todos los grupos, y los ítems generados vencidos se preguntan exactamente (QA-005)', async ({ page, consoleLog }, info) => {
  void consoleLog;
  const due = [
    dueItem('kana', 'あ'), dueItem('kana', 'ア'),
    dueItem('word', 'akai'),
    dueItem('kanji', '一'),
    dueItem('pattern', 'svo-masu:0'),
    dueItem('pattern', 'particle:svo-masu:0'),
    dueItem('word', 'verb:taberu:masu'),
    dueItem('word', 'number:4173'),
    dueItem('word', 'time:7:30'),
    dueItem('word', 'date:3:14'),
    dueItem('dialogue', 'dialogue:saludos-manana:1'),
  ];
  await seed(page, buildProgress({ completed: lessonsUpTo('kanji-3', true), items: due }), '/');
  await expect(page.getByTestId('due-total')).toHaveText(String(due.length));
  await page.getByRole('link', { name: /Repasar ahora/ }).click();
  const plan = (await page.locator('section[aria-labelledby="review-plan"]').innerText()).replace(/\s+/g, ' ');
  await page.getByRole('button', { name: 'Empezar repaso' }).click();
  const seen: string[] = [];
  for (let i = 0; i < 80; i++) {
    if (await page.getByRole('heading', { name: /Repaso terminado/ }).count()) break;
    const g = await currentGame(page);
    if (!g) { await page.waitForTimeout(100); continue; }
    await expect(page.getByTestId('loading')).toHaveCount(0);
    seen.push(`${g}: ${(await page.locator('main section:visible').first().innerText()).replace(/\s+/g, ' ').slice(0, 90)}`);
    await answerRound(page, g);
  }
  await expect(page.getByRole('heading', { name: 'Repaso terminado' })).toBeVisible();
  const summary = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
  const p = (await readProgress(page))!;
  const now = Date.now();
  const stillDue = due.filter((d) => p.items[`${d.kind}:${d.itemId}`]!.nextDue <= now).map((d) => d.itemId);
  const extraGenerated = Object.keys(p.items).filter((k) => /^word:(number|time|date|counter):/.test(k) && !due.some((d) => `${d.kind}:${d.itemId}` === k));
  measure(info, 'repaso', { plan, rounds: seen.length, seen, stillDue, extraGenerated, summary: summary.slice(0, 300) });
  await shot(page, info, 'review-summary');
  expect(stillDue).toEqual([]);
  expect(extraGenerated).toEqual([]);
  expect(seen.some((s) => s.includes('4173') || s.includes('よんせんひゃくななじゅうさん'))).toBe(true);
  await page.goto('/');
  await expect(page.getByTestId('due-total')).toHaveText('0');
});

for (const kanaInput of ['romaji', 'teclado'] as const) {
  test(`katakana k-a con ー: lección completa escribiendo con ${kanaInput === 'romaji' ? 'el IME romaji' : 'el teclado kana en pantalla'}`, async ({ page, consoleLog }, info) => {
    void consoleLog;
    const lesson = curriculum.find((l) => l.id === 'k-a')!;
    await seed(page, buildProgress({ completed: lessonsUpTo('k-a'), settings: { kanaInput } as never }), '/leccion/k-a');
    await page.getByRole('button', { name: 'Empezar práctica' }).click();
    const typed: string[] = [];
    const done = lessonResultVisible(page);
    for (let i = 0; i < 300 && !(await done()); i++) {
      const g = await currentGame(page);
      if (!g) { await page.waitForTimeout(100); continue; }
      if (g === 'Escribir kana' && (await page.getByTestId('romaji').count())) typed.push((await page.getByTestId('romaji').innerText()).trim());
      await answerRound(page, g, { lessonKana: lesson.kana });
    }
    await expect(page.getByRole('heading', { name: '¡Lección completada!' })).toBeVisible();
    measure(info, `k-a ${kanaInput}`, { promptsEscribirKana: typed });
    expect(typed.length).toBeGreaterThan(0);
  });
}

test('teclado kana: ー, ゛, 小 y cambio a katakana producen コーヒー / ジュース / チョコ', async ({ page, consoleLog }, info) => {
  void consoleLog;
  await seed(page, buildProgress({ completed: lessonsUpTo('k-repaso'), settings: { kanaInput: 'teclado' } as never }), '/practica');
  await page.getByRole('combobox', { name: 'Juego:' }).selectOption('kana-write');
  await page.getByRole('button', { name: 'Empezar' }).click();
  const input = page.locator('main form input');
  await input.click();
  const kb = page.getByRole('group', { name: 'Teclado de kana' });
  const tap = (n: string) => kb.getByRole('button', { name: n, exact: true }).click();
  await tap('Cambiar a katakana');
  await tap('Fila カ'); await tap('コ'); await tap('Alargamiento ー'); await tap('Fila ハ'); await tap('ヒ'); await tap('Alargamiento ー');
  await expect(input).toHaveValue('コーヒー');
  await tap('Borrar todo');
  await tap('Fila サ'); await tap('シ'); await tap('Dakuten (゛) en el último kana'); await tap('Fila ヤ'); await tap('ユ'); await tap('Kana pequeño (ゃゅょっぁ) en el último');
  await tap('Alargamiento ー'); await tap('Fila サ'); await tap('ス');
  await expect(input).toHaveValue('ジュース');
  await page.keyboard.press('Backspace');
  await expect(input).toHaveValue('ジュー');
  measure(info, 'kana keyboard', 'コーヒー / ジュース / Backspace físico OK');
});

test('kanji: furigana automático (Aprendiz con ruby, Guru sin ruby), «siempre» y «nunca»', async ({ page, consoleLog }, info) => {
  void consoleLog;
  const completed = lessonsUpTo('kanji-3', true);
  const word = dueItem('word', 'ichi');
  const check = async (stage: number, furigana: 'auto' | 'siempre' | 'nunca') => {
    await seed(page, buildProgress({ completed, kanjiStage: stage, items: [{ ...word, srsStage: 5, nextDue: Date.now() + 9e8 }], settings: { furigana } }), '/memoria/guru');
    const row = page.getByTestId('memory-row').filter({ hasText: 'Palabra' }).first();
    await expect(row).toContainText('一');
    return row.locator('ruby').count();
  };
  const r = { autoAprendiz: await check(1, 'auto'), autoGuru: await check(5, 'auto'), siempreGuru: await check(5, 'siempre'), nuncaAprendiz: await check(1, 'nunca') };
  measure(info, 'furigana (número de <ruby> en la fila de 一)', r);
  expect(r).toEqual({ autoAprendiz: 1, autoGuru: 0, siempreGuru: 1, nuncaAprendiz: 0 });
});

test('ajustes: exportar (nombre nihongo_dojo_backup_AAAA-MM-DD.json) → reiniciar → importar restaura el progreso', async ({ page, consoleLog }, info) => {
  void consoleLog;
  await seed(page, buildProgress({ completed: lessonsUpTo('h-ka', true), xp: 420 }), '/ajustes');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar progreso' }).click()]);
  const name = download.suggestedFilename();
  const file = await download.path();
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  await page.getByRole('button', { name: 'Reiniciar progreso' }).click();
  await page.getByRole('button', { name: 'Sí, borrar todo' }).click();
  await expect(page.getByText('Progreso reiniciado.')).toBeVisible();
  expect((await readProgress(page))?.xp ?? 0).toBe(0);
  await page.getByTestId('import-file').setInputFiles(file);
  await expect(page.getByText('Progreso importado correctamente.')).toBeVisible();
  const p = (await readProgress(page))!;
  // invalid file -> Spanish error
  await page.getByTestId('import-file').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{nope') });
  await expect(page.getByText('El archivo no es un JSON válido.')).toBeVisible();
  measure(info, 'export/import', { name, xpExported: json.xp, xpAfterImport: p.xp, completed: p.completedLessons });
  expect(name).toMatch(/^nihongo_dojo_backup_\d{4}-\d{2}-\d{2}\.json$/);
  const d = new Date();
  expect(name).toBe(`nihongo_dojo_backup_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`);
  expect(p.xp).toBe(420);
  expect(p.completedLessons).toEqual(expect.arrayContaining(['h-a', 'h-ka']));
  await page.goto('/');
  await expect(page.getByTestId('xp-text')).toContainText('420 en total');
});

test('guardado fallido: localStorage.setItem lanza → banner visible con enlace a Ajustes', async ({ page, consoleLog }, info) => {
  void consoleLog;
  await seed(page, buildProgress({ completed: ['h-a'] }), '/acerca-de');
  await page.addInitScript((key) => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k: string, v: string) {
      if (k === key) throw new DOMException('QuotaExceededError', 'QuotaExceededError');
      return orig.call(this, k, v);
    };
  }, STORAGE_KEY);
  await page.goto('/practica');
  await page.getByRole('button', { name: 'Empezar' }).click();
  await answerRound(page, 'Reconocer kana');
  const banner = page.getByTestId('save-banner');
  await expect(banner).toBeVisible();
  await expect(banner.getByRole('link', { name: 'Ajustes' })).toBeVisible();
  measure(info, 'save banner', (await banner.innerText()).replace(/\s+/g, ' '));
  await shot(page, info, 'save-banner');
});

test.use({ allowConsole: [[/no se pudo guardar el progreso/], { scope: 'test' }] as never });
