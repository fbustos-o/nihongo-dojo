import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../App';
import { content } from '../domain/contentLoader';
import { glosses } from '../domain/glosses';
import type { Word } from '../domain/schema';
import { GAME_IDS } from '../domain/schema';
import { FuriganaModeSchema, KanaInputModeSchema, ThemeSchema } from '../state/progressSchema';
import { Clock } from '../games/clock';
import { KanaRecognize } from '../games/kana-recognize';
import { gameDescription, gameName } from '../games/registry';
import { ReadWords } from '../games/read-words';
import { meaningChoices, originText } from '../games/wordUtils';
import { getProgressSnapshot, useProgress } from '../state/progressStore';
import { serializeProgress } from '../state/persistence';
import { formatMonthDay, monthName, weekdayInitial, weekdayName, weekdayShort } from './dates';
import { syncHtmlLang } from './htmlLang';
import { MESSAGES } from './messages';
import { translate } from './index';

const user = () => userEvent.setup({ delay: null });
const settle = () => waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument());
const renderAt = async (path: string) => {
  const result = render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
  await settle();
  return result;
};
const setLang = (uiLang: 'es' | 'en', meaningLang: 'es' | 'en' = uiLang) => useProgress.getState().updateSettings({ uiLang, meaningLang });
const kana = (c: string) => content.kana.find((k) => k.char === c)!;

beforeEach(() => useProgress.getState().resetProgress());
afterEach(() => useProgress.getState().resetProgress());

describe('interface in English', () => {
  it('Home', async () => {
    setLang('en');
    await renderAt('/');
    expect(screen.getByRole('heading', { name: /Welcome/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Reviews due' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Next lesson' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your memory' })).toBeInTheDocument();
    expect(screen.getByTestId('streak')).toHaveTextContent('0 days');
    expect(screen.getByText(/Nothing due for now/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Level experience' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Progress: Kanji' })).toBeInTheDocument();
    expect(screen.queryByText('Repasos pendientes')).not.toBeInTheDocument();
  });

  it('Home streak uses English weekday initials (S M T W T F S)', async () => {
    setLang('en');
    await renderAt('/');
    const days = screen.getAllByRole('listitem', { name: /you studied|no study/ });
    expect(days).toHaveLength(7);
    const initials = days.map((d) => d.textContent!.replace('✓', '')).join('');
    expect(initials).toMatch(/^[SMTWF]{7}$/);
    expect(initials).not.toMatch(/[LXJV]/);
  });

  it('Settings, with the language selectors and the daily new words field', async () => {
    setLang('en');
    await renderAt('/ajustes');
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByText('Show romaji as a help')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Interface language' })).toHaveValue('en');
    expect(screen.getByRole('combobox', { name: 'Meanings language' })).toHaveValue('en');
    expect(screen.getByRole('button', { name: 'Export progress' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset progress' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Dark' })).toBeInTheDocument();
  });

  it('Settings change the language live and keep the daily goal within 0-100', async () => {
    const u = user();
    await renderAt('/ajustes');
    expect(screen.getByRole('heading', { name: 'Ajustes' })).toBeInTheDocument();
    await u.selectOptions(screen.getByRole('combobox', { name: 'Idioma de la interfaz' }), 'en');
    expect(useProgress.getState().settings.uiLang).toBe('en');
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(useProgress.getState().settings.meaningLang).toBe('es');
    await u.selectOptions(screen.getByRole('combobox', { name: 'Meanings language' }), 'en');
    expect(useProgress.getState().settings.meaningLang).toBe('en');

    const goal = screen.getByRole('spinbutton', { name: 'New words per day' });
    expect(goal).toHaveValue(10);
    await u.clear(goal);
    await u.type(goal, '25');
    expect(useProgress.getState().settings.newWordsPerDay).toBe(25);
    await u.clear(goal);
    await u.type(goal, '500');
    expect(useProgress.getState().settings.newWordsPerDay).toBe(100);
  });

  it('export/import keeps the new settings', () => {
    useProgress.getState().updateSettings({ uiLang: 'en', meaningLang: 'en', newWordsPerDay: 33 });
    const text = serializeProgress(getProgressSnapshot());
    useProgress.getState().resetProgress();
    expect(useProgress.getState().settings.newWordsPerDay).toBe(10);
    expect(useProgress.getState().importProgress(text)).toBeNull();
    expect(useProgress.getState().settings).toMatchObject({ uiLang: 'en', meaningLang: 'en', newWordsPerDay: 33 });
  });

  it('the lesson runner (intro and practice header)', async () => {
    setLang('en');
    const u = user();
    await renderAt('/leccion/h-a');
    expect(screen.getByRole('heading', { name: 'New kana' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Row chart' })).toBeInTheDocument();
    expect(screen.getByText('1 · Introduction')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Start practice' }));
    await settle();
    expect(screen.getByText(/^Game \d+ of \d+:/)).toBeInTheDocument();
    expect(screen.getByText('2 · Practice')).toBeInTheDocument();
  });

  it('a missing lesson and the lesson title follow the language', async () => {
    setLang('en');
    await renderAt('/leccion/nope');
    expect(screen.getByText('Lesson not found')).toBeInTheDocument();
  });

  it('Review (empty) and Practice pages', async () => {
    setLang('en');
    const { unmount } = await renderAt('/repaso');
    expect(screen.getByRole('heading', { name: 'No reviews due' })).toBeInTheDocument();
    unmount();
    await renderAt('/practica');
    expect(screen.getByRole('heading', { name: 'Free kanji practice' })).toBeInTheDocument();
    expect(within(screen.getByTestId('due-summary')).getByText(/You have no reviews due/)).toBeInTheDocument();
  });

  it('About', async () => {
    setLang('en');
    await renderAt('/acerca-de');
    expect(screen.getByRole('heading', { name: /About/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Credits' })).toBeInTheDocument();
  });

  it('game: kana recognize (typed round) speaks English', async () => {
    setLang('en');
    const u = user();
    render(<KanaRecognize kana={[kana('か')]} words={[]} rounds={2} />);
    expect(screen.getByLabelText('Romaji')).toBeInTheDocument();
    expect(screen.getByText('Type the romaji and press Enter.')).toBeInTheDocument();
    await u.type(screen.getByLabelText('Romaji'), 'xx{Enter}');
    expect(screen.getByText('Incorrect. Type the right answer to continue:')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Type the answer')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check' })).toBeInTheDocument();
  });

  it('game: clock speaks English', () => {
    setLang('en');
    render(<Clock words={[]} kana={[]} rounds={1} />);
    expect(document.body.textContent).toMatch(/What time does the clock show\?|Set the clock to this time:/);
    expect(document.body.textContent).not.toMatch(/reloj/i);
  });

  it('game: read words (multiple choice) shows the English gloss', () => {
    setLang('en');
    const house: Word = { ...content.vocab.find((w) => w.id === 'taberu')!, id: 'casa-test', kana: 'いえ', es: ['casa'], en: ['house'], origin: undefined };
    render(<ReadWords kana={[]} words={[house]} rounds={1} />);
    expect(screen.getByText('What does it mean?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'house' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'casa' })).not.toBeInTheDocument();
  });
});

describe('meaning language', () => {
  const base = content.vocab.find((w) => w.id === 'taberu')!;

  it('glosses return en when present and fall back to es when missing', () => {
    expect(glosses({ es: ['casa'], en: ['house'] }, 'en')).toEqual(['house']);
    expect(glosses({ es: ['casa'], en: ['house'] }, 'es')).toEqual(['casa']);
    expect(glosses({ es: ['casa'] }, 'en')).toEqual(['casa']);
    expect(glosses({ es: ['casa'], en: [] }, 'en')).toEqual(['casa']);
  });

  it('meaning choices come from the same language as the correct answer', () => {
    const withEn = content.vocab.slice(0, 40).map((w, i) => ({ ...w, en: [`english-${i}`] }));
    const target = withEn[0]!;
    const rng = () => 0.3;
    const en = meaningChoices(target, 4, withEn, rng, 'en');
    expect(en.every((c) => c.text.startsWith('english-'))).toBe(true);
    expect(en.filter((c) => c.correct)).toEqual([{ text: 'english-0', correct: true }]);
    const es = meaningChoices(target, 4, withEn, rng, 'es');
    expect(es.some((c) => c.text.startsWith('english-'))).toBe(false);
  });

  it('a word without English meaning is shown (and offered) in Spanish while meaning language is English', () => {
    setLang('es', 'en');
    const noEn: Word = { ...base, id: 'sin-en', en: undefined };
    const choices = meaningChoices(noEn, 4, content.vocab, () => 0.5);
    expect(choices.find((c) => c.correct)!.text).toBe(noEn.es[0]);
  });

  it('the interface can be Spanish while meanings are English', () => {
    setLang('es', 'en');
    const word: Word = { ...base, id: 'x', es: ['comer'], en: ['to eat'] };
    render(<ReadWords kana={[]} words={[word]} rounds={1} />);
    expect(screen.getByText('¿Qué significa?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'to eat' })).toBeInTheDocument();
  });

  it('loanword origins are translated', () => {
    expect(originText('inglés: smartphone (abreviado)', 'en')).toBe('English: smartphone (abbreviated)');
    expect(originText('inglés: smartphone (abreviado)', 'es')).toBe('inglés: smartphone (abreviado)');
    expect(originText('alemán: Arbeit', 'en')).toBe('German: Arbeit');
  });
});

describe('dates, html lang, registry', () => {
  it('weekday initials and names follow the language', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((d) => weekdayInitial(d, 'es')).join('')).toBe('DLMXJVS');
    expect([0, 1, 2, 3, 4, 5, 6].map((d) => weekdayInitial(d, 'en')).join('')).toBe('SMTWTFS');
    expect(weekdayName(3, 'es')).toBe('miércoles');
    expect(weekdayName(3, 'en')).toBe('Wednesday');
    expect(weekdayShort(0, 'en')).toBe('Sun');
    expect(monthName(3, 'es')).toBe('marzo');
    expect(monthName(3, 'en')).toBe('March');
  });

  it('month-day text keeps each language word order', () => {
    expect(formatMonthDay(3, 14, 'es')).toBe('14 de marzo');
    expect(formatMonthDay(3, 14, 'en')).toBe('March 14');
  });

  it('<html lang> follows the interface language', () => {
    const stop = syncHtmlLang();
    expect(document.documentElement.lang).toBe('es');
    useProgress.getState().updateSettings({ uiLang: 'en' });
    expect(document.documentElement.lang).toBe('en');
    useProgress.getState().updateSettings({ uiLang: 'es' });
    expect(document.documentElement.lang).toBe('es');
    stop();
  });

  it('game names and descriptions are translatable', () => {
    expect(gameName('numbers', 'es')).toBe('Números y precios');
    expect(gameName('numbers', 'en')).toBe('Numbers and prices');
    expect(gameDescription('clock', 'en')).toBe('Say what time the clock shows.');
    setLang('en');
    expect(gameName('flashcards')).toBe('Flashcards');
  });
});

const SOURCES = import.meta.glob<string>('../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true });

describe('dictionary coverage', () => {
  it('every static t("key") used in the source exists in both languages', () => {
    const missing: string[] = [];
    for (const [file, text] of Object.entries(SOURCES)) {
      if (/\.test\.tsx?$|\/content\/|\/messages\//.test(file)) continue;
      for (const m of text.matchAll(/\bt\(\s*'([a-zA-Z]+\.[^'$]+)'/g)) {
        const key = m[1]!;
        if (!(key in MESSAGES.es) || !(key in MESSAGES.en)) missing.push(`${file}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('the dynamic key families are complete', () => {
    const keys: string[] = [
      ...GAME_IDS.flatMap((id) => [`games.name.${id}`, `games.desc.${id}`]),
      ...FuriganaModeSchema.options.map((m) => `settings.furigana.${m}`),
      ...KanaInputModeSchema.options.map((m) => `settings.kanaInput.${m}`),
      ...ThemeSchema.options.map((m) => `settings.theme.${m}`),
      ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `memory.stage.${n}`),
      ...['Aprendiz', 'Guru', 'Maestro', 'Iluminado', 'Quemado'].map((g) => `memory.group.${g}`),
      ...['kana', 'kanji', 'word', 'conjugation', 'number', 'clock', 'calendar', 'syntax', 'particle', 'dialogue'].map((c) => `memory.cat.${c}`),
      ...['kana', 'words', 'patterns', 'kanji'].map((g) => `review.group.${g}`),
      ...[1, 2, 3, 4, 5].map((n) => `stage.${n}`),
      ...['S', 'V', 'O', 'DIR', 'BE', 'ADJ', 'N'].map((s) => `games.slot.${s}`),
      ...['は', 'が', 'も', 'を', 'に', 'へ', 'で', 'の', 'と', 'や', 'から', 'まで', 'か'].map((p) => `games.role.${p}`),
      ...['digits', 'hear', 'price', 'priceHear', 'counter'].map((m) => `games.nmode.${m}`),
      ...['date', 'weekday', 'relWeekday', 'relDate'].map((k) => `games.ckind.${k}`),
      ...['present', 'past', 'negative', 'negativePast'].map((t) => `games.rule.i.${t}`),
      ...['u', 'ru', 'irregular'].map((g) => `games.group.${g}`),
      ...['verb', 'i-adj', 'na-adj', 'noun'].map((c) => `games.cat.${c}`),
      ...['gojuon', 'dakuten', 'yoon', 'extended'].map((g) => `practice.group.${g}`),
      ...['kana-recognize', 'read-words', 'kanji', 'conjugation', 'syntax', 'particles', 'numbers', 'clock', 'calendar', 'dialogues'].map((g) => `review.unit.${g}`),
      ...['tsu', 'nin', 'kai', 'times', 'sai', 'hon', 'mai', 'fun', 'ji'].map((c) => `memory.counter.${c}`),
    ];
    const missing = keys.filter((k) => !(k in MESSAGES.es) || !(k in MESSAGES.en));
    expect(missing).toEqual([]);
  });

  it('English values differ from Spanish for the strings that are words (spot check)', () => {
    expect(translate('en', 'home.due')).toBe('Reviews due');
    expect(translate('es', 'home.due')).toBe('Repasos pendientes');
  });
});
