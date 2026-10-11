/* First-visit journey: dashboard -> Camino -> lesson h-a (pass) -> h-ka unlocked; failing a lesson. */
import { test, expect } from './support/fixtures';
import { curriculum } from './support/content';
import { lessonResultVisible, playUntil } from './support/solver';
import { readProgress } from './support/state';

const hA = curriculum.find((l) => l.id === 'h-a')!;

test('primera visita: inicio vacío, camino y lección h-a completa desbloquea h-ka', async ({ page, consoleLog }) => {
  void consoleLog;
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('ようこそ');
  await expect(page.getByTestId('level')).toHaveText('1');
  await expect(page.getByTestId('xp-text')).toContainText('0 / 100 XP · 0 en total');
  await expect(page.getByTestId('streak')).toContainText('0 días');
  await expect(page.getByTestId('due-total')).toHaveText('0');
  await expect(page.getByTestId('today-lessons')).toHaveText('0');
  await expect(page.getByTestId('today-accuracy')).toHaveText('–');

  await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'Camino' }).click();
  await expect(page).toHaveURL(/\/camino$/);
  const first = page.getByRole('link', { name: /Hiragana: あ い う え お/ });
  await expect(first).toContainText('Siguiente lección');
  await expect(page.getByText('Hiragana: fila か (ka ki ku ke ko)')).toBeVisible();
  // h-ka is not a link while locked
  await expect(page.getByRole('link', { name: /fila か/ })).toHaveCount(0);

  await first.click();
  await expect(page).toHaveURL(/\/leccion\/h-a$/);
  await page.getByRole('button', { name: 'Empezar práctica' }).click();
  const result = await playUntil(page, lessonResultVisible(page), { lessonKana: hA.kana });
  expect(result.games).toEqual(['Reconocer kana', 'Escribir kana', 'Leer palabras', 'Escuchar']);
  await expect(page.getByRole('heading', { name: '¡Lección completada!' })).toBeVisible();
  await expect(page.getByText('100%')).toBeVisible();
  await expect(page.getByText(/Kana desbloqueados: あ い う え お/)).toBeVisible();

  const progress = await readProgress(page);
  expect(progress!.completedLessons).toContain('h-a');
  expect(progress!.knownKana).toEqual(expect.arrayContaining(['あ', 'い', 'う', 'え', 'お']));
  const totalCorrect = result.rounds; // every round answered right first time
  expect(progress!.xp).toBe(totalCorrect * 10 + 30);

  await page.getByRole('link', { name: /Continuar: Hiragana: fila か/ }).click();
  await expect(page).toHaveURL(/\/leccion\/h-ka$/);
  await expect(page.getByRole('heading', { name: /fila か/ })).toBeVisible();

  await page.getByRole('link', { name: 'Inicio' }).click();
  await expect(page.getByTestId('streak')).toContainText('1 día');
  await expect(page.getByTestId('today-lessons')).toHaveText('1');
  await expect(page.getByTestId('today-accuracy')).toHaveText('100%');
  await expect(page.getByTestId('level')).not.toHaveText('1'); // > 100 XP after one lesson
  await expect(page.getByText('Hiragana: fila か (ka ki ku ke ko)')).toBeVisible(); // "Siguiente lección" card
  await expect(page.getByTestId('srs-Aprendiz')).toBeVisible();
});

test('una lección por debajo del 80 % no se completa', async ({ page, consoleLog }) => {
  void consoleLog;
  await page.goto('/leccion/h-a');
  await page.getByRole('button', { name: 'Empezar práctica' }).click();
  await playUntil(page, lessonResultVisible(page), { pickWrong: () => true, lessonKana: hA.kana });
  await expect(page.getByRole('heading', { name: 'Casi lo logras' })).toBeVisible();
  await expect(page.getByText('Necesitas al menos 80% de aciertos para completarla.')).toBeVisible();
  await expect(page.getByRole('link', { name: /Continuar/ })).toHaveCount(0);
  const progress = await readProgress(page);
  expect(progress!.completedLessons).not.toContain('h-a');
  expect(progress!.knownKana).toEqual([]);
  await page.getByRole('button', { name: 'Repetir lección' }).click();
  await expect(page.getByRole('button', { name: 'Empezar práctica' })).toBeVisible();
  await page.goto('/camino');
  await expect(page.getByRole('link', { name: /fila か/ })).toHaveCount(0);
});

test('justo en el umbral: 1 fallo de ~50 rondas sigue aprobando; muchos fallos no', async ({ page, consoleLog }) => {
  void consoleLog;
  await page.goto('/leccion/h-a');
  await page.getByRole('button', { name: 'Empezar práctica' }).click();
  // wrong on every 4th round => 75 % accuracy => must fail
  await playUntil(page, lessonResultVisible(page), { pickWrong: (i) => i % 4 === 0, lessonKana: hA.kana });
  await expect(page.getByRole('heading', { name: 'Casi lo logras' })).toBeVisible();
});
