/* Generic game solver for the e2e journeys (QA E8): reads the round from the DOM and answers it from the
 * content JSON + the app's own engines. `wrong: true` answers wrong first (then fixes it to move on). */
import { expect, type Locator, type Page } from '@playwright/test';
import {
  conjugationAnswer, dialogues, kana, kanji, meaningText, norm, numberFromKana, patterns, readCounter, readDate, readDayOfWeek,
  readNumber, readPrice, readTime, shiftDay, SPANISH_MONTHS, SPANISH_WEEKDAYS, timeFromKana, vocab, weekdayOf, type KanaEntry, type Word,
} from './content';

export type GameName =
  | 'Reconocer kana' | 'Escribir kana' | 'Leer palabras' | 'Escuchar' | 'Sintaxis' | 'Partículas' | 'Conjugación'
  | 'Números y precios' | 'Reloj' | 'Calendario' | 'Diálogos' | 'Mini-lectura' | 'Kanji';

export interface SolveOptions {
  wrong?: boolean;
  /** Kana of the lesson (disambiguates ji/zu/o in "Escribir kana"). */
  lessonKana?: string[];
}

/** Text of a JaText / ruby node without the furigana. */
export const jaText = (loc: Locator): Promise<string> =>
  loc.evaluate((el) => {
    const c = el.cloneNode(true) as HTMLElement;
    c.querySelectorAll('rt').forEach((r) => r.remove());
    return c.textContent ?? '';
  });

const tokenize = (ja: string): string[] => ja.replace(/[。？！?!]+$/u, '').split(/\s+/u).filter(Boolean);
const romajiLabel = (k: KanaEntry): string => (k.char === 'ー' ? '- (vocal larga)' : k.char === 'ッ' || k.char === 'っ' ? 'xtsu (pausa)' : k.romaji);
const otherScript = (s: string): string =>
  [...s].map((c) => { const code = c.codePointAt(0)!; return code >= 0x3041 && code <= 0x3096 ? String.fromCodePoint(code + 0x60) : code >= 0x30a1 && code <= 0x30f6 ? String.fromCodePoint(code - 0x60) : c; }).join('');
const examples = patterns.flatMap((p) => (p.examples ?? []).map((e, i) => ({ ...e, id: `${p.id}:${i}` })));

/** Name of the game being played (lesson label, review label or practice label). */
export async function currentGame(page: Page): Promise<GameName | null> {
  const main = page.locator('main');
  const lessonLabel = main.locator('p.muted', { hasText: /^Juego \d+ de \d+:/ }).locator('strong');
  if (await lessonLabel.count()) return (await lessonLabel.first().textContent()) as GameName;
  const reviewLabel = main.getByTestId('review-step').locator('strong');
  if (await reviewLabel.count()) return (await reviewLabel.first().textContent()) as GameName;
  const practice = main.locator('p.muted', { hasText: / · \d+ (kana|kanji)$/ });
  if (await practice.count()) return ((await practice.first().textContent()) ?? '').split(' · ')[0] as GameName;
  return null;
}

async function choose(page: Page, buttons: Locator, isRight: (text: string, b: Locator) => Promise<boolean> | boolean, wrong: boolean): Promise<void> {
  const n = await buttons.count();
  let right: Locator | null = null;
  let bad: Locator | null = null;
  for (let i = 0; i < n; i++) {
    const b = buttons.nth(i);
    if (await b.isDisabled()) continue;
    const text = (await jaText(b)).trim();
    if (await isRight(text, b)) right ??= b;
    else bad ??= b;
  }
  if (!right) throw new Error(`solver: no correct option among ${n} buttons: ${(await buttons.allTextContents()).join(' | ')}`);
  if (wrong && bad) await bad.click();
  await right.click();
}

async function type(input: Locator, answer: string, wrong: boolean): Promise<void> {
  if (wrong) {
    await input.fill('zzzq');
    await input.press('Enter');
    await expect(input.page().getByTestId('correct-answer')).toBeVisible();
    input = input.page().locator('main form input');
  }
  await input.fill(answer);
  await input.press('Enter');
}

const choiceButtons = (main: Locator) => main.locator('[class*="_choices_"] button');

/** Answers the current round of `game`. Returns false when nothing answerable is on screen. */
export async function answerRound(page: Page, game: GameName, o: SolveOptions = {}): Promise<boolean> {
  const main = page.locator('main');
  const wrong = !!o.wrong;
  const formInput = main.locator('form input');

  switch (game) {
    case 'Reconocer kana': {
      const prompt = main.getByTestId('prompt');
      const shown = (await prompt.locator('span[lang="ja"]').first().textContent())!.trim();
      if (await prompt.getByTestId('script-pair-hint').count()) {
        const target = otherScript(shown);
        await choose(page, choiceButtons(main), (t) => t === target, wrong);
        return true;
      }
      const entry = kana.find((k) => k.char === shown)!;
      if (await choiceButtons(main).count()) await choose(page, choiceButtons(main), (t) => t === romajiLabel(entry), wrong);
      else await type(formInput, entry.romaji === '-' ? '-' : entry.romaji, wrong);
      return true;
    }
    case 'Escribir kana': {
      const r = (await main.getByTestId('romaji').textContent())!.trim();
      const hint = main.getByTestId('prompt').locator('[class*="_hint_"]').first();
      const hintText = (await hint.count()) ? ((await hint.textContent()) ?? '') : '';
      const word = vocab.find((w) => w.romaji === r && w.es.join(', ') === hintText);
      let answer: string;
      if (word) answer = word.kana;
      else {
        const cands = kana.filter((k) => k.romaji === r);
        answer = (cands.find((k) => o.lessonKana?.includes(k.char)) ?? cands[0])!.char;
      }
      await type(formInput, answer, wrong);
      return true;
    }
    case 'Leer palabras': {
      const t = norm(await jaText(main.getByTestId('word-prompt')));
      const cands = vocab.filter((w) => norm(w.kana) === t || (w.kanji && norm(w.kanji) === t) || w.romaji === t);
      if (cands.length === 0) throw new Error(`solver: unknown word "${t}"`);
      if (await formInput.count()) await type(formInput, cands[0]!.romaji, wrong);
      else await choose(page, choiceButtons(main), (txt) => cands.some((w) => w.es[0] === txt), wrong);
      return true;
    }
    case 'Escuchar': {
      const r = (await main.getByTestId('romaji').textContent())!.trim();
      const words = vocab.filter((w) => w.romaji === r);
      const kanaCands = kana.filter((k) => k.romaji === r).map((k) => k.char);
      await choose(page, choiceButtons(main), (txt) => kanaCands.includes(txt) || words.some((w) => norm(w.kana) === norm(txt) || norm(w.kanji ?? '-') === norm(txt) || w.romaji === txt), wrong);
      return true;
    }
    case 'Sintaxis': {
      const next = main.getByRole('button', { name: 'Siguiente' });
      if (await next.count()) { await next.click(); return true; }
      const es = (await main.getByTestId('prompt').textContent())!.trim();
      const bank = main.getByRole('group', { name: 'Fichas disponibles' }).getByRole('button');
      const texts = (await Promise.all((await bank.all()).map((b) => jaText(b)))).map(norm);
      const ex = examples.filter((e) => e.es === es).find((e) => tokenize(e.ja).every((tk) => texts.includes(norm(tk))));
      if (!ex) throw new Error(`solver: no example for "${es}"`);
      const tokens = tokenize(ex.ja);
      const order = wrong ? [...tokens].reverse() : tokens;
      for (const tk of order) {
        const n = await bank.count();
        for (let i = 0; i < n; i++) {
          const b = bank.nth(i);
          if (!(await b.isDisabled()) && norm(await jaText(b)) === norm(tk)) { await b.click(); break; }
        }
      }
      await main.getByRole('button', { name: 'Comprobar' }).click();
      return true;
    }
    case 'Partículas': {
      const next = main.getByRole('button', { name: 'Siguiente' });
      if (await next.count()) { await next.click(); return true; }
      const prompt = main.getByTestId('prompt');
      const es = (await prompt.locator('[class*="_hint_"]').first().textContent())!.trim();
      const spans = prompt.locator('[class*="_promptText_"] > span');
      const n = await spans.count();
      let at = -1;
      for (let i = 0; i < n; i++) if (await spans.nth(i).locator('[aria-label="hueco"]').count()) at = i;
      const ex = examples.find((e) => e.es === es && tokenize(e.ja).length === n);
      if (!ex || at < 0) throw new Error(`solver: particle example not found "${es}"`);
      const answer = tokenize(ex.ja)[at]!;
      await choose(page, choiceButtons(main), (t) => t === answer, wrong);
      return true;
    }
    case 'Conjugación': {
      const t = norm(await jaText(main.getByTestId('word-prompt')));
      const meaning = (await main.locator('[class*="_target_"]').first().textContent())!.trim();
      const label = (await main.getByTestId('form-label').textContent())!.trim();
      const w = vocab.find((x) => norm(x.kana) === t && (x.es[0] ?? x.romaji) === meaning && ['verb', 'i-adj', 'na-adj', 'noun'].includes(x.pos));
      if (!w) throw new Error(`solver: conjugation word "${t}" (${meaning})`);
      await type(formInput, conjugationAnswer(w, label), wrong);
      return true;
    }
    case 'Números y precios': {
      const digits = main.getByRole('textbox', { name: 'Número con cifras' });
      if (await digits.count()) {
        const k = (await main.locator('[class*="_kanaLine_"] span[lang="ja"]').first().textContent())!.trim();
        const n = numberFromKana(k);
        if (n === undefined) throw new Error(`solver: number for ${k}`);
        await type(digits, String(n), wrong);
        return true;
      }
      const big = (await main.locator('[class*="_big_"]').first().textContent())!.trim();
      let reading: string;
      let m: RegExpMatchArray | null;
      if (big.startsWith('¥')) reading = readPrice(Number(big.replace(/[¥,]/g, ''))).kana;
      else if (/^\d+$/.test(big)) reading = readNumber(Number(big)).kana;
      else if ((m = big.match(/^(\d+) cosas? \(con つ\)/))) reading = readCounter(Number(m[1]), 'tsu').kana;
      else if ((m = big.match(/^(\d+) personas?/))) reading = readCounter(Number(m[1]), 'nin').kana;
      else if ((m = big.match(/^piso (\d+)/))) reading = readCounter(Number(m[1]), 'kai').kana;
      else if ((m = big.match(/^(\d+) años? de edad/))) reading = readCounter(Number(m[1]), 'sai').kana;
      else throw new Error(`solver: numbers prompt "${big}"`);
      await readingAnswer(page, reading, wrong);
      return true;
    }
    case 'Reloj': {
      const set = main.getByTestId('set-time');
      if (await set.count()) {
        const k = (await main.getByTestId('prompt').locator('span[lang="ja"]').first().textContent())!.trim();
        const target = timeFromKana(k)!;
        const [h, m] = (await set.textContent())!.split(':').map(Number) as [number, number];
        if (wrong) { await main.getByRole('button', { name: 'Hora +' }).click(); await main.getByRole('button', { name: 'Comprobar' }).click(); await main.getByRole('button', { name: 'Hora −' }).click(); }
        for (let i = 0; i < (target.h - h + 12) % 12; i++) await main.getByRole('button', { name: 'Hora +' }).click();
        const dm = (target.m - m + 60) % 60;
        for (let i = 0; i < Math.floor(dm / 5); i++) await main.getByRole('button', { name: '5 min +' }).click();
        for (let i = 0; i < dm % 5; i++) await main.getByRole('button', { name: '1 min +' }).click();
        await main.getByRole('button', { name: 'Comprobar' }).click();
        return true;
      }
      const pos = async (id: string) => {
        const l = main.getByTestId(id);
        const x = Number(await l.getAttribute('x2')) - 100;
        const y = 100 - Number(await l.getAttribute('y2'));
        return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
      };
      const mAngle = await pos('minute-hand');
      const mm = Math.round(mAngle / 6) % 60;
      const hAngle = await pos('hour-hand');
      const hh = ((Math.round((hAngle - mm / 2) / 30) % 12) + 12) % 12 || 12;
      await readingAnswer(page, readTime(hh, mm).kana, wrong);
      return true;
    }
    case 'Calendario': {
      const q = (await main.getByTestId('prompt').textContent())!;
      const month = (name: string) => SPANISH_MONTHS.indexOf(name) + 1;
      let m: RegExpMatchArray | null;
      let reading: string;
      if ((m = q.match(/fecha marcada \((\d+) de (\p{L}+)\)/u))) reading = readDate(month(m[2]!), Number(m[1])).kana;
      else if ((m = q.match(/Qué día de la semana es el (\d+) de (\p{L}+)\?/u))) reading = readDayOfWeek(weekdayOf(month(m[2]!), Number(m[1]))).kana;
      else if ((m = q.match(/Hoy es el (\d+) de (\p{L}+)\. ¿Qué fecha es (mañana|ayer)\?/u))) {
        const d = shiftDay(month(m[2]!), Number(m[1]), m[3] === 'mañana' ? 1 : -1);
        reading = readDate(d.month, d.day).kana;
      } else if ((m = q.match(/Hoy es (\p{L}+)\. ¿Qué día es (mañana|ayer)\?/u))) reading = readDayOfWeek((SPANISH_WEEKDAYS.indexOf(m[1]!) + (m[2] === 'mañana' ? 1 : 6)) % 7).kana;
      else throw new Error(`solver: calendar prompt "${q}"`);
      await readingAnswer(page, reading, wrong);
      return true;
    }
    case 'Diálogos': {
      const nextBtn = main.getByRole('button', { name: /^(Escucha y responde|Siguiente diálogo)$/ });
      if (await nextBtn.count()) { await nextBtn.click(); return true; }
      const title = (await main.locator('h2[class*="_title_"]').textContent())!.trim();
      const d = dialogues.find((x) => x.title === title)!;
      const promptText = (await main.getByTestId('prompt').textContent()) ?? '';
      let correct: string;
      if (promptText.includes('Tu turno')) {
        const cur = await main.getByRole('list', { name: 'Conversación' }).locator('li').count();
        correct = d.lines[cur]!.ja;
      } else {
        const heard = norm(await jaText(main.getByTestId('prompt').locator('span[lang="ja"]').first()));
        const i = d.lines.findIndex((l, j) => norm(l.ja) === heard && d.lines[j + 1]);
        correct = d.lines[i + 1]!.ja;
      }
      const opts = main.getByRole('group', { name: 'Respuestas posibles' }).getByRole('button');
      await choose(page, opts, async (_t, b) => norm(await jaText(b.locator('span[lang="ja"]').first())) === norm(correct), wrong);
      return true;
    }
    case 'Mini-lectura': {
      const q = (await main.locator('[class*="_question_"]').first().textContent())!.trim();
      const lis = main.getByTestId('reading-text').locator('li');
      const romaji = await lis.locator('p[class*="_romaji_"]').allTextContents();
      const exOf = (i: number) => examples.find((e) => e.romaji === romaji[i]);
      let m: RegExpMatchArray | null;
      if ((m = q.match(/significa la frase (\d+)\?/))) {
        const ex = exOf(Number(m[1]) - 1)!;
        await choose(page, choiceButtons(main), (t) => t === ex.es, wrong);
      } else if ((m = q.match(/dice «(.+)»\?/))) {
        const idx = romaji.findIndex((_, i) => exOf(i)?.es === m![1]);
        await choose(page, choiceButtons(main), (t) => t === `Frase ${idx + 1}`, wrong);
      } else throw new Error(`solver: mini-reading "${q}"`);
      return true;
    }
    case 'Kanji': {
      const word = main.getByTestId('kanji-word');
      if (await word.count()) {
        const wid = await word.getAttribute('data-word');
        const w = vocab.find((x) => x.id === wid)!;
        await type(formInput, w.kana, wrong);
        return true;
      }
      const sentence = main.getByTestId('transform-sentence');
      if (await sentence.count()) {
        const sid = await sentence.getAttribute('data-sentence');
        const ex = examples.find((e) => e.id === sid)!;
        await choose(page, choiceButtons(main), (t) => t === ex.es, wrong);
        return true;
      }
      const clue = main.getByTestId('kanji-clue');
      if (await clue.count()) {
        const meaning = (await main.locator('[class*="_promptText_"]').first().textContent())!.trim();
        const cands = kanji.filter((k) => meaningText(k) === meaning).map((k) => k.char);
        await choose(page, choiceButtons(main), (t) => cands.includes(t), wrong);
        return true;
      }
      const ch = (await main.getByTestId('prompt').locator('span[lang="ja"]').first().textContent())!.trim();
      const k = kanji.find((x) => x.char === ch)!;
      await choose(page, choiceButtons(main), (t) => t === meaningText(k), wrong);
      return true;
    }
  }
}

/** ReadingRound answer: options (aria-label = kana) or a KanaInput. Alternatives are not needed: primary kana. */
async function readingAnswer(page: Page, reading: string, wrong: boolean): Promise<void> {
  const main = page.locator('main');
  const buttons = choiceButtons(main);
  if (await buttons.count()) await choose(page, buttons, (t) => t === reading, wrong);
  else await type(main.locator('form input'), reading, wrong);
}

export interface PlayResult { rounds: number; games: GameName[] }

/**
 * Plays rounds until `done()` is true. `pickWrong(roundIndex)` decides which rounds are answered wrong.
 */
export async function playUntil(page: Page, done: () => Promise<boolean>, opts: { pickWrong?: (i: number) => boolean; lessonKana?: string[]; maxRounds?: number } = {}): Promise<PlayResult> {
  const games: GameName[] = [];
  let i = 0;
  const max = opts.maxRounds ?? 400;
  while (!(await done())) {
    if (i >= max) throw new Error(`solver: still playing after ${max} rounds (${games.join(',')})`);
    const game = await currentGame(page);
    if (!game) { await page.waitForTimeout(150); i++; continue; }
    if (games.at(-1) !== game) games.push(game);
    await answerRound(page, game, { wrong: opts.pickWrong?.(i) ?? false, lessonKana: opts.lessonKana });
    i++;
  }
  return { rounds: i, games };
}

export const lessonResultVisible = (page: Page) => async () => (await page.getByRole('heading', { name: /^(¡Lección completada!|Casi lo logras)$/ }).count()) > 0;

/** Words known to the solver whose meaning could also be the answer (diagnostics). */
export const wordsByKana = (k: string): Word[] => vocab.filter((w) => norm(w.kana) === norm(k));
