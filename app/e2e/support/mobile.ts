/* Q2 helpers: speech stub, layout measurements and screenshots for the mobile acceptance tests. */
import fs from 'node:fs';
import path from 'node:path';
import type { Locator, Page, TestInfo } from '@playwright/test';

/** Where evidence screenshots go (scratchpad by default; override with QA_SHOTS). */
export const SHOTS = process.env.QA_SHOTS ?? path.resolve(process.cwd(), 'test-results/q2-shots');

export async function shot(page: Page, info: TestInfo, name: string, fullPage = false): Promise<string> {
  fs.mkdirSync(SHOTS, { recursive: true });
  const file = path.join(SHOTS, `${info.project.name}-${name}.png`);
  await page.screenshot({ path: file, fullPage });
  return file;
}

/**
 * Headless Chromium has speechSynthesis but no Japanese voice. `voice: true` installs a fake ja-JP voice that records what
 * is spoken in `window.__spoken`; `voice: false` removes speechSynthesis entirely (static-clip fallback path).
 */
export async function stubSpeech(page: Page, voice: boolean): Promise<void> {
  await page.addInitScript((withVoice) => {
    const w = window as unknown as { __spoken: string[] };
    w.__spoken = [];
    if (!withVoice) {
      Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true });
      // 'speechSynthesis' in window must be false
      delete (window as unknown as Record<string, unknown>).speechSynthesis;
      return;
    }
    const v = { lang: 'ja-JP', name: 'QA ja', voiceURI: 'qa-ja', localService: true, default: false };
    const synth = {
      getVoices: () => [v],
      speak: (u: { text: string }) => w.__spoken.push(u.text),
      cancel: () => undefined,
      pause: () => undefined,
      resume: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      speaking: false,
      pending: false,
      paused: false,
    };
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
    (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = class {
      text: string;
      constructor(t: string) {
        this.text = t;
      }
    };
  }, voice);
}

export const spoken = (page: Page): Promise<string[]> => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken.slice());
export const clearSpoken = (page: Page): Promise<void> => page.evaluate(() => void ((window as unknown as { __spoken: string[] }).__spoken.length = 0));

export interface Box { top: number; bottom: number; left: number; right: number; width: number; height: number }

export async function box(loc: Locator): Promise<Box> {
  return loc.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), height: Math.round(r.height) };
  });
}

/** Visible fold: the viewport height minus the fixed bottom tab bar (when it is shown) and the kana keyboard. */
export async function fold(page: Page): Promise<{ viewport: number; navTop: number | null; kbTop: number | null; fold: number }> {
  return page.evaluate(() => {
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const nav = document.querySelector('nav[aria-label="Navegación principal"]') as HTMLElement | null;
    const navStyle = nav ? getComputedStyle(nav) : null;
    const navTop = nav && !nav.hidden && navStyle?.position === 'fixed' && navStyle.display !== 'none' ? Math.round(nav.getBoundingClientRect().top) : null;
    const kb = document.querySelector('[role="group"][aria-label="Teclado de kana"]') as HTMLElement | null;
    const kbTop = kb ? Math.round(kb.getBoundingClientRect().top) : null;
    return { viewport: Math.round(vh), navTop, kbTop, fold: Math.min(Math.round(vh), navTop ?? Infinity, kbTop ?? Infinity) };
  });
}

/** Lowest bottom edge among the elements (in viewport coordinates, without scrolling). */
export async function lowest(loc: Locator): Promise<number> {
  const all = await loc.all();
  let max = -Infinity;
  for (const l of all) max = Math.max(max, (await box(l)).bottom);
  return max;
}
