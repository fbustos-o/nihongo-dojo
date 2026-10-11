import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../App';
import { useProgress } from '../state/progressStore';
import type { ItemState } from '../state/progressSchema';

const user = () => userEvent.setup({ delay: null });
const renderAt = async (path: string) => {
  const result = render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
  await waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument());
  return result;
};
const item = (kind: ItemState['kind'], itemId: string, extra: Partial<ItemState> = {}): ItemState => ({
  kind,
  itemId,
  srsStage: 1,
  correct: 0,
  wrong: 0,
  lastSeen: 1,
  nextDue: 0,
  weight: 1,
  ...extra,
});
const setItems = (list: ItemState[]) => useProgress.setState({ items: Object.fromEntries(list.map((i) => [`${i.kind}:${i.itemId}`, i])) });

beforeEach(() => useProgress.getState().resetProgress());

describe('MemoryPage', () => {
  it('shows a friendly empty state', async () => {
    await renderAt('/memoria/guru');
    expect(screen.getByTestId('memory-empty')).toHaveTextContent(/Todavía no tienes ítems en Guru/);
  });

  it('lists the items of the group with type, stage, accuracy and next review', async () => {
    setItems([
      item('kana', 'あ', { srsStage: 2, correct: 3, wrong: 1, nextDue: Date.now() + 3 * 3_600_000 + 60_000 }),
      item('word', 'number:416', { srsStage: 1, nextDue: 0 }),
      item('word', 'time:4:30', { srsStage: 6 }),
    ]);
    await renderAt('/memoria/aprendiz');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Aprendiz');
    const rows = screen.getAllByTestId('memory-row');
    expect(rows).toHaveLength(2);
    const text = rows.map((r) => r.textContent).join('|');
    expect(text).toContain('Aprendiz 2');
    expect(text).toContain('75%');
    expect(text).toContain('en 3 h');
    expect(text).toContain('vencido');
    expect(text).toContain('416');
    expect(text).not.toContain('4:30');
  });

  it('filters by type and sorts', async () => {
    setItems([item('kana', 'あ', { nextDue: 5 }), item('kana', 'い', { nextDue: 1 }), item('word', 'number:7', { nextDue: 3 })]);
    const u = user();
    await renderAt('/memoria/aprendiz');
    const order = () => screen.getAllByTestId('memory-row').map((r) => r.textContent ?? '');
    expect(order()[0]).toContain('ii'); // unlocked-aware: unknown kana show as romaji (+ the romaji detail)
    await u.selectOptions(screen.getByLabelText('Tipo'), 'number');
    expect(screen.getAllByTestId('memory-row')).toHaveLength(1);
    await u.selectOptions(screen.getByLabelText('Tipo'), 'all');
    await u.selectOptions(screen.getByLabelText('Ordenar por'), 'name');
    expect(order()[0]).toContain('7');
  });

  it('reveals the absolute date on tap', async () => {
    setItems([item('kana', 'あ', { nextDue: new Date(2030, 4, 1, 10, 0).getTime() })]);
    const u = user();
    await renderAt('/memoria/aprendiz');
    const row = screen.getByTestId('memory-row');
    await u.click(within(row).getByRole('button'));
    expect(within(row).getByText(/2030/)).toBeInTheDocument();
  });

  it('redirects unknown groups home', async () => {
    await renderAt('/memoria/xyz');
    expect(screen.getByTestId('due-total')).toBeInTheDocument();
  });
});

describe('Dashboard SRS cards and help', () => {
  it('links every card to its memory page', async () => {
    setItems([item('kana', 'あ'), item('kana', 'い', { srsStage: 5 })]);
    await renderAt('/');
    expect(screen.getByRole('link', { name: /Aprendiz: 1/ })).toHaveAttribute('href', '/memoria/aprendiz');
    expect(screen.getByRole('link', { name: /Guru: 1/ })).toHaveAttribute('href', '/memoria/guru');
    expect(screen.getByRole('link', { name: /Quemado: 0/ })).toHaveAttribute('href', '/memoria/quemado');
    await user().click(screen.getByRole('link', { name: /Guru: 1/ }));
    expect(await screen.findByRole('heading', { level: 1, name: /Guru/ })).toBeInTheDocument();
  });

  it('opens and closes the help dialog with the keyboard', async () => {
    const u = user();
    await renderAt('/memoria/aprendiz');
    const button = screen.getByRole('button', { name: /Ayuda/ });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await u.click(button);
    const dialog = screen.getByRole('dialog', { name: /Cómo funciona/ });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByText('Aprendiz 1')).toBeInTheDocument();
    expect(within(dialog).getByText('a los 4 horas')).toBeInTheDocument();
    expect(dialog).toHaveTextContent(/furigana/i);
    expect(within(dialog).getByRole('button', { name: 'Cerrar' })).toHaveFocus();
    await u.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it('shows the help on the dashboard too', async () => {
    const u = user();
    await renderAt('/');
    await u.click(screen.getByRole('button', { name: /Ayuda/ }));
    await u.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
