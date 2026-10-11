import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { content } from '../../domain/contentLoader';
import { itemKey } from '../../state/progressSchema';
import { useProgress } from '../../state/progressStore';
import { KanjiGame } from './KanjiGame';
import { meaningText, transformSentences } from './kanjiLogic';

const user = () => userEvent.setup({ delay: null });
const practice = content.kanji.filter((k) => k.genkiLesson >= 4 && k.genkiLesson <= 6);

beforeEach(() => {
  useProgress.getState().resetProgress();
  useProgress.getState().unlockKana(content.kana.flatMap((k) => [...k.char]));
  useProgress.getState().unlockKanji(content.kanji.filter((k) => k.genkiLesson <= 6).map((k) => k.char));
});

type Kind = 'meaning' | 'pick' | 'reading' | 'transform';

/** Answers the round on screen (right or wrong first) and returns which kind it was. */
async function answer(u: ReturnType<typeof user>, ok: boolean): Promise<Kind> {
  const prompt = screen.getByTestId('prompt');
  if (screen.queryByTestId('kanji-clue')) {
    const clue = screen.getByTestId('kanji-clue').nextElementSibling!.textContent!;
    const k = practice.find((x) => meaningText(x) === clue)!;
    const options = screen.getAllByRole('button').filter((b) => b.textContent && b.textContent.length === 1);
    const right = options.find((b) => b.textContent === k.char)!;
    if (!ok) await u.click(options.find((b) => b !== right)!);
    await u.click(right);
    return 'pick';
  }
  if (screen.queryByTestId('kanji-word')) {
    const w = content.vocab.find((x) => x.id === screen.getByTestId('kanji-word').getAttribute('data-word'))!;
    const input = screen.getByLabelText('Lectura en kana');
    if (!ok) {
      await u.type(input, 'zzz{Enter}');
      await u.type(screen.getByLabelText('Lectura en kana'), `${w.romaji}{Enter}`);
    } else await u.type(input, `${w.romaji}{Enter}`);
    return 'reading';
  }
  if (screen.queryByTestId('transform-sentence')) {
    const sentence = within(screen.getByTestId('transform-sentence')).getAllByText(/./).map((n) => n.textContent).join('');
    expect(sentence.length).toBeGreaterThan(0);
    const sentences = transformSentences(content.patterns, content.vocab, new Set(content.kanji.map((k) => k.char)));
    const options = screen.getAllByRole('button').map((b) => b.textContent!);
    const right = sentences.find((s) => s.id === screen.getByTestId('transform-sentence').getAttribute('data-sentence'))!;
    expect(options).toContain(right.es);
    if (!ok) await u.click(screen.getAllByRole('button').find((b) => b.textContent !== right.es)!);
    await u.click(screen.getByRole('button', { name: right.es }));
    return 'transform';
  }
  const k = practice.find((x) => x.char === prompt.textContent!.slice(0, 1))!;
  if (!ok) await u.click(screen.getAllByRole('button').find((b) => b.textContent !== meaningText(k))!);
  await u.click(screen.getByRole('button', { name: meaningText(k) }));
  return 'meaning';
}

describe('KanjiGame', () => {
  it('plays the four kinds of round and records kanji and word items', async () => {
    const u = user();
    const onFinish = vi.fn();
    render(<KanjiGame kanji={practice} words={content.vocab} kana={[]} rounds={8} onFinish={onFinish} />);
    const kinds: Kind[] = [];
    for (let i = 0; i < 8; i++) kinds.push(await answer(u, true));
    expect(kinds).toEqual(['meaning', 'pick', 'reading', 'transform', 'meaning', 'pick', 'reading', 'transform']);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0]![0]).toMatchObject({ total: 8, correct: 8 });
    const items = Object.values(useProgress.getState().items);
    expect(items.some((i) => i.kind === 'kanji' && practice.some((k) => k.char === i.itemId))).toBe(true);
    expect(items.filter((i) => i.kind === 'word').every((i) => i.itemId.endsWith(':kanji'))).toBe(true);
    expect(items.filter((i) => i.kind === 'word').length).toBeGreaterThanOrEqual(2);
  });

  it('a wrong answer is recorded once and lowers the stage but still lets the learner continue', async () => {
    const u = user();
    render(<KanjiGame kanji={practice} words={content.vocab} kana={[]} rounds={4} />);
    const before = { ...useProgress.getState().items };
    await answer(u, false);
    const changed = Object.values(useProgress.getState().items).filter((i) => i.wrong === 1);
    expect(changed).toHaveLength(1);
    expect(changed[0]!.kind).toBe('kanji');
    expect(Object.keys(before)).not.toContain(itemKey('kanji', 'zzz'));
    await answer(u, true);
    expect(screen.getByRole('progressbar', { name: 'Progreso' })).toHaveAttribute('aria-valuenow', '2');
  });

  it('the reading round shows the word in bare kanji (no furigana) and checks against kana', async () => {
    const u = user();
    render(<KanjiGame kanji={practice.filter((k) => k.char === '食')} words={content.vocab} kana={[]} rounds={3} />);
    await answer(u, true); // meaning
    expect(screen.queryByTestId('kanji-clue')).toBeInTheDocument();
    await answer(u, true); // pick
    expect(screen.getByTestId('kanji-word').querySelector('ruby')).toBeNull();
    expect(screen.getByTestId('kanji-word').textContent).toContain('食');
  });

  it('the transformation round shows kanji with furigana and highlights nothing unknown', async () => {
    const u = user();
    render(<KanjiGame kanji={practice} words={content.vocab} kana={[]} rounds={4} />);
    await answer(u, true);
    await answer(u, true);
    await answer(u, true);
    const sentence = screen.getByTestId('transform-sentence');
    expect(sentence.querySelector('ruby')).not.toBeNull();
    expect(screen.getByText(/Ya conoces esta frase/)).toBeInTheDocument();
  });

  it('after the lesson the furigana of a kanji disappears once its item reaches Guru', async () => {
    useProgress.getState().resetProgress();
    useProgress.getState().unlockKana(content.kana.flatMap((k) => [...k.char]));
    useProgress.getState().unlockKanji(['食']);
    const { JaText } = await import('../../components/JaText');
    const word = { kana: 'たべる', kanji: '食べる' };
    const { container } = render(<JaText word={word} />);
    expect(container.querySelector('ruby')).not.toBeNull();
    for (let i = 0; i < 4; i++) {
      // reviewed when due: each right answer climbs one stage (1 -> 5)
      useProgress.setState((s) => ({ items: { ...s.items, 'kanji:食': { ...s.items['kanji:食']!, nextDue: 1 } } }));
      useProgress.getState().recordAnswer('食', 'kanji', true);
    }
    expect(useProgress.getState().items['kanji:食']!.srsStage).toBe(5);
    // re-render picks the new state up
    const { container: after } = render(<JaText word={word} />);
    expect(after.querySelector('ruby')).toBeNull();
    expect(after).toHaveTextContent('食べる');
  });

  it('walks the due items in order in a review (sequential)', async () => {
    const u = user();
    const kanji = practice.slice(0, 3);
    render(<KanjiGame kanji={kanji} words={[]} kana={[]} rounds={3} sequential />);
    const seen: string[] = [];
    for (let i = 0; i < 3; i++) {
      const prompt = screen.queryByTestId('kanji-clue');
      seen.push(prompt ? 'pick' : screen.getByTestId('prompt').textContent!.slice(0, 1));
      await answer(u, true);
    }
    expect(seen[0]).toBe(kanji[0]!.char);
    expect(seen[2]).toBe(kanji[2]!.char);
  });

  it('says so when there is nothing to practise', () => {
    render(<KanjiGame kanji={[]} words={[]} kana={[]} />);
    expect(screen.getByText(/No hay kanji para practicar/)).toBeInTheDocument();
  });
});
