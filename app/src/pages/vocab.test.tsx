import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { itemKey } from '../state/progressSchema';
import { useProgress } from '../state/progressStore';
import { word } from '../state/testWords';
import { defaultFilters, filterVocab, normalizeSearch, statusOfStage } from './vocabLogic';
import { VocabPage } from './VocabPage';

const user = () => userEvent.setup({ delay: null });
const vocab = [
  word('inu', 'いぬ', 1, { es: ['perro'], en: ['dog'], romaji: 'inu' }),
  word('neko', 'ねこ', 150, { es: ['gato'], en: ['cat'], romaji: 'neko', written: '猫' }),
  word('cafe', 'カフェ', 700, { es: ['café'], en: ['cafe'], romaji: 'kafe' }),
  word('mizu', 'みず', undefined, { es: ['agua'], romaji: 'mizu', source: 'genki' }),
];
const stageItem = (id: string, srsStage: number) => ({ itemId: id, kind: 'word' as const, srsStage, correct: 0, wrong: 0, lastSeen: 1, nextDue: 5, weight: 1 });

beforeEach(() => {
  useProgress.getState().resetProgress();
  useProgress.getState().unlockKana(['い', 'ぬ', 'ね', 'こ', 'み', 'ず']);
});

describe('vocabLogic', () => {
  const ids = (f: Partial<ReturnType<typeof defaultFilters>>, items = {}, lang: 'es' | 'en' = 'es') =>
    filterVocab(vocab, items, { ...defaultFilters(), ...f }, lang).map((w) => w.id);

  it('Core tab keeps only ranked words, sorted by rank; the all tab adds the rest', () => {
    expect(ids({})).toEqual(['inu', 'neko', 'cafe']);
    expect(ids({ coreOnly: false })).toEqual(['inu', 'neko', 'cafe', 'mizu']);
  });
  it('searches kana, romaji, written form and meanings, ignoring accents and script', () => {
    expect(ids({ query: 'ねこ' })).toEqual(['neko']);
    expect(ids({ query: 'KAFE' })).toEqual(['cafe']);
    expect(ids({ query: 'cafe' })).toEqual(['cafe']); // «café» without the accent
    expect(ids({ query: '猫' })).toEqual(['neko']);
    expect(ids({ query: 'dog' }, {}, 'es')).toEqual(['inu']);
    expect(ids({ query: 'ネコ' })).toEqual(['neko']);
    expect(normalizeSearch(' Café ')).toBe('cafe');
  });
  it('filters by rank range, source and SRS status', () => {
    expect(ids({ range: '1-100' })).toEqual(['inu']);
    expect(ids({ range: '101-300' })).toEqual(['neko']);
    expect(ids({ range: '601-1000' })).toEqual(['cafe']);
    expect(ids({ coreOnly: false, source: 'genki' })).toEqual(['mizu']);
    const items = { [itemKey('word', 'inu')]: { srsStage: 6 }, [itemKey('word', 'neko')]: { srsStage: 2 } };
    expect(ids({ status: 'guru' }, items)).toEqual(['inu']);
    expect(ids({ status: 'apprentice' }, items)).toEqual(['neko']);
    expect(ids({ status: 'new' }, items)).toEqual(['cafe']);
  });
  it('maps stages to groups', () => {
    expect([undefined, 0, 1, 4, 5, 6, 7, 8, 9].map(statusOfStage)).toEqual(['new', 'new', 'apprentice', 'apprentice', 'guru', 'guru', 'master', 'master', 'burned']);
  });
});

describe('VocabPage', () => {
  const renderPage = () =>
    render(
      <MemoryRouter>
        <VocabPage vocab={vocab} />
      </MemoryRouter>,
    );

  it('lists the Core words, counts the known ones and searches', async () => {
    renderPage();
    const u = user();
    expect(screen.getAllByTestId('vocab-row')).toHaveLength(3);
    expect(screen.getByTestId('vocab-known')).toHaveTextContent('Sabes 0 de 3 palabras del Core 1000');
    expect(screen.getByText('Core #150')).toBeInTheDocument();
    await u.type(screen.getByRole('searchbox'), 'gato');
    expect(screen.getAllByTestId('vocab-row')).toHaveLength(1);
    expect(screen.getByTestId('vocab-count')).toHaveTextContent('1 palabras');
    await u.clear(screen.getByRole('searchbox'));
    await u.type(screen.getByRole('searchbox'), 'zzz');
    expect(screen.getByText('Ninguna palabra coincide con el filtro.')).toBeInTheDocument();
  });

  it('filters by range and switches to all words', async () => {
    renderPage();
    const u = user();
    await u.selectOptions(screen.getByLabelText('Rango'), '101-300');
    expect(screen.getAllByTestId('vocab-row')).toHaveLength(1);
    await u.selectOptions(screen.getByLabelText('Rango'), '');
    await u.click(screen.getByRole('button', { name: 'Todas' }));
    expect(screen.getAllByTestId('vocab-row')).toHaveLength(4);
  });

  it('«Ya la sé» marks the word as Guru and toggles it back', async () => {
    renderPage();
    const u = user();
    const row = screen.getAllByTestId('vocab-row')[0]!;
    const toggle = within(row).getByRole('button', { name: /Ya la sé/ });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await u.click(toggle);
    expect(useProgress.getState().items[itemKey('word', 'inu')]!.srsStage).toBe(5);
    expect(useProgress.getState().xp).toBe(0);
    expect(within(row).getByRole('button', { name: /Ya la sé/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('vocab-known')).toHaveTextContent('Sabes 1 de 3');
    await u.click(within(row).getByRole('button', { name: /Ya la sé/ }));
    expect(useProgress.getState().items[itemKey('word', 'inu')]!.srsStage).toBe(0);
    expect(screen.getByTestId('vocab-known')).toHaveTextContent('Sabes 0 de 3');
  });

  it('shows meanings in the active language and filters by status', async () => {
    useProgress.getState().updateSettings({ meaningLang: 'en' });
    useProgress.setState({ items: { [itemKey('word', 'inu')]: stageItem('inu', 7) } });
    renderPage();
    expect(screen.getByText('dog')).toBeInTheDocument();
    await user().selectOptions(screen.getByLabelText('Estado'), 'master');
    expect(screen.getAllByTestId('vocab-row')).toHaveLength(1);
  });

  it('paginates long lists', async () => {
    const many = Array.from({ length: 120 }, (_, i) => word(`w${i}`, 'いぬ', i + 1));
    render(
      <MemoryRouter>
        <VocabPage vocab={many} />
      </MemoryRouter>,
    );
    expect(screen.getAllByTestId('vocab-row')).toHaveLength(50);
    await user().click(screen.getByRole('button', { name: 'Mostrar más' }));
    expect(screen.getAllByTestId('vocab-row')).toHaveLength(100);
  });
});
