/* Pedagogical invariant in the live UI: no kana the learner has not unlocked (besides the lesson's own). */
import { test, expect } from './support/fixtures';
import { curriculum, lessonsUpTo } from './support/content';
import { currentGame, answerRound, lessonResultVisible } from './support/solver';
import { buildProgress, seed } from './support/state';

const KANA_RE = /[ぁ-ゖァ-ヺ]/gu;

/** Kana visible in the game area (excluding the intro chart, inputs and the lesson title). */
async function visibleKana(page: import('@playwright/test').Page): Promise<string[]> {
  return page.locator('main').evaluate((main) => {
    const c = main.cloneNode(true) as HTMLElement;
    c.querySelectorAll('h1, [role="group"][aria-label="Tabla de filas"], input, [class*="_romaji_"], rt').forEach((n) => n.remove());
    return [...new Set((c.innerText.match(/[ぁ-ゖァ-ヺ]/gu) ?? []))];
  });
}

async function collectLessonKana(page: import('@playwright/test').Page, lessonId: string) {
  const lesson = curriculum.find((l) => l.id === lessonId)!;
  const done = lessonsUpTo(lessonId);
  await seed(page, buildProgress({ completed: done }), `/leccion/${lessonId}`);
  const allowed = new Set([...curriculum.filter((l) => done.includes(l.id)).flatMap((l) => l.kana ?? []), ...(lesson.kana ?? [])].flatMap((k) => [...k]));
  await page.getByRole('button', { name: 'Empezar práctica' }).click();
  const seen = new Map<string, string>();
  const done_ = lessonResultVisible(page);
  for (let i = 0; i < 300 && !(await done_()); i++) {
    const game = await currentGame(page);
    if (!game) continue;
    for (const k of await visibleKana(page)) if (!allowed.has(k) && !seen.has(k)) seen.set(k, game);
    await answerRound(page, game);
  }
  return [...seen].map(([k, game]) => `${k} (${game})`);
}

test('h-a: los distractores de «Escuchar» no muestran kana sin desbloquear (QA-003)', async ({ page, consoleLog }) => {
  test.fail(true, 'QA-003: Listen usa kanaChoices sobre todos los kana (か, き, く… en la lección de あいうえお)');
  void consoleLog;
  // run the lesson twice to make the random distractors show up
  const leaks = [...(await collectLessonKana(page, 'h-a')), ...(await collectLessonKana(page, 'h-a'))];
  expect(leaks).toEqual([]);
});

test('h-yoon-1: las palabras con yōon se ven en kana, no mezcladas con romaji (QA-001)', async ({ page, consoleLog }) => {
  test.fail(true, 'QA-001: renderKana no reconoce los dígrafos desbloqueados (きゃ) y muestra «きyaく»');
  void consoleLog;
  const done = lessonsUpTo('h-tsu-long', true);
  await seed(page, buildProgress({ completed: done }), '/practica');
  await page.getByRole('combobox', { name: 'Juego:' }).selectOption('read-words');
  await page.getByRole('checkbox', { name: 'Yōon (hiragana)' }).check();
  await page.getByRole('button', { name: 'Empezar' }).click();
  const prompts: string[] = [];
  for (let i = 0; i < 30; i++) {
    prompts.push(await page.getByTestId('word-prompt').innerText());
    await answerRound(page, 'Leer palabras').catch(() => page.getByRole('button', { name: 'Terminar' }).click());
    if (await page.getByRole('heading', { name: 'Resumen' }).count()) break;
  }
  const mixed = prompts.filter((p) => /[a-z]/.test(p));
  expect(mixed).toEqual([]);
});

test('etapa 2 (l-verbos-1): la retroalimentación no muestra katakana antes de la etapa 3 (QA-008)', async ({ page, consoleLog }) => {
  test.fail(true, 'QA-008: «¡Correcto! コーヒー = café» usa word.kana sin JaText');
  void consoleLog;
  const leaks = [...(await collectLessonKana(page, 'l-kore')), ...(await collectLessonKana(page, 'l-verbos-1'))];
  expect(leaks.filter((l) => /[ァ-ヺ]/u.test(l))).toEqual([]);
});

test("h-ka … h-wa-n: ninguna lección de hiragana filtra kana posteriores (salvo «Escuchar» y glosas con partículas, QA-003/QA-031)", async ({ page, consoleLog }) => {
  void consoleLog;
  const leaks: string[] = [];
  for (const id of ['h-ka', 'h-sa', 'h-ta', 'h-wa-n']) leaks.push(...(await collectLessonKana(page, id)).map((l) => `${id}: ${l}`));
  // Known leaks reported separately: Listen distractors (QA-003) and Japanese particles inside Spanish glosses
  // shown by «Escribir kana» / «Leer palabras» (QA-031, e.g. «preguntar (persona に)» in h-ta).
  expect(leaks.filter((l) => !l.endsWith('(Escuchar)') && !/: [にがへを] \(Escribir kana\)$/u.test(l))).toEqual([]);
  void KANA_RE;
});
