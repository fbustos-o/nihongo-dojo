/* Generic game solver for the e2e journeys (QA E8): reads the round from the DOM and answers it from the
 * content JSON + the app's own engines. `wrong: true` answers wrong first (then fixes it to move on). */
import { expect, type Locator, type Page } from '@playwright/test';
import { toHiragana, toRomaji } from 'wanakana';
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

// same as src/games/syntax/syntaxLogic.ts tokenize(): clause punctuation is split off and dropped
const tokenize = (ja: string): string[] =>
  ja.replace(/[。？！?!]+$/u, '').replace(/([、，。])/gu, ' $1 ').split(/\s+/u).filter((t) => t !== '' && !/^[、，。]$/u.test(t));
const romajiLabel = (k: KanaEntry): string => (k.char === 'ー' ? '- (vocal larga)' : k.char === 'ッ' || k.char === 'っ' ? 'xtsu (pausa)' : k.romaji);
const otherScript = (s: string): string =>
  [...s].map((c) => { const code = c.codePointAt(0)!; return code >= 0x3041 && code <= 0x3096 ? String.fromCodePoint(code + 0x60) : code >= 0x30a1 && code <= 0x30f6 ? String.fromCodePoint(code - 0x60) : c; }).join('');
/** norm() after turning romaji fallbacks back into kana («boうし» -> ぼうし). */
const mnorm = (s: string): string => norm(toHiragana(s.replace(/\s+/g, ''), { passRomaji: false })).replace(/っ/g, '');
/** Romaji key without long-vowel distinctions (コーヒー / koohii / こnpyuuたー all compare equal to their romaji). */
const loose = (s: string): string => toRomaji(katakanaToHiraganaLite(s)).toLowerCase().replace(/[^a-z]/g, '').replace(/ou/g, 'o').replace(/([aeiou])\1+/g, '$1').replace(/([bcdfghjkmpqrstvwxyz])\1/g, '$1');
const katakanaToHiraganaLite = (s: string): string => [...s].map((c) => (c >= 'ァ' && c <= 'ヶ' ? String.fromCharCode(c.charCodeAt(0) - 0x60) : c)).join('');
/** Displayed text (possibly mixed kana/romaji) equals the Japanese `ja`. */
const exactSame = (shown: string, ja: string): boolean => norm(shown) === norm(ja) || mnorm(shown) === mnorm(ja);
const same = (shown: string, ja: string): boolean => exactSame(shown, ja) || loose(shown) === loose(ja);
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
  if (!right) throw new Error(`solver: no correct option among ${n} buttons: ${(await buttons.allTextContents()).join(' | ')} — prompt: ${(await page.getByTestId('prompt').first().innerText().catch(() => '?')).replace(/\s+/g, ' ')}`);
  if (wrong && bad) await bad.click();
  await right.click();
}

/* On-screen kana keyboard (settings.kanaInput = teclado, or auto on touch devices): the input is read-only. */
const KB_ROWS = ['あいうえお', 'かきくけこ', 'さしすせそ', 'たちつてと', 'なにぬねの', 'はひふへほ', 'まみむめも', 'や ゆ よ', 'らりるれろ', 'わをん  '];
const PLAIN = 'かきくけこさしすせそたちつてとはひふへほ';
const VOICED = 'がぎぐげござじずぜぞだぢづでどばびぶべぼ';
const SEMI = 'ぱぴぷぺぽ';
const SMALL: Record<string, string> = { っ: 'つ', ゃ: 'や', ゅ: 'ゆ', ょ: 'よ', ぁ: 'あ', ぃ: 'い', ぅ: 'う', ぇ: 'え', ぉ: 'お', ゎ: 'わ' };
const toHira = (c: string) => (c >= 'ァ' && c <= 'ヶ' ? String.fromCharCode(c.charCodeAt(0) - 0x60) : c);

/** Types `text` (kana, ー, spaces) by tapping the on-screen kana keyboard, then presses its Enter key. */
export async function kbType(page: Page, text: string, submit = true): Promise<void> {
  const kb = page.getByRole('group', { name: 'Teclado de kana' });
  await expect(kb).toBeVisible();
  const tap = (name: string) => kb.getByRole('button', { name, exact: true }).click();
  for (const ch of [...text]) {
    if (ch === ' ') { await tap('Espacio'); continue; }
    if (ch === 'ー') { await tap('Alargamiento ー'); continue; }
    const kata = ch >= 'ァ' && ch <= 'ヶ';
    // the switch key is labelled with the OTHER script
    const inKata = (await kb.getByRole('button', { name: 'Cambiar a hiragana' }).count()) > 0;
    if (kata !== inKata) await tap(kata ? 'Cambiar a katakana' : 'Cambiar a hiragana');
    let h = toHira(ch);
    const mods: string[] = [];
    if (SMALL[h]) { mods.push('Kana pequeño (ゃゅょっぁ) en el último'); h = SMALL[h]!; }
    else if (VOICED.includes(h)) { mods.push('Dakuten (゛) en el último kana'); h = PLAIN[VOICED.indexOf(h)]!; }
    else if (SEMI.includes(h)) { mods.push('Handakuten (゜) en el último kana'); h = 'はひふへほ'[SEMI.indexOf(h)]!; }
    else if (h === 'ゔ') { mods.push('Dakuten (゛) en el último kana'); h = 'う'; }
    const row = KB_ROWS.findIndex((r) => r.includes(h));
    if (row < 0) throw new Error(`kbType: no key for ${ch}`);
    const label = (s: string) => (kata ? String.fromCharCode(s.charCodeAt(0) + 0x60) : s);
    await tap(`Fila ${label(KB_ROWS[row]![0]!)}`);
    await tap(label(h));
    for (const m of mods) await tap(m);
  }
  if (submit) await tap('Enter: comprobar');
}

const isReadOnly = async (input: Locator) => (await input.getAttribute('readonly')) !== null;

async function type(input: Locator, answer: string, wrong: boolean): Promise<void> {
  const page = input.page();
  if (wrong) {
    if (await isReadOnly(input)) { await input.click(); await kbType(page, 'ぬぬ'); }
    else { await input.fill('zzzq'); await input.press('Enter'); }
    await expect(page.getByTestId('correct-answer')).toBeVisible();
    input = page.locator('main form input');
  }
  if (await isReadOnly(input)) {
    await input.click();
    await kbType(page, answer);
    return;
  }
  await input.fill(answer);
  await input.press('Enter');
}

/** Last text sent to the speech stub (support/mobile.ts stubSpeech). */
const lastSpoken = (page: Page): Promise<string | undefined> =>
  page.evaluate(() => (window as unknown as { __spoken?: string[] }).__spoken?.at(-1));

const choiceButtons = (main: Locator) => main.locator('[class*="_choices_"] button');

/** Answers the current round of `game`. Returns false when nothing answerable is on screen. */
export async function answerRound(page: Page, game: GameName, o: SolveOptions = {}): Promise<boolean> {
  // lazy game chunk still loading (React keeps the previous game hidden in the DOM meanwhile)
  await expect(page.getByTestId('loading')).toHaveCount(0);
  const main = page.locator('main');
  const wrong = !!o.wrong;
  const formInput = main.locator('form input');

  switch (game) {
    case 'Reconocer kana': {
      const prompt = main.getByTestId('prompt');
      const shown = (await jaText(prompt.locator('span[lang="ja"]').first())).trim();
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
      if (!(await main.getByTestId('romaji').count())) {
        // Dictado: only audio. The stub recorded what was spoken.
        await expect(main.getByTestId('write-mode')).toContainText('Dictado');
        const said = await lastSpoken(page);
        if (!said) throw new Error('solver: Dictado without spoken text (stubSpeech missing?)');
        await type(formInput, said, wrong);
        return true;
      }
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
      const raw = await jaText(main.getByTestId('word-prompt'));
      const t = norm(raw);
      // JaText falls back to romaji for locked kana: «boうし» (ぼうし before dakuten) -> back to kana
      const mixed = mnorm(raw);
      let cands = vocab.filter((w) => norm(w.kana) === t || mnorm(w.kana) === mixed || (w.kanji && norm(w.kanji) === t) || w.romaji === t);
      if (cands.length === 0) cands = vocab.filter((w) => same(raw, w.kana));
      if (cands.length === 0) throw new Error(`solver: unknown word "${t}"`);
      if (await formInput.count()) await type(formInput, cands[0]!.romaji, wrong);
      else await choose(page, choiceButtons(main), (txt) => cands.some((w) => w.es[0] === txt), wrong);
      return true;
    }
    case 'Escuchar': {
      if (!(await main.getByTestId('romaji').count())) {
        const saidRaw = (await lastSpoken(page)) ?? '';
        const said = norm(saidRaw);
        await choose(page, choiceButtons(main), (txt) => norm(txt) === said || mnorm(txt) === mnorm(saidRaw) || vocab.some((w) => norm(w.kana) === said && (w.romaji === txt || norm(w.kanji ?? '-') === norm(txt))), wrong);
        return true;
      }
      const r = (await main.getByTestId('romaji').textContent())!.trim();
      const words = vocab.filter((w) => w.romaji === r);
      const kanaCands = kana.filter((k) => k.romaji === r).map((k) => k.char);
      const exact = async () => { for (const b of await choiceButtons(main).all()) { const txt = (await jaText(b)).trim(); if (kanaCands.includes(txt) || words.some((w) => norm(w.kana) === norm(txt) || norm(w.kana) === mnorm(txt) || norm(w.kanji ?? '-') === norm(txt) || w.romaji === txt)) return true; } return false; };
      if (await exact()) await choose(page, choiceButtons(main), (txt) => kanaCands.includes(txt) || words.some((w) => norm(w.kana) === norm(txt) || norm(w.kana) === mnorm(txt) || norm(w.kanji ?? '-') === norm(txt) || w.romaji === txt), wrong);
      else await choose(page, choiceButtons(main), (txt) => loose(txt) === loose(r), wrong);
      return true;
    }
    case 'Sintaxis': {
      const next = main.getByRole('button', { name: 'Siguiente' });
      if (await next.count()) { await next.click(); return true; }
      const es = (await main.getByTestId('prompt').textContent())!.trim();
      const bank = main.getByRole('group', { name: 'Fichas disponibles' }).getByRole('button');
      const texts = await Promise.all((await bank.all()).map((b) => jaText(b)));
      const ex = examples.filter((e) => e.es === es).find((e) => tokenize(e.ja).every((tk) => texts.some((t) => exactSame(t, tk)))) ?? examples.filter((e) => e.es === es).find((e) => tokenize(e.ja).every((tk) => texts.some((t) => same(t, tk))));
      if (!ex) throw new Error(`solver: no example for "${es}"`);
      const tokens = tokenize(ex.ja);
      const order = wrong ? [...tokens].reverse() : tokens;
      for (const tk of order) {
        const n = await bank.count();
        let hit = -1;
        for (const eq of [exactSame, same]) {
          for (let i = 0; i < n && hit < 0; i++) if (!(await bank.nth(i).isDisabled()) && eq(await jaText(bank.nth(i)), tk)) hit = i;
          if (hit >= 0) break;
        }
        if (hit >= 0) await bank.nth(hit).click();
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
      await choose(page, choiceButtons(main), (t) => t === answer || mnorm(t) === norm(answer), wrong);
      return true;
    }
    case 'Conjugación': {
      const shownWord = await jaText(main.getByTestId('word-prompt'));
      const meaning = (await main.locator('[class*="_target_"]').first().textContent())!.trim();
      const label = (await main.getByTestId('form-label').textContent())!.trim();
      const conjOk = (x: (typeof vocab)[number]) => (x.es[0] ?? x.romaji) === meaning && ['verb', 'i-adj', 'na-adj', 'noun'].includes(x.pos);
      const w = vocab.find((x) => exactSame(shownWord, x.kana) && conjOk(x)) ?? vocab.find((x) => same(shownWord, x.kana) && (x.es[0] ?? x.romaji) === meaning && ['verb', 'i-adj', 'na-adj', 'noun'].includes(x.pos));
      if (!w) throw new Error(`solver: conjugation word "${shownWord}" (${meaning})`);
      await type(formInput, conjugationAnswer(w, label), wrong);
      return true;
    }
    case 'Números y precios': {
      const digits = main.getByRole('textbox', { name: 'Número con cifras' });
      if (await digits.count()) {
        const line = main.locator('[class*="_kanaLine_"] span[lang="ja"]');
        // locked kana render as ruby with romaji in <rt>: read the base text only
        const k = (await line.count()) ? (await line.first().evaluate((e) => { const c = e.cloneNode(true) as HTMLElement; c.querySelectorAll('rt').forEach((r) => r.remove()); return c.textContent ?? ''; })).trim() : ((await lastSpoken(page)) ?? '');
        const n = numberFromKana(k);
        if (n === undefined) throw new Error(`solver: number for ${k}`);
        await type(digits, String(n), wrong);
        return true;
      }
      if (!(await main.locator('[class*="_big_"]').count())) throw new Error(`solver: numbers round not understood: ${(await main.locator('section').first().innerText()).slice(0, 300)}`);
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
        const k = (await jaText(main.getByTestId('prompt').locator('span[lang="ja"]').first())).trim();
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
      let line: (typeof d.lines)[number];
      // romaji is the robust key (kana may be partly shown as romaji before the learner knows them)
      const rkey = (x: string) => x.toLowerCase().replace(/[^a-z]/g, '');
      if (promptText.includes('Tu turno')) {
        const cur = await main.getByRole('list', { name: 'Conversación' }).locator('li').count();
        line = d.lines[cur]!;
      } else {
        const heardSpan = main.getByTestId('prompt').locator('span[lang="ja"]');
        const heardKana = mnorm((await heardSpan.count()) ? await jaText(heardSpan.first()) : ((await lastSpoken(page)) ?? ''));
        let i = d.lines.findIndex((l, j) => d.lines[j + 1] && rkey(promptText).includes(rkey(l.romaji)));
        if (i < 0) i = d.lines.findIndex((l, j) => mnorm(l.ja) === heardKana && d.lines[j + 1]);
        line = d.lines[i + 1]!;
      }
      const opts = main.getByRole('group', { name: 'Respuestas posibles' }).getByRole('button');
      await choose(page, opts, async (t, b) => rkey(t).endsWith(rkey(line.romaji)) || mnorm(await jaText(b.locator('span[lang="ja"]').first())) === mnorm(line.ja), wrong);
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
      const ch = (await jaText(main.getByTestId('prompt').locator('span[lang="ja"]').first())).trim();
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
  if (await buttons.count()) await choose(page, buttons, (t) => t === reading || exactSame(t, reading), wrong);
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
