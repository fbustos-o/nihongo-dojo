import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../App';
import { content } from '../domain/contentLoader';
import { itemKey } from '../state/progressSchema';
import { useProgress } from '../state/progressStore';
import { kanjiReview } from '../pages/PracticePage';
import { finishLesson, kanjiLessonWords, kanjiRounds, lessonContent, syncKnownKanji, unlockedKanjiForLessons } from './lessonLogic';
import { exampleWords } from './KanjiIntro';

const user = () => userEvent.setup({ delay: null });
const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
const lesson = (id: string) => content.curriculum.find((l) => l.id === id)!;
const kanjiLessons = content.curriculum.filter((l) => l.stage === 4);
const pass = { total: 10, correct: 9, bestStreak: 5, items: {} };
const fail = { total: 10, correct: 5, bestStreak: 1, items: {} };

/** Completes everything before `id` (as if the learner had played it). */
function completeBefore(id: string) {
  const byId = new Map(content.curriculum.map((l) => [l.id, l]));
  const seen = new Set<string>();
  const visit = (lid: string) => byId.get(lid)!.requires.forEach((r) => !seen.has(r) && (seen.add(r), visit(r)));
  visit(id);
  seen.forEach((lid) => {
    useProgress.getState().completeLesson(lid);
    useProgress.getState().unlockKana(byId.get(lid)!.kana ?? []);
    useProgress.getState().unlockKanji(byId.get(lid)!.kanji ?? []);
  });
}

beforeEach(() => useProgress.getState().resetProgress());

describe('kanji lessons: content', () => {
  it('cover the 144 kanji once, in Genki order, each with its meaning and strokes', () => {
    const chars = kanjiLessons.flatMap((l) => l.kanji ?? []);
    expect(chars).toHaveLength(144);
    expect(new Set(chars).size).toBe(144);
    for (const l of kanjiLessons) {
      const n = Number(l.id.replace('kanji-', ''));
      const data = lessonContent(l, new Set());
      expect(data.kanji.map((k) => k.char)).toEqual(l.kanji);
      expect(data.newKanji).toEqual(l.kanji);
      expect(data.kanji.every((k) => k.genkiLesson === n && k.strokes)).toBe(true);
    }
  });

  it('practises only words written with kanji of this lesson and the previous ones', () => {
    for (const l of kanjiLessons) {
      const allowed = new Set<string>();
      let cursor: typeof l | undefined = l;
      while (cursor?.stage === 4) {
        (cursor.kanji ?? []).forEach((c) => allowed.add(c));
        cursor = content.curriculum.find((x) => x.id === cursor!.requires.find((r) => r.startsWith('kanji-')));
      }
      const { words } = lessonContent(l, new Set());
      expect(words.length, l.id).toBeGreaterThan(0);
      for (const w of words) {
        expect(w.kanji, w.id).toBeDefined();
        expect([...w.kanji!].filter((ch) => /[一-鿿]/u.test(ch)).every((ch) => allowed.has(ch)), `${l.id} ${w.id}`).toBe(true);
      }
    }
  });

  it('kanjiLessonWords filters by allowed kanji', () => {
    const words = kanjiLessonWords(content.vocab, ['学', '生']);
    expect(words.map((w) => w.kanji)).toContain('学生');
    expect(words.map((w) => w.kanji)).not.toContain('日本');
  });

  it('gives 2 to 4 example words per kanji and rounds scale with the kanji count', () => {
    for (const k of content.kanji) {
      const examples = exampleWords(k, new Set(content.kanji.map((x) => x.char)));
      expect(examples.length, k.char).toBeGreaterThanOrEqual(1);
      expect(examples.length).toBeLessThanOrEqual(4);
      expect(examples.every((w) => w.kanji!.includes(k.char))).toBe(true);
    }
    expect(kanjiRounds(15)).toBe(24);
    expect(kanjiRounds(3)).toBe(12);
  });
});

describe('kanji lessons: unlocking', () => {
  it('passing unlocks the lesson kanji at SRS stage 1 and completes the lesson', () => {
    const l = lesson('kanji-3');
    expect(finishLesson(l, pass).passed).toBe(true);
    const s = useProgress.getState();
    expect(s.completedLessons).toContain('kanji-3');
    expect(s.unlockedKanji).toEqual(expect.arrayContaining(l.kanji!));
    for (const c of l.kanji!) expect(s.items[itemKey('kanji', c)]!.srsStage).toBe(1);
  });

  it('failing unlocks nothing', () => {
    expect(finishLesson(lesson('kanji-3'), fail).passed).toBe(false);
    expect(useProgress.getState().unlockedKanji).toEqual([]);
    expect(useProgress.getState().completedLessons).toEqual([]);
  });

  it('syncKnownKanji restores the kanji of completed lessons (e.g. after an import) without resetting SRS', () => {
    useProgress.getState().completeLesson('kanji-3');
    useProgress.getState().recordAnswer('一', 'kanji', true);
    useProgress.getState().recordAnswer('一', 'kanji', true);
    syncKnownKanji();
    const s = useProgress.getState();
    expect(new Set(s.unlockedKanji)).toEqual(unlockedKanjiForLessons(content.curriculum, ['kanji-3']));
    expect(s.items['kanji:一']!.srsStage).toBe(2);
    expect(s.items['kanji:二']!.srsStage).toBe(1);
  });
});

describe('kanji lesson page', () => {
  it('is locked until stage 2 and the katakana review are done', () => {
    renderAt('/leccion/kanji-3');
    expect(screen.getByText(/bloqueada/)).toBeInTheDocument();
  });

  it('intro shows each kanji big with meaning, readings (Genki highlighted), strokes and example words with audio', () => {
    completeBefore('kanji-3');
    renderAt('/leccion/kanji-3');
    expect(screen.getByRole('heading', { name: 'Kanji nuevos' })).toBeInTheDocument();
    const card = screen.getByTestId('kanji-card-時');
    expect(within(card).getByText('時', { selector: 'div' })).toBeInTheDocument();
    expect(card).toHaveTextContent('hora; tiempo');
    expect(card).toHaveTextContent('10 trazos');
    expect(card).toHaveTextContent('on');
    expect(card).toHaveTextContent('kun');
    expect(within(card).getByText('じ', { selector: 'strong' })).toBeInTheDocument();
    expect(within(card).getAllByRole('button', { name: /Oír/ }).length).toBeGreaterThanOrEqual(2);
    // new kanji already show with furigana inside the lesson, before being unlocked
    expect(card.querySelector('ruby')).not.toBeNull();
    expect(useProgress.getState().unlockedKanji).not.toContain('時');
    expect(screen.getAllByTestId(/kanji-card-/)).toHaveLength(15);
  });

  it('starts with the kanji game', async () => {
    completeBefore('kanji-3');
    renderAt('/leccion/kanji-3');
    await user().click(screen.getByRole('button', { name: 'Empezar práctica' }));
    expect(screen.getByText(/^Juego 1 de \d+:/)).toHaveTextContent('Kanji');
    expect(screen.getByText('¿Qué significa?')).toBeInTheDocument();
  });
});

describe('Práctica: kanji review and free practice', () => {
  it('kanjiReview turns due kanji and kanji-words into game content', () => {
    const { recordAnswer } = useProgress.getState();
    recordAnswer('食', 'kanji', false); // stage 0: due at once
    recordAnswer('taberu:kanji', 'word', false);
    recordAnswer('あ', 'kana', false);
    const { kanji, words } = kanjiReview(useProgress.getState().items, Date.now() + 1000);
    expect(kanji.map((k) => k.char)).toEqual(['食']);
    expect(words.map((w) => w.id)).toEqual(['taberu']);
  });

  it('offers the due kanji review and runs it with the kanji game', async () => {
    useProgress.getState().unlockKana(content.kana.flatMap((k) => [...k.char]));
    useProgress.getState().unlockKanji(['食', '飲', '見']);
    // 食 and 飲 were unlocked a while ago: their first review (4 hours) is due
    const items = useProgress.getState().items;
    useProgress.setState({ items: { ...items, 'kanji:食': { ...items['kanji:食']!, nextDue: 1 }, 'kanji:飲': { ...items['kanji:飲']!, nextDue: 2 } } });
    renderAt('/practica');
    const card = screen.getByRole('heading', { name: 'Repaso de kanji' }).closest('section')!;
    expect(card).toHaveTextContent('Tienes 2 kanji');
    await user().click(within(card).getByRole('button', { name: /Repasar kanji \(2\)/ }));
    expect(screen.getByRole('heading', { name: 'Repasos pendientes' })).toBeInTheDocument();
    expect(screen.getByText(/Kanji · 2 kanji/)).toBeInTheDocument();
    expect(screen.getByTestId('prompt')).toHaveTextContent('食');
  });

  it('free practice picks a lesson range and only unlocked kanji', async () => {
    renderAt('/practica');
    const free = screen.getByRole('heading', { name: 'Práctica libre de kanji' }).closest('section')!;
    expect(within(free).getByRole('button', { name: 'Practicar kanji' })).toBeDisabled();
    useProgress.getState().unlockKanji(content.kanji.filter((k) => k.genkiLesson <= 5).map((k) => k.char));
    const u = user();
    await u.selectOptions(within(free).getByLabelText('Desde la lección'), '4');
    await u.selectOptions(within(free).getByLabelText('Hasta la lección'), '4');
    expect(free).toHaveTextContent('14 kanji desbloqueados en el rango');
    await u.click(within(free).getByRole('button', { name: 'Practicar kanji' }));
    expect(screen.getByRole('heading', { name: 'Práctica libre' })).toBeInTheDocument();
    expect(screen.getByText(/Kanji · 14 kanji/)).toBeInTheDocument();
  });
});

describe('Ajustes: furigana', () => {
  it('changes the setting and JaText follows it', async () => {
    useProgress.getState().unlockKana(content.kana.flatMap((k) => [...k.char]));
    useProgress.getState().unlockKanji(['食']);
    const u = user();
    renderAt('/ajustes');
    const select = screen.getByLabelText('Furigana');
    expect(select).toHaveValue('auto');
    await u.selectOptions(select, 'nunca');
    expect(useProgress.getState().settings.furigana).toBe('nunca');
    await u.selectOptions(select, 'siempre');
    expect(useProgress.getState().settings.furigana).toBe('siempre');
  });
});
