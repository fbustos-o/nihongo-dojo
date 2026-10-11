/* Q2 helpers: reach a given game inside a lesson, record measurements as test annotations. */
import type { Page, TestInfo } from '@playwright/test';
import { lessonsUpTo } from './content';
import { answerRound, currentGame, type GameName } from './solver';
import { buildProgress, seed, type ProgressOptions } from './state';

/** Seeds the lesson's prerequisites, opens it and plays (correctly) until `game` is on screen. */
export async function openLessonGame(page: Page, lessonId: string, game: GameName | null, o: ProgressOptions = {}): Promise<void> {
  await seed(page, buildProgress({ completed: lessonsUpTo(lessonId), ...o }), `/leccion/${lessonId}`);
  await page.getByRole('button', { name: 'Empezar práctica' }).click();
  if (!game) return;
  for (let i = 0; i < 200; i++) {
    const g = await currentGame(page);
    if (g === game) {
      await page.getByTestId('loading').waitFor({ state: 'detached' }).catch(() => undefined);
      return;
    }
    if (!g) {
      await page.waitForTimeout(100);
      continue;
    }
    await answerRound(page, g);
  }
  throw new Error(`openLessonGame: ${game} not reached in ${lessonId}`);
}

/** Records a measurement in the HTML report and on stdout (the report tables in QA_REPORT.md come from these). */
export function measure(info: TestInfo, what: string, value: unknown): void {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  info.annotations.push({ type: 'measure', description: `${what}: ${text}` });
  console.log(`[measure][${info.project.name}] ${what}: ${text}`);
}
