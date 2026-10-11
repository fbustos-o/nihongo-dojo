import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { content } from '../domain/contentLoader';
import { itemKey } from '../state/progressSchema';
import { useProgress } from '../state/progressStore';
import { KanaRecognize } from './kana-recognize';
import { KanaWrite } from './kana-write';
import { Listen } from './listen';
import { ReadWords } from './read-words';
import { GAME_REGISTRY, implementedGameIds, isImplemented } from './registry';
import type { GameStats } from './types';

const kana = (c: string) => content.kana.find((k) => k.char === c)!;
const word = (id: string) => content.vocab.find((w) => w.id === id)!;
const item = (kind: 'kana' | 'word', id: string) => useProgress.getState().items[itemKey(kind, id)];
const user = () => userEvent.setup({ delay: null });

beforeEach(() => useProgress.getState().resetProgress());

describe('registry', () => {
  it('implements the stage 1 games and describes every game in Spanish', () => {
    expect(implementedGameIds()).toEqual(expect.arrayContaining(['kana-recognize', 'kana-write', 'listen', 'read-words']));
    expect(isImplemented('syntax')).toBe(true);
    expect(isImplemented('kanji')).toBe(true);
    for (const meta of Object.values(GAME_REGISTRY)) {
      expect(meta.name).not.toBe('');
      expect(meta.description).not.toBe('');
    }
  });
});

describe('kana-recognize', () => {
  it('accepts the right romaji, counts it, shows the streak and finishes after the rounds', async () => {
    const onFinish = vi.fn<(s: GameStats) => void>();
    render(<KanaRecognize kana={[kana('か')]} words={[]} rounds={2} onFinish={onFinish} />);
    const input = screen.getByLabelText('Romaji');
    expect(input).toHaveFocus();
    await user().type(input, 'KA{Enter}');
    expect(screen.getByText('か = ka · fila か')).toBeInTheDocument();
    expect(screen.getByText(/Racha: 1/)).toBeInTheDocument();
    expect(screen.getByLabelText('Romaji')).toHaveFocus();
    await user().type(screen.getByLabelText('Romaji'), 'ka{Enter}');
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0]![0]).toMatchObject({ total: 2, correct: 2, bestStreak: 2 });
    expect(item('kana', 'か')).toMatchObject({ correct: 2, wrong: 0 });
    expect(useProgress.getState().xp).toBe(20);
  });

  it('accepts the alt romaji of を', async () => {
    render(<KanaRecognize kana={[kana('を')]} words={[]} rounds={1} />);
    await user().type(screen.getByLabelText('Romaji'), 'wo{Enter}');
    expect(item('kana', 'を')).toMatchObject({ correct: 1 });
  });

  it('wrong answer: shows the answer and forces retyping it before moving on', async () => {
    const onFinish = vi.fn();
    render(<KanaRecognize kana={[kana('か')]} words={[]} rounds={1} onFinish={onFinish} />);
    await user().type(screen.getByLabelText('Romaji'), 'ki{Enter}');
    expect(screen.getByText(/Incorrecto/)).toBeInTheDocument();
    expect(screen.getByTestId('correct-answer')).toHaveTextContent('ka');
    expect(item('kana', 'か')).toMatchObject({ correct: 0, wrong: 1 });
    // another wrong try does not advance
    await user().type(screen.getByLabelText('Romaji'), 'ku{Enter}');
    expect(onFinish).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Romaji')).toHaveFocus();
    // retyping the right answer continues, without counting a second answer
    await user().type(screen.getByLabelText('Romaji'), 'ka{Enter}');
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0]![0]).toMatchObject({ total: 1, correct: 0 });
    expect(item('kana', 'か')).toMatchObject({ correct: 0, wrong: 1 });
  });

  it('near miss shows "casi"', async () => {
    render(<KanaRecognize kana={[kana('し')]} words={[]} rounds={1} />);
    await user().type(screen.getByLabelText('Romaji'), 'shii{Enter}');
    expect(screen.getByText(/Casi/)).toBeInTheDocument();
  });

  it('uses multiple choice for brand-new kana of the lesson', async () => {
    const entries = ['か', 'き', 'く'].map(kana);
    render(<KanaRecognize kana={entries} words={[]} newKana={['か', 'き', 'く']} rounds={1} />);
    expect(screen.queryByLabelText('Romaji')).toBeNull();
    const target = screen.getByTestId('prompt').textContent!;
    const romaji = kana(target).romaji;
    const buttons = screen.getAllByRole('button').filter((b) => b.className.includes('choice') || /^[a-z]+$/.test(b.textContent ?? ''));
    expect(buttons.length).toBeGreaterThanOrEqual(4);
    await user().click(screen.getByRole('button', { name: romaji }));
    expect(item('kana', target)).toMatchObject({ correct: 1 });
  });
});

describe('kana-write', () => {
  it('turns romaji into kana and compares kana to kana', async () => {
    render(<KanaWrite kana={[kana('あ')]} words={[]} rounds={1} />);
    expect(screen.getByTestId('romaji')).toHaveTextContent('a');
    await user().type(screen.getByLabelText('Escribe en kana'), 'a{Enter}');
    expect(item('kana', 'あ')).toMatchObject({ correct: 1 });
  });

  it('wrong kana forces retyping', async () => {
    const onFinish = vi.fn();
    render(<KanaWrite kana={[kana('あ')]} words={[]} rounds={1} onFinish={onFinish} />);
    await user().type(screen.getByLabelText('Escribe en kana'), 'i{Enter}');
    expect(screen.getByTestId('correct-answer')).toHaveTextContent('あ');
    expect(onFinish).not.toHaveBeenCalled();
    await user().type(screen.getByLabelText('Escribe en kana'), 'a{Enter}');
    expect(onFinish).toHaveBeenCalled();
    expect(item('kana', 'あ')).toMatchObject({ wrong: 1, correct: 0 });
  });
});

describe('listen', () => {
  it('without a Japanese voice shows a notice and the romaji, and stays playable', async () => {
    render(<Listen kana={[kana('あ')]} words={[]} rounds={1} />);
    expect(screen.getByRole('note')).toHaveTextContent(/voz en japonés/);
    expect(screen.getByTestId('romaji')).toHaveTextContent('a');
    await user().click(screen.getByRole('button', { name: 'あ' }));
    expect(item('kana', 'あ')).toMatchObject({ correct: 1 });
  });

  it('wrong option is disabled and the right one must be chosen', async () => {
    const onFinish = vi.fn();
    useProgress.getState().unlockKana([...'あいうえお']);
    render(<Listen kana={[kana('あ')]} words={[]} rounds={1} onFinish={onFinish} />);
    const options = screen.getAllByRole('button').filter((b) => /^[぀-ゟ]$/.test(b.textContent ?? ''));
    expect(options).toHaveLength(4);
    const wrong = options.find((b) => b.textContent !== 'あ')!;
    await user().click(wrong);
    expect(wrong).toBeDisabled();
    expect(screen.getByText(/Sonó: Kana: a · elegiste/)).toBeInTheDocument();
    expect(onFinish).not.toHaveBeenCalled();
    await user().click(screen.getByRole('button', { name: 'あ' }));
    expect(onFinish).toHaveBeenCalled();
    expect(item('kana', 'あ')).toMatchObject({ wrong: 1, correct: 0 });
  });
});

describe('read-words', () => {
  const words = [word('ie'), word('iie'), word('ai')];

  it('multiple choice then typed reading, alternating', async () => {
    useProgress.getState().unlockKana([...'あいうえお']);
    render(<ReadWords kana={[]} words={[word('ie')]} rounds={2} />);
    expect(screen.getByTestId('word-prompt')).toHaveTextContent('いえ');
    await user().click(screen.getByRole('button', { name: word('ie').es[0]! }));
    expect(item('word', 'ie')).toMatchObject({ correct: 1 });
    // round 2: typed
    await user().type(screen.getByLabelText('Lectura en romaji'), 'ie{Enter}');
    expect(item('word', 'ie')).toMatchObject({ correct: 2 });
  });

  it('shows locked kana with romaji ruby (JaText) and hides the romaji hint when showRomaji is off', () => {
    useProgress.getState().updateSettings({ showRomaji: false });
    const { container } = render(<ReadWords kana={[]} words={[word('ie')]} rounds={1} />);
    // nothing unlocked: the word is kana with romaji ruby (JaText), no extra hint line
    expect(screen.getByTestId('word-prompt')).toHaveTextContent('いiえe');
    expect(container.querySelectorAll('[class*=hint]').length).toBe(0);
  });

  it('shows the romaji hint when enabled', () => {
    useProgress.getState().unlockKana([...'あいうえお']);
    render(<ReadWords kana={[]} words={[word('ie')]} rounds={1} />);
    expect(screen.getAllByText('ie').length).toBeGreaterThan(0);
  });

  it('wrong meaning is disabled and must be corrected', async () => {
    useProgress.getState().unlockKana([...'あいうえお']);
    const onFinish = vi.fn();
    render(<ReadWords kana={[]} words={words} rounds={1} onFinish={onFinish} />);
    const shown = screen.getByTestId('word-prompt').textContent!;
    const target = words.find((w) => w.kana === shown)!;
    const wrongButton = screen
      .getAllByRole('button')
      .find((b) => !target.es.includes(b.textContent ?? '') && b.className.includes('choice'))!;
    await user().click(wrongButton);
    expect(wrongButton).toBeDisabled();
    expect(onFinish).not.toHaveBeenCalled();
    await user().click(screen.getByRole('button', { name: target.es[0]! }));
    expect(onFinish).toHaveBeenCalled();
    expect(item('word', target.id)).toMatchObject({ wrong: 1, correct: 0 });
  });
});
