import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { content } from '../../domain/contentLoader';
import type { SentencePattern } from '../../domain/schema';
import { useProgress } from '../../state/progressStore';
import { MiniReading } from './MiniReading';
import { buildQuestions, makeReadingText, pickSentences, sentencesOf } from './readingLogic';

const user = () => userEvent.setup({ delay: null });
const examples = [
  { es: 'Yo bebo agua.', ja: 'わたし は みず を のみます。', romaji: 'a' },
  { es: 'Yo leo el periódico.', ja: 'わたし は しんぶん を よみます。', romaji: 'b' },
  { es: 'Yo compro un paraguas.', ja: 'わたし は かさ を かいます。', romaji: 'c' },
  { es: 'Yo veo televisión.', ja: 'わたし は テレビ を みます。', romaji: 'd' },
  { es: 'Yo escribo una carta.', ja: 'わたし は てがみ を かきます。', romaji: 'e' },
];
const pattern = { id: 'p-r', title: 't', lesson: 'P1', english: [], japanese: [], explanationEs: '', examples } as SentencePattern;

beforeEach(() => {
  useProgress.getState().resetProgress();
  useProgress.getState().unlockKana(content.kana.map((k) => k.char));
});

describe('reading logic', () => {
  it('assembles 4-6 distinct sentences from a pattern and 3 questions with one right option each', () => {
    const pool = sentencesOf(content.patterns);
    for (const p of content.patterns.filter((x) => sentencesOf([x]).length >= 4)) {
      const text = makeReadingText([p], pool)!;
      expect(text.sentences.length).toBeGreaterThanOrEqual(4);
      expect(text.sentences.length).toBeLessThanOrEqual(6);
      expect(new Set(text.sentences.map((s) => s.es)).size).toBe(text.sentences.length);
      expect(text.questions).toHaveLength(3);
      for (const q of text.questions) {
        expect(q.options.filter((o) => o.correct)).toHaveLength(1);
        expect(new Set(q.options.map((o) => o.text)).size).toBe(q.options.length);
        expect(q.options.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('returns null with fewer than four sentences and mixes patterns to reach four', () => {
    expect(pickSentences([{ ...pattern, examples: examples.slice(0, 2) } as SentencePattern])).toBeNull();
    const a = { ...pattern, id: 'a', examples: examples.slice(0, 2) } as SentencePattern;
    const b = { ...pattern, id: 'b', examples: examples.slice(2, 4) } as SentencePattern;
    expect(pickSentences([a, b])).toHaveLength(4);
  });

  it('distractors never repeat the right translation', () => {
    const s = sentencesOf([pattern]);
    const qs = buildQuestions(s, s);
    expect(qs[0]!.prompt).toMatch(/^¿Qué significa la frase \d\?$/);
    expect(qs[2]!.prompt).toMatch(/^¿Qué frase dice «/);
  });
});

function correctOption(): string {
  const prompt = screen.getByTestId('prompt').textContent!;
  const lines = within(screen.getByTestId('reading-text')).getAllByRole('listitem');
  const exampleAt = (li: HTMLElement) => examples.find((e) => li.textContent!.includes(e.ja.replace(/[\s。]/gu, '')) || li.textContent!.includes(e.ja.replace(/。/g, '').replace(/ /g, ' ')))!;
  const n = prompt.match(/frase (\d)/)?.[1];
  if (n && prompt.startsWith('¿Qué significa')) return exampleAt(lines[Number(n) - 1]!).es;
  const es = prompt.match(/«(.+)»/)![1]!;
  return `Frase ${lines.findIndex((li) => exampleAt(li).es === es) + 1}`;
}

describe('mini-reading game', () => {
  it('shows the text and answers three questions, recording each', async () => {
    const u = user();
    const onFinish = vi.fn();
    render(<MiniReading kana={[]} words={[]} patterns={[pattern]} rounds={3} onFinish={onFinish} />);
    expect(within(screen.getByTestId('reading-text')).getAllByRole('listitem').length).toBeGreaterThanOrEqual(4);
    for (let i = 0; i < 3; i++) {
      await u.click(screen.getByRole('button', { name: correctOption() }));
    }
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0]![0]).toMatchObject({ total: 3, correct: 3 });
  });

  it('a wrong option is disabled and counted as a mistake', async () => {
    const u = user();
    render(<MiniReading kana={[]} words={[]} patterns={[pattern]} rounds={3} />);
    const right = correctOption();
    const wrong = screen.getAllByRole('button').find((b) => b.className.includes('choice') && b.textContent !== right)!;
    await u.click(wrong);
    expect(wrong).toBeDisabled();
    expect(screen.getByText(/Incorrecto/)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: right }));
    const items = Object.values(useProgress.getState().items);
    expect(items.some((i) => i.wrong === 1)).toBe(true);
  });
});
