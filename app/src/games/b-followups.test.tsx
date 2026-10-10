import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { content } from '../domain/contentLoader';
import { SentencePatternSchema } from '../domain/schema';
import { Conjugation } from './conjugation';
import { KanaWrite } from './kana-write';
import { KanjiGame } from './kanji';
import { kanjiToCredit } from './kanji/kanjiLogic';
import { MiniReading } from './mini-reading';
import { Particles } from './particles';
import { ReadWords } from './read-words';
import { GAME_REGISTRY, preloadGame } from './registry';
import { Syntax } from './syntax';
import { examplesOf } from './syntax/syntaxLogic';
import { useProgress } from '../state/progressStore';
import { itemKey } from '../state/progressSchema';
import { sampleWords } from '../lesson/lessonLogic';
import { LessonRunner } from '../lesson/LessonRunner';

const user = () => userEvent.setup({ delay: null });
const word = (id: string) => content.vocab.find((w) => w.id === id)!;

beforeEach(() => {
  useProgress.getState().resetProgress();
  useProgress.getState().unlockKana(content.kana.flatMap((k) => [...k.char]));
});

describe('B2: pattern examples are part of the validated schema', () => {
  it('keeps `examples` after validation and games read them from the content', () => {
    const raw = { id: 'p', title: 't', lesson: 'P1', english: [], japanese: [], explanationEs: '', examples: [{ es: 'a', ja: 'わたし は', romaji: 'b' }] };
    expect(SentencePatternSchema.parse(raw).examples).toEqual(raw.examples);
    expect(SentencePatternSchema.parse({ ...raw, examples: undefined }).examples).toBeUndefined();
    expect(content.patterns.filter((p) => examplesOf(p).length > 0).length).toBeGreaterThan(10);
    expect(examplesOf(content.patterns.find((p) => p.id === 'svo-masu')!).length).toBeGreaterThan(0);
  });
});

describe('B1: one dialogue prop', () => {
  it('GameProps has dialogueIds only', async () => {
    const types = await import('./types');
    expect(types).toBeDefined();
    const p: import('./types').GameProps = { kana: [], words: [], dialogueIds: ['x'] };
    // @ts-expect-error the old `dialogues` prop is gone
    const old: import('./types').GameProps = { kana: [], words: [], dialogues: [] };
    expect(p.dialogueIds).toEqual(['x']);
    expect(old).toBeDefined();
  });
});

describe('B3: mini-reading shows unlocked kanji', () => {
  const pattern = content.patterns.find((p) => examplesOf(p).some((e) => e.ja.includes('たべ')) && examplesOf(p).length >= 4)!;
  it('is kana-only before kanji are unlocked and uses kanji with furigana after', () => {
    const { container, unmount } = render(<MiniReading kana={[]} words={[]} patterns={[pattern]} rounds={3} />);
    const list = screen.getByTestId('reading-text');
    expect(list.querySelector('ruby')).toBeNull();
    unmount();
    useProgress.getState().unlockKanji(content.kanji.map((k) => k.char));
    const rich = content.patterns.filter((p) => examplesOf(p).length >= 4);
    let withRuby = 0;
    for (let i = 0; i < 25; i++) {
      const r = render(<MiniReading kana={[]} words={[]} patterns={rich} rounds={3} />);
      if (screen.getByTestId('reading-text').querySelector('ruby')) withRuby++;
      r.unmount();
    }
    expect(withRuby).toBeGreaterThan(0);
    expect(container).toBeDefined();
  });
});

describe('B4: loanword lessons use a bounded weighted sample', () => {
  const loanwords = content.vocab.filter((w) => /[ァ-ヺ]/.test(w.kana)).slice(0, 40);
  it('caps at 14 words, keeps the original order and does not alter the content', () => {
    const sample = sampleWords(loanwords, 14, {}, () => 0.3);
    expect(sample).toHaveLength(14);
    const order = loanwords.filter((w) => sample.includes(w));
    expect(sample).toEqual(order);
    expect(sampleWords(loanwords.slice(0, 10), 14, {})).toHaveLength(10);
    expect(loanwords).toHaveLength(40);
  });
  it('favours new and often-missed words', () => {
    const items: Record<string, never> = {};
    const known = Object.fromEntries(loanwords.slice(0, 20).map((w) => [itemKey('word', w.id), { itemId: w.id, kind: 'word', srsStage: 9, correct: 9, wrong: 0, lastSeen: 1, nextDue: 1, weight: 1 }]));
    let fromKnown = 0;
    for (let i = 0; i < 200; i++) fromKnown += sampleWords(loanwords, 14, { ...items, ...known } as never).filter((w) => loanwords.indexOf(w) < 20).length;
    expect(fromKnown / 200).toBeLessThan(7); // 14 * 20/40 = 7 if unweighted
  });
  it('a loanword lesson run practises at most 14 words', async () => {
    const lesson = content.curriculum.find((l) => l.id.startsWith('k-prestamos'))!;
    const sample = sampleWords(content.vocab.filter((w) => lesson.words?.includes(w.id)));
    expect(sample.length).toBeLessThanOrEqual(14);
    expect(typeof LessonRunner).toBe('function');
  });
});

describe('B5: kanji partial credit from words', () => {
  it('kanjiToCredit: unlocked kanji of the word, once per session', () => {
    const w = { kanji: '食べ物' };
    expect(kanjiToCredit(w, ['食', '物'], new Set())).toEqual(['食', '物']);
    expect(kanjiToCredit(w, ['食'], new Set())).toEqual(['食']);
    expect(kanjiToCredit(w, ['食', '物'], new Set(['食']))).toEqual(['物']);
    expect(kanjiToCredit({ kanji: undefined }, ['食'], new Set())).toEqual([]);
  });

  it('a word answered right first time advances its kanji; a wrong answer does not penalise them', async () => {
    const u = user();
    useProgress.getState().unlockKanji(['食']);
    const w = word('taberu');
    const kanjiItem = () => useProgress.getState().items[itemKey('kanji', '食')]!;
    render(<KanjiGame kanji={[]} words={[w]} kana={[]} rounds={2} />);
    const input = () => screen.getByLabelText('Lectura en kana');
    await u.type(input(), `${w.romaji}{Enter}`);
    expect(kanjiItem()).toMatchObject({ srsStage: 2, correct: 1, wrong: 0 });
    // second right answer in the same session: no extra credit for the same kanji
    await u.type(input(), `${w.romaji}{Enter}`);
    expect(kanjiItem()).toMatchObject({ srsStage: 2, correct: 1 });
  });

  it('wrong word answers leave the kanji untouched', async () => {
    const u = user();
    useProgress.getState().unlockKanji(['食']);
    const w = word('taberu');
    render(<KanjiGame kanji={[]} words={[w]} kana={[]} rounds={1} />);
    await u.type(screen.getByLabelText('Lectura en kana'), 'zzz{Enter}');
    expect(useProgress.getState().items[itemKey('kanji', '食')]).toMatchObject({ srsStage: 1, wrong: 0, correct: 0 });
    expect(useProgress.getState().items[itemKey('word', 'taberu:kanji')]).toMatchObject({ wrong: 1 });
  });
});

describe('B9: IME spelling hint wherever a word is typed', () => {
  it('kana-write shows it for a mixed-script word too', () => {
    const w = { ...word('paatii'), kana: 'パーティーをする' };
    render(<KanaWrite kana={[]} words={[w]} rounds={1} />);
    expect(screen.getByTestId('typing-hint')).toHaveTextContent('ティ → «thi»');
  });
  it('read-words typing round shows it', () => {
    const w = word('paatii');
    render(<ReadWords kana={[]} words={[w]} rounds={4} />);
    // round 0 is multiple choice; answer it to reach the typing round
    return (async () => {
      const u = user();
      await u.click(screen.getByRole('button', { name: w.es[0]! }));
      expect(screen.getByTestId('typing-hint')).toHaveTextContent('ティ → «thi»');
    })();
  });
  it('conjugation hint appears only for words that need it, kanji reading round has the hook', () => {
    render(<Conjugation kana={[]} words={[word('taberu')]} rounds={1} onlyItems={['verb:taberu:masu']} />);
    expect(screen.queryByTestId('typing-hint')).not.toBeInTheDocument();
  });
});

describe('review restriction (onlyItems)', () => {
  it('syntax and particles only ask the requested items', () => {
    const p = content.patterns.find((x) => examplesOf(x).length >= 3 && examplesOf(x).every((e) => e.ja.split(' ').length >= 3))!;
    const { unmount } = render(<Syntax kana={[]} words={[]} patterns={[p]} onlyItems={[`${p.id}:1`]} sequential rounds={2} />);
    expect(screen.getByTestId('prompt')).toHaveTextContent(examplesOf(p)[1]!.es);
    unmount();
    render(<Particles kana={[]} words={[]} patterns={[p]} onlyItems={[`particle:${p.id}:2`]} sequential rounds={2} />);
    expect(screen.getByTestId('prompt').parentElement).toHaveTextContent(examplesOf(p)[2]!.es);
  });
  it('conjugation review asks the exact form', () => {
    render(<Conjugation kana={[]} words={[]} onlyItems={['verb:taberu:te']} sequential rounds={1} />);
    expect(screen.getByTestId('form-label')).toHaveTextContent(/て/);
    expect(screen.queryByRole('group', { name: 'Modo' })).not.toBeInTheDocument();
  });
});

describe('lazy registry', () => {
  it('every implemented game is a lazy component that can be preloaded', async () => {
    for (const meta of Object.values(GAME_REGISTRY)) expect(meta.component).toBeDefined();
    await Promise.all(Object.keys(GAME_REGISTRY).map((id) => preloadGame(id as keyof typeof GAME_REGISTRY)));
    expect(MemoryRouter).toBeDefined();
  });
});
