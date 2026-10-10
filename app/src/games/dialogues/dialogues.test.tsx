import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { content } from '../../domain/contentLoader';
import { itemKey } from '../../state/progressSchema';
import { useProgress } from '../../state/progressStore';
import { Dialogues } from './Dialogues';
import { eligibleDialogues, hasRoleLine, listenTargets, nextRoleLine, replyOptions } from './dialoguesLogic';

const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const user = () => userEvent.setup({ delay: null });
const dlg = (id: string) => content.dialogues.find((d) => d.id === id)!;
beforeEach(() => {
  useProgress.getState().resetProgress();
  useProgress.getState().unlockKana(content.kana.map((k) => k.char));
});

describe('dialogue logic', () => {
  it('replyOptions: the correct line plus distinct distractors of the same speaker', () => {
    const d = dlg('restaurante-cuenta');
    for (let seed = 1; seed < 20; seed++) {
      const options = replyOptions(d, 1, content.dialogues, seeded(seed));
      expect(options).toHaveLength(4);
      expect(options.filter((o) => o.correct)).toHaveLength(1);
      expect(options.find((o) => o.correct)!.line).toBe(d.lines[1]);
      expect(new Set(options.map((o) => o.line.ja.replace(/\s+/g, ''))).size).toBe(4);
      expect(options.every((o) => o.line.speaker === 'B')).toBe(true);
    }
  });

  it('finds the learner lines and listening targets', () => {
    const d = dlg('restaurante-cuenta');
    expect(nextRoleLine(d.lines, 0, 'B')).toBe(1);
    expect(nextRoleLine(d.lines, 6, 'B')).toBe(d.lines.length);
    expect(listenTargets(d, 'B')).toEqual([0, 2, 4]);
    expect(hasRoleLine(d, 'A')).toBe(true);
  });

  it('eligibleDialogues: explicit ids, else by words, else everything', () => {
    expect(eligibleDialogues(content.dialogues, content.curriculum, [], ['como-llegar']).map((d) => d.id)).toEqual(['como-llegar']);
    expect(eligibleDialogues(content.dialogues, content.curriculum, [])).toHaveLength(content.dialogues.length);
    const words = content.vocab;
    expect(eligibleDialogues(content.dialogues, content.curriculum, words).length).toBeGreaterThan(5);
  });
});

describe('Dialogues game', () => {
  const lineButton = (ja: string) => screen.getByRole('button', { name: new RegExp(ja.replace(/\s+/g, '\\s*').replace(/[。？、]/g, '')) });

  it('plays the learner turns: wrong then right, scoring the first try, then the listening round', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const d = dlg('restaurante-cuenta');
    const onFinish = vi.fn();
    render(<Dialogues kana={[]} words={[]} dialogueIds={[d.id]} rounds={4} onFinish={onFinish} />);

    // Turn 1 (line 1): the chat already shows the first line (partner).
    const chat = screen.getByRole('list', { name: 'Conversación' });
    expect(within(chat).getAllByRole('listitem')).toHaveLength(1);
    const group = screen.getByRole('group', { name: 'Respuestas posibles' });
    const buttons = within(group).getAllByRole('button');
    expect(buttons.length).toBe(4);
    const wrong = buttons.find((b) => !b.textContent!.includes('さんぜんろっぴゃくえん'))!;
    await user().click(wrong);
    expect(wrong).toBeDisabled();
    expect(screen.getByText(/Incorrecto/)).toBeInTheDocument();
    await user().click(lineButton(d.lines[1]!.ja.split('。')[0]!));
    expect(useProgress.getState().items[itemKey('dialogue', `dialogue:${d.id}:1`)]).toMatchObject({ correct: 0, wrong: 1 });

    // Turn 2 (line 3) and 3 (line 5), both right.
    for (const i of [3, 5]) {
      await user().click(lineButton(d.lines[i]!.ja.split('。')[0]!.split('、')[0]!));
      expect(useProgress.getState().items[itemKey('dialogue', `dialogue:${d.id}:${i}`)]).toMatchObject({ correct: 1, wrong: 0 });
    }

    // Finished → listening round.
    expect(screen.getByText('Fin del diálogo.')).toBeInTheDocument();
    await user().click(screen.getByRole('button', { name: 'Escucha y responde' }));
    expect(screen.getByText(/Escucha y elige la respuesta/)).toBeInTheDocument();
    await user().click(lineButton(d.lines[1]!.ja.split('。')[0]!));
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0]![0]).toMatchObject({ total: 4, correct: 3 });
    vi.restoreAllMocks();
  });

  it('translation is hidden until toggled', async () => {
    render(<Dialogues kana={[]} words={[]} dialogueIds={['como-llegar']} rounds={10} />);
    const es = dlg('como-llegar').lines[0]!.es;
    expect(screen.queryByText(es)).not.toBeInTheDocument();
    await user().click(screen.getByLabelText('Mostrar traducción'));
    expect(screen.getByText(es)).toBeInTheDocument();
  });

  it('shows romaji only when the setting is on', () => {
    useProgress.getState().updateSettings({ showRomaji: false });
    const first = dlg('como-llegar').lines[0]!.romaji;
    const { unmount } = render(<Dialogues kana={[]} words={[]} dialogueIds={['como-llegar']} rounds={10} />);
    expect(screen.queryByText(first)).not.toBeInTheDocument();
    unmount();
    useProgress.getState().updateSettings({ showRomaji: true });
    render(<Dialogues kana={[]} words={[]} dialogueIds={['como-llegar']} rounds={10} />);
    expect(screen.getByText(first)).toBeInTheDocument();
  });

  it('free practice lets the learner pick the role', async () => {
    render(<Dialogues kana={[]} words={[]} dialogueIds={['como-llegar']} />);
    await user().click(screen.getByRole('button', { name: 'Hablo como A' }));
    expect(screen.getByText('Tu turno: ¿qué respondes?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Terminar' })).toBeInTheDocument();
  });
});
