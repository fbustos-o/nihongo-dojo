import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { content } from '../../domain/contentLoader';
import type { SentencePattern } from '../../domain/schema';
import { itemKey } from '../../state/progressSchema';
import { useProgress } from '../../state/progressStore';
import type { GameStats } from '../types';
import { Syntax } from './Syntax';

const user = () => userEvent.setup({ delay: null });
const pattern = {
  id: 'p-test',
  title: 'test',
  lesson: 'P1',
  english: [
    { slot: 'S', text: 'Yo' },
    { slot: 'V', text: 'bebo' },
    { slot: 'O', text: 'agua' },
  ],
  japanese: [],
  explanationEs: '',
  examples: [{ es: 'Yo bebo agua.', ja: 'わたし は みず を のみます。', romaji: 'watashi wa mizu o nomimasu.' }],
} as SentencePattern;

const bank = () => within(screen.getByRole('group', { name: 'Fichas disponibles' }));

beforeEach(() => {
  useProgress.getState().resetProgress();
  useProgress.getState().unlockKana(content.kana.map((k) => k.char));
});

describe('syntax game', () => {
  it('builds the sentence with taps, shows the 3-row table and records the answer', async () => {
    const onFinish = vi.fn<(s: GameStats) => void>();
    const u = user();
    render(<Syntax kana={[]} words={[]} patterns={[pattern]} rounds={1} onFinish={onFinish} />);
    expect(screen.getByTestId('prompt')).toHaveTextContent('Yo bebo agua.');
    expect(screen.getByLabelText('Estructura española')).toHaveTextContent('SujetoVerboObjeto');
    expect(screen.getByRole('button', { name: 'Comprobar' })).toBeDisabled();
    for (const piece of ['わたし', 'は', 'みず', 'を', 'のみます']) await u.click(bank().getByRole('button', { name: piece }));
    await u.click(screen.getByRole('button', { name: 'Comprobar' }));
    expect(screen.getByText(/¡Correcto!/)).toBeInTheDocument();
    const table = screen.getByTestId('solution-table');
    expect(within(table).getByText('Estructura española')).toBeInTheDocument();
    expect(within(table).getByText('Estructura japonesa')).toBeInTheDocument();
    expect(within(table).getByText('Frase japonesa')).toBeInTheDocument();
    expect(within(table).getByText('のみます').closest('td')?.className).toMatch(/verb/);
    expect(useProgress.getState().items[itemKey('pattern', 'p-test:0')]).toMatchObject({ correct: 1, wrong: 0 });
    await u.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0]![0]).toMatchObject({ total: 1, correct: 1 });
  });

  it('wrong order: reports a mistake, shows the solution; tiles can be taken back', async () => {
    const u = user();
    render(<Syntax kana={[]} words={[]} patterns={[pattern]} rounds={1} />);
    await u.click(bank().getByRole('button', { name: 'のみます' }));
    await u.click(bank().getByRole('button', { name: 'わたし' }));
    await u.click(screen.getByTestId('placed-0'));
    expect(screen.getByTestId('placed-0')).toHaveTextContent('わたし');
    await u.click(bank().getByRole('button', { name: 'みず' }));
    await u.click(screen.getByRole('button', { name: 'Comprobar' }));
    expect(screen.getByText(/Incorrecto/)).toBeInTheDocument();
    expect(screen.getByTestId('solution-table')).toHaveTextContent('のみます');
    expect(useProgress.getState().items[itemKey('pattern', 'p-test:0')]).toMatchObject({ correct: 0, wrong: 1 });
  });

  it('accepts a moved time phrase', async () => {
    const u = user();
    const p = { ...pattern, id: 'p-time', examples: [{ es: 'Ayer comí.', ja: 'きのう わたし は ごはん を たべました。', romaji: '' }] } as SentencePattern;
    render(<Syntax kana={[]} words={[]} patterns={[p]} rounds={1} />);
    for (const piece of ['わたし', 'は', 'きのう', 'ごはん', 'を', 'たべました']) await u.click(bank().getByRole('button', { name: piece }));
    await u.click(screen.getByRole('button', { name: 'Comprobar' }));
    expect(screen.getByText(/¡Correcto!/)).toBeInTheDocument();
  });

  it('shows romaji for kana that are not unlocked yet', () => {
    useProgress.getState().resetProgress();
    render(<Syntax kana={[]} words={[]} patterns={[pattern]} rounds={1} />);
    // locked kana stay kana, with romaji ruby over each: the accessible name carries both
    expect(bank().queryByRole('button', { name: 'わたし' })).toBeNull();
    expect(bank().getByRole('button', { name: /わ.*wa.*た.*ta.*し.*shi/ })).toBeInTheDocument();
  });
});
