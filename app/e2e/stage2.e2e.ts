/* Q2 — every stage-2 lesson end to end (desktop, no Japanese voice: text fallbacks), with a readability metric:
 * Japanese strings that JaText shows half in kana and half in romaji («かban», «deす») because M3 opens the lesson
 * before the learner knows those kana. */
import type { Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { curriculum, lessonsUpTo } from './support/content';
import { answerRound, currentGame, lessonResultVisible, type GameName } from './support/solver';
import { buildProgress, readProgress, seed } from './support/state';
import { measure } from './support/flow';

/** JaText nodes on screen that mix kana and romaji fallback segments. */
async function mixedSamples(page: Page): Promise<string[]> {
  return page.locator('main').evaluate((main) => {
    const out: string[] = [];
    main.querySelectorAll('span[lang="ja"][class*="_ja_"]').forEach((el) => {
      const hasRomaji = el.querySelector('[class*="_romaji_"]');
      const text = el.textContent ?? '';
      if (hasRomaji && /[ぁ-ゖァ-ヺ]/u.test(text)) out.push(text);
    });
    return out;
  });
}

const lessons = curriculum.filter((l) => l.stage === 2);

for (const lesson of lessons) {
  test(`etapa 2 de punta a punta: ${lesson.id} (${lesson.title})`, async ({ page, consoleLog }, info) => {
    void consoleLog;
    await seed(page, buildProgress({ completed: lessonsUpTo(lesson.id) }), `/leccion/${lesson.id}`);
    await page.getByRole('button', { name: 'Empezar práctica' }).click();
    const games: GameName[] = [];
    const mixed = new Set<string>();
    const done = lessonResultVisible(page);
    let rounds = 0;
    for (; rounds < 400 && !(await done()); rounds++) {
      const g = await currentGame(page);
      if (!g) {
        await page.waitForTimeout(100);
        continue;
      }
      if (games.at(-1) !== g) games.push(g);
      for (const m of await mixedSamples(page)) mixed.add(m);
      await answerRound(page, g);
    }
    await expect(page.getByRole('heading', { name: '¡Lección completada!' })).toBeVisible();
    const p = await readProgress(page);
    expect(p!.completedLessons).toContain(lesson.id);
    measure(info, `stage2 ${lesson.id}`, { games, rounds, knownKana: p!.knownKana.length, mixedCount: mixed.size, mixed: [...mixed].slice(0, 12) });
  });
}
