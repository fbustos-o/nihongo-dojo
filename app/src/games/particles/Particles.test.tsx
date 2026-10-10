import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { content } from '../../domain/contentLoader';
import type { SentencePattern } from '../../domain/schema';
import { checkAnswer } from '../../engine';
import { itemKey } from '../../state/progressSchema';
import { useProgress } from '../../state/progressStore';
import { BASE_PARTICLES } from '../syntax/syntaxLogic';
import { PARTICLE_EXPLANATIONS, blankablePositions, makeBlank, particleEntries, particleOptions } from './particleLogic';
import { Particles } from './Particles';

const user = () => userEvent.setup({ delay: null });
const pattern = {
  id: 'p-go',
  title: 'test',
  lesson: 'P1',
  english: [],
  japanese: [],
  explanationEs: '',
  examples: [{ es: 'Voy a la estación.', ja: 'えき に いきます。', romaji: 'eki ni ikimasu.' }],
} as SentencePattern;

beforeEach(() => {
  useProgress.getState().resetProgress();
  useProgress.getState().unlockKana(content.kana.map((k) => k.char));
});

describe('particle logic', () => {
  it('blanks a particle and never the first token', () => {
    expect(blankablePositions(['わたし', 'は', 'みず', 'を', 'のみます'])).toEqual([1, 3]);
    const b = makeBlank('わたし は みず を のみます。', () => 0)!;
    expect(b).toMatchObject({ at: 1, answer: 'は' });
    expect(makeBlank('ごご よじ です。')).toBeNull();
    expect(makeBlank('これ は ほん ですか。', () => 0.99)!.answer).toBe('は');
  });

  it('offers the answer plus three distractors that cannot also be right', () => {
    for (let i = 0; i < 30; i++) {
      for (const answer of BASE_PARTICLES) {
        const options = particleOptions(answer);
        expect(options).toHaveLength(4);
        expect(options.filter((o) => o === answer)).toHaveLength(1);
        expect(new Set(options).size).toBe(4);
      }
    }
    expect(particleOptions('に')).not.toContain('へ');
  });

  it('strict comparison keeps は/わ and を/お apart', () => {
    expect(checkAnswer('わ', 'は', { strict: true }).correct).toBe(false);
    expect(checkAnswer('お', 'を', { strict: true }).correct).toBe(false);
    expect(checkAnswer('は', 'は', { strict: true }).correct).toBe(true);
  });

  it('every particle has a Spanish explanation and the content has plenty of blanks', () => {
    for (const p of BASE_PARTICLES) expect(PARTICLE_EXPLANATIONS[p]).toBeTruthy();
    expect(particleEntries(content.patterns).length).toBeGreaterThan(80);
  });
});

describe('particles game', () => {
  it('correct choice shows the sentence and the explanation, records the answer', async () => {
    const u = user();
    render(<Particles kana={[]} words={[]} patterns={[pattern]} rounds={1} />);
    expect(screen.getByRole('img', { name: 'hueco' })).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'に' }));
    expect(screen.getByTestId('explanation')).toHaveTextContent(PARTICLE_EXPLANATIONS['に']!);
    expect(screen.getByTestId('filled')).toHaveTextContent('に');
    expect(useProgress.getState().items[itemKey('pattern', 'particle:p-go:0')]).toMatchObject({ correct: 1, wrong: 0 });
  });

  it('wrong choice is disabled and counted; the right one must still be found', async () => {
    const u = user();
    render(<Particles kana={[]} words={[]} patterns={[pattern]} rounds={1} />);
    const wrong = screen.getAllByRole('button').find((b) => /^[はをでもの]$/.test(b.textContent ?? '') && b.textContent !== 'に')!;
    await u.click(wrong);
    expect(wrong).toBeDisabled();
    expect(screen.getByText(/Incorrecto/)).toBeInTheDocument();
    expect(screen.queryByTestId('explanation')).toBeNull();
    await u.click(screen.getByRole('button', { name: 'に' }));
    expect(screen.getByTestId('explanation')).toBeInTheDocument();
    expect(useProgress.getState().items[itemKey('pattern', 'particle:p-go:0')]).toMatchObject({ correct: 0, wrong: 1 });
  });
});
