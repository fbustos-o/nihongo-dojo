import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { content } from '../../domain/contentLoader';
import { useProgress } from '../../state/progressStore';
import { Conjugation } from './Conjugation';
import { formLabel, readingFor } from './conjugationLogic';

const user = () => userEvent.setup({ delay: null });
const word = (id: string) => content.vocab.find((w) => w.id === id)!;
const FORMS = ['masu', 'masen', 'mashita', 'masendeshita'] as const;

beforeEach(() => {
  useProgress.getState().resetProgress();
  useProgress.getState().unlockKana(content.kana.map((k) => k.char));
});

const currentForm = () => {
  const label = screen.getByTestId('form-label').textContent;
  return FORMS.find((f) => formLabel('verb', f) === label)!;
};

describe('conjugation quiz', () => {
  it('asks for a form of the lesson and accepts the right conjugation', async () => {
    const u = user();
    render(<Conjugation kana={[]} words={[word('taberu')]} lessonId="l-conj-masu" rounds={1} />);
    const form = currentForm();
    await u.type(screen.getByLabelText('Conjugación en kana'), `${readingFor(word('taberu'), 'verb', form).kana}{Enter}`);
    expect(screen.getByText(/¡Correcto!/)).toHaveTextContent('Grupo II');
    expect(useProgress.getState().items[`word:verb:taberu:${form}`]).toMatchObject({ correct: 1, wrong: 0 });
  });

  it('a wrong answer shows the right one with the rule and forces retyping', async () => {
    const u = user();
    const onFinish = vi.fn();
    render(<Conjugation kana={[]} words={[word('nomu')]} lessonId="l-conj-masu" rounds={1} onFinish={onFinish} />);
    const form = currentForm();
    await u.type(screen.getByLabelText('Conjugación en kana'), 'ああ{Enter}');
    expect(screen.getByText(/Incorrecto/)).toBeInTheDocument();
    expect(screen.getByTestId('correct-answer')).toHaveTextContent('Grupo I');
    expect(screen.getByTestId('correct-answer')).toHaveTextContent(readingFor(word('nomu'), 'verb', form).kana);
    expect(onFinish).not.toHaveBeenCalled();
    expect(useProgress.getState().items[`word:verb:nomu:${form}`]).toMatchObject({ correct: 0, wrong: 1 });
    await u.type(screen.getByLabelText('Conjugación en kana'), `${readingFor(word('nomu'), 'verb', form).kana}{Enter}`);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('only asks forms of the lesson (l-verbos-1: ます / ません)', async () => {
    render(<Conjugation kana={[]} words={[word('taberu')]} lessonId="l-verbos-1" rounds={5} />);
    expect(screen.getByTestId('form-label').textContent).toMatch(/^ます|^ません/);
  });

  it('free practice lets the learner pick the forms', async () => {
    const u = user();
    render(<Conjugation kana={[]} words={[word('taberu')]} />);
    expect(screen.getByRole('group', { name: 'Tipo de palabra' })).toBeInTheDocument();
    const fieldset = screen.getByRole('group', { name: 'Formas a practicar' });
    expect(fieldset).toBeInTheDocument();
    await u.click(screen.getByRole('checkbox', { name: /^Forma て$/ }));
    expect(screen.getByRole('checkbox', { name: /^Forma て$/ })).toBeChecked();
  });
});

describe('conjugation table mode', () => {
  const fillRow = async (u: ReturnType<typeof user>, id: string, lessonForms: readonly (typeof FORMS)[number][], wrongIndex = -1) => {
    const w = word(id);
    for (const [i, f] of lessonForms.entries()) {
      const input = screen.getByLabelText(`${w.kana}: ${formLabel('verb', f)}`);
      await u.type(input, i === wrongIndex ? 'ああ' : readingFor(w, 'verb', f).kana);
    }
  };

  it('fills the grid, checks a row and offers a new table once all rows are checked', async () => {
    const u = user();
    render(<Conjugation kana={[]} words={[word('taberu'), word('nomu')]} lessonId="l-verbos-1" rounds={20} />);
    await u.click(screen.getByRole('button', { name: 'Tabla' }));
    expect(screen.getByRole('button', { name: 'Tabla' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('conjugation-table')).toBeInTheDocument();
    await fillRow(u, 'taberu', ['masu', 'masen']);
    await fillRow(u, 'nomu', ['masu', 'masen'], 1);
    const buttons = screen.getAllByRole('button', { name: 'Comprobar fila' });
    expect(buttons).toHaveLength(2);
    // rows are shuffled: check whichever row holds each verb
    for (const b of buttons) await u.click(b);
    expect(screen.getAllByText('✓').length).toBe(3);
    expect(screen.getByText(/✗ のみません/)).toBeInTheDocument();
    expect(useProgress.getState().items['word:verb:taberu:masu']).toMatchObject({ correct: 1 });
    expect(useProgress.getState().items['word:verb:nomu:masen']).toMatchObject({ wrong: 1 });
    await u.click(screen.getByRole('button', { name: 'Nueva tabla' }));
    expect(screen.queryByText('✓')).toBeNull();
  });

  it('toggles back to the quiz', async () => {
    const u = user();
    render(<Conjugation kana={[]} words={[word('taberu')]} lessonId="l-conj-masu" rounds={5} />);
    await u.click(screen.getByRole('button', { name: 'Tabla' }));
    await u.click(screen.getByRole('button', { name: 'Preguntas' }));
    expect(screen.getByTestId('form-label')).toBeInTheDocument();
  });
});
