import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { bumpDaily } from '../state/daily';
import { itemKey } from '../state/progressSchema';
import { useProgress } from '../state/progressStore';
import { word } from '../state/testWords';
import { LearnNewPage, pickLearnBatch } from './LearnNewPage';
import { TodayCard } from './home/TodayCard';

const user = () => userEvent.setup({ delay: null });
const kana = ['い', 'ぬ', 'ね', 'こ', 'さ', 'か', 'な', 'み', 'ず', 'ひ', 'と'];
// ranks deliberately out of order; "ぱん" needs kana that are not known
const vocab = [
  word('w3', 'ねこ', 3),
  word('w1', 'いぬ', 1),
  word('w7', 'ぱん', 7),
  word('w2', 'さかな', 2),
  word('w4', 'みず', 4),
  word('w5', 'ひと', 5),
  word('w6', 'いな', 6),
  word('w8', 'ねな', 8),
];

beforeEach(() => {
  useProgress.getState().resetProgress();
  useProgress.getState().unlockKana(kana);
});

describe('pickLearnBatch', () => {
  it('takes the next new readable Core words in rank order, at least 5', () => {
    expect(pickLearnBatch(vocab).map((w) => w.id)).toEqual(['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w8']);
    useProgress.getState().updateSettings({ newWordsPerDay: 3 });
    expect(pickLearnBatch(vocab).map((w) => w.id)).toEqual(['w1', 'w2', 'w3', 'w4', 'w5']); // minimum 5
    useProgress.getState().updateSettings({ newWordsPerDay: 6 });
    expect(pickLearnBatch(vocab)).toHaveLength(6);
  });
  it('shrinks with today\'s progress and skips words already started or marked known', () => {
    useProgress.getState().updateSettings({ newWordsPerDay: 7 });
    useProgress.setState((s) => ({ daily: bumpDaily(s.daily, new Date(), { newWords: 2 }) }));
    useProgress.getState().markKnown('word', 'w1');
    useProgress.getState().recordAnswer('w2', 'word', true);
    expect(pickLearnBatch(vocab).map((w) => w.id)).toEqual(['w3', 'w4', 'w5', 'w6', 'w8']);
  });
  it('respects known kana: a new kana unlocks its words', () => {
    useProgress.getState().unlockKana(['ぱ', 'ん']);
    expect(pickLearnBatch(vocab).map((w) => w.id)).toContain('w7');
  });
});

describe('LearnNewPage', () => {
  it('runs flashcards, then read-words, then shows the summary', async () => {
    useProgress.getState().updateSettings({ newWordsPerDay: 5 });
    render(
      <MemoryRouter>
        <LearnNewPage vocab={vocab} />
      </MemoryRouter>,
    );
    const u = user();
    await u.click(screen.getByRole('button', { name: 'Empezar' }));
    for (let i = 0; i < 5; i++) {
      await waitFor(() => expect(screen.getByTestId('flashcard')).toBeInTheDocument());
      await u.click(screen.getByTestId('flashcard'));
      await u.click(screen.getByRole('button', { name: 'Ya la sé' }));
    }
    expect(Object.values(useProgress.getState().daily)[0]!.newWords).toBe(5);
    await waitFor(() => expect(screen.getByTestId('word-prompt')).toBeInTheDocument());
    expect(screen.getByText('2 · Leer palabras').closest('li')).toHaveAttribute('aria-current', 'step');
  });

  it('says so when no new word is readable', () => {
    useProgress.setState({ knownKana: [] });
    render(
      <MemoryRouter>
        <LearnNewPage vocab={vocab} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('learn-empty')).toBeInTheDocument();
  });
});

describe('TodayCard', () => {
  const renderCard = () =>
    render(
      <MemoryRouter>
        <TodayCard vocab={vocab} />
      </MemoryRouter>,
    );
  it('offers new words as primary when nothing is due, and the lesson as secondary', () => {
    renderCard();
    expect(screen.getByTestId('today-plan-new')).toHaveTextContent('Palabras nuevas: 0 de 10');
    expect(screen.getByTestId('today-primary')).toHaveAttribute('href', '/aprender');
    expect(screen.getByTestId('today-primary')).toHaveTextContent('Aprender 7 palabras nuevas');
  });
  it('falls back to the lesson once the daily target is met', () => {
    useProgress.setState((s) => ({ daily: bumpDaily(s.daily, new Date(), { newWords: 10 }) }));
    renderCard();
    expect(screen.getByTestId('today-primary')).toHaveAttribute('href', expect.stringMatching(/^\/leccion\//));
  });
  it('puts reviews first when something is due', () => {
    useProgress.setState({
      items: { [itemKey('word', 'x')]: { itemId: 'x', kind: 'word', srsStage: 1, correct: 1, wrong: 0, lastSeen: 1, nextDue: 2, weight: 1 } },
    });
    renderCard();
    expect(screen.getByTestId('today-primary')).toHaveAttribute('href', '/repaso');
    expect(screen.getByTestId('today-plan-reviews')).toHaveTextContent('1');
  });
});
