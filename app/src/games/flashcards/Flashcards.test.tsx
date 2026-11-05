import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { itemKey } from '../../state/progressSchema';
import { useProgress } from '../../state/progressStore';
import { word } from '../../state/testWords';
import { Flashcards } from './Flashcards';

const user = () => userEvent.setup({ delay: null });
const words = [
  word('a', 'いぬ', 1, { es: ['perro'], en: ['dog'], written: '犬', note: 'animal', romaji: 'inu' }),
  word('b', 'ねこ', 2, { es: ['gato'], en: ['cat'], romaji: 'neko' }),
];

beforeEach(() => {
  useProgress.getState().resetProgress();
  useProgress.getState().unlockKana(['い', 'ぬ', 'ね', 'こ']);
});

describe('Flashcards', () => {
  it('flips to show meaning, written form, note and Core badge, then reports', async () => {
    const onFinish = vi.fn();
    render(<Flashcards kana={[]} words={words} sequential onFinish={onFinish} />);
    const u = user();
    expect(screen.queryByTestId('flashcard-back')).toBeNull();
    expect(screen.queryByText('Ya la sé')).toBeNull();
    await u.click(screen.getByTestId('flashcard'));
    const back = screen.getByTestId('flashcard-back');
    expect(back).toHaveTextContent('perro');
    expect(back).toHaveTextContent('犬');
    expect(back).toHaveTextContent('animal');
    expect(back).toHaveTextContent('Core #1');
    expect(back).toHaveTextContent('inu');
    await u.click(screen.getByRole('button', { name: 'Ya la sé' }));
    expect(useProgress.getState().items[itemKey('word', 'a')]!.srsStage).toBe(1);
    expect(useProgress.getState().xp).toBe(10);
    expect(Object.values(useProgress.getState().daily)[0]!.newWords).toBe(1);
    // the next card is face down again
    expect(screen.queryByTestId('flashcard-back')).toBeNull();
    await u.click(screen.getByTestId('flashcard'));
    await u.click(screen.getByRole('button', { name: 'Todavía no' }));
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0]![0]).toMatchObject({ total: 2, correct: 1 });
    expect(useProgress.getState().items[itemKey('word', 'b')]!.srsStage).toBe(0);
    // a wrong first answer is not a «new word learned»
    expect(Object.values(useProgress.getState().daily)[0]!.newWords).toBe(1);
  });

  it('shows English meanings with the meaning language and hides romaji when the setting is off', async () => {
    useProgress.getState().updateSettings({ meaningLang: 'en', showRomaji: false });
    render(<Flashcards kana={[]} words={words} sequential />);
    await user().click(screen.getByTestId('flashcard'));
    const back = screen.getByTestId('flashcard-back');
    expect(back).toHaveTextContent('dog');
    expect(back).not.toHaveTextContent('perro');
    expect(back).not.toHaveTextContent('inu');
  });

  it('works with the keyboard: space flips, 1 and 2 answer', async () => {
    const onFinish = vi.fn();
    render(<Flashcards kana={[]} words={words} sequential onFinish={onFinish} />);
    const u = user();
    await u.keyboard('1'); // before flipping: ignored
    expect(useProgress.getState().xp).toBe(0);
    await u.keyboard(' ');
    expect(screen.getByTestId('flashcard-back')).toBeInTheDocument();
    await u.keyboard('1');
    await u.keyboard(' ');
    await u.keyboard('2');
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0]![0]).toMatchObject({ total: 2, correct: 1 });
  });

  it('respects rounds and handles an empty list', async () => {
    const onFinish = vi.fn();
    const { unmount } = render(<Flashcards kana={[]} words={words} sequential rounds={1} onFinish={onFinish} />);
    const u = user();
    await u.click(screen.getByTestId('flashcard'));
    await u.click(screen.getByRole('button', { name: 'Ya la sé' }));
    expect(onFinish).toHaveBeenCalledTimes(1);
    unmount();
    render(<Flashcards kana={[]} words={[]} />);
    expect(screen.getByText(/No hay palabras/)).toBeInTheDocument();
  });
});
