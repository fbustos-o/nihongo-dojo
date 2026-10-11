/**
 * QA Q2 — game-level rewrites of Parte 1 probes (QA-003, QA-009) and new findings (QA-036, QA-038).
 * `it.fails` = documents a real, still-open bug (passes while the bug exists).
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { content } from '../../app/src/domain/contentLoader';
import { renderKana } from '../../app/src/domain/renderPlan';
import { unlockedKanaForLessons } from '../../app/src/engine/kanaFilter';
import { Listen } from '../../app/src/games/listen';
import { KanaWrite } from '../../app/src/games/kana-write/KanaWrite';
import { computePathNodes, lessonContent, nextSuggestions } from '../../app/src/lesson/lessonLogic';
import { useProgress } from '../../app/src/state/progressStore';

const { curriculum, kana, vocab, patterns, dialogues } = content;
const k = (c: string) => kana.find((x) => x.char === c)!;

function setKnown(chars: string[]) {
  useProgress.setState({ knownKana: chars, items: {}, settings: { ...useProgress.getState().settings, kanaInput: 'romaji', showRomaji: true } });
}

// ------------------------------------------------------------------------------------------------
// QA-003 (rewritten): the real Listen game, no voice -> romaji prompt + 4 kana options
// ------------------------------------------------------------------------------------------------
describe('QA-003 (juego real): «Escuchar» solo ofrece kana conocidos + los de la lección', () => {
  const play = async (lessonKana: string[], known: string[], rounds = 20) => {
    setKnown(known);
    const user = userEvent.setup();
    render(<Listen kana={lessonKana.map(k)} newKana={lessonKana} words={[]} rounds={rounds} />);
    const shown = new Set<string>();
    for (let r = 0; r < rounds; r++) {
      const romaji = screen.getByTestId('romaji').textContent!.trim();
      const buttons = screen.getAllByRole('button').filter((b) => /^[ぁ-ゖァ-ヺー]+$/u.test(b.textContent ?? ''));
      buttons.forEach((b) => shown.add(b.textContent!));
      const right = buttons.find((b) => kana.some((x) => x.char === b.textContent && x.romaji === romaji && lessonKana.includes(x.char)))!;
      await user.click(right);
    }
    return [...shown];
  };
  it('h-a (nada conocido): opciones solo de あいうえお', async () => {
    const shown = await play(['あ', 'い', 'う', 'え', 'お'], []);
    expect(shown.filter((c) => !'あいうえお'.includes(c))).toEqual([]);
  });
  it('k-ka (hiragana completo + ア行 conocidos): opciones solo de katakana ya vistos o de la lección', async () => {
    const hira = unlockedKanaForLessons(curriculum, curriculum.filter((l) => l.stage === 1).map((l) => l.id));
    const shown = await play(['カ', 'キ', 'ク', 'ケ', 'コ'], [...hira, 'ア', 'イ', 'ウ', 'エ', 'オ', 'ー']);
    expect(shown.filter((c) => !'アイウエオーカキクケコ'.includes(c))).toEqual([]);
  });
});

// ------------------------------------------------------------------------------------------------
// QA-009 (rewritten): the real KanaWrite game shows an unambiguous romaji for を / ぢ / づ
// ------------------------------------------------------------------------------------------------
describe('QA-009 (juego real): «Escribir kana» pide を/ぢ/づ sin ambigüedad', () => {
  for (const [char, typing, twin] of [['を', 'wo', 'お'], ['ぢ', 'di', 'じ'], ['づ', 'du', 'ず'], ['ヲ', 'wo', 'オ']] as const) {
    it(`${char}: se muestra «${typing}» + nota, y escribir ${twin} es un error`, async () => {
      setKnown([]);
      const user = userEvent.setup();
      render(<KanaWrite kana={[k(char)]} words={[]} rounds={2} />);
      expect(screen.getByTestId('romaji').textContent).toBe(typing);
      expect(screen.getByTestId('write-note').textContent).toContain(char);
      const input = screen.getByRole('textbox', { name: 'Escribe en kana' });
      // type the twin directly (kana) -> wrong, the correct answer is shown
      await user.type(input, twin);
      await user.click(screen.getByRole('button', { name: 'Comprobar' }));
      expect(screen.getByTestId('correct-answer').textContent).toContain(char);
    });
  }
  it('お (sin gemelo ambiguo en su silabario): se muestra «o» sin nota', () => {
    setKnown([]);
    render(<KanaWrite kana={[k('お')]} words={[]} rounds={1} />);
    expect(screen.getByTestId('romaji').textContent).toBe('o');
    expect(screen.queryByTestId('write-note')).toBeNull();
  });
});

// ------------------------------------------------------------------------------------------------
// QA-038: a romaji run that ends in っ before a known kana loses the gemination
// ------------------------------------------------------------------------------------------------
describe('QA-038: renderKana con っ bloqueado', () => {
  const upTo = (id: string) => unlockedKanaForLessons(curriculum, curriculum.slice(0, curriculum.findIndex((l) => l.id === id) + 1).filter((l) => l.stage === 1).map((l) => l.id));
  const show = (text: string, known: ReadonlySet<string>) => renderKana(text, known).map((s) => s.text).join('');
  it.fails('みっつ / がっこう / まって con todo menos っ: no se muestran como «みつ», «がこう», «まて»', () => {
    const known = new Set([...upTo('h-yoon-2')]);
    expect(known.has('っ')).toBe(false);
    // today: みっつ -> «みつ», がっこう -> «がこう», まって -> «まて», ちょっと -> «choと» (wanakana drops a trailing っ)
    for (const w of ['みっつ', 'がっこう', 'まって']) expect(show(w, known)).not.toBe(w.replace('っ', ''));
    expect(show('ちょっと', known)).not.toBe('choと');
  });
});

// ------------------------------------------------------------------------------------------------
// QA-036: what the learner knows when each stage-2 lesson opens (gating) and on the suggested path
// ------------------------------------------------------------------------------------------------
describe('QA-036: legibilidad de la etapa 2 con el desbloqueo intercalado (M3)', () => {
  const stage2 = curriculum.filter((l) => l.stage === 2);
  const byId = new Map(curriculum.map((l) => [l.id, l]));
  const ancestors = (id: string): string[] => {
    const seen = new Set<string>();
    const visit = (x: string) => byId.get(x)!.requires.forEach((r) => { if (!seen.has(r)) { seen.add(r); visit(r); } });
    visit(id);
    return [...seen];
  };
  /** Share of the kana characters of a lesson's material that the learner can read when it opens. */
  const readable = (id: string, known: ReadonlySet<string>) => {
    const l = byId.get(id)!;
    const c = lessonContent(l, known, content);
    const texts = [
      ...c.words.map((w) => w.kana),
      ...patterns.filter((p) => l.patterns?.includes(p.id)).flatMap((p) => (p.examples ?? []).map((e) => e.ja)),
      ...dialogues.filter((d) => l.dialogues?.includes(d.id)).flatMap((d) => d.lines.map((x) => x.ja)),
    ].join('');
    const chars = [...texts].filter((ch) => /[ぁ-ゖ]/u.test(ch));
    const ok = chars.filter((ch) => known.has(ch) || [...known].some((u) => u.includes(ch)));
    return chars.length ? Math.round((ok.length / chars.length) * 100) : 100;
  };

  it('informe: kana conocidos y % legible al abrirse cada lección de la etapa 2 (requisitos mínimos)', () => {
    const rows = stage2.map((l) => {
      const known = unlockedKanaForLessons(curriculum, ancestors(l.id));
      return `${l.id.padEnd(16)} requiere hiragana hasta ${curriculum.filter((x) => x.stage === 1 && ancestors(l.id).includes(x.id)).at(-1)?.id.padEnd(13)} legible ${readable(l.id, known)}%`;
    });
    console.log(`\nQA-036 gating mínimo:\n${rows.join('\n')}`);
    expect(rows.length).toBe(stage2.length);
  });

  it('informe: camino sugerido por el inicio («Siguiente lección») — cuándo llega cada lección de gramática', () => {
    const done: string[] = [];
    const rows: string[] = [];
    for (let step = 0; step < 80; step++) {
      const next = nextSuggestions(computePathNodes(curriculum, done), done).next;
      if (!next) break;
      if (next.stage === 2) rows.push(`${String(step + 1).padStart(2)}. ${next.id.padEnd(16)} legible ${readable(next.id, unlockedKanaForLessons(curriculum, done))}% (kana hechos: ${done.filter((x) => x.startsWith('h-')).length}/15)`);
      done.push(next.id);
      if (stage2.every((l) => done.includes(l.id))) break;
    }
    console.log(`\nQA-036 camino sugerido:\n${rows.join('\n')}`);
    expect(rows.length).toBeGreaterThan(0);
  });

  it.fails('ninguna lección de la etapa 2 se abre con menos del 90 % de su material legible en kana', () => {
    const bad = stage2.map((l) => ({ id: l.id, pct: readable(l.id, unlockedKanaForLessons(curriculum, ancestors(l.id))) })).filter((r) => r.pct < 90);
    expect(bad).toEqual([]);
  });
});

void vocab;

// ------------------------------------------------------------------------------------------------
// QA-039 probe: numbers typed in the romaji IME right after h-ma (ん not learned yet)
// ------------------------------------------------------------------------------------------------
import { checkAnswer } from '../../app/src/engine/answer';
import { KanaInput } from '../../app/src/components/KanaInput';
describe('Números tras h-ma: respuestas escritas', () => {
  it('«san» escrito con el IME romaji y Enter se acepta como さん (la n final queda sin convertir)', async () => {
    useProgress.setState({ settings: { ...useProgress.getState().settings, kanaInput: 'romaji' } });
    const user = userEvent.setup();
    let value = '';
    render(<form onSubmit={(e) => e.preventDefault()}><KanaInput aria-label="k" onChange={(v) => (value = v)} /></form>);
    await user.type(screen.getByRole('textbox', { name: 'k' }), 'san');
    console.log(`IME «san» -> «${value}»; checkAnswer: ${checkAnswer(value, 'さん').correct}`);
    expect(checkAnswer(value, 'さん').correct).toBe(true);
  });
});
