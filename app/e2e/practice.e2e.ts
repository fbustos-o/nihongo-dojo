/* Free practice with the kana games (Práctica). */
import { test, expect } from './support/fixtures';
import { answerRound, type GameName } from './support/solver';
import { buildProgress, readProgress, seed } from './support/state';

const GAMES: [string, GameName][] = [
  ['kana-recognize', 'Reconocer kana'],
  ['kana-write', 'Escribir kana'],
  ['listen', 'Escuchar'],
  ['read-words', 'Leer palabras'],
];

for (const [id, name] of GAMES) {
  test(`práctica libre: ${name} (fila あ), 8 rondas y «Terminar»`, async ({ page, consoleLog }) => {
    void consoleLog;
    // the learner already passed h-a, so the words of the row are shown in kana
    await seed(page, buildProgress({ completed: ['h-a'] }), '/practica');
    await page.getByRole('combobox', { name: 'Juego:' }).selectOption(id);
    // only the あ row: unselect all basics, then pick あ
    await page.getByRole('checkbox', { name: 'Básicos (hiragana)' }).uncheck();
    await page.getByRole('button', { name: 'あ', exact: true }).first().click();
    await expect(page.getByText('5 kana seleccionados')).toBeVisible();
    await page.getByRole('button', { name: 'Empezar' }).click();
    await expect(page.getByText(`${name} · 5 kana`)).toBeVisible();
    for (let i = 0; i < 8; i++) {
      await answerRound(page, name);
      await expect(page.getByText(`Práctica libre · ${i + 1} respondidas`)).toBeVisible();
    }
    await page.getByRole('button', { name: 'Terminar' }).click();
    await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible();
    await expect(page.getByText(/Aciertos: 8 de 8/)).toBeVisible();
  });
}

test('práctica sin filas seleccionadas no se puede empezar', async ({ page, consoleLog }) => {
  void consoleLog;
  await page.goto('/practica');
  await page.getByRole('checkbox', { name: 'Básicos (hiragana)' }).uncheck();
  await expect(page.getByRole('button', { name: 'Empezar' })).toBeDisabled();
  await expect(page.getByText('Elige al menos una fila.')).toBeVisible();
});

// QA-002: every answer moves the SRS stage, even when the item is not due. 45 correct answers in a few
// minutes of free practice burn the five kana (stage 9 = "Quemado", never reviewed again).
test('SRS: practicar sin parar no debería quemar ítems que no tocaba repasar (QA-002)', async ({ page, consoleLog }) => {
  void consoleLog;
  await page.goto('/practica');
  await page.getByRole('checkbox', { name: 'Básicos (hiragana)' }).uncheck();
  await page.getByRole('button', { name: 'あ', exact: true }).first().click();
  await page.getByRole('button', { name: 'Empezar' }).click();
  for (let i = 0; i < 45; i++) await answerRound(page, 'Reconocer kana');
  await page.getByRole('button', { name: 'Terminar' }).click();
  const progress = await readProgress(page);
  const stages = Object.values(progress!.items).map((it) => it.srsStage);
  // Expected: at most Aprendiz (answers given before the item is due should not climb several stages in one sitting)
  expect(Math.max(...stages)).toBeLessThanOrEqual(4);
});

// QA-016: free practice of a row that is not unlocked yet shows the words in romaji (no ExtraKanaContext), so
// «Leer palabras» asks to type the romaji of a word shown in romaji.
test('práctica libre de una fila no desbloqueada: las palabras se muestran en kana (QA-016)', async ({ page, consoleLog }) => {
  test.fail(true, 'QA-016: PracticePage no envuelve el juego en ExtraKanaContext');
  void consoleLog;
  await page.goto('/practica');
  await page.getByRole('combobox', { name: 'Juego:' }).selectOption('read-words');
  await page.getByRole('checkbox', { name: 'Básicos (hiragana)' }).uncheck();
  await page.getByRole('button', { name: 'あ', exact: true }).first().click();
  await page.getByRole('button', { name: 'Empezar' }).click();
  await expect(page.getByTestId('word-prompt')).not.toHaveText(/[a-z]/);
});
