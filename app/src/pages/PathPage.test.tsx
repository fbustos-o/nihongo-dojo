import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { useProgress } from '../state/progressStore';
import { PathPage } from './PathPage';

// Synthetic five-stage curriculum (stage 5 does not need real data).
vi.mock('../domain/contentLoader', () => {
  const lesson = (id: string, stage: 1 | 2 | 3 | 4 | 5, requires: string[] = []) => ({
    id,
    stage,
    title: `Lección ${id}`,
    titleEn: `Lesson ${id}`,
    requires,
    games: ['kana-recognize'],
  });
  return {
    content: {
      curriculum: [
        lesson('a1', 1),
        lesson('a2', 1, ['a1']),
        lesson('b1', 2, ['a2']),
        lesson('c1', 3, ['b1']),
        lesson('d1', 4, ['c1']),
        lesson('e1', 5, ['a2']),
        lesson('e2', 5, ['e1']),
      ],
    },
  };
});

const renderPath = () =>
  render(
    <MemoryRouter>
      <PathPage />
    </MemoryRouter>,
  );

beforeEach(() => {
  localStorage.clear();
  useProgress.getState().resetProgress();
});

describe('PathPage with five stages', () => {
  it('shows every stage with its title, locked nodes and the requirement hint', () => {
    renderPath();
    for (const name of ['1. Hiragana', '2. Gramática en hiragana', '3. Katakana', '4. Kanji', '5. Vocabulario esencial']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: /Lección a1.*Siguiente lección/ })).toHaveAttribute('aria-current', 'step');
    expect(screen.getAllByText('Bloqueada').length).toBe(6);
    expect(screen.getByText('requiere: Lección e1')).toBeInTheDocument();
  });

  it('folds a finished stage by default and remembers a manual toggle', async () => {
    useProgress.setState({ completedLessons: ['a1', 'a2'] });
    renderPath();
    expect(screen.queryByRole('link', { name: /Lección a1/ })).toBeNull();
    const expand = screen.getByRole('button', { name: 'Desplegar Hiragana' });
    expect(expand).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(expand);
    expect(screen.getByText('Lección a1')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('nihongo-dojo:path-collapsed') ?? '{}')).toEqual({ 1: false });
    expect(screen.getByRole('button', { name: 'Plegar Hiragana' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('«requires» uses the interface language (QA-104)', () => {
    useProgress.setState((s) => ({ settings: { ...s.settings, uiLang: 'en' } }));
    renderPath();
    expect(screen.getByText('requires: Lesson e1')).toBeInTheDocument();
  });

  it('«Ir a la lección actual» unfolds the current stage and focuses the lesson (QA-110)', async () => {
    useProgress.setState({ completedLessons: ['a1'] });
    localStorage.setItem('nihongo-dojo:path-collapsed', JSON.stringify({ 1: true }));
    renderPath();
    expect(screen.queryByRole('link', { name: /Lección a2/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Ir a la lección actual/ }));
    expect(screen.getByRole('link', { name: /Lección a2/ })).toHaveFocus();
  });
});
