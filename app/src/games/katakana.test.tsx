import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toKatakana } from 'wanakana';
import { content } from '../domain/contentLoader';
import { checkAnswer } from '../engine';
import { itemKey } from '../state/progressSchema';
import { useProgress } from '../state/progressStore';
import { KanaRecognize } from './kana-recognize';
import { KanaWrite } from './kana-write';
import { typingHints } from './kanaUtils';
import { ReadWords } from './read-words';

const kana = (c: string) => content.kana.find((k) => k.char === c)!;
const word = (id: string) => content.vocab.find((w) => w.id === id)!;
const item = (kind: 'kana' | 'word', id: string) => useProgress.getState().items[itemKey(kind, id)];
const user = () => userEvent.setup({ delay: null });

beforeEach(() => {
  useProgress.getState().resetProgress();
  vi.restoreAllMocks();
});

describe('kana-recognize in katakana lessons', () => {
  it('hiragana <-> katakana round: shows か, picks カ', async () => {
    useProgress.getState().unlockKana([...'あいうえおかきくけこ']);
    vi.spyOn(Math, 'random').mockReturnValue(0); // pair round, shows the hiragana partner
    render(<KanaRecognize kana={[kana('カ')]} words={[]} rounds={1} />);
    expect(screen.getByTestId('prompt')).toHaveTextContent('か');
    expect(screen.getByTestId('script-pair-hint')).toHaveTextContent('katakana');
    expect(screen.queryByLabelText('Romaji')).toBeNull();
    await user().click(screen.getByRole('button', { name: 'カ' }));
    expect(item('kana', 'カ')).toMatchObject({ correct: 1 });
  });

  it('a wrong script-pair option is disabled and the right one must be found', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const onFinish = vi.fn();
    render(<KanaRecognize kana={[kana('カ')]} words={[]} rounds={1} onFinish={onFinish} />);
    const wrong = screen.getAllByRole('button').find((b) => b.textContent !== 'カ' && /^[ァ-ヺ]$/.test(b.textContent ?? ''))!;
    await user().click(wrong);
    expect(wrong).toBeDisabled();
    expect(onFinish).not.toHaveBeenCalled();
    await user().click(screen.getByRole('button', { name: 'カ' }));
    expect(item('kana', 'カ')).toMatchObject({ correct: 0, wrong: 1 });
  });

  it('new ツ is multiple choice with シ among the options when シ is known', async () => {
    useProgress.getState().unlockKana(['シ']);
    vi.spyOn(Math, 'random').mockReturnValue(0); // the weighted picker takes the first item: ツ
    render(<KanaRecognize kana={[kana('ツ')]} words={[]} newKana={['ツ']} rounds={1} />);
    expect(screen.queryByLabelText('Romaji')).toBeNull();
    // romaji of the options: tsu (target) and shi (look-alike)
    expect(screen.getByRole('button', { name: 'shi' })).toBeInTheDocument();
    await user().click(screen.getByRole('button', { name: 'tsu' }));
    expect(item('kana', 'ツ')).toMatchObject({ correct: 1 });
  });

  it('explains ー and accepts "-" for it', async () => {
    render(<KanaRecognize kana={[kana('ー')]} words={[]} rounds={1} />);
    expect(screen.getByText(/vocal larga/)).toBeInTheDocument();
    await user().type(screen.getByLabelText('Romaji'), '-{Enter}');
    expect(item('kana', 'ー')).toMatchObject({ correct: 1 });
  });

  it('accepts the alt IME romaji of extended kana', async () => {
    render(<KanaRecognize kana={[kana('ティ')]} words={[]} rounds={2} />);
    await user().type(screen.getByLabelText('Romaji'), 'thi{Enter}');
    expect(item('kana', 'ティ')).toMatchObject({ correct: 1 });
    await user().type(screen.getByLabelText('Romaji'), 'ti{Enter}');
    expect(item('kana', 'ティ')).toMatchObject({ correct: 2 });
  });
});

describe('kana-write with katakana', () => {
  it('writes a katakana word with the katakana IME; repeated vowel and "-" both give ー', async () => {
    render(<KanaWrite kana={[]} words={[word('koohii')]} rounds={2} />);
    expect(screen.getByLabelText('Escribe en kana')).toBeInTheDocument();
    await user().type(screen.getByLabelText('Escribe en kana'), 'koohii{Enter}');
    expect(item('word', 'koohii')).toMatchObject({ correct: 1 });
    await user().type(screen.getByLabelText('Escribe en kana'), 'ko-hi-{Enter}');
    expect(item('word', 'koohii')).toMatchObject({ correct: 2 });
  });

  it('tells how to type ティ and ウォ', () => {
    render(<KanaWrite kana={[]} words={[word('paatii')]} rounds={1} />);
    expect(screen.getByTestId('typing-hint')).toHaveTextContent('ティ → «thi»');
  });

  it('every katakana word can be typed in the IME using its hints', () => {
    for (const w of content.vocab.filter((x) => /^[ァ-ヺー]+$/.test(x.kana))) {
      let typed = w.romaji;
      for (const h of typingHints(w.kana)) {
        // replace the romaji of the unit by the IME spelling (units are short, so replace the first occurrence)
        const entry = kana(h.char);
        typed = typed.replace(entry.romaji, h.typing);
      }
      expect(checkAnswer(toKatakana(typed), w.kana, { strict: true, scriptSensitive: true }).correct, `${w.kana} (${typed})`).toBe(true);
    }
  });

  it('typing hints are empty for plain katakana', () => {
    expect(typingHints('コーヒー')).toEqual([]);
    expect(typingHints('ウォーター')).toEqual([{ char: 'ウォ', typing: 'who' }]);
  });
});

describe('read-words with loanwords', () => {
  it('asks what it means and reveals the original word only after answering', async () => {
    render(<ReadWords kana={[]} words={[word('terebi')]} rounds={2} />);
    useProgress.getState().unlockKana([...'テレビ']);
    expect(screen.getByText('¿Qué significa?')).toBeInTheDocument();
    expect(screen.queryByTestId('origin')).toBeNull();
    expect(screen.queryByText(/television/)).toBeNull();
    await user().click(screen.getByRole('button', { name: word('terebi').es[0]! }));
    const note = screen.getByTestId('origin');
    expect(note).toHaveTextContent('Pronunciación original');
    expect(note).toHaveTextContent('inglés: television');
  });

  it('a wrong answer does not reveal it early; it appears when the round is over', async () => {
    render(<ReadWords kana={[]} words={[word('pan')]} rounds={2} />);
    const buttons = screen.getAllByRole('button').filter((b) => b.className.includes('choice'));
    const wrong = buttons.find((b) => b.textContent !== word('pan').es[0])!;
    await user().click(wrong);
    expect(screen.queryByTestId('origin')).toBeNull();
    await user().click(screen.getByRole('button', { name: word('pan').es[0]! }));
    expect(screen.getByTestId('origin')).toHaveTextContent('portugués: pão');
  });

  it('words without origin show no note', async () => {
    render(<ReadWords kana={[]} words={[word('ie')]} rounds={2} />);
    await user().click(screen.getByRole('button', { name: word('ie').es[0]! }));
    expect(screen.queryByTestId('origin')).toBeNull();
  });
});
